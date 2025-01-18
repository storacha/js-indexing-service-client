import { MultihashDigest, Link } from 'multiformats'
import { Delegation, Failure, Result, DID, IPLDView, IPLDBlock } from '@ucanto/interface'
import { DecodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat } from '@storacha/blob-index/types'
import { Claim } from '@web3-storage/content-claims/client/api'

export type { MultihashDigest, Link }
export type { Delegation, Failure, Result, DID, IPLDView, IPLDBlock }
export type { DecodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat }
export type { Claim }

export interface IndexingServiceClient {
  queryClaims (q: Query): Promise<Result<QueryOk, QueryError>>
}

/**
 * Match narrows parameters for locating providers/claims for a set of multihashes.
 */
export interface Match {
  subject: DID[]
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
  claims: Map<string, Claim>
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
