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
  const resultBlob = await removeFn(file, {
    // Keep the model assets loading from their default CDN to avoid
    // bundling the large WASM/ONNX files into the app's own build.
    publicPath: 'https://unpkg.com/@imgly/background-removal@1.4.5/dist/',
    output: {
      format: 'image/png',
      quality: 1,
    },
  })
  return resultBlob
}
