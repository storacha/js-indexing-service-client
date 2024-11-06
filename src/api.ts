import { MultihashDigest, Link } from 'multiformats'
import { Delegation, Failure, Result, Principal, IPLDView } from '@ucanto/interface'
import { DecodeFailure, ShardedDAGIndex, UnknownFormat } from '@storacha/blob-index/types'

export { MultihashDigest, Link }
export { Delegation, Failure, Result }
export { DecodeFailure, ShardedDAGIndex, UnknownFormat }

/**
 * Match narrows parameters for locating providers/claims for a set of multihashes.
 */
export interface Match {
  subject: Principal[]
}

/**
 * Query is a query for several multihashes.
 */
export interface Query {
  hashes: MultihashDigest[]
  match?: Match
}

export interface QueryOk extends IPLDView {
  claims: Map<string, Delegation>
  indexes: Map<string, ShardedDAGIndex>
}

export type QueryError =
  | InvalidQuery
  | NetworkError
  | DecodeFailure
  | UnknownFormat

export interface InvalidQuery extends Failure {
  name: 'InvalidQuery'
}

export interface NetworkError extends Failure {
  name: 'NetworkError'
}
