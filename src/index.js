import * as CBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { base58btc } from 'multiformats/bases/base58'
import { z } from 'zod'
import { ok, error } from '@ucanto/core'
import * as CAR from '@ucanto/core/car'
import * as Delegation from '@ucanto/core/delegation'
import * as ShardedDAGIndex from '@storacha/blob-index/sharded-dag-index'
import { InvalidQueryError, NetworkError, UnknownFormatError, DecodeError } from './errors.js'

/** @import { Result, Link, Query, QueryOk, QueryError } from './api.js' */

const SERVICE_URL = 'https://indexing.storacha.network'
const CLAIMS_PATH = '/claims'

const QueryResult = z
  .object({
    'index/query/result@0.1': z.object({
      claims: z
        .array(
          z.instanceof(CID).transform(cid => /** @type {Link} */ (cid))
        ),
      indexes: z
        .record(z.string(), z.instanceof(CID))
        .transform((record) => Object.values(record)),
    }),
  })
  .transform((object) => object['index/query/result@0.1'])

export class Client {
  #fetch
  #serviceURL

  /**
   * @param {object} [options]
   * @param {URL} [options.serviceURL]
   * @param {typeof globalThis.fetch} [options.fetch]
   */
  constructor (options) {
    this.#serviceURL = options?.serviceURL ?? new URL(SERVICE_URL)
    /** @type {typeof globalThis.fetch} */
    this.#fetch = options?.fetch ?? globalThis.fetch.bind(globalThis)
  }

  /**
   * @param {Query} query
   * @param {object} [options]
   * @param {typeof fetch} options.fetch
   * @returns {Promise<Result<QueryOk, QueryError>>}
   */
  async queryClaims({ hashes = [], match = { subject: [] } }) {
    const url = new URL(CLAIMS_PATH, this.#serviceURL)
    hashes.forEach((hash) =>
      url.searchParams.append('multihash', base58btc.encode(hash.bytes))
    )
    match.subject.forEach((space) =>
      url.searchParams.append('spaces', space.did())
    )

    if (!hashes.length) {
      return error(new InvalidQueryError('missing multihashes in query'))
    }

    const response = await this.#fetch(url)
    if (!response.ok) {
      return error(new NetworkError(`unexpected status: ${response.status}`))
    }
    if (!response.body) {
      return error(new NetworkError('missing response body'))
    }

    const { roots, blocks } = CAR.decode(new Uint8Array(await response.arrayBuffer()))
    if (roots.length !== 1) {
      return error(new DecodeError('expected exactly one root'))
    }

    let parsed
    try {
      parsed = QueryResult.parse(await CBOR.decode(roots[0].bytes))
    } catch (/** @type {any} */ err) {
      return error(new UnknownFormatError(`parsing root block: ${err.message}`))
    }

    const claims = new Map()
    for (const root of parsed.claims) {
      let claim
      try {
        claim = Delegation.view({ root, blocks })
      } catch (/** @type {any} */ err) {
        return error(new DecodeError(`decoding claim: ${root}: ${err.message}`))
      }
      claims.set(root.toString(), claim)
    }

    const indexes = new Map()
    for (const link of parsed.indexes) {
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

    return ok({
      root: roots[0],
      iterateIPLDBlocks: () => blocks.values(),
      claims,
      indexes
    })
  }
}
