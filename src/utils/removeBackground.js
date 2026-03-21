/**
 * Remove the background from an image File/Blob using @imgly/background-removal.
 * The model (~30 MB) is downloaded once and cached by the browser.
 * Returns a PNG Blob with a transparent background.
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
  // Do NOT set publicPath — the library defaults to its own CDN
  // (staticimgly.com) keyed to the exact installed version.
  // Hardcoding a path (e.g. an unpkg URL) causes a version mismatch
  // that makes resources.json fail to load and silently falls back.
  const resultBlob = await removeFn(file, {
    output: {
      format: 'image/png',
      quality: 1,
    },
  })
  return resultBlob
}
