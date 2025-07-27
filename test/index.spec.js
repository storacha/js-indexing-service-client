import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'
import { connect } from '@ucanto/client'
import { CAR } from '@ucanto/transport'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as Server from '@ucanto/server'
import * as AssertCaps from '@storacha/capabilities/assert'
import * as ClaimCaps from '@storacha/capabilities/claim'
import { Client } from '../src/index.js'
import { 
  NetworkTimeoutError, 
  NetworkConnectionError, 
  ServerError, 
  ClientError 
} from '../src/errors.js'
import { randomLink } from './helpers.js'

/** @import { Claim } from '../src/api.js' */

/** @param {Claim} claim */
const contentDigest = (claim) =>
  'digest' in claim.content ? Digest.decode(claim.content.digest) : claim.content.multihash

const notImplemented = () => Server.error(new Error('not implemented'))

describe('indexing service client', () => {
  it('queries claims', async () => {
    const digestString = 'zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'
    const digest = Digest.decode(base58btc.decode(digestString))
    const fixturePath = path.join(import.meta.dirname, 'fixtures', `${digestString}.queryresult.car`)
    const responseData = await fs.promises.readFile(fixturePath)

    const client = new Client({ fetch: async () => new Response(responseData) })
    const result = await client.queryClaims({ hashes: [digest] })
    assert(result.ok)
    assert(!result.error)

    const indexClaim = [...result.ok.claims.values()].find(c => {
      return c.type === 'assert/index'
    })
    assert(indexClaim)

    assert(equals(digest.bytes, contentDigest(indexClaim).bytes))

    // index should be included in results
    const index = result.ok.indexes.get(indexClaim.index.toString())
    assert(index)

    // find location claim for the index
    const indexLocationCommitment = [...result.ok.claims.values()].filter(c => {
      return c.type === 'assert/location'
    }).find(c => equals(contentDigest(c).bytes, indexClaim.index.multihash.bytes))
    assert(indexLocationCommitment)

    assert(indexLocationCommitment.location)

    assert.equal(index.shards.size, 1)

    // find location claim for the shard
    const [[shard, slices]] = index.shards.entries()
    const shardLocationCommitment = [...result.ok.claims.values()].filter(c => {
      return c.type === 'assert/location'
    }).find(c => equals(contentDigest(c).bytes, shard.bytes))
    assert(shardLocationCommitment)

    assert(shardLocationCommitment.location)

    const position = slices.get(digest)
    assert(position)
    
    console.log()
    console.log(`Results for ${digestString}:`)
    console.log(`  Index: ${indexClaim.index}`)
    console.log(`    Location: ${indexLocationCommitment.location}`)
    console.log(`  Shard: ${base58btc.encode(shard.bytes)}`)
    console.log(`    Location: ${shardLocationCommitment.location}`)
    console.log(`    Position: ${position[0]}-${position[0]+position[1]}`)
    console.log()
  })

  it('return result when fetch throws', async () => {
    const client = new Client({
      fetch: async () => {
        throw new Error('boom')
      }
    })

    const digest = await sha256.digest(new Uint8Array([1, 2, 3]))
    const result = await client.queryClaims({ hashes: [digest] })

    assert.equal(result.ok, undefined)
    assert.ok(result.error)
    assert.equal(result.error.name, 'NetworkError')
    assert.equal(result.error.message, 'boom')
  })

  it('publish index claim', async () => {
    const alice = await ed25519.generate()
    const service = await ed25519.generate()
    const proof = await AssertCaps.index.delegate({
      issuer: service,
      audience: alice,
      with: service.did()
    })

    const server = Server.create({
      id: service,
      codec: CAR.inbound,
      service: {
        assert: {
          index: Server.provide(AssertCaps.index, () => Server.ok({})),
          equals: Server.provide(AssertCaps.equals, notImplemented)
        },
        claim: {
          cache: Server.provide(ClaimCaps.cache, notImplemented)
        },
      },
      validateAuthorization: () => ({ ok: true })
    })

    const client = new Client({
      connection: connect({
        id: service,
        codec: CAR.outbound,
        channel: server
      })
    })

    const receipt = await client.publishIndexClaim(alice, {
      content: await randomLink(),
      index: await randomLink()
    }, { proofs: [proof] })

    assert.equal(receipt.out.error, undefined)
    assert(receipt.out.ok)
  })

  it('publish equals claim', async () => {
    const alice = await ed25519.generate()
    const service = await ed25519.generate()
    const proof = await AssertCaps.equals.delegate({
      issuer: service,
      audience: alice,
      with: service.did()
    })

    const server = Server.create({
      id: service,
      codec: CAR.inbound,
      service: {
        assert: {
          index: Server.provide(AssertCaps.index, notImplemented),
          equals: Server.provide(AssertCaps.equals, () => Server.ok({}))
        },
        claim: {
          cache: Server.provide(ClaimCaps.cache, notImplemented)
        },
      },
      validateAuthorization: () => ({ ok: true })
    })

    const client = new Client({
      connection: connect({
        id: service,
        codec: CAR.outbound,
        channel: server
      })
    })

    const receipt = await client.publishEqualsClaim(alice, {
      content: await randomLink(),
      equals: await randomLink()
    }, { proofs: [proof] })

    assert.equal(receipt.out.error, undefined)
    assert(receipt.out.ok)
  })
})

