<template>
  <div ref="container" class="map-view" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { Map, type GeoJSONSource, type PaddingOptions } from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import type { AnimationConfig, BackgroundConfig, EffectConfig, SidoConfig, SidoGeo, TurnoutInput } from '../types'
import { BASEMAP_LAYER_IDS, createBaseStyle } from '../map/style'
import { createMask } from '../map/mask'
import { CalloutManager, type CalloutItem } from '../map/callout'
import { createLayers, LAYER, lookPaint, SRC } from '../map/layers'
import { createAnimator, DEFAULT_ANIMATION, easeOutBack, type Frames } from '../map/animator'
import { DEFAULT_EFFECTS } from '../map/effects'
import { formatPct, heightOf, isPeak, matchTurnout, type MatchResult } from '../composables/useTurnout'

const props = withDefaults(
  defineProps<{
    /** 시도 코드 (예: '11' 서울) */
    sido: string
    /** 서버 값: "서울특별시 종로구" → 72.4 */
    values?: TurnoutInput
    /** 높이/색 설정 */
    config: SidoConfig
    /** 차오름 애니메이션 설정 */
    animation?: AnimationConfig
    /** 값이 바뀌면 현재 상태에서 새 값까지 자동으로 애니메이션 */
    autoplay?: boolean
    /** 카메라 기울기 (도) */
    pitch?: number
    /** 시도를 화면에 맞출 때 여백(px) — 리모컨 패널이 가리는 영역 제외용 */
    padding?: PaddingOptions
    /** 배경 지도 설정 */
    background?: BackgroundConfig
    /** 강조 효과 설정 */
    effects?: EffectConfig
  }>(),
  {
    values: () => ({}),
    animation: () => ({ ...DEFAULT_ANIMATION }),
    autoplay: true,
    pitch: 45,
    padding: () => ({ top: 60, bottom: 60, left: 60, right: 60 }),
    background: () => ({ basemap: true, maskOpacity: 0.35 }),
    effects: () => ({ ...DEFAULT_EFFECTS }),
  },
)

const emit = defineEmits<{
  (e: 'loaded', geo: SidoGeo): void
  (e: 'matched', result: MatchResult): void
  (e: 'animationend'): void
}>()

const container = ref<HTMLDivElement>()
const map = shallowRef<Map>()
const geo = shallowRef<SidoGeo>()

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** 매칭된 목표 값 (시군구 key → 값, 값 없으면 undefined) */
let targets: Record<string, number | undefined> = {}
/** 라벨 보정용 높이(m): 일반 라벨은 현재 평균 높이, 100% 라벨은 현재 100% 블록 높이 */
let labelHeight = 0
let peakLabelHeight = 0
/** 라벨 setData 최소 간격(ms) — 매 프레임 갱신하면 워커 부하가 커서 제한 */
const LABEL_INTERVAL = 50
let lastLabelAt = 0

const animator = createAnimator((frames) => render(frames))

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
    { padding: props.padding, pitch: props.pitch, bearing: 0, duration: animate ? 1200 : 0 },
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
  // 말풍선은 100% 블록(또는 1위 블록) 윗면 위에 + 라벨 높이만큼 더 띄움
  callouts?.setLift(calloutHeight * k + 34)
}

/** 표시 상태(frames) → 블록 feature-state + 라벨 */
function render(frames: Frames, forceLabels = false) {
  const m = map.value
  const g = geo.value
  if (!m || !g) return
  const cfg = props.config
  const top = heightOf(99.999, cfg)

  // 라벨 높이도 블록이 차오르는 만큼 따라 올라가도록 현재 높이로 계산
  let sum = 0
  let count = 0
  let peakH = 0
  for (const f of g.sgg.features) {
    const fr = frames[f.properties.key] ?? { v: 0, peak: 0 }
    const h = fr.peak > 0 ? top + (cfg.peakHeight - top) * easeOutBack(fr.peak) : heightOf(fr.v, cfg)
    m.setFeatureState({ source: SRC.sgg, id: f.id! }, { v: fr.v, h, peak: fr.peak > 0 })
    if (fr.peak > 0) peakH = Math.max(peakH, h)
    else if (targets[f.properties.key] !== undefined) {
      sum += h
      count++
    }
  }
  updatePeakSource(frames)
  labelHeight = count ? sum / count : heightOf(0, cfg)
  peakLabelHeight = peakH || cfg.peakHeight
  liftLabels()

  const now = performance.now()
  if (!forceLabels && now - lastLabelAt < LABEL_INTERVAL) return
  lastLabelAt = now
  const labels: FeatureCollection = {
    type: 'FeatureCollection',
    features: g.labels.features.map((f) => {
      const key = f.properties.key
      const fr = frames[key] ?? { v: 0, peak: 0 }
      const has = targets[key] !== undefined
      return {
        ...f,
        properties: {
          ...f.properties,
          v: has ? (targets[key] as number) : -1,
          pct: !has ? '-' : fr.peak > 0 ? formatPct(100) : formatPct(Math.min(fr.v, 99.9)),
          peak: fr.peak > 0,
        },
      }
    }),
  }
  ;(m.getSource(SRC.labels) as GeoJSONSource).setData(labels)
  updateCallouts(frames)
}

