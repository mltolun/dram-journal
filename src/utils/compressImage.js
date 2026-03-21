/**
 * Resize an image File/Blob, max `maxPx` on longest side.
 *
 * format: 'image/jpeg' — white-fills transparent areas, outputs JPEG
 * format: 'image/png'  — preserves transparency, outputs PNG
 *
 * Returns { blob, dataUrl, kb }
 */
export function compressImage(file, maxPx = 600, quality = 0.78, format = 'image/png') {
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
      const ctx = canvas.getContext('2d')

      if (format === 'image/jpeg') {
        // JPEG has no alpha channel — fill white so transparency
        // doesn't render as black.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
      }
      // For PNG, leave the canvas transparent so the removed background
      // stays transparent in the stored file.

      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        const reader = new FileReader()
        reader.onload = (ev) => resolve({
          blob,
          dataUrl: ev.target.result,
          kb: Math.round(blob.size / 1024),
        })
        reader.readAsDataURL(blob)
      }, format, quality)
    }
    img.src = url
  })
}
