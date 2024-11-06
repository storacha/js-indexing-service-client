import type { CID, MultihashDigest } from 'multiformats/cid'
import { PrincipalView } from '@ipld/dag-ucan'

export interface Block {
  cid: CID
  bytes: Uint8Array
}

// Match narrows parameters for locating providers/claims for a set of multihashes
export interface Match {
  subject: PrincipalView[]
}

// Query is a query for several multihashes
export interface Query {
  hashes?: MultihashDigest[]
  match?: Match
}
