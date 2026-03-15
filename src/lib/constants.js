export const COLOR_HEX = ['#C8822A', '#3B8BD4', '#1D9E75', '#7F77DD']

export const ATTRS = ['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado']

export const ATTR_LABELS = {
  dulzor:    'Sweetness',
  ahumado:   'Smokiness',
  cuerpo:    'Body',
  frutado:   'Fruitiness',
  especiado: 'Spiciness',
}

export const DEFAULTS = {
  dulzor: 3, ahumado: 1, cuerpo: 3, frutado: 3, especiado: 2,
}

export const TYPE_LABELS = {
  scotch: 'Scotch', irish: 'Irish', bourbon: 'Bourbon',
  japanese: 'Japanese', other: 'Other',
}

export const TYPE_BADGE_STYLE = {
  scotch:   'background:rgba(200,130,42,0.15);color:var(--amber-light)',
  irish:    'background:rgba(50,170,100,0.15);color:#6ecb93',
  bourbon:  'background:rgba(180,80,80,0.15);color:#e08888',
  japanese: 'background:rgba(180,150,230,0.15);color:#c4aff0',
  other:    'background:rgba(150,150,150,0.15);color:#aaa',
}