/** 말풍선 대상: 100% 시군구. 100%가 없으면(옵션) 애니메이션이 끝난 뒤 최고값 시군구 */
let callouts: CalloutManager | undefined
let calloutHeight = 0
function updateCallouts(frames: Frames) {
  const g = geo.value
  if (!callouts || !g) return
  const fx = props.effects
  if (!fx.callout) {
    callouts.clear()
    return
  }
  const cfg = props.config
  let picks = g.labels.features.filter((f) => (frames[f.properties.key]?.peak ?? 0) > 0)
  let isTop = false
  if (!picks.length && fx.calloutTopWhenNoPeak && !animator.running) {
    let best = -1
    for (const f of g.labels.features) {
      const v = targets[f.properties.key]
      if (v !== undefined && v > best) best = v
    }
    if (best >= 0) {
      picks = g.labels.features.filter((f) => targets[f.properties.key] === best)
      isTop = true
    }
  }
  calloutHeight = isTop ? heightOf(Math.min(99.9, (targets[picks[0].properties.key] as number) ?? 0), cfg) : peakLabelHeight
  const items: CalloutItem[] = picks.map((f) => {
    const v = targets[f.properties.key] ?? 0
    return {
      key: f.properties.key,
      lngLat: f.geometry.coordinates as [number, number],
      title: f.properties.sggnm,
      value: isTop ? formatPct(Math.min(v, 99.9)) : formatPct(100),
      sub: fx.calloutText.replaceAll('{시도}', g.sidonm).replaceAll('{시군구}', f.properties.sggnm),
    }
  })
  callouts.update(items, cfg.color)
  liftLabels()
}

/** 100% 글로우 숨쉬기 효과 */
let pulseRaf = 0
function pulseLoop(now: number) {
  const m = map.value
  if (!m?.getLayer(LAYER.peakGlow)) return
  const fx = props.effects
  const wave = fx.pulse ? 0.5 + 0.5 * Math.sin(now / 450) : 1
  m.setPaintProperty(LAYER.peakGlow, 'line-opacity', 0.9 * fx.glow * (0.55 + 0.45 * wave))
  m.setPaintProperty(LAYER.peakGlow, 'line-width', 18 + 10 * wave)
  pulseRaf = fx.pulse && peakSignature ? requestAnimationFrame(pulseLoop) : 0
}
function startPulse() {
  if (pulseRaf) cancelAnimationFrame(pulseRaf)
  pulseRaf = requestAnimationFrame(pulseLoop)
}

/** 글로우 강도 반영 */
function applyEffects() {
  const m = map.value
  if (!m?.getLayer(LAYER.sidoGlow)) return
  m.setPaintProperty(LAYER.sidoGlow, 'line-opacity', 0.3 * props.effects.glow)
  startPulse()
  updateCallouts(animator.frames)
}

/**
 * 100% 블록은 별도 레이어(불투명)로 그리므로 소스 속성 peak가 필요하다.
 * (레이어 필터는 feature-state를 못 쓰기 때문) 100% 상태가 바뀔 때만 setData.
 */
let peakSignature = ''
function updatePeakSource(frames: Frames, force = false) {
  const m = map.value
  const g = geo.value
  if (!m || !g) return
  const sig = g.sgg.features
    .filter((f) => (frames[f.properties.key]?.peak ?? 0) > 0)
    .map((f) => f.id)
    .join(',')
  if (!force && sig === peakSignature) return
  peakSignature = sig
  startPulse()
  const peaks = new Set(sig.split(','))
  ;(m.getSource(SRC.sgg) as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: g.sgg.features.map((f) => ({ ...f, properties: { ...f.properties, peak: peaks.has(String(f.id)) } })),
  })
}

/** 서버 값 매칭 → 목표 값/라벨 높이 계산 */
function updateTargets() {
  const g = geo.value
  if (!g) return
  const result = matchTurnout(props.values, g)
  targets = {}
  for (const f of g.sgg.features) targets[f.properties.key] = result.values[f.properties.key]
  emit('matched', result)
}

