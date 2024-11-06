import { Failure } from '@ucanto/core'

export {
  UnknownFormat as UnknownFormatError,
  DecodeFailure as DecodeError
} from '@storacha/blob-index/sharded-dag-index'

export class InvalidQueryError extends Failure {
  #reason
  static name = /** @type {const} */ ('InvalidQuery')

  get name() {
    return InvalidQueryError.name
  }

  /** @param {string} reason */
  constructor (reason) {
    super()
    this.#reason = reason
  }

  describe() {
    return this.#reason ?? 'Invalid query'
  }
}

export class MissingBlockError extends Failure {
  #reason
  static name = /** @type {const} */ ('MissingBlock')

  get name() {
    return MissingBlockError.name
  }

  /** @param {string} reason */
  constructor (reason) {
    super()
    this.#reason = reason
  }

  describe() {
    return this.#reason ?? 'Missing block'
  }
}

export class NetworkError extends Failure {
  #reason
  static name = /** @type {const} */ ('NetworkError')

  get name() {
    return NetworkError.name
  }

  /** @param {string} reason */
  constructor (reason) {
    super()
    this.#reason = reason
  }

  describe() {
    return this.#reason ?? 'Network error'
  }
}
