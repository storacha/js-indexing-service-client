import { describe, it } from 'mocha'
import { expect } from 'chai'

import * as Digest from 'multiformats/hashes/digest'
import * as DID from '@ipld/dag-ucan/did'
import { Client } from '../src/index.js'

import * as fs from 'node:fs'

/**
 * @template T
 * @param {AsyncIterable<T>} asyncIterable
 */
const arrayFromAsync = async (asyncIterable) => {
  const array = []
  for await (const item of asyncIterable) {
    array.push(item)
  }
  return array
}

describe('', () => {
  it('', async () => {
    const client = new Client()

    const responseData = fs.readFileSync(
      '/Users/peeja/Downloads/zQmaUTmXKd6ZBRUY4jQkX3cUDAfrqd5xjmZq59kNtiKt21f.queryresult.car'
    )

    const result = await client.queryClaims(
      {
        hashes: [
          Digest.create(0, new Uint8Array([0])),
          Digest.create(0, new Uint8Array([1])),
        ],
        match: {
          subject: [
            DID.parse('did:example:zSpace1'),
            DID.parse('did:example:zSpace2'),
          ],
        },
      },
      {
        fetch: async (url) => {
          if (
            url.toString() ===
            'https://indexing.storacha.network/claims?multihash=z15R&multihash=z15S&spaces=did%3Aexample%3AzSpace1&spaces=did%3Aexample%3AzSpace2'
          ) {
            return new Response(responseData)
          }
          throw `Unexpected fetch: ${url}`
        },
      }
    )

    expect(result).to.deep.equal({
      claims: [],
      indexes: [],
    })
  })
})
