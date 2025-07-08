import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { expect, assert } from 'chai'
import * as Digest from 'multiformats/hashes/digest'
import { base58btc } from 'multiformats/bases/base58'
import { sha256 } from 'multiformats/hashes/sha2'
import { equals } from 'multiformats/bytes'
import { Client } from '../src/index.js'
import * as Claim from '../src/claim.js'
import * as ed25519 from '@ucanto/principal/ed25519'
import { Assert } from '@storacha/capabilities'
import { randomLink } from './helpers.js'

/** @import { URI } from '@ucanto/interface' */

describe('claim', () => {
  it('view from delegation', async () => {
    const content = await randomLink()
    const storageNode = await ed25519.generate()
    const space = await ed25519.generate()
  
    const site = await Assert.location.delegate({
      issuer: storageNode,
      audience: space,
      with: storageNode.did(),
      nb: { content, location: ['http://example.com/'] }
    })

    const claim = Claim.from(site)
    assert.equal(claim.type, Assert.location.can)
    assert.equal(claim.content.toString(), content.toString())
    if (claim.type === Assert.location.can) {
      assert.equal(claim.location[0], 'http://example.com/')
    }
  })

  it('create view', async () => {
    const content = await randomLink()
    const storageNode = await ed25519.generate()
    const space = await ed25519.generate()
  
    const site = await Assert.location.delegate({
      issuer: storageNode,
      audience: space,
      with: storageNode.did(),
      nb: { content, location: ['http://example.com/'] }
    })

    const blocks = new Map()
    for (const b of site.export()) {
      blocks.set(b.cid.toString(), b)
    }

    const claim = Claim.view({ root: site.cid, blocks })
    assert.equal(claim.type, Assert.location.can)
    assert.equal(claim.content.toString(), content.toString())
    if (claim.type === Assert.location.can) {
      assert.equal(claim.location[0], 'http://example.com/')
    }
  })
})
