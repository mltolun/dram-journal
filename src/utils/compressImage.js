/**
 * Compress an image File to a JPEG (default) or WebP blob, max `maxPx` on the
 * longest side. If the browser can't encode the requested type (older Safari
 * silently returns PNG for WebP) it falls back to JPEG.
 * Returns { blob, dataUrl, kb }
 */
export function compressImage(file, maxPx = 600, quality = 0.78, type = 'image/jpeg') {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image file. Try a different photo.'))
    }
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx }
        else       { w = Math.round(w * maxPx / h); h = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const finish = (blob) => {
        URL.revokeObjectURL(url)
        if (!blob) { reject(new Error('Could not process that image file.')); return }
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Could not process that image file.'))
        reader.onload = (ev) => resolve({
          blob,
          dataUrl: ev.target.result,
          kb: Math.round(blob.size / 1024),
        })
        reader.readAsDataURL(blob)
      }
      canvas.toBlob((blob) => {
        if (blob && blob.type !== type && type !== 'image/jpeg') {
          canvas.toBlob(finish, 'image/jpeg', quality)   // encoder unsupported → JPEG
        } else {
          finish(blob)
        }
      }, type, quality)
    }
    img.src = url
  })
}
