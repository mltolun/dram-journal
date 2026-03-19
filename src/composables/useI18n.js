import { ref, computed } from 'vue'

const locale = ref(localStorage.getItem('dj_locale') || 'en')

export function useI18n() {
  function setLocale(l) {
    locale.value = l
    localStorage.setItem('dj_locale', l)
  }

  function toggleLocale() {
    setLocale(locale.value === 'en' ? 'es' : 'en')
  }

  const t = computed(() => TRANSLATIONS[locale.value] || TRANSLATIONS.en)

  return { locale, t, setLocale, toggleLocale }
}

// ─── Translations ─────────────────────────────────────────────────────────────

const TRANSLATIONS = {
  en: {
    // Brand
    brandTitle: 'The Dram Journal',
    brandSub: 'Whisky tasting & comparison log',

    // Header menu
    exportCsv: 'Export CSV',
    signOut: 'Sign out',
    nothingToExport: 'Nothing to export',
    csvExported: '✓ CSV exported',

    // Auth
    signIn: 'Sign in',
    register: 'Register',
    emailAddress: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    createAccount: 'Create account',
    forgotPassword: 'Forgot your password?',
    fillAllFields: 'Please fill in all fields',
    passwordsNoMatch: 'Passwords do not match',
    passwordTooShort: 'Password must be at least 6 characters',
    accountCreated: 'Account created! Check your email to confirm.',
    enterEmailFirst: 'Enter your email first',
    passwordResetSent: 'Password reset email sent.',

    // Toolbar
    journal: 'Journal',
    wishlist: 'Wishlist',
    selected: 'selected',
    compare: 'Compare',
    share: 'Share',
    scan: 'Scan',
    add: 'Add',
    selectFirst: 'Select at least 2 whiskies to compare',
    maxWhiskies: 'Maximum 3 whiskies for comparison',
    clearSelected: 'Clear selection',

    // WhiskyCard
    moveToJournal: '↑ Move to Journal',
    view: '⊙ View',
    delete: '✕',

    // WhiskyModal – titles
    addToWishlist: 'Add to Wishlist',
    addToJournal: 'Add to Journal',
    edit: 'Edit',

    // WhiskyModal – form fields
    name: 'Name',
    namePlaceholder: 'Arran 10 Years Old',
    photo: 'Photo',
    distillery: 'Distillery',
    distilleryPlaceholder: 'Arran',
    regionOrigin: 'Region / Origin',
    regionPlaceholder: 'Isle of Arran, Scotland',
    style: 'Style',
    ageMaturation: 'Age / Maturation',
    agePlaceholder: '10 years / Bourbon cask',
    price: 'Price',
    pricePlaceholder: '£35–45',
    tastingDate: 'Tasting date',
    flavourProfile: '— Flavour profile (0–5)',
    nose: 'Nose',
    nosePlaceholder: 'Vanilla, green apple…',
    palate: 'Palate',
    palatePlaceholder: 'Sweet malt, warm spice…',
    rating: 'Rating',
    personalNotes: 'Personal notes',
    notesPlaceholder: 'My impressions…',
    wishlistNotes: 'Notes / Why I want this',
    wishlistNotesPlaceholder: 'Recommended by…, Seen at…',

    // WhiskyModal – style options
    scotch: 'Scotch',
    irish: 'Irish',
    bourbon: 'Bourbon',
    japanese: 'Japanese',
    other: 'Other',

    // WhiskyModal – actions
    saving: 'Saving…',
    saveChanges: '✓ Save changes',
    addToJournalBtn: '＋ Add to Journal',
    addToWishlistBtn: '✦ Add to Wishlist',
    cancel: 'Cancel',
    close: 'Close',
    nameRequired: 'Name is required',

    // WhiskyModal – view mode
    editBtn: '✎ Edit',
    flavourProfileView: '— Flavour profile',

    // Flavour attributes
    attrs: {
      dulzor: 'Sweetness',
      ahumado: 'Smokiness',
      cuerpo: 'Body',
      frutado: 'Fruitiness',
      especiado: 'Spiciness',
    },

    // Type labels
    types: {
      scotch: 'Scotch',
      irish: 'Irish',
      bourbon: 'Bourbon',
      japanese: 'Japanese',
      other: 'Other',
    },

    // ComparePanel
    comparison: '— Comparison',
    whisky: 'Whisky',
    type: 'Type',
    ageMaturationCol: 'Age / Maturation',
    flavourProfileSection: '— Flavour profile',
    personalNotesSection: '— Personal notes',
    noNotes: 'No notes',
    compMatrixCols: [
      { label: 'Distillery',       key: 'distillery' },
      { label: 'Type',             key: 'type', badge: true },
      { label: 'Age / Maturation', key: 'age' },
      { label: 'Nose',             key: 'nose' },
      { label: 'Palate',           key: 'palate' },
      { label: 'Price',            key: 'price' },
    ],

    // ShareModal
    shareThisDram: 'Share this dram',
    shareThisDramSpan: 'this dram',
    shareDescription: 'Anyone with this link can view a read-only snapshot. Dram Journal members can import it into their own collection.',
    copy: 'Copy',
    linkCopied: '✓ Link copied',
    linkPublicDram: 'Link is public — anyone can view this dram. Logged-in users can import it.',
    generatingLink: 'Generating link…',
    couldNotGenerateLink: '⚠ Could not generate link: ',

    // WishlistShareModal
    shareWishlist: 'Share wishlist',
    shareWishlistSpan: 'wishlist',
    sharingBottles: (count) => `Sharing <strong>${count} ${count === 1 ? 'bottle' : 'bottles'}</strong> from your wishlist. Anyone with this link can view and import them.`,
    linkPublicWishlist: 'Link is public — anyone can view and import your wishlist.',

    // ScanModal
    scanBottle: 'Scan bottle',
    scanBottleSpan: 'bottle',
    tapToPhoto: 'Tap to take / choose photo',
    orDragDrop: 'or drag & drop',
    scansRemaining: (remaining, cap) => `${remaining} of ${cap} scans remaining today`,
    identifyWhisky: '🔍 Identify whisky',
    retake: 'Retake',
    analysingBottle: 'Analysing bottle…',
    isReading: (model) => `${model} is reading the label`,
    whiskyIdentified: '✓ Whisky identified',
    addToList: (list) => `＋ Add to ${list === 'wishlist' ? 'Wishlist' : 'Journal'}`,
    scanAgain: 'Scan again',
    tryAgain: 'Try again',
    imageProcessing: 'Image still processing, please wait a moment.',
    dailyLimitReached: (cap) => `Daily scan limit of ${cap} reached. Try again tomorrow.`,
    scanFieldLabels: {
      name: 'Name', distillery: 'Distillery', origin: 'Region',
      type: 'Style', age: 'Age / ABV',
    },

    // ShareView
    loading: 'Loading…',
    dramNotFound: 'This dram could not be found',
    backToJournal: '← Back to The Dram Journal',
    details: '— Details',
    notes: '— Notes',
    addToMyWishlist: '✦ Add to my Wishlist',
    importing: 'Importing…',
    signInToImport: 'Sign in to import',
    backToJournalBtn: '← Back to journal',
    shareDetailLabels: {
      distillery: 'Distillery',
      origin: 'Region / Origin',
      style: 'Style',
      age: 'Age / Maturation',
      price: 'Price',
      date: 'Tasting date',
      nose: 'Nose',
      palate: 'Palate',
    },

    // WishlistShareView
    wishlistNotFound: 'This wishlist could not be found',
    bottle: 'bottle',
    bottles: 'bottles',
    shared: 'shared',
    addToMyWishlistOne: '✦ Add to Wishlist',
    added: '✓ Added',
    addedToWishlist: (name) => `✦ ${name} added to your Wishlist!`,
    addedAllToWishlist: (n) => `✦ ${n} bottles added to your Wishlist!`,
    addAllTo: (n) => `✦ Add all ${n} to my Wishlist`,
    importFailed: '⚠ Import failed: ',

    // AppView / misc toasts
    deleted: 'Deleted',
    movedToJournal: (name) => `✓ ${name} moved to Journal`,
    whiskyUpdated: (name) => `✓ ${name} updated`,
    whiskyAdded: (name) => `✓ ${name} added`,

    // Empty states
    emptyWishlist: 'Your wishlist is empty\nPress "＋ Add" to start one',
    emptyJournal: 'No whiskies yet\nPress "＋ Add" to get started',
  },

  es: {
    // Brand
    brandTitle: 'The Dram Journal',
    brandSub: 'Registro de catas y comparaciones',

    // Header menu
    exportCsv: 'Exportar CSV',
    signOut: 'Cerrar sesión',
    nothingToExport: 'Nada que exportar',
    csvExported: '✓ CSV exportado',

    // Auth
    signIn: 'Iniciar sesión',
    register: 'Registrarse',
    emailAddress: 'Correo electrónico',
    password: 'Contraseña',
    confirmPassword: 'Confirmar contraseña',
    createAccount: 'Crear cuenta',
    forgotPassword: '¿Olvidaste tu contraseña?',
    fillAllFields: 'Por favor completa todos los campos',
    passwordsNoMatch: 'Las contraseñas no coinciden',
    passwordTooShort: 'La contraseña debe tener al menos 6 caracteres',
    accountCreated: '¡Cuenta creada! Revisa tu correo para confirmar.',
    enterEmailFirst: 'Ingresa tu correo primero',
    passwordResetSent: 'Correo de restablecimiento enviado.',

    // Toolbar
    journal: 'Diario',
    wishlist: 'Lista de deseos',
    selected: 'seleccionados',
    compare: 'Comparar',
    share: 'Compartir',
    scan: 'Escanear',
    add: 'Añadir',
    selectFirst: 'Selecciona al menos 2 whiskies para comparar',
    maxWhiskies: 'Máximo 3 whiskies para comparar',
    clearSelected: 'Limpiar selección',

    // WhiskyCard
    moveToJournal: '↑ Mover al Diario',
    view: '⊙ Ver',
    delete: '✕',

    // WhiskyModal – titles
    addToWishlist: 'Añadir a la Lista',
    addToJournal: 'Añadir al Diario',
    edit: 'Editar',

    // WhiskyModal – form fields
    name: 'Nombre',
    namePlaceholder: 'Arran 10 Years Old',
    photo: 'Foto',
    distillery: 'Destilería',
    distilleryPlaceholder: 'Arran',
    regionOrigin: 'Región / Origen',
    regionPlaceholder: 'Isla de Arran, Escocia',
    style: 'Estilo',
    ageMaturation: 'Edad / Maduración',
    agePlaceholder: '10 años / Barrica de Bourbon',
    price: 'Precio',
    pricePlaceholder: '£35–45',
    tastingDate: 'Fecha de cata',
    flavourProfile: '— Perfil de sabor (0–5)',
    nose: 'Nariz',
    nosePlaceholder: 'Vainilla, manzana verde…',
    palate: 'Paladar',
    palatePlaceholder: 'Malta dulce, especias cálidas…',
    rating: 'Puntuación',
    personalNotes: 'Notas personales',
    notesPlaceholder: 'Mis impresiones…',
    wishlistNotes: 'Notas / Por qué lo quiero',
    wishlistNotesPlaceholder: 'Recomendado por…, Visto en…',

    // WhiskyModal – style options
    scotch: 'Escocés',
    irish: 'Irlandés',
    bourbon: 'Bourbon',
    japanese: 'Japonés',
    other: 'Otro',

    // WhiskyModal – actions
    saving: 'Guardando…',
    saveChanges: '✓ Guardar cambios',
    addToJournalBtn: '＋ Añadir al Diario',
    addToWishlistBtn: '✦ Añadir a la Lista',
    cancel: 'Cancelar',
    close: 'Cerrar',
    nameRequired: 'El nombre es obligatorio',

    // WhiskyModal – view mode
    editBtn: '✎ Editar',
    flavourProfileView: '— Perfil de sabor',

    // Flavour attributes
    attrs: {
      dulzor: 'Dulzor',
      ahumado: 'Ahumado',
      cuerpo: 'Cuerpo',
      frutado: 'Frutado',
      especiado: 'Especiado',
    },

    // Type labels
    types: {
      scotch: 'Escocés',
      irish: 'Irlandés',
      bourbon: 'Bourbon',
      japanese: 'Japonés',
      other: 'Otro',
    },

    // ComparePanel
    comparison: '— Comparación',
    whisky: 'Whisky',
    type: 'Tipo',
    ageMaturationCol: 'Edad / Maduración',
    flavourProfileSection: '— Perfil de sabor',
    personalNotesSection: '— Notas personales',
    noNotes: 'Sin notas',
    compMatrixCols: [
      { label: 'Destilería',       key: 'distillery' },
      { label: 'Tipo',             key: 'type', badge: true },
      { label: 'Edad / Maduración',key: 'age' },
      { label: 'Nariz',            key: 'nose' },
      { label: 'Paladar',          key: 'palate' },
      { label: 'Precio',           key: 'price' },
    ],

    // ShareModal
    shareThisDram: 'Compartir este dram',
    shareThisDramSpan: 'este dram',
    shareDescription: 'Cualquiera con este enlace puede ver una copia de solo lectura. Los miembros de Dram Journal pueden importarlo a su colección.',
    copy: 'Copiar',
    linkCopied: '✓ Enlace copiado',
    linkPublicDram: 'El enlace es público — cualquiera puede ver este dram. Los usuarios registrados pueden importarlo.',
    generatingLink: 'Generando enlace…',
    couldNotGenerateLink: '⚠ No se pudo generar el enlace: ',

    // WishlistShareModal
    shareWishlist: 'Compartir lista',
    shareWishlistSpan: 'lista',
    sharingBottles: (count) => `Compartiendo <strong>${count} ${count === 1 ? 'botella' : 'botellas'}</strong> de tu lista. Cualquiera con este enlace puede verlas e importarlas.`,
    linkPublicWishlist: 'El enlace es público — cualquiera puede ver e importar tu lista.',

    // ScanModal
    scanBottle: 'Escanear botella',
    scanBottleSpan: 'botella',
    tapToPhoto: 'Toca para tomar / elegir foto',
    orDragDrop: 'o arrastra y suelta',
    scansRemaining: (remaining, cap) => `${remaining} de ${cap} escaneos restantes hoy`,
    identifyWhisky: '🔍 Identificar whisky',
    retake: 'Repetir',
    analysingBottle: 'Analizando botella…',
    isReading: (model) => `${model} está leyendo la etiqueta`,
    whiskyIdentified: '✓ Whisky identificado',
    addToList: (list) => `＋ Añadir a ${list === 'wishlist' ? 'la Lista' : 'el Diario'}`,
    scanAgain: 'Escanear de nuevo',
    tryAgain: 'Intentar de nuevo',
    imageProcessing: 'La imagen aún se está procesando, espera un momento.',
    dailyLimitReached: (cap) => `Límite diario de ${cap} escaneos alcanzado. Inténtalo mañana.`,
    scanFieldLabels: {
      name: 'Nombre', distillery: 'Destilería', origin: 'Región',
      type: 'Estilo', age: 'Edad / ABV',
    },

    // ShareView
    loading: 'Cargando…',
    dramNotFound: 'No se encontró este dram',
    backToJournal: '← Volver a The Dram Journal',
    details: '— Detalles',
    notes: '— Notas',
    addToMyWishlist: '✦ Añadir a mi Lista',
    importing: 'Importando…',
    signInToImport: 'Inicia sesión para importar',
    backToJournalBtn: '← Volver al diario',
    shareDetailLabels: {
      distillery: 'Destilería',
      origin: 'Región / Origen',
      style: 'Estilo',
      age: 'Edad / Maduración',
      price: 'Precio',
      date: 'Fecha de cata',
      nose: 'Nariz',
      palate: 'Paladar',
    },

    // WishlistShareView
    wishlistNotFound: 'No se encontró esta lista de deseos',
    bottle: 'botella',
    bottles: 'botellas',
    shared: 'compartida',
    addToMyWishlistOne: '✦ Añadir a la Lista',
    added: '✓ Añadido',
    addedToWishlist: (name) => `✦ ${name} añadido a tu Lista!`,
    addedAllToWishlist: (n) => `✦ ${n} botellas añadidas a tu Lista!`,
    addAllTo: (n) => `✦ Añadir las ${n} a mi Lista`,
    importFailed: '⚠ Error al importar: ',

    // AppView / misc toasts
    deleted: 'Eliminado',
    movedToJournal: (name) => `✓ ${name} movido al Diario`,
    whiskyUpdated: (name) => `✓ ${name} actualizado`,
    whiskyAdded: (name) => `✓ ${name} añadido`,

    // Empty states
    emptyWishlist: 'Tu lista está vacía\nPulsa "＋ Añadir" para empezar',
    emptyJournal: 'Aún no hay whiskies\nPulsa "＋ Añadir" para comenzar',
  },
}
