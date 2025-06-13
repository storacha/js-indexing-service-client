import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'
import { Client } from '../src/index.js'

/** @import { Link, Claim } from '../src/api.js' */

/** @param {Claim} claim */
const contentDigest = (claim) =>
  'digest' in claim.content ? Digest.decode(claim.content.digest) : claim.content.multihash

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
})
