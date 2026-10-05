<template>
  <div ref="container" class="map-view" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Map, type GeoJSONSource } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { SidoGeo } from '../types'
import { BASE_STYLE } from '../map/style'
import { createLayers, DEFAULT_HEIGHT, LAYER, SRC } from '../map/layers'

const props = withDefaults(
  defineProps<{
    /** 시도 코드 (예: '11' 서울) */
    sido: string
    /** 카메라 기울기 (도) */
    pitch?: number
  }>(),
  { pitch: 45 },
)

const emit = defineEmits<{
  (e: 'loaded', geo: SidoGeo): void
}>()

const container = ref<HTMLDivElement>()
const map = shallowRef<Map>()
const geo = shallowRef<SidoGeo>()

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

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
function liftLabels(heightM = DEFAULT_HEIGHT) {
  const m = map.value
  if (!m) return
  const lat = m.getCenter().lat
  const metersPerPixel = (2 * Math.PI * 6378137 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** m.getZoom())
  const px = (heightM / metersPerPixel) * Math.sin((m.getPitch() * Math.PI) / 180)
  m.setPaintProperty(LAYER.label, 'text-translate', [0, -px])
}

async function applySido(code: string) {
  const m = map.value
  if (!m) return
  const g = await loadSido(code)
  geo.value = g
  ;(m.getSource(SRC.outline) as GeoJSONSource).setData(g.outline)
  ;(m.getSource(SRC.sgg) as GeoJSONSource).setData(g.sgg)
  ;(m.getSource(SRC.labels) as GeoJSONSource).setData(g.labels)
  fitView()
  emit('loaded', g)
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
    for (const layer of createLayers()) m.addLayer(layer)

    m.on('move', () => liftLabels())
    applySido(props.sido)
  })
})

watch(
  () => props.sido,
  (code) => applySido(code),
)
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
