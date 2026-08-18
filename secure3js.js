/**
 * Secure3JS — Client-Side In-Memory AES-256 Decryption Engine for Three.js
 * Compatible with vanilla JavaScript, modern ES modules, and React.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ── Constants ────────────────────────────────────────────────────────────────
const S3JS_MAGIC = new Uint8Array([0x53, 0x33, 0x4a, 0x53]); // 'S3JS'
const S3FMT_MAGIC = 'S3FMT001';

// ── Key Derivation ───────────────────────────────────────────────────────────
async function resolveKeyBuffer(key) {
  let rawBytes;
  if (key instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(key);
  } else {
    const s = (key || '').toString().trim();
    const isHex = s.length > 0 && s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s);
    if (isHex) {
      rawBytes = new Uint8Array(s.length / 2);
      for (let i = 0; i < rawBytes.length; i++) {
        rawBytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
      }
    } else {
      rawBytes = new TextEncoder().encode(s);
    }
  }

  const safeBytes = new Uint8Array(new ArrayBuffer(rawBytes.byteLength));
  safeBytes.set(rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes));
  return window.crypto.subtle.digest('SHA-256', safeBytes);
}

// ── GZIP Decompression ───────────────────────────────────────────────────────
async function gunzip(compressed) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  writer.write(new Uint8Array(compressed.buffer.slice(0, compressed.byteLength)));
  writer.close();

  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(new ArrayBuffer(total));
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.byteLength;
  }
  return out;
}

// ── Binary Helpers ───────────────────────────────────────────────────────────
function u32(u8, off) {
  return (u8[off] | (u8[off + 1] << 8) | (u8[off + 2] << 16) | (u8[off + 3] << 24)) >>> 0;
}

function u64(u8, off) {
  return u32(u8, off) + u32(u8, off + 4) * 0x100000000;
}

// ── S3FMT001 Container Unpacker ──────────────────────────────────────────────
async function unpackS3FMT001(buffer) {
  const u8 = new Uint8Array(buffer);

  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3], u8[4], u8[5], u8[6], u8[7]);
  if (magic !== S3FMT_MAGIC) {
    throw new Error(
      `[Secure3Js] Decrypted payload is not a valid S3FMT001 container (expected "${S3FMT_MAGIC}", got "${magic}"). Verify your decryption key is correct.`
    );
  }

  const numEntries = u32(u8, 12);
  const gltfParts = [];
  const resources = {};

  let tocOff = 16;
  for (let i = 0; i < numEntries; i++) {
    let name = '';
    for (let j = 0; j < 64; j++) {
      const c = u8[tocOff + j];
      if (c === 0) break;
      name += String.fromCharCode(c);
    }
    tocOff += 64;

    const offset = u64(u8, tocOff);
    tocOff += 8;
    const length = u64(u8, tocOff);
    tocOff += 8;
    const flags = u8[tocOff];
    tocOff += 1;

    let payload = new Uint8Array(buffer.slice(offset, offset + length));
    if (flags === 0x01) {
      payload = await gunzip(payload);
    }

    let pOff = 0;
    const jsonLen = u32(payload, pOff);
    pOff += 4;
    if (jsonLen > 0) {
      const jsonStr = new TextDecoder().decode(payload.slice(pOff, pOff + jsonLen));
      pOff += jsonLen;
      try {
        gltfParts.push(JSON.parse(jsonStr));
      } catch {
        throw new Error(`[Secure3Js] JSON parse error in S3FMT001 component "${name}".`);
      }
    }

    const numRes = u32(payload, pOff);
    pOff += 4;
    for (let r = 0; r < numRes; r++) {
      const nameLen = u32(payload, pOff);
      pOff += 4;
      const resName = new TextDecoder().decode(payload.slice(pOff, pOff + nameLen));
      pOff += nameLen;
      const resLen = u32(payload, pOff);
      pOff += 4;
      resources[resName] = payload.slice(pOff, pOff + resLen);
      pOff += resLen;
    }
  }

  const gltfJson = {};
  for (const part of gltfParts) Object.assign(gltfJson, part);

  return assembleGLB(gltfJson, resources);
}

// ── GLB Assembler ────────────────────────────────────────────────────────────
function assembleGLB(rawJson, resources) {
  const json = JSON.parse(JSON.stringify(rawJson));

  const usedAsImage = new Set();
  if (Array.isArray(json.images)) {
    for (const img of json.images) {
      if (typeof img.uri === 'string' && resources[img.uri]) {
        usedAsImage.add(img.uri);
        const data = resources[img.uri];
        const ext = img.uri.split('.').pop()?.toLowerCase() ?? 'png';
        const mime =
          ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'webp'
            ? 'image/webp'
            : 'image/png';
        let bin = '';
        const CHUNK = 8192;
        for (let k = 0; k < data.length; k += CHUNK) {
          bin += String.fromCharCode(...data.subarray(k, k + CHUNK));
        }
        img.uri = `data:${mime};base64,${btoa(bin)}`;
      }
    }
  }

  const bufferDefs = Array.isArray(json.buffers) ? json.buffers : [];
  const bufferStartOffsets = new Array(bufferDefs.length).fill(0);
  const mergedChunks = [];
  let totalBinarySize = 0;

  for (let bi = 0; bi < bufferDefs.length; bi++) {
    bufferStartOffsets[bi] = totalBinarySize;
    const uri = bufferDefs[bi].uri ?? '';

    if (usedAsImage.has(uri)) continue;

    const data =
      uri && resources[uri]
        ? resources[uri]
        : !uri && resources['buffer.bin']
        ? resources['buffer.bin']
        : undefined;

    if (data) {
      mergedChunks.push(data);
      totalBinarySize += data.byteLength;
      const pad = (4 - (data.byteLength % 4)) % 4;
      if (pad > 0) {
        mergedChunks.push(new Uint8Array(pad));
        totalBinarySize += pad;
      }
    }
  }

  if (Array.isArray(json.bufferViews)) {
    for (const bv of json.bufferViews) {
      const origBufIdx = bv.buffer ?? 0;
      bv.byteOffset = (bv.byteOffset ?? 0) + (bufferStartOffsets[origBufIdx] ?? 0);
      bv.buffer = 0;
    }
  }

  if (totalBinarySize > 0) {
    json.buffers = [{ byteLength: totalBinarySize }];
  } else {
    delete json.buffers;
  }

  const mergedBinary = new Uint8Array(totalBinarySize);
  let mOff = 0;
  for (const chunk of mergedChunks) {
    mergedBinary.set(chunk, mOff);
    mOff += chunk.byteLength;
  }

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadLen = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunkSize = jsonBytes.byteLength + jsonPadLen;

  const hasBin = totalBinarySize > 0;
  const totalLen = 12 + 8 + jsonChunkSize + (hasBin ? 8 + totalBinarySize : 0);

  const glb = new Uint8Array(totalLen);
  const dv = new DataView(glb.buffer);

  // GLB 2.0 file header
  dv.setUint32(0, 0x46546c67, true); // magic = 'glTF'
  dv.setUint32(4, 2, true); // version = 2
  dv.setUint32(8, totalLen, true);

  // JSON chunk
  dv.setUint32(12, jsonChunkSize, true);
  dv.setUint32(16, 0x4e4f534a, true); // chunkType = 'JSON'
  glb.set(jsonBytes, 20);
  glb.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonChunkSize);

  // BIN chunk
  if (hasBin) {
    const binStart = 20 + jsonChunkSize;
    dv.setUint32(binStart, totalBinarySize, true);
    dv.setUint32(binStart + 4, 0x004e4942, true); // chunkType = 'BIN\0'
    glb.set(mergedBinary, binStart + 8);
  }

  return glb.buffer;
}

// ── Public Decryption API ────────────────────────────────────────────────────
export async function decryptAndUnpack(encArrayBuffer, rawKey) {
  const keyBuffer = await resolveKeyBuffer(rawKey ?? '');
  if (!keyBuffer || keyBuffer.byteLength === 0) {
    throw new Error('[Secure3Js] Invalid or missing decryption key.');
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const u8 = new Uint8Array(encArrayBuffer);
  const hasS3JSMagic =
    u8.length >= 16 &&
    u8[0] === S3JS_MAGIC[0] &&
    u8[1] === S3JS_MAGIC[1] &&
    u8[2] === S3JS_MAGIC[2] &&
    u8[3] === S3JS_MAGIC[3];

  const iv = hasS3JSMagic ? encArrayBuffer.slice(4, 16) : encArrayBuffer.slice(0, 12);
  const ciphertext = hasS3JSMagic ? encArrayBuffer.slice(16) : encArrayBuffer.slice(12);

  let decryptedBuffer;
  try {
    decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      cryptoKey,
      ciphertext
    );
  } catch {
    throw new Error(
      '[Secure3Js] Decryption failed — wrong key or corrupted file. Ensure the passphrase exactly matches the one used during encryption.'
    );
  }

  const glbBuffer = await unpackS3FMT001(decryptedBuffer);

  try {
    new Uint8Array(decryptedBuffer).fill(0);
  } catch {}

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(dracoLoader);

    loader.parse(
      glbBuffer,
      '',
      (gltf) => {
        try {
          new Uint8Array(glbBuffer).fill(0);
        } catch {}
        resolve(gltf.scene);
      },
      (err) => {
        try {
          new Uint8Array(glbBuffer).fill(0);
        } catch {}
        reject(
          new Error(
            `[Secure3Js] GLTFLoader failed to parse the decrypted model: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        );
      }
    );
  });
}

// ── Anti-Debugger & DevTools Traps ───────────────────────────────────────────
export function enableAntiDebugger(options = {}) {
  const {
    debuggerIntervalMs = 100,
    detectTimingAnomaly = true,
    timingThresholdMs = 150,
    neuterConsole = true,
    onDebugDetected
  } = options;

  let stopped = false;
  const timers = [];

  if (neuterConsole && typeof window !== 'undefined') {
    try {
      const noop = () => {};
      ['log', 'dir', 'table', 'info', 'debug'].forEach((method) => {
        if (window.console && typeof window.console[method] === 'function') {
          window.console[method] = noop;
        }
      });
    } catch {}
  }

  const debuggerLoop = () => {
    if (!stopped) {
      try {
        (function () {
          return Function('debugger')();
        })();
      } catch {}
    }
  };

  if (typeof window !== 'undefined') {
    timers.push(setInterval(debuggerLoop, debuggerIntervalMs));
  }

  if (detectTimingAnomaly && typeof performance !== 'undefined') {
    let last = performance.now();
    timers.push(
      setInterval(() => {
        if (stopped) return;
        const now = performance.now();
        if (now - last > timingThresholdMs + debuggerIntervalMs * 2) {
          if (onDebugDetected) {
            try {
              onDebugDetected();
            } catch {}
          }
        }
        last = performance.now();
      }, debuggerIntervalMs)
    );
  }

  return () => {
    stopped = true;
    timers.forEach((t) => clearInterval(t));
  };
}

export function sealViewerEnvironment(threeInstance) {
  if (!threeInstance) return;
  const targets = [
    threeInstance.Scene,
    threeInstance.Mesh,
    threeInstance.Group,
    threeInstance.BufferGeometry,
    threeInstance.Material
  ];
  targets.forEach((cls) => {
    if (cls && cls.prototype && typeof Object.freeze === 'function') {
      try {
        Object.freeze(cls.prototype);
      } catch {}
    }
  });
}

// ── Ephemeral Token Utilities ────────────────────────────────────────────────
export function createTimedToken(modelId, ttlSeconds = 60) {
  const now = Date.now();
  const payload = {
    modelId,
    iat: now,
    exp: now + ttlSeconds * 1000,
    nonce: Math.random().toString(36).substring(2, 15)
  };
  const json = JSON.stringify(payload);
  return typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    : '';
}

export function parseTimedToken(token) {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const json = decodeURIComponent(escape(atob(base64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token, clockSkewSeconds = 0) {
  const parsed = typeof token === 'string' ? parseTimedToken(token) : token;
  if (!parsed || typeof parsed.exp !== 'number') return true;
  return Date.now() > parsed.exp + clockSkewSeconds * 1000;
}

export function getTokenRemainingMs(token) {
  const parsed = typeof token === 'string' ? parseTimedToken(token) : token;
  if (!parsed || typeof parsed.exp !== 'number') return 0;
  return Math.max(0, parsed.exp - Date.now());
}

export function formatTokenTimeRemaining(token) {
  const ms = getTokenRemainingMs(token);
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}