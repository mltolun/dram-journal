/**
 * Syntax validation tests.
 *
 * Each import below triggers Vue's template compiler via @vitejs/plugin-vue.
 * A broken template (unclosed tag, mismatched bracket, invalid directive, etc.)
 * will throw a compile-time error and fail the test immediately.
 */

import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'

// ── Components ────────────────────────────────────────────────────────────────
import AdminFeaturePanel from '../components/AdminFeaturePanel.vue'
import AppHeader from '../components/AppHeader.vue'
import AppSidebar from '../components/AppSidebar.vue'
import AppToolbar from '../components/AppToolbar.vue'
import AuthBox from '../components/AuthBox.vue'
import Autocomplete from '../components/Autocomplete.vue'
import BadgeToast from '../components/BadgeToast.vue'
import CatalogueSearch from '../components/CatalogueSearch.vue'
import CameraCaptureModal from '../components/CameraCaptureModal.vue'
import ComparePanel from '../components/ComparePanel.vue'
import FeatureRequestPanel from '../components/FeatureRequestPanel.vue'
import FeedPanel from '../components/FeedPanel.vue'
import FlavorWheel from '../components/FlavorWheel.vue'
import InboxPanel from '../components/InboxPanel.vue'
import PhotoUpload from '../components/PhotoUpload.vue'
import RecommendationsPanel from '../components/RecommendationsPanel.vue'
import ScanModal from '../components/ScanModal.vue'
import ShareModal from '../components/ShareModal.vue'
import StatsPanel from '../components/StatsPanel.vue'
import SubscriptionsPanel from '../components/SubscriptionsPanel.vue'
import TimelinePanel from '../components/TimelinePanel.vue'
import WhiskyCard from '../components/WhiskyCard.vue'
import WhiskyModal from '../components/WhiskyModal.vue'
import WishlistShareModal from '../components/WishlistShareModal.vue'

// ── Views ─────────────────────────────────────────────────────────────────────
import App from '../App.vue'
import AppView from '../views/AppView.vue'
import LandingView from '../views/LandingView.vue'
import ResetView from '../views/ResetView.vue'
import ShareView from '../views/ShareView.vue'
import WishlistShareView from '../views/WishlistShareView.vue'

const allComponents = [
  ['AdminFeaturePanel', AdminFeaturePanel],
  ['AppHeader', AppHeader],
  ['AppSidebar', AppSidebar],
  ['AppToolbar', AppToolbar],
  ['AuthBox', AuthBox],
  ['Autocomplete', Autocomplete],
  ['BadgeToast', BadgeToast],
  ['CatalogueSearch', CatalogueSearch],
  ['CameraCaptureModal', CameraCaptureModal],
  ['ComparePanel', ComparePanel],
  ['FeatureRequestPanel', FeatureRequestPanel],
  ['FeedPanel', FeedPanel],
  ['FlavorWheel', FlavorWheel],
  ['InboxPanel', InboxPanel],
  ['PhotoUpload', PhotoUpload],
  ['RecommendationsPanel', RecommendationsPanel],
  ['ScanModal', ScanModal],
  ['ShareModal', ShareModal],
  ['StatsPanel', StatsPanel],
  ['SubscriptionsPanel', SubscriptionsPanel],
  ['TimelinePanel', TimelinePanel],
  ['WhiskyCard', WhiskyCard],
  ['WhiskyModal', WhiskyModal],
  ['WishlistShareModal', WishlistShareModal],
  ['App', App],
  ['AppView', AppView],
  ['LandingView', LandingView],
  ['ResetView', ResetView],
  ['ShareView', ShareView],
  ['WishlistShareView', WishlistShareView],
]

describe('Vue template syntax', () => {
  it.each(allComponents)('%s compiles without errors', (_name, component) => {
    expect(component).toBeDefined()
    // A Vue SFC compiled without errors will have a render function or setup
    expect(
      typeof component === 'object' || typeof component === 'function'
    ).toBe(true)
  })
})
