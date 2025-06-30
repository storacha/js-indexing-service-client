import { base58btc } from 'multiformats/bases/base58'
import { error } from '@ucanto/core'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { index, equals } from '@storacha/capabilities/assert'
import { parse as parseDID } from '@ipld/dag-ucan/did'
import * as QueryResult from './query-result.js'
import { InvalidQueryError, NetworkError } from './errors.js'

/** @import { IndexingService, IndexingServiceClient, Result, Query, QueryOk, QueryError, Signer, AssertEquals, AssertIndex, ConnectionView, Principal, UCANOptions } from './api.js' */

const SERVICE_DID = 'did:web:indexer.storacha.network'
const SERVICE_URL = 'https://indexer.storacha.network'
const CLAIMS_PATH = '/claims'

/** @implements {IndexingServiceClient} */
export class Client {
  /** @type {typeof globalThis.fetch} */
  #fetch
  #serviceURL
  /** @type {ConnectionView<IndexingService>} */
  #conn

  /**
   * @param {object} [options]
   * @param {Principal} [options.servicePrincipal]
   * @param {URL} [options.serviceURL]
   * @param {typeof globalThis.fetch} [options.fetch]
   * @param {Record<string, string>} [options.headers]
   * @param {ConnectionView<IndexingService>} [options.connection]
   */
  constructor({
    servicePrincipal,
    serviceURL = new URL(SERVICE_URL),
    fetch = globalThis.fetch.bind(globalThis),
    headers,
    connection
  } = {}) {
    this.#serviceURL = serviceURL
    this.#fetch = fetch
    this.#conn = connection ?? connect({
      id: servicePrincipal ?? parseDID(SERVICE_DID),
      codec: CAR.outbound,
      channel: HTTP.open({ url: serviceURL, fetch, headers })
    })
  }

  /**
   * @param {Query} query
   * @returns {Promise<Result<QueryOk, QueryError>>}
   */
  async queryClaims({ hashes = [], match = { subject: [] }, kind = "standard" }) {
    const url = new URL(CLAIMS_PATH, this.#serviceURL)
    hashes.forEach((hash) =>
      url.searchParams.append('multihash', base58btc.encode(hash.bytes))
    )
    match.subject.forEach((space) => url.searchParams.append('spaces', space))
    url.searchParams.append('kind', kind)

    if (!hashes.length) {
      return error(new InvalidQueryError('missing multihashes in query'))
    }

    let response
    try {
      response = await this.#fetch(url)
      if (!response.ok) {
        return error(new NetworkError(`unexpected status: ${response.status}`))
      }
      if (!response.body) {
        return error(new NetworkError('missing response body'))
      }

      return QueryResult.extract(new Uint8Array(await response.arrayBuffer()))
    } catch (/** @type {any} */ err) {
      return error(new NetworkError(err.message ?? 'fetch failed'))
    }
  }

  /**
   * @param {Signer} issuer
   * @param {AssertIndex['nb']} params
   * @param {Omit<UCANOptions, 'audience'>} [options]
   */
  async publishIndexClaim(issuer, params, options) {
    return index.invoke({
      issuer,
      audience: this.#conn.id,
      with: this.#conn.id.did(),
      nb: params,
      ...options
    }).execute(this.#conn)
  }

  /**
   * @param {Signer} issuer
   * @param {AssertEquals['nb']} params
   * @param {Omit<UCANOptions, 'audience'>} [options]
   */
  async publishEqualsClaim(issuer, params, options) {
    return equals.invoke({
      issuer,
      audience: this.#conn.id,
      with: this.#conn.id.did(),
      nb: params,
      ...options
    }).execute(this.#conn)
  }
}
