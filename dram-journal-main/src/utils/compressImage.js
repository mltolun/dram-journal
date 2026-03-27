/**
 * Compress an image File to a JPEG blob, max `maxPx` on longest side.
 * Returns { blob, dataUrl, kb }
 */
export function compressImage(file, maxPx = 600, quality = 0.78) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx }
        else       { w = Math.round(w * maxPx / h); h = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        const reader = new FileReader()
        reader.onload = (ev) => resolve({
          blob,
          dataUrl: ev.target.result,
          kb: Math.round(blob.size / 1024),
        })
        reader.readAsDataURL(blob)
      }, 'image/jpeg', quality)
    }
    img.src = url
  })
}
