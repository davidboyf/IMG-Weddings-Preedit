// ──────────────────────────────────────────────────────────────────────────────
// Perceptual Hash (pHash) — DCT-based image fingerprinting
// Used for duplicate clip detection without server-side ML.
//
// Algorithm:
//  1. Resize to 32×32 via canvas
//  2. Grayscale conversion (BT.709 luminance)
//  3. Compute 8×8 block DCT (low frequencies only)
//  4. Build 64-bit hash from whether each coefficient is above median
//  5. Hamming distance between hashes = similarity measure
//
// Distance guide:
//   0–4   → nearly identical (duplicate take, same shot)
//   5–10  → very similar (nearby shot, slight change)
//   11–20 → possibly related
//   20+   → different content
// ──────────────────────────────────────────────────────────────────────────────

const HASH_SIZE = 32   // resize to 32×32 before DCT
const DCT_SIZE  = 8    // use top-left 8×8 of DCT output → 64-bit hash

/** Compute a pHash string (64 '0'/'1' chars) from a base64 image URL. */
export async function computeHash(imageSrc: string): Promise<string | null> {
  try {
    const pixels = await resizeToGrayscale(imageSrc, HASH_SIZE)
    if (!pixels) return null
    const dct    = computeDCT8x8(pixels)
    return buildHash(dct)
  } catch {
    return null
  }
}

/** Hamming distance between two pHash strings (same length). */
export function hammingDistance(h1: string, h2: string): number {
  let d = 0
  const len = Math.min(h1.length, h2.length)
  for (let i = 0; i < len; i++) {
    if (h1[i] !== h2[i]) d++
  }
  return d
}

/** Similarity as 0–1 (1 = identical). */
export function hashSimilarity(h1: string, h2: string): number {
  const d = hammingDistance(h1, h2)
  return 1 - d / Math.max(h1.length, h2.length, 1)
}

// ── Internals ────────────────────────────────────────────────────────────────

/** Renders img to an off-screen canvas, returns grayscale float32 array (HASH_SIZE²). */
function resizeToGrayscale(src: string, size: number): Promise<Float32Array | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = size
        canvas.height = size
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)
        const pixels = new Float32Array(size * size)
        for (let i = 0; i < size * size; i++) {
          // BT.709 luminance coefficients
          pixels[i] = 0.2126 * data[i * 4]
                    + 0.7152 * data[i * 4 + 1]
                    + 0.0722 * data[i * 4 + 2]
        }
        resolve(pixels)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** 2D DCT-II on the first 8×8 block of a HASH_SIZE×HASH_SIZE grayscale array. */
function computeDCT8x8(pixels: Float32Array): Float32Array {
  const N    = HASH_SIZE
  const S    = DCT_SIZE
  const dct  = new Float32Array(S * S)
  const kn   = Math.PI / N

  for (let u = 0; u < S; u++) {
    for (let v = 0; v < S; v++) {
      let sum = 0
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum += pixels[x * N + y]
               * Math.cos(kn * (x + 0.5) * u)
               * Math.cos(kn * (y + 0.5) * v)
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1
      dct[u * S + v] = (2 / N) * cu * cv * sum
    }
  }
  return dct
}

/** Build hash: skip DC component (0,0), compare rest to median. */
function buildHash(dct: Float32Array): string {
  // Exclude DC (index 0) — it represents average brightness and shifts with exposure
  const values = Array.from(dct).slice(1)
  const sorted = [...values].sort((a, b) => a - b)
  const median  = sorted[Math.floor(sorted.length / 2)]
  return values.map((v) => (v > median ? '1' : '0')).join('')
}

// ── Sharpness estimation from image ──────────────────────────────────────────

/** Returns a sharpness score 0–100 using a Laplacian-like variance approach on canvas. */
export async function estimateSharpness(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const SIZE = 64
        const canvas = document.createElement('canvas')
        canvas.width  = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

        // Convert to grayscale
        const gray: number[] = []
        for (let i = 0; i < SIZE * SIZE; i++) {
          gray.push(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2])
        }

        // Laplacian kernel: [0,1,0, 1,-4,1, 0,1,0]
        let variance = 0
        let count = 0
        for (let y = 1; y < SIZE - 1; y++) {
          for (let x = 1; x < SIZE - 1; x++) {
            const lap = -4 * gray[y * SIZE + x]
                       +     gray[(y - 1) * SIZE + x]
                       +     gray[(y + 1) * SIZE + x]
                       +     gray[y * SIZE + (x - 1)]
                       +     gray[y * SIZE + (x + 1)]
            variance += lap * lap
            count++
          }
        }
        // Normalize to 0–100 (empirically calibrated for video thumbnails)
        const score = Math.min(100, Math.sqrt(variance / count) * 0.8)
        resolve(Math.round(score))
      } catch {
        resolve(50) // default middle score on error
      }
    }
    img.onerror = () => resolve(50)
    img.src = imageSrc
  })
}

/** Returns exposure score 0–100 (100 = perfect midtone exposure). */
export async function estimateExposure(imageSrc: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const SIZE = 32
        const canvas = document.createElement('canvas')
        canvas.width  = SIZE
        canvas.height = SIZE
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, SIZE, SIZE)
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE)

        let totalLum = 0
        const n = SIZE * SIZE
        for (let i = 0; i < n; i++) {
          totalLum += 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]
        }
        const mean = totalLum / n  // 0–255
        // Ideal exposure ≈ 100–160 (slightly below midpoint — wedding footage tends slightly warm)
        const ideal = 130
        const deviation = Math.abs(mean - ideal)
        const score = Math.max(0, 100 - deviation * 0.8)
        resolve(Math.round(score))
      } catch {
        resolve(50)
      }
    }
    img.onerror = () => resolve(50)
    img.src = imageSrc
  })
}
