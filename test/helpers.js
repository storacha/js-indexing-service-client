import { sha256 } from 'multiformats/hashes/sha2'
import * as Link from 'multiformats/link'
import * as raw from 'multiformats/codecs/raw'

/** @param {number} size */
export const randomBytes = size => crypto.getRandomValues(new Uint8Array(size))
export const randomDigest = () => sha256.digest(randomBytes(32))
export const randomLink = async () => Link.create(raw.code, await randomDigest())
