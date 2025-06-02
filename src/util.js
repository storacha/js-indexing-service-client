import { error } from '@ucanto/core'
import * as QueryResult from './query-result.js'

/** @import { IndexingServiceClient, QueryError } from './api.js' */

/**
 * Combines the passed clients into a single client. When querying claims, error
 * responses are ignored unless ALL clients return an error. If all clients
 * return an error then the first error encountered is returned.
 *
 * @param {IndexingServiceClient[]} clients
 * @returns {IndexingServiceClient}
 */
export const combine = (clients) => {
  if (!clients.length) {
    throw new Error('missing indexing service clients')
  }
  return {
    async queryClaims (q) {
      const results = await Promise.all(clients.map(c => c.queryClaims(q)))
      const claims = []
      const indexes = new Map()
      const errors = []
      for (const res of results) {
        if (res.error) {
          errors.push(res.error)
          continue
        }
        for (const [, v] of res.ok.claims) {
          claims.push(v)
        }
        for (const [k, v] of res.ok.indexes) {
          indexes.set(k, v)
        }
      }
      if (errors.length === results.length) {
        return results[0]
      }
      const fromRes = await QueryResult.from({ claims, indexes })
      if (fromRes.error) {
        // shoud not happen - we already decoded so re-encoding should work
        return error(/** @type {QueryError} */ ({
          ...fromRes.error,
          name: 'UnknownFormat',
          message: `failed to combine results: ${fromRes.error.message}`
        }))
      }
      return fromRes
    }
  }
}
