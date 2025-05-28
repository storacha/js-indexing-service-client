import { MultihashDigest, Link, UnknownLink } from 'multiformats'
import { Ability, BlockStore, Capability, Capabilities, Caveats, Delegation, Failure, Resource, Result, DID, IPLDView, IPLDBlock, UCANLink, ServiceMethod } from '@ucanto/interface'
import { DecodeFailure, EncodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat } from '@storacha/blob-index/types'
import { AssertLocation, AssertPartition, AssertInclusion, AssertIndex, AssertEquals, AssertRelation } from '@storacha/capabilities/types'

export type { MultihashDigest, Link }
export type { Ability, BlockStore, Capability, Capabilities, Caveats, Delegation, Failure, Resource, Result, DID, IPLDView, IPLDBlock, UCANLink }
export type { DecodeFailure, EncodeFailure, ShardedDAGIndex, ShardedDAGIndexView, UnknownFormat }
export type { AssertLocation, AssertPartition, AssertInclusion, AssertIndex, AssertEquals, AssertRelation }

export interface IndexingServiceClient {
  queryClaims (q: Query): Promise<Result<QueryOk, QueryError>>
}

/**
 * Match narrows parameters for locating providers/claims for a set of multihashes.
 */
export interface Match {
  subject: DID[]
}

export type Kind = "standard" | "index_or_location" | "location"

/**
 * Query is a query for several multihashes.
 */
export interface Query {
  hashes: MultihashDigest[]
  match?: Match
  kind?: Kind
}

export interface QueryOk extends QueryResult {}

export interface QueryResult extends IPLDView {
  claims: Map<string, Claim>
  indexes: Map<string, ShardedDAGIndex>
  archive (): Promise<Result<Uint8Array, EncodeFailure>>
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

export type InferCaveats<C extends Capability> = C extends Capability<Ability, Resource, infer NB> ? NB : never

export interface ContentCaveats {
  content: UnknownLink | { digest: Uint8Array } 
}

export interface ClaimCapability<Can extends Ability = Ability, With extends Resource = Resource, Caveats extends ContentCaveats = ContentCaveats> extends Capability<Can, With, Caveats> {
  nb: Caveats
}

/** A verifiable claim about data. */
export interface ContentClaim<C extends ClaimCapability = ClaimCapability> {
  /** Subject of the claim e.g. CAR, DAG root etc. */
  readonly content: C['nb']['content']
  /** Discriminator for different types of claims. */
  readonly type: C['can']
  /** Returns the underlying delegation this claim is based on. */
  delegation(): Delegation<[C]>
}

/** A claim not known to this library. */
export interface UnknownClaim extends ContentClaim {}

/** A claim that a CID is available at a URL. */
export interface LocationCommitment extends ContentClaim<AssertLocation>, Readonly<Omit<InferCaveats<AssertLocation>, 'content'>> {
}

/** A claim that a CID's graph can be read from the blocks found in parts. */
export interface PartitionClaim extends ContentClaim<AssertPartition>, Readonly<Omit<InferCaveats<AssertPartition>, 'content'>> {
}

/** A claim that a CID includes the contents claimed in another CID. */
export interface InclusionClaim extends ContentClaim<AssertInclusion>, Readonly<Omit<InferCaveats<AssertInclusion>, 'content'>> {
}

/**
 * A claim that a content graph can be found in blob(s) that are identified and
 * indexed in the given index CID.
 */
export interface IndexClaim extends ContentClaim<AssertIndex>, Readonly<Omit<InferCaveats<AssertIndex>, 'content'>> {
}

/** A claim that a CID links to other CIDs. */
export interface RelationClaim extends ContentClaim<AssertRelation>, Readonly<Omit<InferCaveats<AssertRelation>, 'content'>> {
}

/** A claim that the same data is referred to by another CID and/or multihash */
export interface EqualsClaim extends ContentClaim<AssertEquals>, Readonly<Omit<InferCaveats<AssertEquals>, 'content'>> {
}

/** A verifiable claim about data. */
export type Claim =
  | LocationCommitment
  | PartitionClaim
  | InclusionClaim
  | IndexClaim
  | RelationClaim
  | EqualsClaim

/** Indexing service accepts invocations of claims for data. */
export interface IndexingService {
  assert: {
    index: ServiceMethod<AssertIndex, {}, Failure>
    equals: ServiceMethod<AssertEquals, {}, Failure>
  }
}
