import { ref, computed } from 'vue'

// ─── Supported locales ────────────────────────────────────────────────────────
const SUPPORTED = ['en', 'es']

// Countries where Spanish is the primary/official language
const SPANISH_COUNTRIES = new Set([
  'AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ',
  'GT','HN','MX','NI','PA','PY','PE','ES','UY','VE',
])

/**
 * Map a BCP-47 language tag or ISO-3166-1 country code to one of our supported
 * locale keys. Returns null if we can't confidently map it.
 */
function mapToSupportedLocale(langOrCountry) {
  if (!langOrCountry) return null
  const base = langOrCountry.split(/[-_]/)[0].toLowerCase()
  if (base === 'es') return 'es'
  if (base === 'en') return 'en'
  // country code path (uppercase two-letter)
  if (SPANISH_COUNTRIES.has(langOrCountry.toUpperCase())) return 'es'
  return null
}

/**
 * Detect the best locale for a first-time visitor.
 *
 * Strategy (in order of priority):
 *  1. navigator.language / navigator.languages  — instant, no network
 *  2. IP-geolocation via ipapi.co               — catches VPN-free regional signals
 *
 * Only called when there is no existing 'dj_locale' in localStorage.
 * Saves the result so it only runs once.
 */
export async function detectLocale() {
  if (localStorage.getItem('dj_locale')) return  // already set by user or previous visit

  // 1. Browser language preference
  const browserLangs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || '']

  for (const lang of browserLangs) {
    const mapped = mapToSupportedLocale(lang)
    if (mapped) {
      _applyLocale(mapped)
      return
    }
  }

  // 2. IP geolocation fallback (best-effort, silently ignored on failure)
  try {
    const res  = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    const mapped = mapToSupportedLocale(data.country_code) ||
                   mapToSupportedLocale(data.languages?.split(',')[0])
    if (mapped) {
      _applyLocale(mapped)
      return
    }
  } catch {
    // Network unavailable or timed out — stay on default
  }

  // 3. Hard fallback
  _applyLocale('en')
}

function _applyLocale(l) {
  if (!SUPPORTED.includes(l)) return
  locale.value = l
  localStorage.setItem('dj_locale', l)
}

