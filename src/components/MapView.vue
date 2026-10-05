<template>
  <div ref="container" class="map-view" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Map, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { SidoConfig, SidoGeo, TurnoutInput } from '../types'
import { BASE_STYLE } from '../map/style'
import { colorPaint, createLayers, LAYER, SRC } from '../map/layers'
import { formatPct, heightOf, isPeak, matchTurnout, type MatchResult } from '../composables/useTurnout'

const props = withDefaults(
  defineProps<{
    /** 시도 코드 (예: '11' 서울) */
    sido: string
    /** 서버 값: "서울특별시 종로구" → 72.4 */
    values?: TurnoutInput
    /** 높이/색 설정 */
    config: SidoConfig
    /** 카메라 기울기 (도) */
    pitch?: number
  }>(),
  { values: () => ({}), pitch: 45 },
)

const emit = defineEmits<{
  (e: 'loaded', geo: SidoGeo): void
  (e: 'matched', result: MatchResult): void
}>()

const container = ref<HTMLDivElement>()
const map = shallowRef<Map>()
const geo = shallowRef<SidoGeo>()

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 라벨 보정용 높이(m): 일반 라벨은 평균 높이, 100% 라벨은 peakHeight */
let labelHeight = 0
let peakLabelHeight = 0

async function loadSido(code: string): Promise<SidoGeo> {
  const res = await fetch(`${import.meta.env.BASE_URL}geo/${code}.json`)
  if (!res.ok) throw new Error(`시도 데이터를 불러오지 못했습니다: ${code}`)
  return res.json()
}

/** 시도 전체가 화면에 들어오도록 카메라 이동 */
function fitView(animate = true) {
  const m = map.value
  const g = geo.value
  if (!m || !g) return
  const [w, s, e, n] = g.bbox
  m.fitBounds(
    [
      [w, s],
      [e, n],
    ],
    { padding: 60, pitch: props.pitch, bearing: 0, duration: animate ? 1200 : 0 },
  )
}

/**
 * 라벨은 지면 높이에 그려지므로, 블록 높이만큼 화면 위로 올린다.
 * 화면상 높이(px) ≈ 높이(m) / 픽셀당 미터 × sin(기울기)
 */
function liftLabels() {
  const m = map.value
  if (!m) return
  const lat = m.getCenter().lat
  const metersPerPixel = (2 * Math.PI * 6378137 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom())
  const k = Math.sin((m.getPitch() * Math.PI) / 180) / metersPerPixel
  m.setPaintProperty(LAYER.label, 'text-translate', [0, -labelHeight * k])
  m.setPaintProperty(LAYER.labelPeak, 'text-translate', [0, -peakLabelHeight * k])
}

/** 값 → feature-state(h, v, peak) + 라벨 데이터 갱신 */
function applyValues() {
  const m = map.value
  const g = geo.value
  if (!m || !g) return
  const result = matchTurnout(props.values, g)
  const cfg = props.config

  const heights: number[] = []
  for (const f of g.sgg.features) {
    const v = result.values[f.properties.key]
    const has = v !== undefined
    const h = has ? heightOf(v, cfg) : heightOf(0, cfg)
    if (has && !isPeak(v)) heights.push(h)
    m.setFeatureState({ source: SRC.sgg, id: f.id! }, { v: v ?? 0, h, peak: has && isPeak(v) })
  }
  labelHeight = heights.length ? heights.reduce((a, b) => a + b, 0) / heights.length : heightOf(0, cfg)
  peakLabelHeight = cfg.peakHeight

  const labels: FeatureCollection = {
    type: 'FeatureCollection',
    features: g.labels.features.map((f) => {
      const v = result.values[f.properties.key]
      return {
        ...f,
        properties: {
          ...f.properties,
          v: v ?? -1,
          pct: v === undefined ? '-' : formatPct(v),
          peak: v !== undefined && isPeak(v),
        },
      }
    }),
  }
  ;(m.getSource(SRC.labels) as GeoJSONSource).setData(labels)
  liftLabels()
  emit('matched', result)
}

async function applySido(code: string) {
  const m = map.value
  if (!m) return
  const g = await loadSido(code)
  geo.value = g
  m.removeFeatureState({ source: SRC.sgg })
  ;(m.getSource(SRC.outline) as GeoJSONSource).setData(g.outline)
  ;(m.getSource(SRC.sgg) as GeoJSONSource).setData(g.sgg)
  applyValues()
  fitView()
  emit('loaded', g)
}

function applyColor(color: string) {
  const m = map.value
  if (!m?.getLayer(LAYER.extrusion)) return
  for (const [layer, prop, value] of colorPaint(color)) m.setPaintProperty(layer, prop as Parameters<Map['setPaintProperty']>[1], value)
}

onMounted(() => {
  const m = new Map({
    container: container.value!,
    style: BASE_STYLE,
    center: [127.8, 36.2],
    zoom: 6,
    pitch: props.pitch,
    maxPitch: 60,
    attributionControl: false,
    canvasContextAttributes: { antialias: true },
  })
  map.value = m

  m.on('load', () => {
    m.addSource(SRC.outline, { type: 'geojson', data: EMPTY })
    m.addSource(SRC.sgg, { type: 'geojson', data: EMPTY })
    m.addSource(SRC.labels, { type: 'geojson', data: EMPTY })
    for (const layer of createLayers(props.config.color)) m.addLayer(layer)

    m.on('move', liftLabels)
    applySido(props.sido)
  })
})

watch(
  () => props.sido,
  (code) => applySido(code),
)
watch(() => props.values, applyValues, { deep: true })
watch(
  () => [props.config.maxHeight, props.config.peakHeight],
  applyValues,
)
watch(() => props.config.color, applyColor)
watch(
  () => props.pitch,
  (pitch) => map.value?.easeTo({ pitch, duration: 600 }),
)

onBeforeUnmount(() => map.value?.remove())

defineExpose({ map, geo, fitView })
</script>

<style scoped>
.map-view {
  position: absolute;
  inset: 0;
}
</style>
