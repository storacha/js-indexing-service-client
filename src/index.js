import { base58btc } from 'multiformats/bases/base58'
import { error } from '@ucanto/core'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { index, equals } from '@storacha/capabilities/assert'
import { parse as parseDID } from '@ipld/dag-ucan/did'
import * as QueryResult from './query-result.js'
import { 
  InvalidQueryError, 
  NetworkError,
  NetworkTimeoutError,
  NetworkConnectionError,
  ServerError,
  ClientError,
  withRetry,
  DEFAULT_RETRY_OPTIONS 
} from './errors.js'

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
   * @param {Partial<import('./errors.js').RetryOptions>} [options.retry]
   */
  constructor({
    servicePrincipal,
    serviceURL = new URL(SERVICE_URL),
    fetch = globalThis.fetch.bind(globalThis),
    headers,
    connection,
    retry = {}
  } = {}) {
    this.#serviceURL = serviceURL
    this.#fetch = fetch
    this.#conn = connection ?? connect({
      id: servicePrincipal ?? parseDID(SERVICE_DID),
      codec: CAR.outbound,
      channel: HTTP.open({ url: serviceURL, fetch, headers })
    })
    this.retryOptions = { ...DEFAULT_RETRY_OPTIONS, ...retry }
  }

  /**
   * @param {Query} query
   * @returns {Promise<Result<QueryOk, QueryError>>}
   */
  async queryClaims({ hashes = [], match = { subject: [] }, kind = "standard" }) {
    if (!hashes.length) {
      return error(new InvalidQueryError('missing multihashes in query'))
    }

    const url = new URL(CLAIMS_PATH, this.#serviceURL)
    hashes.forEach((hash) =>
      url.searchParams.append('multihash', base58btc.encode(hash.bytes))
    )
    match.subject.forEach((space) => url.searchParams.append('spaces', space))
    url.searchParams.append('kind', kind)

    try {
      const response = await withRetry(async () => {
        try {
          const response = await this.#fetch(url)
          
          // Handle different HTTP status codes with specific errors
          if (!response.ok) {
            if (response.status >= 500) {
              throw new ServerError(response.status)
            } else if (response.status >= 400) {
              throw new ClientError(response.status)
            }
          }
          
          if (!response.body) {
            throw new NetworkError('missing response body')
          }
          
          return response
        } catch (err) {
          // Convert fetch errors to our custom error types
          if (err instanceof Error) {
            if (err.name === 'AbortError') {
              throw new NetworkTimeoutError()
            } else if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
              throw new NetworkConnectionError()
            } else if (!(err instanceof NetworkError)) {
              // Wrap unknown errors in NetworkError
              throw new NetworkError(err.message ?? 'fetch failed')
            }
          }
          throw err
        }
      }, this.retryOptions)

      return QueryResult.extract(new Uint8Array(await response.arrayBuffer()))
    } catch (err) {
      // At this point, all errors should be instances of NetworkError or its subclasses
      return error(err instanceof NetworkError ? err : new NetworkError('unknown error occurred'))
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