// ─── Reactive locale ──────────────────────────────────────────────────────────
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
    friendsFollowers: 'Friends & Followers',
    featureRequests: 'Feature Requests',
    adminRequests: 'Admin · Requests',

    // Inbox
    inbox: 'Inbox',
    inboxEmpty: 'All clear. Whisky recommendations and follow requests will appear here.',
    markAllRead: 'Mark all read',
    followRequest: 'Follow request',
    sharedDram: 'Shared dram',
    featureUpdate: 'Feature update',
    wantsToFollow: 'wants to follow you',
    accept: 'Accept',
    decline: 'Decline',

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
    moveToJournal: 'Move to Journal',
    finishBottle: 'Finish a bottle',
    noBottles: 'no bottles yet',
    view: 'View',
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
    country: 'Country',
    countryPlaceholder: 'Scotland',
    region: 'Region',
    regionPlaceholder: 'Speyside',
    regionOriginPlaceholder: 'Isle of Arran, Scotland',
    style: 'Style',
    ageMaturation: 'Age / Maturation',
    abv: 'ABV',
    agePlaceholder: '10 years / Bourbon cask',
    price: 'Price',
    pricePlaceholder: '£35–45',
    tastingDate: 'Tasting date',
    bottleCount: 'Bottles finished',
    lastFinished: 'Last finished',
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
    saveChanges: 'Save changes',
    addToJournalBtn: 'Add to Journal',
    addToWishlistBtn: 'Add to Wishlist',
    cancel: 'Cancel',
    close: 'Close',
    nameRequired: 'Name is required',

    // Catalogue search
    catalogueSearchPlaceholder: 'Search whisky or distillery…',
    catalogueNoResults:         'No results found.',
    catalogueNotFound:          'Not in the list?',
    catalogueAddManually:       'Add manually',
    yourOverride:               'Your override',
    searching:                  'Searching…',

    // Scan match
    scanMatchLabel:  'Is this the whisky?',
    scanMatchHint:   'Select the matching bottle from the catalogue:',
    scanNoMatch:     'No catalogue match found.',
    scanNotRight:    'Not the right one?',
    scanUseScanned:  'Use scanned data',

    // WhiskyModal – view mode
    editBtn: 'Edit',
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
    identifyWhisky: 'Identify whisky',
    retake: 'Retake',
    analysingBottle: 'Analysing bottle…',
    isReading: (model) => `${model} is reading the label`,
    whiskyIdentified: 'Whisky identified',
    addToList: (list) => `Add to ${list === 'wishlist' ? 'Wishlist' : 'Journal'}`,
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
    addToMyWishlist: 'Add to my Wishlist',
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
    addToMyWishlistOne: 'Add to Wishlist',
    added: '✓ Added',
    addedToWishlist: (name) => `✦ ${name} added to your Wishlist!`,
    addedAllToWishlist: (n) => `✦ ${n} bottles added to your Wishlist!`,
    addAllTo: (n) => `Add all ${n} to my Wishlist`,
    importFailed: '⚠ Import failed: ',

    // AppView / misc toasts
    deleted: 'Deleted',
    movedToJournal: (name) => `✓ ${name} moved to Journal`,
    bottleFinished: (name) => `${name} — bottle finished!`,
    whiskyUpdated: (name) => `✓ ${name} updated`,
    whiskyAdded: (name) => `✓ ${name} added`,

    // Trash
    trashSection: 'Trash',
    trashAutoFlush: 'items deleted after 5 days',
    trashRestore: 'Restore',
    trashDeleteNow: 'Delete permanently',
    trashDaySingular: 'day left',
    trashDayPlural: 'days left',
    trashMoved: (name) => `"${name}" moved to trash`,
    trashRestored: (name) => `✓ "${name}" restored to Journal`,

    // Empty states
    emptyWishlist: 'Your wishlist is empty\nPress "＋ Add" to start one',
    emptyJournal: 'No whiskies yet\nPress "＋ Add" to get started',

    // Recommendations
    recsTitle: 'Weekly Recommendations',
    recsSub: 'Personalised picks based on your journal — refreshed every Monday',
    recsGenerated: 'Generated on',
    added: 'Added',

    // Feature Requests panel
    frTitle: 'Feature Requests',
    frSubmitSection: '✦ Submit a new request',
    frTitleLabel: 'Feature title',
    frTitlePlaceholder: 'Short, descriptive name…',
    frDescLabel: 'Problem & description',
    frDescHint: 'What are you trying to achieve? Describe the problem, not just the solution.',
    frDescPlaceholder: 'Describe the underlying problem you\'re facing…',
    frImpactLabel: 'User impact',
    frImpactHint: 'How will this improve your experience? (e.g. "saves 20 min/week", "removes need for spreadsheet")',
    frImpactPlaceholder: 'Why does this matter to you?',
    frSubmitBtn: 'Submit request',
    frSubmitting: 'Submitting…',
    frSubmitSuccess: '✓ Request submitted! We\'ll review it soon.',
    frMyRequests: '✦ My requests',
    frEmpty: 'No requests yet. Share an idea above!',
    frLoading: 'Loading…',
    frDetails: '▼ details',
    frLess: '▲ less',
    frProblemStatement: 'Problem statement',
    frUserImpact: 'User impact',
    frSubmitted: 'Submitted',
    frPriority: 'Priority',
    frDue: 'Due',
    frFromTeam: 'From the team:',
    frStatusOpen: 'Open',
    frStatusAccepted: 'Accepted',
    frStatusInProgress: 'In Progress',
    frStatusDone: 'Done',
    frStatusDeclined: 'Declined',

    // Admin Feature Requests panel
    frAdminTitle: 'Feature Requests (Admin)',
    frAdminBadge: 'Admin',
    frAdminEmpty: 'No requests in this category.',
    frAdminNoteLabel: 'Note to user',
    frAdminNoteHint: '(shown when status → Done)',
    frAdminNotePlaceholder: 'Briefly describe what was built, or link to the release…',
    frAdminSave: 'Save changes',
    frAdminSaving: 'Saving…',
    frAdminSaved: '✓ Saved',
    frAdminSaveFailed: 'Failed to save',
    frAdminDelete: 'Delete',
    frAdminDeleteConfirm: 'Delete this request?',
    frAdminDeleteYes: 'Yes, delete',
    frAdminCancel: 'Cancel',
    frAdminManage: '▼ manage',
    frAdminCollapse: '▲ collapse',
    frAdminStatusLabel: 'Status',
    frAdminPriorityLabel: 'Priority',
    frAdminPriorityNone: '— none —',
    frAdminDueDateLabel: 'Due date',
    frAdminAccessDenied: 'Access denied',
    frAdminFilterAll: 'All',

    // Stats & Badges panel
    statsAndBadges: 'Stats & Badges',
    statsTitle: 'My Dram Stats',
    statsDrams: 'Drams',
    statsCountries: 'Countries',
    statsBadges: 'Badges',
    statsAchievements: '✦ Achievements',
    statsEarned: 'Earned',
    statsPassport: 'Regional Passport',
    badgeUnlocked: 'Badge Unlocked',
    allBadgesEarned: 'All badges earned',
    statsFooter: 'Keep exploring — more badges unlock as you taste!',
    statsFlavorWheel: 'Flavour Profile',
    statsFlavorWheelSub: 'Average across all fully-profiled entries',
    statsNotEnoughData: 'Log 3+ whiskies with all 5 flavour attributes to unlock this view',
    statsContinentHeadline: (countries, continents) => `${countries} ${countries === 1 ? 'country' : 'countries'} across ${continents} ${continents === 1 ? 'continent' : 'continents'}`,
    statsContinentBritishIsles: 'British Isles',
    statsContinentEurope: 'Europe',
    statsContinentAmericas: 'Americas',
    statsContinentAsia: 'Asia',
    statsContinentRestOfWorld: 'Rest of World',

    // Dashboard / sidebar
    quickStats: 'Quick Stats',
    totalDrams: 'Total Drams',
    logNewDram: 'Log new dram',
    galleryView: 'Gallery',
    listView: 'List',
    searchPlaceholder: 'Search by name, distillery or region…',

    // Community Feed tab
    feed: 'Feed',
    feedNoFollows: 'Follow some friends to see their activity here',
    feedNoFollowsSub: 'Add followers via Friends & Followers in the menu',
    feedNoActivity: 'No activity in the last 3 months',
    feedLogged: 'logged',
    feedRated: 'rated',
    feedJustNow: 'just now',
    feedMinutesAgo: (m) => `${m}m ago`,
    feedHoursAgo: (h) => `${h}h ago`,
    feedDaysAgo: (d) => `${d}d ago`,
    feedRefresh: 'Refresh',
    badges: {
      first_dram:       { name: 'First Dram',           desc: 'Log your first whisky' },
      tenner:           { name: 'The Tenner',            desc: '10 whiskies in your journal' },
      century:          { name: 'Century Club',          desc: '100 whiskies in your journal' },
      globe_trotter:    { name: 'Globe Trotter',         desc: 'Taste whiskies from 5+ countries' },
      peat_freak:       { name: 'Peat Freak',            desc: '10 whiskies with smokiness rated 4+' },
      the_critic:       { name: 'The Critic',            desc: 'Rate 50 whiskies' },
      flavor_arch:      { name: 'Flavor Archaeologist',  desc: 'Complete all 5 flavor attributes on 20 entries' },
      social_butterfly: { name: 'Social Butterfly',      desc: '5 people follow your journal' },
    },

    // Landing page
    landing: {
      nav: { signIn: 'Sign in', startFree: 'Start free', langLabel: 'Español' },
      hero: {
        eyebrow: 'Your whisky, recorded forever',
        title: 'Every dram<br>deserves a story.',
        sub: 'The Dram Journal is your personal whisky logbook — track tastings, build a wishlist, compare bottles side by side, and share drams with fellow enthusiasts.',
        ctaMain: 'Start your journal',
        note: 'Start free · No credit card required',
        floatBadge: 'New badge!',
        floatName: 'First Dram',
      },
      tasting: { nose: 'Nose', palate: 'Palate' },
      mockBarLabels: ['Sweetness', 'Smokiness', 'Body', 'Fruitiness', 'Spiciness'],
      compareBarLabels: ['Sweet', 'Smoke', 'Body', 'Fruit', 'Spice'],
      features: {
        eyebrow: "What's inside",
        title: 'Everything a whisky lover needs',
        items: [
          { title: 'Tasting Journal',      desc: 'Log every bottle with nose, palate, finish, personal notes, photos and a star rating. Your collection, beautifully organised.',          tags: ['Unlimited entries', 'Photo uploads', 'Star ratings'] },
          { title: 'Wishlist',             desc: 'Track bottles you want to try next. Add notes and reasons, then share your wishlist publicly with a single link.',                       tags: ['Public link', 'Import from friends'] },
          { title: 'Bottle Scanner',       desc: 'Point your camera at any bottle and AI identifies the whisky, auto-filling distillery, age, style and flavour profile from the catalogue.', tags: ['AI-powered', 'Catalogue of thousands'] },
          { title: 'Side-by-side Compare', desc: 'Select up to 3 bottles and compare every tasting dimension in a clear visual breakdown. Discover patterns in what you love.',            tags: ['Up to 3 at once', 'Visual charts'] },
          { title: 'Stats & Badges',       desc: 'Track countries, distilleries and styles explored. Earn badges for every milestone — from your first dram to the Century Club.',         tags: ['8 badges', 'Collection stats', 'Passport'] },
          { title: 'Friends & Sharing',    desc: 'Follow other collectors, send dram recommendations directly to their inbox, and import shared bottles into your own journal.',            tags: ['Direct sharing', 'Follow friends', 'Activity feed'] },
        ],
      },
      showcase: {
        eyebrow: 'Tasting notes',
        title: 'Rate every dimension<br>of your dram',
        desc: 'Go beyond nose and palate. Score each whisky on sweetness, smokiness, body, fruitiness and spice — then watch your flavour fingerprint emerge across your entire collection.',
      },
      compare: {
        eyebrow: 'Side by side',
        title: 'Compare up to 3 whiskies at once',
        desc: 'Select any bottles from your journal and instantly see how they stack up across every tasting dimension.',
      },
      social: {
        eyebrow: 'Community',
        title: 'Share the dram,<br>share the love',
        desc: 'Send a whisky recommendation directly to a friend. Follow fellow collectors. Share your wishlist publicly. Every bottle is a conversation starter.',
        items: [
          'Direct dram sharing with tasting notes',
          'Public wishlist links anyone can view',
          'Follow friends & see their activity',
          'Import shared bottles to your journal',
        ],
        msgPill: 'Shared dram',
        scanTitle: 'Scan a bottle',
        scanSub: 'AI identifies distillery, age & style automatically',
      },
      badgesSection: {
        eyebrow: 'Achievements',
        title: 'Collect badges<br>as you explore',
        desc: 'Every milestone — your first dram, a new country, a century of bottles — unlocks a badge. Eight to earn, zero to buy.',
        items: [
          { label: 'First Dram',           desc: 'Log your first whisky' },
          { label: 'The Tenner',           desc: '10 whiskies in your journal' },
          { label: 'Century Club',         desc: '100 whiskies in your journal' },
          { label: 'Globe Trotter',        desc: 'Taste whiskies from 5+ countries' },
          { label: 'Peat Freak',           desc: '10 whiskies with smokiness 4+' },
          { label: 'The Critic',           desc: 'Rate 50 whiskies' },
          { label: 'Flavor Archaeologist', desc: 'Complete all 5 flavor attributes on 20 entries' },
          { label: 'Social Butterfly',     desc: '5 people follow your journal' },
        ],
      },
      cta: {
        title: 'Your collection starts tonight.',
        sub: 'Join whisky lovers already logging their drams. Start free today.',
        btn: 'Create your journal',
      },
      footer: { copy: 'A labour of love for whisky enthusiasts.' },
    },
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
    friendsFollowers: 'Amigos y seguidores',
    featureRequests: 'Solicitudes de función',
    adminRequests: 'Admin · Solicitudes',

    // Inbox
    inbox: 'Bandeja de entrada',
    inboxEmpty: 'Todo al día. Las recomendaciones y solicitudes de seguimiento aparecerán aquí.',
    markAllRead: 'Marcar todo como leído',
    followRequest: 'Solicitud de seguimiento',
    sharedDram: 'Dram compartido',
    featureUpdate: 'Actualización de función',
    wantsToFollow: 'quiere seguirte',
    accept: 'Aceptar',
    decline: 'Rechazar',

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
    moveToJournal: 'Mover al Diario',
    finishBottle: 'Terminar una botella',
    noBottles: 'sin botellas aún',
    view: 'Ver',
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
    country: 'País',
    countryPlaceholder: 'Escocia',
    region: 'Región',
    regionPlaceholder: 'Speyside',
    regionOriginPlaceholder: 'Isla de Arran, Escocia',
    style: 'Estilo',
    ageMaturation: 'Edad / Maduración',
    abv: 'ABV',
    agePlaceholder: '10 años / Barrica de Bourbon',
    price: 'Precio',
    pricePlaceholder: '£35–45',
    tastingDate: 'Fecha de cata',
    bottleCount: 'Botellas terminadas',
    lastFinished: 'Última terminada',
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
    saveChanges: 'Guardar cambios',
    addToJournalBtn: 'Añadir al Diario',
    addToWishlistBtn: 'Añadir a la Lista',
    cancel: 'Cancelar',
    close: 'Cerrar',
    nameRequired: 'El nombre es obligatorio',

    // Catalogue search
    catalogueSearchPlaceholder: 'Buscar whisky o destilería…',
    catalogueNoResults:         'Sin resultados.',
    catalogueNotFound:          '¿No está en la lista?',
    catalogueAddManually:       'Añadir manualmente',
    yourOverride:               'Tu ajuste',
    searching:                  'Buscando…',

    // Scan match
    scanMatchLabel:  '¿Es este el whisky?',
    scanMatchHint:   'Selecciona la botella correcta del catálogo:',
    scanNoMatch:     'No se encontró coincidencia en el catálogo.',
    scanNotRight:    '¿No es el correcto?',
    scanUseScanned:  'Usar datos escaneados',

    // WhiskyModal – view mode
    editBtn: 'Editar',
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
    identifyWhisky: 'Identificar whisky',
    retake: 'Repetir',
    analysingBottle: 'Analizando botella…',
    isReading: (model) => `${model} está leyendo la etiqueta`,
    whiskyIdentified: 'Whisky identificado',
    addToList: (list) => `Añadir a ${list === 'wishlist' ? 'la Lista' : 'el Diario'}`,
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
    addToMyWishlist: 'Añadir a mi Lista',
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
    addToMyWishlistOne: 'Añadir a la Lista',
    added: '✓ Añadido',
    addedToWishlist: (name) => `✦ ${name} añadido a tu Lista!`,
    addedAllToWishlist: (n) => `✦ ${n} botellas añadidas a tu Lista!`,
    addAllTo: (n) => `Añadir las ${n} a mi Lista`,
    importFailed: '⚠ Error al importar: ',

    // AppView / misc toasts
    deleted: 'Eliminado',
    movedToJournal: (name) => `✓ ${name} movido al Diario`,
    bottleFinished: (name) => `${name} — ¡botella terminada!`,
    whiskyUpdated: (name) => `✓ ${name} actualizado`,
    whiskyAdded: (name) => `✓ ${name} añadido`,

    // Trash
    trashSection: 'Papelera',
    trashAutoFlush: 'se eliminan tras 5 días',
    trashRestore: 'Restaurar',
    trashDeleteNow: 'Eliminar permanentemente',
    trashDaySingular: 'día restante',
    trashDayPlural: 'días restantes',
    trashMoved: (name) => `"${name}" movido a la papelera`,
    trashRestored: (name) => `✓ "${name}" restaurado al Diario`,

    // Empty states
    emptyWishlist: 'Tu lista está vacía\nPulsa "＋ Añadir" para empezar',
    emptyJournal: 'Aún no hay whiskies\nPulsa "＋ Añadir" para comenzar',

    // Recommendations
    recsTitle: 'Recomendaciones Semanales',
    recsSub: 'Selecciones personalizadas basadas en tu diario — actualizadas cada lunes',
    recsGenerated: 'Generado el',
    added: 'Añadido',

    // Feature Requests panel
    frTitle: 'Solicitudes de función',
    frSubmitSection: '✦ Enviar nueva solicitud',
    frTitleLabel: 'Título de la función',
    frTitlePlaceholder: 'Nombre corto y descriptivo…',
    frDescLabel: 'Problema y descripción',
    frDescHint: '¿Qué intentas lograr? Describe el problema, no solo la solución.',
    frDescPlaceholder: 'Describe el problema al que te enfrentas…',
    frImpactLabel: 'Impacto para el usuario',
    frImpactHint: '¿Cómo mejoraría tu experiencia? (p.ej. "ahorra 20 min/semana", "elimina la necesidad de una hoja de cálculo")',
    frImpactPlaceholder: '¿Por qué es importante para ti?',
    frSubmitBtn: 'Enviar solicitud',
    frSubmitting: 'Enviando…',
    frSubmitSuccess: '✓ ¡Solicitud enviada! La revisaremos pronto.',
    frMyRequests: '✦ Mis solicitudes',
    frEmpty: 'Sin solicitudes aún. ¡Comparte una idea arriba!',
    frLoading: 'Cargando…',
    frDetails: '▼ detalles',
    frLess: '▲ menos',
    frProblemStatement: 'Descripción del problema',
    frUserImpact: 'Impacto para el usuario',
    frSubmitted: 'Enviado',
    frPriority: 'Prioridad',
    frDue: 'Fecha límite',
    frFromTeam: 'Del equipo:',
    frStatusOpen: 'Abierta',
    frStatusAccepted: 'Aceptada',
    frStatusInProgress: 'En progreso',
    frStatusDone: 'Completada',
    frStatusDeclined: 'Rechazada',

    // Admin Feature Requests panel
    frAdminTitle: 'Solicitudes de función (Admin)',
    frAdminBadge: 'Admin',
    frAdminEmpty: 'No hay solicitudes en esta categoría.',
    frAdminNoteLabel: 'Nota para el usuario',
    frAdminNoteHint: '(se muestra cuando el estado → Completada)',
    frAdminNotePlaceholder: 'Describe brevemente qué se creó, o enlaza a la versión…',
    frAdminSave: 'Guardar cambios',
    frAdminSaving: 'Guardando…',
    frAdminSaved: '✓ Guardado',
    frAdminSaveFailed: 'Error al guardar',
    frAdminDelete: 'Eliminar',
    frAdminDeleteConfirm: '¿Eliminar esta solicitud?',
    frAdminDeleteYes: 'Sí, eliminar',
    frAdminCancel: 'Cancelar',
    frAdminManage: '▼ gestionar',
    frAdminCollapse: '▲ colapsar',
    frAdminStatusLabel: 'Estado',
    frAdminPriorityLabel: 'Prioridad',
    frAdminPriorityNone: '— ninguna —',
    frAdminDueDateLabel: 'Fecha límite',
    frAdminAccessDenied: 'Acceso denegado',
    frAdminFilterAll: 'Todo',

    // Stats & Badges panel
    statsAndBadges: 'Estadísticas e Insignias',
    statsTitle: 'Mis Estadísticas',
    statsDrams: 'Drams',
    statsCountries: 'Países',
    statsBadges: 'Insignias',
    statsAchievements: '✦ Logros',
    statsEarned: 'Obtenida',
    statsPassport: 'Pasaporte Regional',
    badgeUnlocked: 'Insignia Desbloqueada',
    allBadgesEarned: 'Todas las insignias obtenidas',
    statsFooter: '¡Sigue explorando — desbloqueas más insignias al degustar!',
    statsFlavorWheel: 'Perfil de Sabor',
    statsFlavorWheelSub: 'Promedio de todas las entradas con perfil completo',
    statsNotEnoughData: 'Registra 3+ whiskies con los 5 atributos de sabor para desbloquear esta vista',
    statsContinentHeadline: (countries, continents) => `${countries} ${countries === 1 ? 'país' : 'países'} en ${continents} ${continents === 1 ? 'continente' : 'continentes'}`,
    statsContinentBritishIsles: 'Islas Británicas',
    statsContinentEurope: 'Europa',
    statsContinentAmericas: 'Américas',
    statsContinentAsia: 'Asia',
    statsContinentRestOfWorld: 'Resto del mundo',

    // Dashboard / sidebar
    quickStats: 'Estadísticas',
    totalDrams: 'Total Drams',
    logNewDram: 'Registrar dram',
    galleryView: 'Galería',
    listView: 'Lista',
    searchPlaceholder: 'Buscar por nombre, destilería o región…',

    // Community Feed tab
    feed: 'Feed',
    feedNoFollows: 'Sigue a amigos para ver su actividad aquí',
    feedNoFollowsSub: 'Añade seguidores desde Amigos y seguidores en el menú',
    feedNoActivity: 'Sin actividad en los últimos 3 meses',
    feedLogged: 'añadió',
    feedRated: 'valoró',
    feedJustNow: 'ahora mismo',
    feedMinutesAgo: (m) => `hace ${m}m`,
    feedHoursAgo: (h) => `hace ${h}h`,
    feedDaysAgo: (d) => `hace ${d}d`,
    feedRefresh: 'Actualizar',
    badges: {
      first_dram:       { name: 'Primer Dram',           desc: 'Registra tu primer whisky' },
      tenner:           { name: 'El Diez',               desc: '10 whiskies en tu diario' },
      century:          { name: 'Club del Centenar',     desc: '100 whiskies en tu diario' },
      globe_trotter:    { name: 'Trotamundos',           desc: 'Prueba whiskies de 5+ países' },
      peat_freak:       { name: 'Fanático del Turba',    desc: '10 whiskies con ahumado de 4+' },
      the_critic:       { name: 'El Crítico',            desc: 'Valora 50 whiskies' },
      flavor_arch:      { name: 'Arqueólogo del Sabor',  desc: 'Completa los 5 atributos de sabor en 20 entradas' },
      social_butterfly: { name: 'Alma de la Fiesta',     desc: '5 personas siguen tu diario' },
    },

    // Landing page
    landing: {
      nav: { signIn: 'Iniciar sesión', startFree: 'Empezar gratis', langLabel: 'English' },
      hero: {
        eyebrow: 'Tu whisky, registrado para siempre',
        title: 'Cada dram<br>merece una historia.',
        sub: 'The Dram Journal es tu registro personal de whisky — anota catas, crea una lista de deseos, compara botellas en paralelo y comparte drams con otros entusiastas.',
        ctaMain: 'Empieza tu diario',
        note: 'Gratis · Sin tarjeta de crédito',
        floatBadge: '¡Nueva insignia!',
        floatName: 'Primer Dram',
      },
      tasting: { nose: 'Nariz', palate: 'Paladar' },
      mockBarLabels: ['Dulzura', 'Ahumado', 'Cuerpo', 'Frutado', 'Especiado'],
      compareBarLabels: ['Dulce', 'Ahumado', 'Cuerpo', 'Fruta', 'Especia'],
      features: {
        eyebrow: 'Qué incluye',
        title: 'Todo lo que un amante del whisky necesita',
        items: [
          { title: 'Diario de Catas',      desc: 'Registra cada botella con nariz, paladar, final, notas personales, fotos y puntuación. Tu colección, perfectamente organizada.',            tags: ['Entradas ilimitadas', 'Subida de fotos', 'Puntuaciones'] },
          { title: 'Lista de Deseos',      desc: 'Registra botellas que quieres probar. Añade notas y razones, luego comparte tu lista públicamente con un solo enlace.',                     tags: ['Enlace público', 'Importar de amigos'] },
          { title: 'Escáner de Botellas',  desc: 'Apunta tu cámara a cualquier botella y la IA identifica el whisky, rellenando automáticamente destilería, edad, estilo y perfil de sabor.', tags: ['Con IA', 'Catálogo de miles'] },
          { title: 'Comparar en Paralelo', desc: 'Selecciona hasta 3 botellas y compara cada dimensión de cata en un desglose visual claro. Descubre patrones en lo que te gusta.',          tags: ['Hasta 3 a la vez', 'Gráficos visuales'] },
          { title: 'Estadísticas e Insignias', desc: 'Sigue países, destilerías y estilos explorados. Gana insignias por cada hito — desde tu primer dram al Club del Siglo.',              tags: ['8 insignias', 'Estadísticas', 'Pasaporte'] },
          { title: 'Amigos y Compartir',   desc: 'Sigue a otros coleccionistas, envía recomendaciones de drams a sus buzones e importa botellas compartidas a tu propio diario.',            tags: ['Compartir directo', 'Seguir amigos', 'Actividad'] },
        ],
      },
      showcase: {
        eyebrow: 'Notas de cata',
        title: 'Puntúa cada dimensión<br>de tu dram',
        desc: 'Ve más allá de nariz y paladar. Puntúa cada whisky en dulzura, ahumado, cuerpo, frutado y especiado — y observa tu perfil de sabor emerger en toda tu colección.',
      },
      compare: {
        eyebrow: 'Cara a cara',
        title: 'Compara hasta 3 whiskies a la vez',
        desc: 'Selecciona cualquier botella de tu diario y ve al instante cómo se comparan en cada dimensión de cata.',
      },
      social: {
        eyebrow: 'Comunidad',
        title: 'Comparte el dram,<br>comparte el amor',
        desc: 'Envía una recomendación de whisky directamente a un amigo. Sigue a otros coleccionistas. Comparte tu lista públicamente. Cada botella es un punto de partida.',
        items: [
          'Compartir drams directamente con notas de cata',
          'Listas de deseos públicas que cualquiera puede ver',
          'Sigue amigos y ve su actividad',
          'Importa botellas compartidas a tu diario',
        ],
        msgPill: 'Dram compartido',
        scanTitle: 'Escanear una botella',
        scanSub: 'La IA identifica destilería, edad y estilo automáticamente',
      },
      badgesSection: {
        eyebrow: 'Logros',
        title: 'Colecciona insignias<br>mientras exploras',
        desc: 'Cada hito — tu primer dram, un nuevo país, un centenar de botellas — desbloquea una insignia. Ocho por ganar, ninguna por comprar.',
        items: [
          { label: 'Primer Dram',           desc: 'Registra tu primer whisky' },
          { label: 'La Decena',             desc: '10 whiskies en tu diario' },
          { label: 'Club del Siglo',        desc: '100 whiskies en tu diario' },
          { label: 'Trotamundos',           desc: 'Prueba whiskies de 5+ países' },
          { label: 'Fanático de la Turba',  desc: '10 whiskies con ahumado 4+' },
          { label: 'El Crítico',            desc: 'Puntúa 50 whiskies' },
          { label: 'Arqueólogo de Sabores', desc: 'Completa los 5 atributos de sabor en 20 entradas' },
          { label: 'Alma de la Fiesta',       desc: '5 personas siguen tu diario' },
        ],
      },
      cta: {
        title: 'Tu colección empieza esta noche.',
        sub: 'Únete a los amantes del whisky que ya registran sus drams. Empieza gratis hoy.',
        btn: 'Crea tu diario',
      },
      footer: { copy: 'Una obra de amor para entusiastas del whisky.' },
    },
  },
}