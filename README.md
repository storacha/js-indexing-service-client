# indexing-service-client

JS implementation of a Storacha indexing service client.

## Install

```sh
npm install @storacha/indexing-service-client
```

# Usage

```js
import { Client } from '@storacha/indexing-service-client'

const client = new Client()
const results = await client.queryClaims({ hashes: [/* ... multihash(es) ... */] })
```

## Contributing

Feel free to join in. All welcome. [Open an issue](https://github.com/storacha/js-indexing-service-client/issues)!

## License

Dual-licensed under [MIT / Apache 2.0](https://github.com/storacha/js-indexing-service-client/blob/main/LICENSE.md)

