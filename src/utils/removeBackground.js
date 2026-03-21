/**
 * Remove the background from an image File/Blob using @imgly/background-removal.
 * The model is downloaded once and cached by the browser.
 * Returns a PNG Blob with a transparent background.
 *
 * publicPath is intentionally omitted — the library defaults to its own
 * versioned CDN (staticimgly.com) which always matches the installed version.
 * Hardcoding a URL here causes a version mismatch and silent fallback.
 */

let _removeBackgroundFn = null

async function getRemoveFn() {
  if (!_removeBackgroundFn) {
    const mod = await import('@imgly/background-removal')
    _removeBackgroundFn = mod.removeBackground
  }
  return _removeBackgroundFn
}

export async function removeBackground(file) {
  const removeFn = await getRemoveFn()
  const resultBlob = await removeFn(file, {
    // 'large' (isnet) gives the best edge retention for full product shots
    // including bottles alongside boxes/tubes. 'medium' clips translucent
    // or light-coloured packaging.
    model: 'large',
    output: {
      format: 'image/png',
      quality: 1,
    },
  })
  return resultBlob
}
