# Secure3JS Sample Code & Integration Examples

Official open-source sample code repository demonstrating **Secure3JS** — asset protection, encryption, and client-side in-memory decryption for Three.js 3D models.

---

## 📂 Repository Structure

```
.
├── README.md                      # Main documentation & guide
├── .gitignore                     # Git ignore rules
│
├── with-secure3js.html            # Root-level encrypted 3D model viewer
├── without-secure3js.html         # Root-level standard GLTF viewer (side-by-side comparison)
├── secure3js.js                   # Standalone Secure3JS runtime engine
│
├── 01-without-secure3js/          # Standalone unencrypted GLTF/GLB example
│   ├── index.html                 # Standard Three.js loader
│   └── README.md                  # Explanation of asset theft vulnerabilities
│
├── 02-with-secure3js/             # Standalone Secure3JS protected example
│   ├── index.html                 # Secure3JS in-memory AES-256 decryption loader
│   ├── secure3js.js               # Runtime engine
│   └── README.md                  # Security breakdown & memory protection details
│
└── 03-furniture-configurator/     # Standalone configurable 3D product example
    ├── index.html                 # Interactive material & finish configurator
    ├── secure3js.js               # Runtime engine
    └── README.md                  # Multi-part glTF & dummy material library guide
```

---

## 🔍 Side-by-Side Comparison: The Only 1 Function That Differs

Both `with-secure3js.html` and `without-secure3js.html` share the exact same scene setup, lights, orbit controls, render loop, and responsive resizing. 

The **only difference** is how the model is loaded into memory:

### Standard Approach (Without Secure3JS — Vulnerable to Theft)
```javascript
async function load3DModel(scene, camera, controls) {
  const MODEL_URL = 'https://pub-a5b8a0a666ea47eaa93df657f30bbbb0.r2.dev/Cat.glb';

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  loader.load(MODEL_URL, (gltf) => {
    centerAndDisplayModel(gltf.scene, scene, camera, controls);
  });
}
```

### Protected Approach (With Secure3JS — AES-256 In-Memory Decryption)
```javascript
import { decryptAndUnpack } from 'secure3js';

async function load3DModel(scene, camera, controls) {
  const MODEL_URL = 'https://pub-a5b8a0a666ea47eaa93df657f30bbbb0.r2.dev/Cat.enc';
  const SECRET_KEY = 'YOUR_SECRET_KEY';

  const response = await fetch(MODEL_URL);
  const encBytes = await response.arrayBuffer();

  // Decrypts in RAM and returns reconstructed Three.js scene graph with zero plaintext disk/network exposure
  const model = await decryptAndUnpack(encBytes, SECRET_KEY);

  centerAndDisplayModel(model, scene, camera, controls);
}
```

---

## 🛡️ Security Features

- **AES-256-GCM In-Memory Decryption**: Models are encrypted into `.enc` binary containers. Plaintext files never hit the disk or browser cache.
- **Immediate RAM Sanitization**: Decrypted binary buffers are wiped (`Uint8Array.fill(0)`) as soon as the Three.js scene graph is constructed.
- **Canvas Anti-Scraping**: `preserveDrawingBuffer: false` prevents malicious extensions or scripts from extracting geometries via WebGL canvas buffers.
- **DevTools Traps & Anti-Debugging**: Optional anti-debugging hooks (`enableAntiDebugger`) deter step-through inspection.

---

## 🚀 Quick Start & How to Run

No build step or Node.js required! All examples use standard ES module import maps.

1. Clone this repository:
   ```bash
   git clone https://github.com/anserking/Secure3JS-Sample-Code.git
   cd Secure3JS-Sample-Code
   ```

2. Serve locally using any static web server:
   ```bash
   # Using VS Code: Right-click any .html file and select "Open with Live Server"
   # Or using npx serve:
   npx serve .
   # Or using Python:
   python -m http.server 8000
   ```

3. Open in your browser:
   - `http://localhost:8000/01-without-secure3js/`
   - `http://localhost:8000/02-with-secure3js/`
   - `http://localhost:8000/03-furniture-configurator/`

---

## 📦 NPM Package Installation

If you are using a React, Next.js, or Vite project:

```bash
npm install secure3js three
# or
pnpm add secure3js three
```

### React Usage Example
```tsx
import React from 'react';
import { Secure3Viewer } from 'secure3js';

export default function My3DProduct() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Secure3Viewer
        model="https://your-cdn.com/models/sofa.enc"
        rawKey="YOUR_DECRYPTION_KEY"
      />
    </div>
  );
}
```

---

## 🔗 Related Resources & Demos

- **Secure3JS Official Website**: [https://secure3js.ultrolonstudio.com/](https://secure3js.ultrolonstudio.com/)
- **Live Furniture Configurator Demo**: [Aurelian Living](https://aurelian-living.vercel.app/)
- **Built with ❤️ by Ultrolon Studio**: [https://ultrolonstudio.com/](https://ultrolonstudio.com/)

---

## 📄 License

MIT License — feel free to use these code samples in your commercial and personal Three.js projects.
