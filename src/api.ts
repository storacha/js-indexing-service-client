import { MultihashDigest, Link } from 'multiformats'
import { Delegation, Failure, Result, Principal, IPLDView, IPLDBlock } from '@ucanto/interface'
import { DecodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat } from '@storacha/blob-index/types'

export { MultihashDigest, Link }
export { Delegation, Failure, Result, Principal, IPLDView, IPLDBlock }
export { DecodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat }

export interface IndexingServiceClient {
  queryClaims (q: Query): Promise<Result<QueryOk, QueryError>>
}

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

export interface QueryOk extends QueryResult {}

export interface QueryResult extends IPLDView {
  claims: Map<string, Delegation>
  indexes: Map<string, ShardedDAGIndex>
  archive (): Promise<Result<Uint8Array>>
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
