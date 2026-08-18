# 03 — 3D Furniture & Product Configurator with Secure3JS

This sample demonstrates how to build an interactive 3D product configurator (such as for furniture, automotive, or industrial design) while keeping the 3D model, meshes, and materials protected against online theft.

---

## 3D Asset Architecture for Configurators

When preparing 3D assets in Blender / 3ds Max / Maya for configurators (such as the pattern used in production systems like [Aurelian Living](https://aurelian-living.vercel.app/)):

1. **Dummy Mesh / Material Library ("Cube" convention)**:
   - Artists create a dummy non-rendered node (e.g. named `Cube`) containing all available material slots (fabrics, woods, metals, leathers).
   - Upon model decryption, materials are extracted into a dictionary:
     ```javascript
     const materialsLib = {};
     cubeNode.traverse((child) => {
       if (child.isMesh && child.material) {
         materialsLib[child.material.name] = child.material;
       }
     });
     cubeNode.visible = false;
     ```

2. **Named Mesh Parts / Variants**:
   - Interchangeable mesh components (e.g. legs, cushions, armrests) are named consistently in the glTF hierarchy.
   - When a user selects a variant or material, the corresponding node is toggled or cloned material is applied:
     ```javascript
     const mesh = root.getObjectByName('Cushion_Standard');
     if (mesh && materialsLib['Velvet_Emerald']) {
       mesh.material = materialsLib['Velvet_Emerald'].clone();
       mesh.material.needsUpdate = true;
     }
     ```

3. **Secure Decryption**:
   - The entire 3D container is encrypted into a single `.enc` container using the Secure3JS desktop application or backend encryption service.
   - `decryptAndUnpack()` loads the scene graph directly into RAM without exposing individual GLB, textures, or buffer geometry files to the network or filesystem.

---

## How to Run

1. Open `index.html` with VS Code Live Server or any static web server (e.g. `npx serve .`).
2. Click the color swatches and surface finish buttons to observe dynamic runtime material updates on the encrypted 3D model.
