import { ATTRS } from '../lib/constants.js'

export function exportCSV(whiskies) {
  const headers = ['List','Name','Distillery','Region / Origin','Style','Age / Maturation',
    'Price','Date','Nose','Palate','Notes','Sweetness','Smokiness','Body','Fruitiness','Spiciness']
  const esc = v => {
    const s = v == null ? '' : String(v)
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const rows = whiskies.map(w =>
    [w.list || 'journal', w.name, w.distillery, w.origin, w.type, w.age, w.price, w.date,
     w.nose, w.palate, w.notes, ...ATTRS.map(a => w[a])].map(esc).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dram-journal-export-' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
}
