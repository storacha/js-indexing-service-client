import { CarReader } from '@ipld/car'
import * as CBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { bases } from 'multiformats/basics'
import { z } from 'zod'

/**
 * @import { Block, Query } from './bindings.js'
 */

const SERVICE_URL = 'https://indexing.storacha.network'
const CLAIMS_PATH = '/claims'

const QueryResult = z
  .object({
    'index/query/result@0.1': z.object({
      claims: z.array(z.instanceof(CID)),
      indexes: z
        .record(z.string(), z.instanceof(CID))
        .transform((record) => Object.values(record)),
    }),
  })
  .transform((object) => object['index/query/result@0.1'])

export class Client {
  /**
   * @param {Query} query
   * @param {object} [options]
   * @param {typeof fetch} options.fetch
   */
  async queryClaims(
    { hashes = [], match = { subject: [] } },
    { fetch } = { fetch: globalThis.fetch }
  ) {
    const url = new URL(CLAIMS_PATH, SERVICE_URL)
    hashes.forEach((hash) =>
      url.searchParams.append('multihash', bases.base58btc.encode(hash.bytes))
    )
    match.subject.forEach((space) =>
      url.searchParams.append('spaces', space.did())
    )

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error('TK unexpected response')
    }

    const reader = await CarReader.fromBytes(
      new Uint8Array(await response.arrayBuffer())
    )
    const roots = await reader.getRoots()
    if (roots.length !== 1) {
      throw new Error('TK expected exactly one root')
    }
    const rootBlock = await reader.get(roots[0])
    const parsed = QueryResult.parse(await CBOR.decode(rootBlock.bytes))
    return {
      claims: await dereferenceLinks(parsed.claims, reader),
      indexes: await dereferenceLinks(parsed.indexes, reader),
    }
  }
}

/**
 * @param {CID[]} links
 * @param {CarReader} reader
 */
const dereferenceLinks = async (links, reader) =>
  await Promise.all(
    links.map(async (cid) => {
      /** @type {Block | undefined} */
      const block = await reader.get(cid)
      if (!block) {
        throw new Error('TK expected block')
      }
      return block.bytes
    })
  )
