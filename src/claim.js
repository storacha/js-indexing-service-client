/** @import * as API from './api.js' */
import * as Delegation from '@ucanto/core/delegation'
import * as Assert from '@storacha/capabilities/assert'

const assertCapMap = {
  [Assert.location.can]: Assert.location,
  [Assert.partition.can]: Assert.partition,
  [Assert.inclusion.can]: Assert.inclusion,
  [Assert.index.can]: Assert.index,
  [Assert.relation.can]: Assert.relation,
  [Assert.equals.can]: Assert.equals
}

/**
 * @template {API.Capabilities} C
 * @param {object} dag
 * @param {API.UCANLink<C>} dag.root
 * @param {API.BlockStore<unknown>} dag.blocks
 * @returns {import('./api.js').Claim}
 */
export const view = ({ root, blocks }) => {
  const delegation = Delegation.view({ root, blocks })
  const cap = delegation.capabilities[0]
  const capability = assertCapMap[
    /** @type {keyof typeof assertCapMap} */
    (cap.can)
  ]
  if (!capability) throw new Error(`Unsupported capability: ${cap.can}`)
  // @ts-expect-error cap is unknown
  const parsedCap = capability.create(cap)
  return {
    ...parsedCap.nb,
    type: parsedCap.can,
    // @ts-expect-error
    delegation: () => delegation,
  }
}
