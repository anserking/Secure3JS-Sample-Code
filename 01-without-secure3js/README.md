# 01 — 3D Model Viewer Without Secure3JS (Standard GLTF/GLB)

This example demonstrates the traditional, standard approach for loading a 3D model in Three.js using `GLTFLoader` and `DRACOLoader`.

---

## How It Works

1. The browser requests `Cat.glb` directly over HTTP:
   ```javascript
   const loader = new GLTFLoader();
   loader.load('https://pub-a5b8a0a666ea47eaa93df657f30bbbb0.r2.dev/Cat.glb', (gltf) => {
     scene.add(gltf.scene);
   });
   ```
2. The raw binary GLB geometry, textures, animations, and materials are downloaded in plaintext into browser memory and cache.

---

## ⚠️ Security & Theft Vulnerabilities

When 3D assets are loaded without encryption:
- **Direct Asset Extraction**: Anyone can open **Chrome DevTools → Network tab**, filter by `.glb`, and right-click **"Open in new tab"** or **"Save as..."** to download the exact proprietary 3D model.
- **Automated Scraping**: Web crawlers and browser extensions can extract 3D meshes and PBR texture maps automatically.
- **WebGL Canvas Grabs**: The standard WebGL canvas allows screenshot scraping and geometry dumping through browser console commands.

---

## How to Run

1. Open `index.html` with VS Code Live Server or any static web server (e.g. `npx serve .`).
2. Open your browser's DevTools Network tab to see the unencrypted `Cat.glb` network request.
