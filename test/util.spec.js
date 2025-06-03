import { describe, it } from 'mocha'
import { assert } from 'chai'
import { Assert } from '@storacha/capabilities'
import * as ed25519 from '@ucanto/principal/ed25519'
import { ShardedDAGIndex } from '@storacha/blob-index'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Link from 'multiformats/link'
import * as raw from 'multiformats/codecs/raw'
import * as Claim from '../src/claim.js'
import * as QueryResult from '../src/query-result.js'
import { Client } from '../src/index.js'
import { combine } from '../src/util.js'

/** @import { URI } from '@ucanto/interface' */

/** @param {number} size */
const randomBytes = size => crypto.getRandomValues(new Uint8Array(size))
const randomDigest = () => sha256.digest(randomBytes(32))
const randomLink = async () => Link.create(raw.code, await randomDigest())
/** @param {Uint8Array} bytes */
const toCARLink = async bytes => Link.create(0x0202, await sha256.digest(bytes))

/** @param {import('multiformats').Link} content */
const setup = async (content) => {
  const storageNode = await ed25519.generate()
  const space = await ed25519.generate()

  const domain = storageNode.did().replace('did:key:', '')
  const url = /** @type {URI} */ (`http://${domain}.example.com`)
  const site = await Assert.location.delegate({
    issuer: storageNode,
    audience: space,
    with: storageNode.did(),
    nb: { content, location: [url] }
  })

  const index = ShardedDAGIndex.create(content)
  index.setSlice(await randomDigest(), await randomDigest(), [0, 100])

  const indexArchiveRes = await index.archive()
  assert(indexArchiveRes.ok)

  const indexLink = await toCARLink(indexArchiveRes.ok)

  const blocks = new Map()
  for (const b of site.export()) {
    blocks.set(b.cid.toString(), b)
  }

  const result = await QueryResult.from({
    claims: [Claim.view({ root: site.cid, blocks })],
    indexes: new Map([['index', index]])
  })
  assert(result.ok)

  const queryArchiveRes = await QueryResult.archive(result.ok)
  assert(queryArchiveRes.ok)

  const client = new Client({
    fetch: async () => new Response(queryArchiveRes.ok)
  })

  return { client, claim: site.cid, index: indexLink }
}

describe('combine', () => {
  it('combines multiple clients', async () => {
    const content = await randomLink()

    const service0 = await setup(content)
    const service1 = await setup(content)

    const client = combine([service0.client, service1.client])
    const queryRes = await client.queryClaims({ hashes: [content.multihash] })
    assert(queryRes.ok)

    const claims = [...queryRes.ok.claims.values()]
    assert(claims.some(c => c.delegation().cid.toString() === service0.claim.toString()))
    assert(claims.some(c => c.delegation().cid.toString() === service1.claim.toString()))

    const indexs = []
    for (const [,index] of queryRes.ok.indexes) {
      const archiveRes = await ShardedDAGIndex.archive(index)
      assert(archiveRes.ok)
      indexs.push(await toCARLink(archiveRes.ok))
    }
    assert(indexs.some(i => i.toString() === service0.index.toString()))
    assert(indexs.some(i => i.toString() === service1.index.toString()))
  })
})
