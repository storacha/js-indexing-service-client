import { sha256 } from 'multiformats/hashes/sha2'
import * as raw from 'multiformats/codecs/raw'
import * as Link from 'multiformats/link'

/**
 * @param {number} min
 * @param {number} max
 */
export const randomInteger = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min) + min)
}

/** @param {number} size */
export const randomBytes = size => {
  const bytes = new Uint8Array(size)
  while (size) {
    const chunk = new Uint8Array(Math.min(size, 65_536))
    crypto.getRandomValues(chunk)

    size -= bytes.length
    bytes.set(chunk, size)
  }
  return bytes
}

export const randomDigest = () => {
  const bytes = randomBytes(randomInteger(1, 1024 * 1024))
  const digest = sha256.digest(bytes)
  if (digest instanceof Promise) throw new Error('sha256 hasher is async')
  return digest
}

export const randomLink = () => Link.create(raw.code, randomDigest())
