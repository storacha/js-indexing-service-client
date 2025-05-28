import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, it } from 'mocha'
import { assert } from 'chai'
import * as QueryResult from '../src/query-result.js'

describe('query result', () => {
  it('round trip', async () => {
    const digestString = 'zQmRm3SMS4EbiKYy7VeV3zqXqzyr76mq9b2zg3Tij3VhKUG'
    const fixturePath = path.join(import.meta.dirname, 'fixtures', `${digestString}.queryresult.car`)
    const carBytes = await fs.promises.readFile(fixturePath)

    const extract0 = await QueryResult.extract(carBytes)
    assert(extract0.ok)
    assert(!extract0.error)

    assert(extract0.ok.claims.size > 0)
    assert(extract0.ok.indexes.size > 0)

    const archive = await extract0.ok.archive()
    assert(archive.ok)
    assert(!archive.error)

    const extract1 = await QueryResult.extract(archive.ok)
    assert(extract1.ok)
    assert(!extract1.error)

    assert.equal(extract0.ok.root.toString(), extract1.ok.root.toString())
    assert.equal(extract0.ok.claims.size, extract1.ok.claims.size)
    assert.equal(extract0.ok.indexes.size, extract1.ok.indexes.size)
  })

  it('from encode failure', async () => {
    // @ts-expect-error for test
    const res = await QueryResult.from({ claims: 'none' })
    assert.ok(res.error)
    assert.equal(res.error.name, 'EncodeFailure')
  })

  it('archive encode failure', async () => {
    // @ts-expect-error for test
    const res = await QueryResult.archive(undefined)
    assert.ok(res.error)
    assert.equal(res.error.name, 'EncodeFailure')
  })
})
