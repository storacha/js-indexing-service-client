import { base58btc } from 'multiformats/bases/base58'
import { error } from '@ucanto/core'
import * as QueryResult from './query-result.js'
import { InvalidQueryError, NetworkError } from './errors.js'

/** @import { IndexingServiceClient, Result, Query, QueryOk, QueryError } from './api.js' */

const SERVICE_URL = 'https://indexing.storacha.network'
const CLAIMS_PATH = '/claims'

/** @implements {IndexingServiceClient} */
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
   * @returns {Promise<Result<QueryOk, QueryError>>}
   */
  async queryClaims({ hashes = [], match = { subject: [] } }) {
    const url = new URL(CLAIMS_PATH, this.#serviceURL)
    hashes.forEach((hash) =>
      url.searchParams.append('multihash', base58btc.encode(hash.bytes))
    )
    match.subject.forEach((space) => url.searchParams.append('spaces', space))

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

    return QueryResult.extract(new Uint8Array(await response.arrayBuffer()))
  }
}
