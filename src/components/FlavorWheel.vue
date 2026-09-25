<template>
  <div class="flavor-wheel-wrap">
    <svg viewBox="-28 -16 256 232" class="flavor-wheel" role="img" :aria-label="wheelSummary">
      <!-- Concentric grid pentagons -->
      <polygon
        v-for="scale in [1, 2, 3, 4, 5]"
        :key="scale"
        :points="gridPoints(scale)"
        fill="none"
        stroke="var(--border-hi)"
        :stroke-opacity="scale === 5 ? 0.6 : 0.25"
        stroke-width="0.5"
      />

      <!-- Axis lines from center to max -->
      <line
        v-for="axis in AXES"
        :key="axis.key + '-line'"
        x1="100" y1="100"
        :x2="axisPoint(axis.angle, 5).x"
        :y2="axisPoint(axis.angle, 5).y"
        stroke="var(--border-hi)"
        stroke-opacity="0.35"
        stroke-width="0.5"
      />

      <!-- User profile fill -->
      <polygon
        :points="profilePoints"
        fill="var(--amber)"
        fill-opacity="0.18"
        stroke="var(--amber)"
        stroke-width="1.5"
        stroke-linejoin="round"
      />

      <!-- Value dots -->
      <circle
        v-for="axis in AXES"
        :key="axis.key + '-dot'"
        :cx="axisPoint(axis.angle, profile[axis.key]).x"
        :cy="axisPoint(axis.angle, profile[axis.key]).y"
        r="3"
        fill="var(--amber)"
      />

      <!-- Axis labels -->
      <text
        v-for="axis in AXES"
        :key="axis.key + '-label'"
        :x="labelPos(axis.angle).x"
        :y="labelPos(axis.angle).y"
        :text-anchor="textAnchor(axis.angle)"
        dominant-baseline="middle"
        class="wheel-label"
      >{{ t.attrs[axis.key] }}</text>
    </svg>
    <span class="sr-only">{{ wheelSummary }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({
  profile: {
    type: Object,
    required: true,
    // { dulzor, ahumado, cuerpo, frutado, especiado } — values 0–5
  },
})

const { t } = useI18n()

const CX = 100, CY = 100, R = 72, MAX = 5

// Axes: starting at top (-90°), clockwise every 72°
const AXES = [
  { key: 'dulzor',    angle: -90 },
  { key: 'ahumado',   angle: -18 },
  { key: 'especiado', angle:  54 },
  { key: 'frutado',   angle: 126 },
  { key: 'cuerpo',    angle: 198 },
]

function axisPoint(angleDeg, value) {
  const rad = (angleDeg * Math.PI) / 180
  const r = (value / MAX) * R
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function gridPoints(scale) {
  return AXES.map(({ angle }) => {
    const p = axisPoint(angle, scale)
    return `${p.x},${p.y}`
  }).join(' ')
}

const profilePoints = computed(() =>
  AXES.map(({ key, angle }) => {
    const p = axisPoint(angle, props.profile[key] ?? 0)
    return `${p.x},${p.y}`
  }).join(' ')
)

// Text alternative so the profile is perceivable without the graphic.
const wheelSummary = computed(() =>
  AXES.map(({ key }) => `${t.value.attrs[key]} ${props.profile[key] ?? 0} of 5`).join(', ')
)

function labelPos(angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  const r = R + 17
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function textAnchor(angleDeg) {
  const x = Math.cos((angleDeg * Math.PI) / 180)
  if (Math.abs(x) < 0.25) return 'middle'
  return x > 0 ? 'start' : 'end'
}
</script>

<style scoped>
.flavor-wheel-wrap {
  width: 100%;
}
.flavor-wheel {
  width: 100%;
  max-width: 220px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.wheel-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  fill: var(--text-secondary);
  letter-spacing: 0.03em;
}
@media (max-width: 480px) {
  .wheel-label { font-size: 10px; }
}
</style>
