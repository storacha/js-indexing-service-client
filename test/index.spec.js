import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { equals } from 'multiformats/bytes'
import { Client } from '../src/index.js'

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
      return c.capabilities[0].can === 'assert/index'
    })
    assert(indexClaim)

    const indexCaveats =
      /** @type {{ content: Link, index: Link }} */
      (indexClaim.capabilities[0].nb)
    assert(equals(digest.bytes, indexCaveats.content.multihash.bytes))

    // index should be included in results
    const index = result.ok.indexes.get(indexCaveats.index.toString())
    assert(index)

    // find location claim for the index
    const indexLocationCommitment = [...result.ok.claims.values()].find(c => {
      if (c.capabilities[0].can === 'assert/location') {
        const locationCaveats =
          /** @type {{ content: { digest: Uint8Array } } }} */
          (c.capabilities[0].nb)
        return equals(locationCaveats.content.digest, indexCaveats.index.multihash.bytes)
      }
      return false
    })
    assert(indexLocationCommitment)

    const indexLocationCaveats =
      /** @type {{ content: Link, location: string[] }} */
      (indexLocationCommitment.capabilities[0].nb)
    assert(indexLocationCaveats.location)

    assert.equal(index.shards.size, 1)

    // find location claim for the shard
    const [[shard, slices]] = index.shards.entries()
    const shardLocationCommitment = [...result.ok.claims.values()].find(c => {
      if (c.capabilities[0].can === 'assert/location') {
        const locationCaveats =
          /** @type {{ content: { digest: Uint8Array } } }} */
          (c.capabilities[0].nb)
        return equals(locationCaveats.content.digest, shard.bytes)
      }
      return false
    })
    assert(shardLocationCommitment)

    const shardLocationCaveats =
      /** @type {{ content: Link, location: string[] }} */
      (shardLocationCommitment.capabilities[0].nb)
    assert(shardLocationCaveats.location)

    const position = slices.get(digest)
    assert(position)
    
    console.log()
    console.log(`Results for ${digestString}:`)
    console.log(`  Index: ${indexCaveats.index}`)
    console.log(`    Location: ${indexLocationCaveats.location}`)
    console.log(`  Shard: ${base58btc.encode(shard.bytes)}`)
    console.log(`    Location: ${indexLocationCaveats.location}`)
    console.log(`    Position: ${position[0]}-${position[0]+position[1]}`)
    console.log()
  })
})
