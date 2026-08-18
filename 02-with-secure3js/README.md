# 02 — 3D Model Viewer With Secure3JS (AES-256 Encrypted .enc)

This example demonstrates how to protect your proprietary 3D models from web theft using **Secure3JS**.

---

## How It Works

1. The client browser fetches the encrypted binary container (`Cat.enc`) over HTTPS:
   ```javascript
   const response = await fetch('https://pub-a5b8a0a666ea47eaa93df657f30bbbb0.r2.dev/Cat.enc');
   const encBytes = await response.arrayBuffer();
   ```
2. **Secure3JS** decrypts the payload entirely within client-side RAM using Web Crypto AES-256-GCM:
   ```javascript
   import { decryptAndUnpack } from 'secure3js';

   const model = await decryptAndUnpack(encBytes, SECRET_KEY);
   scene.add(model);
   ```
3. The binary buffers in RAM are automatically sanitized (zeroed) immediately after the Three.js scene graph is constructed.
4. Setting `preserveDrawingBuffer: false` on WebGLRenderer prevents automated canvas screenshot/memory scraping.

---

## 🛡️ Security Comparison

| Threat Vector | Without Secure3JS | With Secure3JS |
| :--- | :--- | :--- |
| **DevTools Network Download** | ❌ Raw `.glb` easily downloaded | ✅ Only encrypted `.enc` ciphertext visible |
| **Model Theft / 3D Piracy** | ❌ Instant one-click theft | ✅ Cryptographically impossible without key |
| **In-Memory Scraping** | ❌ Plaintext in cache | ✅ In-memory sanitization (zeroed upon parse) |
| **DrawingBuffer Memory Dump** | ❌ Canvas scrapable | ✅ `preserveDrawingBuffer: false` prevents dump |

---

## How to Run

1. Open `index.html` with VS Code Live Server or any static web server (e.g. `npx serve .`).
2. Open your browser's DevTools Network tab to verify that only `Cat.enc` is fetched.