describe('error handling', () => {
  it('handles server errors with retry', async () => {
    let attempts = 0
    const client = new Client({
      fetch: async () => {
        attempts++
        if (attempts < 3) {
          return new Response(null, { status: 503 })
        }
        return new Response(await fs.promises.readFile(
          path.join(import.meta.dirname, 'fixtures', 'zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG.queryresult.car')
        ))
      },
      retry: {
        initialDelay: 10, // Speed up test by reducing delays
        maxDelay: 20
      }
    })

    const digest = Digest.decode(base58btc.decode('zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'))
    const result = await client.queryClaims({ hashes: [digest] })
    
    assert(result.ok)
    assert.equal(attempts, 3, 'Should have retried twice before succeeding')
  })

  it('handles network timeout errors with retry', async () => {
    let attempts = 0
    const client = new Client({
      fetch: async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('AbortError')
        }
        return new Response(await fs.promises.readFile(
          path.join(import.meta.dirname, 'fixtures', 'zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG.queryresult.car')
        ))
      },
      retry: {
        initialDelay: 10,
        maxDelay: 20
      }
    })

    const digest = Digest.decode(base58btc.decode('zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'))
    const result = await client.queryClaims({ hashes: [digest] })
    
    assert(result.ok)
    assert.equal(attempts, 2, 'Should have retried once before succeeding')
  })

  it('handles connection errors with retry', async () => {
    let attempts = 0
    const client = new Client({
      fetch: async () => {
        attempts++
        if (attempts < 2) {
          throw new TypeError('Failed to fetch')
        }
        return new Response(await fs.promises.readFile(
          path.join(import.meta.dirname, 'fixtures', 'zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG.queryresult.car')
        ))
      },
      retry: {
        initialDelay: 10,
        maxDelay: 20
      }
    })

    const digest = Digest.decode(base58btc.decode('zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'))
    const result = await client.queryClaims({ hashes: [digest] })
    
    assert(result.ok)
    assert.equal(attempts, 2, 'Should have retried once before succeeding')
  })

  it('gives up after max attempts', async () => {
    let attempts = 0
    const client = new Client({
      fetch: async () => {
        attempts++
        return new Response(null, { status: 503 })
      },
      retry: {
        maxAttempts: 2,
        initialDelay: 10,
        maxDelay: 20
      }
    })

    const digest = Digest.decode(base58btc.decode('zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'))
    const result = await client.queryClaims({ hashes: [digest] })
    
    assert(!result.ok)
    assert(result.error instanceof ServerError)
    assert.equal(attempts, 2, 'Should have tried exactly twice')
  })

  it('does not retry on client errors', async () => {
    let attempts = 0
    const client = new Client({
      fetch: async () => {
        attempts++
        return new Response(null, { status: 400 })
      }
    })

    const digest = Digest.decode(base58btc.decode('zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'))
    const result = await client.queryClaims({ hashes: [digest] })
    
    assert(!result.ok)
    assert(result.error instanceof ClientError)
    assert.equal(attempts, 1, 'Should not have retried')
  })
})
