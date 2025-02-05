import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import { Client } from '../src/index.js'
import { contentMultihash } from '@web3-storage/content-claims/client'
/** @import { Link } from '../src/api.js' */

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

    assert(equals(digest.bytes, contentMultihash(indexClaim).bytes))

    // index should be included in results
    const index = result.ok.indexes.get(indexClaim.index.toString())
    assert(index)

    // find location claim for the index
    const indexLocationCommitment = [...result.ok.claims.values()].filter(c => {
      return c.type === 'assert/location'
    }).find(c => equals(contentMultihash(c).bytes, indexClaim.index.multihash.bytes))
    assert(indexLocationCommitment)

    assert(indexLocationCommitment.location)

    assert.equal(index.shards.size, 1)

    // find location claim for the shard
    const [[shard, slices]] = index.shards.entries()
    const shardLocationCommitment = [...result.ok.claims.values()].filter(c => {
      return c.type === 'assert/location'
    }).find(c => equals(contentMultihash(c).bytes, shard.bytes))
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
})