/** 애니메이션 실행. fromZero면 0부터 다시 */
async function play(fromZero = true) {
  updateTargets()
  const cfg = props.animation
  if (cfg.duration <= 0) {
    animator.set(targets, isPeak)
    render(animator.frames, true)
  } else {
    await animator.animateTo(targets, cfg, isPeak, fromZero)
    render(animator.frames, true)
  }
  emit('animationend')
}

/** 모두 0으로 (블록은 최소 높이) */
function reset() {
  updateTargets()
  const zero = Object.fromEntries(Object.keys(targets).map((k) => [k, 0]))
  animator.set(zero, () => false)
  render(animator.frames, true)
}

/** 애니메이션 없이 목표 값 즉시 표시 */
function showNow() {
  updateTargets()
  animator.set(targets, isPeak)
  render(animator.frames, true)
}

/** 지도 스타일 로드 완료 여부 (그 전에 시도가 바뀌면 load 때 반영) */
let ready = false
/** 시도 요청 순번 — 빠르게 여러 번 바꿔도 마지막 요청만 반영 */
let sidoRequest = 0

async function applySido(code: string) {
  const m = map.value
  if (!m || !ready) return
  const req = ++sidoRequest
  animator.stop()
  const g = await loadSido(code)
  if (req !== sidoRequest) return
  callouts?.clear()
  geo.value = g
  m.removeFeatureState({ source: SRC.sgg })
  ;(m.getSource(SRC.mask) as GeoJSONSource).setData(createMask(g.outline))
  ;(m.getSource(SRC.outline) as GeoJSONSource).setData(g.outline)
  updatePeakSource({}, true)
  reset()
  fitView()
  emit('loaded', g)
}

/** 배경 지도 켜기/끄기, 바깥 어둡게 */
function applyBackground() {
  const m = map.value
  if (!m?.getLayer(LAYER.mask)) return
  const vis = props.background.basemap ? 'visible' : 'none'
  for (const id of BASEMAP_LAYER_IDS) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', vis)
  m.setPaintProperty(LAYER.mask, 'fill-opacity', props.background.basemap ? props.background.maskOpacity : 0)
}

function applyLook() {
  const m = map.value
  if (!m?.getLayer(LAYER.extrusion)) return
  for (const [layer, prop, value] of lookPaint(props.config))
    m.setPaintProperty(layer, prop as Parameters<Map['setPaintProperty']>[1], value)
  updateCallouts(animator.frames)
}

onMounted(() => {
  const m = new Map({
    container: container.value!,
    style: createBaseStyle(true),
    center: [127.8, 36.2],
    zoom: 6,
    pitch: props.pitch,
    maxPitch: 60,
    // 라벨을 자주 갱신하므로 페이드 효과를 끈다 (깜빡임 방지)
    fadeDuration: 0,
    attributionControl: false,
    canvasContextAttributes: { antialias: true },
  })
  map.value = m
  // 개발 중 콘솔 디버깅용
  if (import.meta.env.DEV) (window as unknown as { __map: Map }).__map = m
  m.on('error', (e) => console.error('[map]', e.error?.message ?? e))

  m.on('load', () => {
    m.addSource(SRC.mask, { type: 'geojson', data: EMPTY })
    m.addSource(SRC.outline, { type: 'geojson', data: EMPTY })
    m.addSource(SRC.sgg, { type: 'geojson', data: EMPTY })
    m.addSource(SRC.labels, { type: 'geojson', data: EMPTY })
    for (const layer of createLayers(props.config, props.background.maskOpacity, props.effects.glow)) m.addLayer(layer)
    callouts = new CalloutManager(m)
    applyBackground()

    m.on('move', liftLabels)
    ready = true
    applySido(props.sido)
  })
})

watch(
  () => props.sido,
  (code) => applySido(code),
)
// 값 변경: 현재 표시 상태에서 새 값으로 이어서 애니메이션
watch(
  () => props.values,
  () => (props.autoplay ? play(false) : showNow()),
  { deep: true },
)
// 높이 설정 변경: 즉시 반영
watch(
  () => [props.config.maxHeight, props.config.peakHeight],
  () => {
    updateTargets()
    render(animator.frames, true)
  },
)
watch(() => [props.config.color, props.config.dimOpacity, props.config.dimLightness], applyLook)
watch(() => props.background, applyBackground, { deep: true })
watch(() => props.effects, applyEffects, { deep: true })
watch(
  () => props.padding,
  () => fitView(),
  { deep: true },
)
watch(
  () => props.pitch,
  (pitch) => map.value?.easeTo({ pitch, duration: 600 }),
)

onBeforeUnmount(() => {
  animator.stop()
  cancelAnimationFrame(pulseRaf)
  callouts?.clear()
  map.value?.remove()
})

defineExpose({ map, geo, fitView, play, reset, showNow })
</script>

<style scoped>
.map-view {
  position: absolute;
  inset: 0;
}
</style>
