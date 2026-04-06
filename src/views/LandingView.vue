<template>
  <div class="landing" data-theme="light">

    <!-- ── NAV ── -->
    <nav class="l-nav">
      <div class="l-nav-brand">The <span>Dram</span> Journal</div>
      <div class="l-nav-actions">
        <div class="l-lang-wrap">
          <button class="l-btn-ghost l-lang-btn" @click="langOpen = !langOpen" :class="{ active: langOpen }">
            <GlobeIcon :size="15" />
          </button>
          <div v-if="langOpen" class="l-lang-dropdown">
            <button @click="setLocale('en'); langOpen = false" :class="{ selected: locale === 'en' }">English</button>
            <button @click="setLocale('es'); langOpen = false" :class="{ selected: locale === 'es' }">Español</button>
          </div>
        </div>
        <button class="l-btn-ghost" @click="goToApp('login')">{{ L.nav.signIn }}</button>
        <button class="l-btn-primary" @click="goToApp('register')">{{ L.nav.startFree }}</button>
      </div>
    </nav>

    <!-- ── HERO ── -->
    <section class="l-hero">
      <div class="l-hero-glow"></div>
      <div class="l-hero-content">
        <div class="l-eyebrow">{{ L.hero.eyebrow }}</div>
        <h1 class="l-hero-title" v-html="L.hero.title"></h1>
        <p class="l-hero-sub">{{ L.hero.sub }}</p>
        <div class="l-hero-cta">
          <button class="l-btn-primary l-btn-lg" @click="goToApp('register')">
            <BookOpenIcon :size="16" /> {{ L.hero.ctaMain }}
          </button>
          <button class="l-btn-outline l-btn-lg" @click="goToApp('login')">
            {{ L.nav.signIn }}
          </button>
        </div>
        <p class="l-hero-note">{{ L.hero.note }}</p>
      </div>

      <!-- Mock whisky card -->
      <div class="l-hero-mock">
        <div class="l-mock-card">
          <div class="l-mock-header">
            <span class="wcard-type type-scotch">Scotch</span>
            <div class="l-mock-stars">
              <StarIcon v-for="n in 5" :key="n" :size="12"
                :class="n <= 4 ? 'star-filled' : 'star-empty'" />
            </div>
          </div>
          <div class="l-mock-name">Kilkerran 12</div>
          <div class="l-mock-dist">Glengyle Distillery · Campbeltown</div>
          <div class="l-mock-notes">
            <div class="l-mock-note-row">
              <span class="l-mock-note-lbl">{{ L.tasting.nose }}</span>
              <span class="l-mock-note-val">Citrus zest, vanilla, heather honey</span>
            </div>
            <div class="l-mock-note-row">
              <span class="l-mock-note-lbl">{{ L.tasting.palate }}</span>
              <span class="l-mock-note-val">Apple, dark chocolate, peat smoke</span>
            </div>
          </div>
          <div class="l-mock-bars">
            <div class="l-mock-bar-row" v-for="(bar, i) in mockBars" :key="i"
                 :style="`--delay:${i * 0.07}s`">
              <span class="l-mock-bar-lbl">{{ bar.label }}</span>
              <div class="l-mock-bar-track">
                <div class="l-mock-bar-fill" :style="`width:${bar.pct}%`"></div>
              </div>
              <span class="l-mock-bar-val">{{ bar.val }}</span>
            </div>
          </div>
        </div>

        <!-- Floating badge -->
        <div class="l-mock-float">
          <div class="l-mock-float-icon"><GlassWaterIcon :size="18" /></div>
          <div>
            <div class="l-mock-float-title">{{ L.hero.floatBadge }}</div>
            <div class="l-mock-float-sub">{{ L.hero.floatName }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── FEATURES GRID ── -->
    <section class="l-features">
      <div class="l-section-eyebrow">{{ L.features.eyebrow }}</div>
      <h2 class="l-section-title">{{ L.features.title }}</h2>
      <div class="l-features-grid">
        <div class="l-feat-card" v-for="feat in features" :key="feat.title">
          <div class="l-feat-icon">
            <component :is="feat.icon" :size="20" />
          </div>
          <h3 class="l-feat-title">{{ feat.title }}</h3>
          <p class="l-feat-desc">{{ feat.desc }}</p>
          <div class="l-feat-tags">
            <span v-for="tag in feat.tags" :key="tag" class="l-feat-tag">{{ tag }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── FLAVOUR PROFILE SHOWCASE ── -->
    <section class="l-showcase">
      <div class="l-showcase-text">
        <div class="l-section-eyebrow">{{ L.showcase.eyebrow }}</div>
        <h2 class="l-section-title" v-html="L.showcase.title"></h2>
        <p class="l-showcase-desc">{{ L.showcase.desc }}</p>
      </div>
      <div class="l-profile-card">
        <div class="l-profile-header">
          <div>
            <div class="l-profile-name">Ardbeg Uigeadail</div>
            <div class="l-profile-sub">Islay Single Malt · 54.2% ABV</div>
          </div>
          <span class="wcard-type type-scotch">Scotch</span>
        </div>
        <div class="l-profile-attrs">
          <div class="l-attr-row" v-for="(attr, i) in profileAttrs" :key="attr.label"
               :style="`--delay:${0.05 + i * 0.06}s`">
            <span class="l-attr-label">{{ attr.label }}</span>
            <div class="l-attr-track">
              <div class="l-attr-fill" :style="`width:${attr.pct}%`"></div>
            </div>
            <span class="l-attr-val">{{ attr.val }}</span>
          </div>
        </div>
        <div class="l-profile-notes">
          <div class="l-pnote">
            <span class="l-pnote-lbl">{{ L.tasting.nose }}</span>
            <span class="l-pnote-val">Sherry, dried fruit, toffee, subtle peat smoke</span>
          </div>
          <div class="l-pnote">
            <span class="l-pnote-lbl">{{ L.tasting.palate }}</span>
            <span class="l-pnote-val">Rich raisins, coffee, dark chocolate, maritime smoke</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── COMPARE ── -->
    <section class="l-compare">
      <div class="l-section-eyebrow">{{ L.compare.eyebrow }}</div>
      <h2 class="l-section-title">{{ L.compare.title }}</h2>
      <p class="l-compare-desc">{{ L.compare.desc }}</p>
      <div class="l-compare-mock">
        <div class="l-cmp-col" v-for="(w, i) in compareWhiskies" :key="i"
             :style="`--ci:${i}`">
          <!-- Header: fixed height so bars never overlap it -->
          <div class="l-cmp-header">
            <span class="wcard-type" :class="`type-${w.type}`">{{ w.typeLabel }}</span>
            <div class="l-cmp-name">{{ w.name }}</div>
            <div class="l-cmp-dist">{{ w.dist }}</div>
          </div>
          <!-- Chart: bars + value above + label below, all in one column -->
          <div class="l-cmp-bars">
            <div class="l-cmp-bar" v-for="(val, j) in w.vals" :key="j"
                 :style="`--h:${val * 16}px; --delay:${j * 0.05 + i * 0.1}s`">
              <span class="l-cmp-bar-num">{{ val }}</span>
              <div class="l-cmp-bar-fill"></div>
              <span class="l-cmp-bar-lbl">{{ L.compareBarLabels[j] }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── SOCIAL ── -->
    <section class="l-social">
      <div class="l-social-text">
        <div class="l-section-eyebrow">{{ L.social.eyebrow }}</div>
        <h2 class="l-section-title" v-html="L.social.title"></h2>
        <p class="l-social-desc">{{ L.social.desc }}</p>
        <ul class="l-social-list">
          <li v-for="item in socialItems" :key="item">
            <CheckIcon :size="14" class="l-check" />{{ item }}
          </li>
        </ul>
      </div>
      <div class="l-social-mock">
        <div class="l-msg-card">
          <div class="l-msg-header">
            <span class="l-msg-pill">
              <GlassWaterIcon :size="10" /> {{ L.social.msgPill }}
            </span>
            <span class="l-msg-date">2 Apr</span>
          </div>
          <div class="l-msg-from">from alex@drams.co</div>
          <div class="l-msg-name">Springbank 15</div>
          <div class="l-msg-sub">Springbank · Campbeltown · 46%</div>
          <div class="l-msg-note">
            "You need to try this one. Incredible balance of sherry and brine."
          </div>
        </div>
        <div class="l-scan-card">
          <div class="l-scan-icon"><CameraIcon :size="22" /></div>
          <div>
            <div class="l-scan-title">{{ L.social.scanTitle }}</div>
            <div class="l-scan-sub">{{ L.social.scanSub }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── BADGES ── -->
    <section class="l-badges">
      <div class="l-badges-inner">
        <div class="l-badges-text">
          <div class="l-section-eyebrow">{{ L.badgesSection.eyebrow }}</div>
          <h2 class="l-section-title" v-html="L.badgesSection.title"></h2>
          <p class="l-badges-desc">{{ L.badgesSection.desc }}</p>
        </div>
        <div class="l-badges-grid">
          <div class="l-bdg" v-for="badge in badges" :key="badge.label">
            <div class="l-bdg-icon-wrap">
              <component :is="badge.icon" :size="24" />
            </div>
            <div class="l-bdg-body">
              <div class="l-bdg-name">{{ badge.label }}</div>
              <div class="l-bdg-desc">{{ badge.desc }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── FINAL CTA ── -->
    <section class="l-cta">
      <h2 class="l-cta-title">{{ L.cta.title }}</h2>
      <p class="l-cta-sub">{{ L.cta.sub }}</p>
      <button class="l-btn-primary l-btn-xl" @click="goToApp('register')">
        <BookOpenIcon :size="18" /> {{ L.cta.btn }}
      </button>
    </section>

    <!-- ── FOOTER ── -->
    <footer class="l-footer">
      <div class="l-footer-brand">The <span>Dram</span> Journal</div>
      <div class="l-footer-copy">{{ L.footer.copy }}</div>
    </footer>

  </div>
</template>

<script setup>
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { currentUser, useAuth } from '../composables/useAuth.js'
import { useI18n, detectLocale } from '../composables/useI18n.js'
import {
  BookOpen as BookOpenIcon,
  Star as StarIcon,
  Trophy as TrophyIcon,
  NotebookPen as NotebookPenIcon,
  Heart as HeartIcon,
  Camera as CameraIcon,
  Columns2 as Columns2Icon,
  Users as UsersIcon,
  Check as CheckIcon,
  GlassWater as GlassWaterIcon,
  Globe as GlobeIcon,
  Flame as FlameIcon,
  Hash as HashIcon,
  Lock as LockIcon,
  FlaskConical as FlaskConicalIcon,
} from 'lucide-vue-next'

const router = useRouter()
const { getSession } = useAuth()
const { locale, t, setLocale } = useI18n()

onMounted(async () => {
  await detectLocale()
  await getSession()
  if (currentUser.value) router.push('/app')
})

function goToApp(tab) {
  router.push({ path: '/app', query: { auth: tab } })
}

// ── Data ──────────────────────────────────────────────────────────────────────

const mockBarData  = [ { val: 3, pct: 55 }, { val: 2, pct: 38 }, { val: 4, pct: 72 }, { val: 2, pct: 44 }, { val: 3, pct: 60 } ]
const profileData  = [ { val: 2, pct: 40 }, { val: 5, pct: 100 }, { val: 4, pct: 80 }, { val: 3, pct: 60 }, { val: 3, pct: 60 } ]
const featureIcons = [ NotebookPenIcon, HeartIcon, CameraIcon, Columns2Icon, TrophyIcon, UsersIcon ]
const badgeIcons   = [ GlassWaterIcon, HashIcon, TrophyIcon, GlobeIcon, FlameIcon, StarIcon, FlaskConicalIcon, UsersIcon ]

const compareWhiskies = [
  { name: 'Ardbeg 10',    dist: 'Ardbeg',      type: 'scotch', typeLabel: 'Scotch', vals: [2,5,4,2,3] },
  { name: 'Glenfarclas',  dist: 'Glenfarclas', type: 'scotch', typeLabel: 'Scotch', vals: [4,1,5,4,3] },
  { name: 'Redbreast 12', dist: 'Midleton',    type: 'irish',  typeLabel: 'Irish',  vals: [4,1,3,4,2] },
]

const mockBars     = computed(() => mockBarData.map((d, i) => ({ ...d, label: t.value.landing.mockBarLabels[i] })))
const profileAttrs = computed(() => profileData.map((d, i) => ({ ...d, label: t.value.landing.mockBarLabels[i] })))
const features     = computed(() => t.value.landing.features.items.map((item, i) => ({ ...item, icon: featureIcons[i] })))
const badges       = computed(() => t.value.landing.badgesSection.items.map((item, i) => ({ ...item, icon: badgeIcons[i] })))
const socialItems  = computed(() => t.value.landing.social.items)
const L            = computed(() => t.value.landing)
const langOpen     = ref(false)
</script>

<style scoped>
/* ── All landing styles are prefixed l- to avoid bleeding ── */
/* ── Colors follow the light theme exactly ── */

.landing {
  background: #FFFFFF;
  color: #111111;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}

/* ── Shared type classes reused from global (light theme values) ── */
.wcard-type { font-size:0.6rem; font-weight:600; letter-spacing:0.05em; text-transform:uppercase; padding:2px 8px; border-radius:20px; flex-shrink:0; display:inline-block; }
.type-scotch { background:rgba(200,130,42,0.12); color:#9a5d10; }
.type-irish  { background:rgba(50,170,100,0.12); color:#1a7a45; }

/* ── Typography helpers ── */
.l-section-eyebrow {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #B06A0A;
  margin-bottom: 10px;
  font-family: 'JetBrains Mono', monospace;
}

.l-section-title {
  font-size: clamp(1.6rem, 3.5vw, 2.4rem);
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: -0.03em;
  color: #111111;
  margin-bottom: 18px;
}

/* ── Buttons — exact app style ── */
.l-btn-primary {
  background: #B06A0A;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, transform 0.1s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.l-btn-primary:hover { background: #C87E20; transform: translateY(-1px); }
.l-btn-primary:active { transform: scale(0.97); }
.l-btn-primary.l-btn-lg  { padding: 11px 26px; font-size: 0.9rem; border-radius: 9px; }
.l-btn-primary.l-btn-xl  { padding: 14px 36px; font-size: 1rem;  border-radius: 10px; }

.l-btn-ghost {
  background: none;
  color: #9A8878;
  border: none;
  padding: 8px 14px;
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  cursor: pointer;
  transition: color 0.15s;
  border-radius: 8px;
}
.l-btn-ghost:hover { color: #111111; }

.l-btn-outline {
  background: transparent;
  color: #444444;
  border: 0.5px solid rgba(0,0,0,0.15);
  border-radius: 9px;
  padding: 11px 26px;
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s;
}
.l-btn-outline:hover { border-color: #B06A0A; color: #B06A0A; }

/* ── NAV ── */
.l-nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 48px;
  background: rgba(255,255,255,0.88);
  backdrop-filter: blur(14px);
  border-bottom: 0.5px solid rgba(0,0,0,0.07);
}
.l-nav-brand {
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.035em;
  color: #111111;
}
.l-nav-brand span {
  color: #C87E20;
  font-style: italic;
}
.l-nav-actions { display: flex; align-items: center; gap: 4px; }

/* ── HERO ── */
.l-hero {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 48px;
  padding: 120px 48px 80px;
  position: relative;
  overflow: hidden;
  background: #F7F5F2;
}

.l-hero-glow {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse 70% 60% at 20% 50%, rgba(176,106,10,0.06) 0%, transparent 70%);
  pointer-events: none;
}

.l-eyebrow {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #B06A0A;
  margin-bottom: 16px;
  font-family: 'JetBrains Mono', monospace;
}

.l-hero-title {
  font-size: clamp(2.4rem, 5.5vw, 4rem);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.04em;
  color: #111111;
  margin-bottom: 22px;
}

.l-hero-sub {
  font-size: 1rem;
  color: #9A8878;
  line-height: 1.72;
  max-width: 440px;
  margin-bottom: 32px;
}

.l-hero-cta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.l-hero-note {
  font-size: 0.68rem;
  color: #9A8878;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.03em;
}

/* ── Hero mock card ── */
.l-hero-mock { position: relative; animation: lFadeUp 0.6s 0.15s ease both; }

.l-mock-card {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 22px 22px 18px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.05);
}

.l-mock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.l-mock-stars { display: flex; gap: 2px; }
.star-filled { color: #C87E20; }
.star-empty  { color: rgba(0,0,0,0.12); }

.l-mock-name {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #111111;
  margin-bottom: 2px;
}
.l-mock-dist {
  font-size: 0.68rem;
  color: #9A8878;
  margin-bottom: 14px;
  font-family: 'JetBrains Mono', monospace;
}

.l-mock-notes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
}
.l-mock-note-row { display: flex; flex-direction: column; gap: 2px; }
.l-mock-note-lbl {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #B06A0A;
  font-family: 'JetBrains Mono', monospace;
}
.l-mock-note-val {
  font-size: 0.78rem;
  color: #444444;
  line-height: 1.4;
}

.l-mock-bars { display: flex; flex-direction: column; gap: 6px; }
.l-mock-bar-row {
  display: flex; align-items: center; gap: 8px;
  animation: lBarReveal 0.45s calc(0.5s + var(--delay)) ease both;
}
.l-mock-bar-lbl {
  font-size: 0.58rem;
  color: #9A8878;
  width: 60px;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}
.l-mock-bar-track {
  flex: 1; height: 3px;
  background: rgba(0,0,0,0.06);
  border-radius: 2px; overflow: hidden;
}
.l-mock-bar-fill {
  height: 100%;
  background: #B06A0A;
  border-radius: 2px;
  animation: lFillBar 0.55s calc(0.55s + var(--delay, 0s)) ease both;
  transform-origin: left;
}
.l-mock-bar-val {
  font-size: 0.6rem;
  color: #9A8878;
  width: 10px;
  text-align: right;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}

/* Floating badge */
.l-mock-float {
  position: absolute;
  bottom: -16px; right: -16px;
  display: flex; align-items: center; gap: 10px;
  background: #FFFFFF;
  border: 0.5px solid rgba(176,106,10,0.3);
  border-radius: 10px;
  padding: 10px 14px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  animation: lPopIn 0.4s 1.1s ease both;
  opacity: 0;
}
.l-mock-float-icon {
  color: #C87E20;
  display: flex; align-items: center;
}
.l-mock-float-title {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #B06A0A;
  font-family: 'JetBrains Mono', monospace;
}
.l-mock-float-sub {
  font-size: 0.85rem;
  font-weight: 600;
  color: #111111;
  letter-spacing: -0.01em;
}

/* ── FEATURES ── */
.l-features {
  padding: 96px 48px;
  max-width: 1160px;
  margin: 0 auto;
  text-align: center;
}

.l-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 44px;
  text-align: left;
}

.l-feat-card {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 24px 22px;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.l-feat-card:hover {
  border-color: rgba(176,106,10,0.3);
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  transform: translateY(-2px);
}

.l-feat-icon {
  color: #B06A0A;
  margin-bottom: 12px;
  display: flex;
}
.l-feat-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #111111;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.l-feat-desc {
  font-size: 0.8rem;
  color: #9A8878;
  line-height: 1.65;
  margin-bottom: 14px;
}
.l-feat-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.l-feat-tag {
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(176,106,10,0.08);
  color: #B06A0A;
  border: 0.5px solid rgba(176,106,10,0.18);
  font-family: 'JetBrains Mono', monospace;
}

/* ── SHOWCASE ── */
.l-showcase {
  padding: 80px 48px;
  max-width: 1160px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  align-items: center;
  background: #F7F5F2;
  border-radius: 20px;
}

.l-showcase-desc {
  font-size: 0.88rem;
  color: #9A8878;
  line-height: 1.75;
}

.l-profile-card {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 24px 24px 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.07);
}
.l-profile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}
.l-profile-name {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #111111;
  margin-bottom: 2px;
}
.l-profile-sub {
  font-size: 0.65rem;
  color: #9A8878;
  font-family: 'JetBrains Mono', monospace;
}

.l-profile-attrs { display: flex; flex-direction: column; gap: 9px; margin-bottom: 18px; }
.l-attr-row {
  display: flex; align-items: center; gap: 10px;
  animation: lBarReveal 0.45s var(--delay, 0s) ease both;
}
.l-attr-label {
  font-size: 0.6rem;
  color: #9A8878;
  width: 68px;
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
}
.l-attr-track {
  flex: 1; height: 4px;
  background: rgba(0,0,0,0.06);
  border-radius: 2px; overflow: hidden;
}
.l-attr-fill {
  height: 100%;
  background: #B06A0A;
  border-radius: 2px;
  animation: lFillBar 0.6s var(--delay, 0s) ease both;
  transform-origin: left;
}
.l-attr-val {
  font-size: 0.62rem;
  color: #B06A0A;
  width: 20px;
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
}

.l-profile-notes {
  display: flex; flex-direction: column; gap: 8px;
  padding-top: 16px;
  border-top: 0.5px solid rgba(0,0,0,0.07);
}
.l-pnote { display: flex; flex-direction: column; gap: 2px; }
.l-pnote-lbl {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #B06A0A;
  font-family: 'JetBrains Mono', monospace;
}
.l-pnote-val {
  font-size: 0.78rem;
  color: #444444;
  line-height: 1.45;
  font-style: italic;
}

/* ── COMPARE ── */
.l-compare {
  padding: 96px 48px;
  max-width: 1160px;
  margin: 0 auto;
  text-align: center;
}
.l-compare-desc {
  font-size: 0.88rem;
  color: #9A8878;
  line-height: 1.7;
  max-width: 520px;
  margin: 0 auto 44px;
}

.l-compare-mock {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 14px;
  padding: 28px 20px 24px;
  display: flex;
  max-width: 640px;
  margin: 0 auto;
  box-shadow: 0 4px 20px rgba(0,0,0,0.07);
}

.l-cmp-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 8px;
  border-right: 0.5px solid rgba(0,0,0,0.06);
  animation: lFadeUp 0.5s calc(var(--ci, 0) * 0.1s) ease both;
}
.l-cmp-col:last-child { border-right: none; }

/* Fixed-height header so bars never collide with text */
.l-cmp-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-height: 72px;
  justify-content: flex-start;
  padding-bottom: 10px;
}
.l-cmp-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #111111;
  text-align: center;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.l-cmp-dist {
  font-size: 0.58rem;
  color: #9A8878;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
}

/* Chart area: bars sit at the bottom, value above, label below */
.l-cmp-bars {
  display: flex;
  gap: 5px;
  align-items: flex-end;
  width: 100%;
  justify-content: center;
}

/* Each bar column: label → [spacer to align tops] → fill → number → axis label */
.l-cmp-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 22px;
}

/* Value sits above the bar */
.l-cmp-bar-num {
  font-size: 0.54rem;
  color: #9A8878;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
}

.l-cmp-bar-fill {
  width: 100%;
  height: var(--h, 20px);
  border-radius: 3px 3px 0 0;
  background: #B06A0A;
  animation: lBarGrow 0.5s calc(var(--delay, 0s)) ease both;
  transform-origin: bottom;
}
.l-cmp-col:nth-child(2) .l-cmp-bar-fill { background: #5070A0; }
.l-cmp-col:nth-child(3) .l-cmp-bar-fill { background: #408060; }

/* Axis label sits directly below each bar */
.l-cmp-bar-lbl {
  font-size: 0.48rem;
  color: #BBAA9A;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  margin-top: 3px;
}

/* ── SOCIAL ── */
.l-social {
  padding: 80px 48px;
  max-width: 1160px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  align-items: center;
  background: #F7F5F2;
  border-radius: 20px;
}
.l-social-desc {
  font-size: 0.88rem;
  color: #9A8878;
  line-height: 1.75;
  margin-bottom: 22px;
}
.l-social-list {
  list-style: none;
  display: flex; flex-direction: column; gap: 9px;
}
.l-social-list li {
  font-size: 0.84rem;
  color: #444444;
  display: flex; align-items: center; gap: 8px;
}
.l-check { color: #B06A0A; flex-shrink: 0; }

.l-social-mock { display: flex; flex-direction: column; gap: 12px; }

.l-msg-card {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 16px 18px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.l-msg-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 6px;
}
.l-msg-pill {
  font-size: 0.55rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(176,106,10,0.1);
  color: #B06A0A;
  padding: 2px 7px;
  border-radius: 20px;
  display: flex; align-items: center; gap: 3px;
  font-family: 'JetBrains Mono', monospace;
}
.l-msg-date {
  font-size: 0.6rem;
  color: #9A8878;
  font-family: 'JetBrains Mono', monospace;
}
.l-msg-from {
  font-size: 0.65rem;
  color: #B06A0A;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 8px;
}
.l-msg-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #111111;
  letter-spacing: -0.02em;
  margin-bottom: 1px;
}
.l-msg-sub {
  font-size: 0.65rem;
  color: #9A8878;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 10px;
}
.l-msg-note {
  font-size: 0.78rem;
  color: #9A8878;
  font-style: italic;
  line-height: 1.5;
  padding-left: 10px;
  border-left: 2px solid rgba(176,106,10,0.25);
}

.l-scan-card {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 14px 18px;
  display: flex; align-items: center; gap: 14px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
}
.l-scan-icon { color: #B06A0A; display: flex; align-items: center; flex-shrink: 0; }
.l-scan-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #111111;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
}
.l-scan-sub {
  font-size: 0.72rem;
  color: #9A8878;
  line-height: 1.4;
}

/* ── BADGES ── */
.l-badges {
  background: #F7F5F2;
  padding: 88px 48px;
}
.l-badges-inner {
  max-width: 1160px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 64px;
  align-items: start;
}
.l-badges-desc {
  font-size: 0.88rem;
  color: #9A8878;
  line-height: 1.75;
  margin-top: 4px;
}
.l-badges-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.l-bdg {
  background: #FFFFFF;
  border: 0.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: border-color 0.18s, box-shadow 0.18s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.l-bdg:hover {
  border-color: rgba(176,106,10,0.3);
  box-shadow: 0 3px 12px rgba(0,0,0,0.07);
}
.l-bdg-icon-wrap {
  color: #B06A0A;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(176,106,10,0.08);
  border-radius: 10px;
  flex-shrink: 0;
}
.l-bdg-body {
  min-width: 0;
}
.l-bdg-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: #111111;
  letter-spacing: -0.01em;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.l-bdg-desc {
  font-size: 0.7rem;
  color: #9A8878;
  line-height: 1.4;
}

/* ── FINAL CTA ── */
.l-cta {
  padding: 100px 48px;
  text-align: center;
  background: #F7F5F2;
}
.l-cta-title {
  font-size: clamp(2rem, 4.5vw, 3.2rem);
  font-weight: 600;
  letter-spacing: -0.04em;
  color: #111111;
  margin-bottom: 16px;
  line-height: 1.1;
}
.l-cta-sub {
  font-size: 0.95rem;
  color: #9A8878;
  margin-bottom: 28px;
  line-height: 1.6;
}

/* ── FOOTER ── */
.l-footer {
  padding: 28px 48px;
  border-top: 0.5px solid rgba(0,0,0,0.07);
  display: flex; align-items: center; justify-content: space-between;
  background: #FFFFFF;
}
.l-footer-brand {
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #9A8878;
}
.l-footer-brand span { color: #C87E20; }
.l-footer-copy {
  font-size: 0.68rem;
  color: rgba(0,0,0,0.25);
  font-family: 'JetBrains Mono', monospace;
}

/* ── Animations ── */
@keyframes lFadeUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lBarReveal {
  from { opacity: 0; transform: translateX(-6px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes lFillBar {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
@keyframes lBarGrow {
  from { transform: scaleY(0); }
  to   { transform: scaleY(1); }
}
@keyframes lPopIn {
  from { opacity: 0; transform: scale(0.85) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* Hero content enters on load */
.l-hero-content { animation: lFadeUp 0.6s ease both; }

/* ── Responsive ── */
@media (max-width: 960px) {
  .l-nav { padding: 14px 24px; }

  .l-hero {
    grid-template-columns: 1fr;
    padding: 100px 24px 60px;
    text-align: center;
    background: #F7F5F2;
  }
  .l-hero-sub { margin: 0 auto 32px; }
  .l-hero-cta { justify-content: center; }
  .l-hero-mock { max-width: 360px; margin: 0 auto; }
  .l-mock-float { right: 0; }

  .l-features { padding: 64px 24px; }
  .l-features-grid { grid-template-columns: 1fr 1fr; }

  .l-showcase { grid-template-columns: 1fr; padding: 48px 24px; gap: 36px; border-radius: 0; }
  .l-compare  { padding: 64px 24px; }
  .l-social   { grid-template-columns: 1fr; padding: 48px 24px; gap: 36px; border-radius: 0; }
  .l-badges   { padding: 56px 24px; }
  .l-badges-inner { grid-template-columns: 1fr; gap: 36px; }
  .l-badges-grid  { grid-template-columns: 1fr 1fr; }
  .l-cta      { padding: 72px 24px; }
  .l-footer   { flex-direction: column; gap: 6px; text-align: center; padding: 22px 24px; }
}

@media (max-width: 600px) {
  .l-features-grid { grid-template-columns: 1fr; }
  .l-compare-mock { padding: 20px 10px 20px; overflow-x: auto; }
  .l-badges-grid  { grid-template-columns: 1fr; }
}

/* ── Language toggle ── */
.l-lang-wrap {
  position: relative;
}
.l-lang-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: #9A8878;
}
.l-lang-btn.active { color: #C8A96A; }
.l-lang-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: #fff;
  border: 1px solid #E8DDD5;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.10);
  overflow: hidden;
  z-index: 100;
  min-width: 110px;
}
.l-lang-dropdown button {
  display: block;
  width: 100%;
  padding: 9px 14px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.83rem;
  color: #4A3728;
}
.l-lang-dropdown button:hover { background: #F5EFE8; }
.l-lang-dropdown button.selected { font-weight: 600; color: #C8A96A; }
</style>