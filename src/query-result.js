/** @import * as API from './api.js' */
import * as CBOR from '@ipld/dag-cbor'
import { create as createLink } from 'multiformats/link'
import { ok, error, Schema } from '@ucanto/core'
import * as CAR from '@ucanto/core/car'
import * as ShardedDAGIndex from '@storacha/blob-index/sharded-dag-index'
import { UnknownFormatError, DecodeError } from './errors.js'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Claim from './claim.js'

export const version = 'index/query/result@0.1'

export const QueryResultSchema = Schema.variant({
  [version]: Schema.struct({
    /** claims map */
    claims: Schema.array(Schema.link()).optional(),
    /** Shards the DAG can be found in. */
    indexes: Schema.dictionary({ value: Schema.link() }).optional(),
  }),
})

/**
 * @param {{ root: API.Link, blocks: Map<string, API.IPLDBlock> }} arg
 * @returns {Promise<API.Result<API.QueryResult, API.DecodeFailure|API.UnknownFormat>>}
 */
export const create = async ({ root, blocks }) => {
  const rootBlock = blocks.get(root.toString())
  if (!rootBlock) {
    return error(new DecodeError(`missing root block: ${root}`))
  }
  return view({ root: rootBlock, blocks })
}

/**
 * @param {{ root: API.IPLDBlock, blocks: Map<string, API.IPLDBlock> }} arg
 * @returns {Promise<API.Result<API.QueryResult, API.DecodeFailure|API.UnknownFormat>>}
 */
export const view = async ({ root, blocks }) => {
  let parsed
  let localVersion
  try {
    [localVersion, parsed] = QueryResultSchema.match(CBOR.decode(root.bytes))
  } catch (/** @type {any} */ err) {
    return error(new UnknownFormatError(`parsing root block: ${err.message}`))
  }

  switch (localVersion) {
    case version:
      const claims = new Map()
      for (const root of parsed.claims ?? []) {
        let claim
        try {
          claim = Claim.view({
            root: /** @type {API.UCANLink} */ (root),
            blocks
          })
        } catch (/** @type {any} */ err) {
          return error(new DecodeError(`decoding claim: ${root}: ${err.message}`))
        }
        claims.set(root.toString(), claim)
      }
    

    const indexes = new Map()
    for (const link of Object.values(parsed.indexes ?? [])) {
      const block = blocks.get(link.toString())
      if (!block) {
        return error(new DecodeError(`missing index: ${link}`))
      }
      const { ok: index, error: err } = ShardedDAGIndex.extract(block.bytes)
      if (!index) {
        return error(new DecodeError(`extracting index: ${link}: ${err.message}`))
      } 
      indexes.set(link.toString(), index)
    }

    return ok(new QueryResult({ root, blocks, data: { claims, indexes } }))

    default:
      return error(new UnknownFormatError(`unknown query result version: ${localVersion}`))
  }
  
}

/**
 * @typedef {string} ContextID
 * @param {{
 *   claims?: API.Claim[]
 *   indexes?: Map<ContextID, API.ShardedDAGIndexView>
 * }} param
 * @returns {Promise<API.Result<API.QueryResult, API.EncodeFailure>>}
 */
export const from = async ({ claims, indexes }) => {
  try {
    const blocks = new Map()
    const rootData = {
      'index/query/result@0.1': {
        claims: /** @type {API.Link[]} **/ ([]),
        indexes: /** @type {Record<string, API.Link>} */ ({})
      }
    }
    const data = { claims: new Map(), indexes: new Map() }

    if (claims) {
      for (const claim of claims) {
        rootData['index/query/result@0.1'].claims.push(claim.delegation().link())
        for (const block of claim.delegation().iterateIPLDBlocks()) {
          blocks.set(block.cid.toString(), block)
        }
        data.claims.set(claim.delegation().link().toString(), claim)
      }
    }

    if (indexes) {
      for (const [contextID, index] of indexes.entries()) {
        const result = await index.archive()
        if (!result.ok) {
          return result
        }
        const digest = await sha256.digest(result.ok)
        const link = createLink(CAR.code, digest)
        rootData['index/query/result@0.1'].indexes[contextID] = link
        blocks.set(link.toString(), { cid: link, bytes: result.ok })
        data.indexes.set(link.toString(), index)
      }
    }

    const rootBytes = CBOR.encode(rootData)
    const rootDigest = await sha256.digest(rootBytes)
    const rootLink = createLink(CBOR.code, rootDigest)
    const root = { cid: rootLink, bytes: rootBytes }
    blocks.set(rootLink.toString(), root)

    return ok(new QueryResult({ root, blocks, data }))
  } catch (/** @type {any} */ err) {
    return error(/** @type {API.EncodeFailure} */ ({
      name: 'EncodeFailure',
      message: `encoding DAG: ${err.message}`,
      stack: err.stack
    }))
  }
}

class QueryResult {
  #root
  #blocks
  #data

  /**
   * @param {{
   *   root: API.IPLDBlock
   *   blocks: Map<string, API.IPLDBlock>
   *   data: {
   *     claims: Map<string, API.Claim>
   *     indexes: Map<string, API.ShardedDAGIndex>
   *   }
   * }} param
   */
  constructor ({ root, blocks, data }) {
    this.#root = root
    this.#blocks = blocks
    this.#data = data
  }

  get root () {
    return this.#root
  }

  iterateIPLDBlocks () {
    return this.#blocks.values()
  }

  get claims () {
    return this.#data.claims
  }

  get indexes () {
    return this.#data.indexes
  }

  archive () {
    return archive(this)
  }
}

/**
 * @param {API.QueryResult} result
 * @returns {Promise<API.Result<Uint8Array, API.EncodeFailure>>}
 */
export const archive = async (result) => {
  try {
    const blocks = new Map()
    for (const block of result.iterateIPLDBlocks()) {
      blocks.set(block.cid.toString(), block)
    }
    return ok(CAR.encode({ roots: [result.root], blocks }))
  } catch (/** @type {any} */ err) {
    return error(/** @type {API.EncodeFailure} */ ({
      name: 'EncodeFailure',
      message: `encoding CAR: ${err.message}`,
      stack: err.stack
    }))
  }
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<API.Result<API.QueryResult, API.DecodeFailure|API.UnknownFormat>>}
 */
export const extract = async (bytes) => {
  const { roots, blocks } = CAR.decode(bytes)
  if (roots.length !== 1) {
    return error(new DecodeError('expected exactly one root'))
  }
  return view({ root: roots[0], blocks })
}
