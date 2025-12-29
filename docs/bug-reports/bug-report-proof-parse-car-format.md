# Bug Report: Proof.parse() works but client.addSpace() fails with CAR format UCAN

## 📋 Summary

The `Proof.parse()` function from `@storacha/client/proof` successfully parses UCANs in CAR (Content Addressable Archive) format, but when the parsed proof is passed to `client.addSpace(proof)`, an internal error occurs attempting to parse it again as JWT.

## 🔍 Problem Details

### Expected Behavior

When a UCAN is generated with `storacha delegation create --base64`, it returns a CAR file encoded in base64. The `Proof.parse()` function should be able to parse this format and return a delegation object that can be used directly with `client.addSpace()`.

### Current Behavior

1. ✅ `Proof.parse(ucanBase64String)` works correctly and returns a delegation object
2. ❌ `client.addSpace(proof)` fails with error: `"Expected JWT format: 3 dot-separated base64url-encoded values"`

### Stack Trace

```
Error: Can't parse UCAN: [corrupted binary characters]... Expected JWT format: 3 dot-separated base64url-encoded values.
    at uploadToStoracha (scripts/deploy-ipfs.js:363:15)
```

### Reproduction Code

```javascript
import { create } from '@storacha/client';
import * as Proof from '@storacha/client/proof';

const client = await create();
const ucanBase64 = process.env.STORACHA_UCAN; // UCAN generated with --base64

// ✅ This works
const proof = await Proof.parse(ucanBase64);
console.log('Parsed proof:', proof);

// ❌ This fails
const space = await client.addSpace(proof);
// Error: Expected JWT format: 3 dot-separated base64url-encoded values
```

## 🔬 Technical Analysis

### Relevant Source Code

The `Proof.parse()` in `@storacha/client/dist/proof.js`:

```javascript
export const parse = async (str) => {
    try {
        const cid = Link.parse(str, base64);
        // ... tries to parse as CID
    } catch {
        // Fallback: decodes base64 and reads as CAR
        return legacyExtract(base64.baseDecode(str));
    }
};
```

The `client.addSpace()` internally calls:

```javascript
async addSpace(proof) {
    return await this._agent.importSpaceFromDelegation(proof);
}
```

### Problem Hypothesis

The `importSpaceFromDelegation` method appears to be attempting to parse the proof again as JWT, when it actually already receives a parsed delegation object from `Proof.parse()`. This causes an error because the delegation object is not a JWT string.

## 🛠️ Current Workaround

Currently, we are using `Proof.parse()` correctly, but the error occurs in `addSpace()`. There is no known workaround other than waiting for a fix in the Storacha client.

## 📝 Environment Information

- **@storacha/client**: `1.8.23`
- **Node.js**: `v20.19.6`
- **Operating System**: `darwin 25.1.0`
- **Command used to generate UCAN**: `storacha delegation create <AGENT_DID> --can space/blob/add --can space/index/add --can filecoin/offer --can upload/add --base64`

## 🎯 Suggested Fix

The `importSpaceFromDelegation` method should check if the received parameter is already a parsed delegation object before attempting to parse it again. If it's already an object, it should use it directly. If it's a string, then it should attempt to parse.

## 📚 References

- **npm package**: `@storacha/client@1.8.23`
- **Homepage**: https://storacha.network
- **Related repository**: https://github.com/storacha/js-indexing-service-client (indexing service client)
- **Note**: The JavaScript client repository may be in a private repository or another location. Check https://github.com/storacha or contact support via https://storacha.network

---

**Reported by**: Mellø (neomello)  
**Date**: 2025-01-XX  
**Project**: neo-flowoff-pwa

