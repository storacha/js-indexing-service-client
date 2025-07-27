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

export class NetworkTimeoutError extends NetworkError {
  static name = /** @type {const} */ ('NetworkTimeoutError')

  get name() {
    return NetworkTimeoutError.name
  }

  /** @param {string} [reason] */
  constructor(reason = 'Request timed out') {
    super(reason)
  }
}

export class NetworkConnectionError extends NetworkError {
  static name = /** @type {const} */ ('NetworkConnectionError')

  get name() {
    return NetworkConnectionError.name
  }

  /** @param {string} [reason] */
  constructor(reason = 'Failed to establish connection') {
    super(reason)
  }
}

export class ServerError extends NetworkError {
  #statusCode
  static name = /** @type {const} */ ('ServerError')

  get name() {
    return ServerError.name
  }

  /**
   * @param {number} statusCode
   * @param {string} [reason]
   */
  constructor(statusCode, reason) {
    super(reason ?? `Server responded with status ${statusCode}`)
    this.#statusCode = statusCode
  }

  /** @returns {number} */
  get statusCode() {
    return this.#statusCode
  }
}

export class ClientError extends NetworkError {
  #statusCode
  static name = /** @type {const} */ ('ClientError')

  get name() {
    return ClientError.name
  }

  /**
   * @param {number} statusCode
   * @param {string} [reason]
   */
  constructor(statusCode, reason) {
    super(reason ?? `Client error with status ${statusCode}`)
    this.#statusCode = statusCode
  }

  /** @returns {number} */
  get statusCode() {
    return this.#statusCode
  }
}

/**
 * @typedef {object} RetryOptions
 * @property {number} [maxAttempts] Maximum number of retry attempts (default: 3)
 * @property {number} [initialDelay] Initial delay in milliseconds (default: 1000)
 * @property {number} [maxDelay] Maximum delay in milliseconds (default: 10000)
 * @property {(error: Error) => boolean} [shouldRetry] Function to determine if error is retryable
 */

/**
 * Default retry options
 * @type {Required<RetryOptions>}
 */
export const DEFAULT_RETRY_OPTIONS = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  shouldRetry: (error) => {
    // Retry on network timeouts and connection errors
    if (error instanceof NetworkTimeoutError || error instanceof NetworkConnectionError) {
      return true
    }
    // Retry on certain server errors (500, 502, 503, 504)
    if (error instanceof ServerError) {
      return [500, 502, 503, 504].includes(error.statusCode)
    }
    return false
  }
}

/**
 * Implements exponential backoff with jitter for retrying operations
 * @param {number} attempt Current attempt number (1-based)
 * @param {number} initialDelay Initial delay in milliseconds
 * @param {number} maxDelay Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoff(attempt, initialDelay, maxDelay) {
  const exponentialDelay = initialDelay * Math.pow(2, attempt - 1)
  const jitter = Math.random() * 0.1 * exponentialDelay // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelay)
}

/**
 * Executes an async operation with retry logic
 * @template T
 * @param {() => Promise<T>} operation
 * @param {Partial<RetryOptions>} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(operation, options = {}) {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === config.maxAttempts || !config.shouldRetry(error)) {
        throw error
      }
      
      const delay = calculateBackoff(attempt, config.initialDelay, config.maxDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
