import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl'
import type { SidoConfig } from '../types'
import { BASEMAP_COLORS, LABEL_FONT } from './style'
import { paletteOf } from './color'

export const SRC = {
  mask: 'sido-mask',
  outline: 'sido-outline',
  sgg: 'sgg',
  labels: 'sgg-labels',
} as const

export const LAYER = {
  /** 시도 바깥 어둡게 */
  mask: 'sido-mask',
  floor: 'sido-floor',
  /** 시도 외곽 은은한 글로우 */
  sidoGlow: 'sido-glow',
  floorLine: 'sido-floor-line',
  /** 100% 블록 바닥 주변 글로우 */
  peakGlow: 'sgg-peak-glow',
  /** 100% 블록 (불투명, 메인 색) — 반투명 레이어보다 먼저 그려야 가림이 올바르다 */
  extrusionPeak: 'sgg-extrusion-peak',
  /** 0~99.9% 블록 (연한 색, 반투명) */
  extrusion: 'sgg-extrusion',
  label: 'sgg-label',
  labelPeak: 'sgg-label-peak',
} as const

type Look = Pick<SidoConfig, 'color' | 'dimOpacity' | 'dimLightness'>

/** 0~99.9% 블록 색: 값이 낮을수록 더 연하게 (feature-state v) */
export function dimColor(look: Look): ExpressionSpecification {
  const p = paletteOf(look.color, look.dimLightness)
  return ['interpolate', ['linear'], ['coalesce', ['feature-state', 'v'], 0], 0, p.dimLow, 100, p.dimHigh]
}

/** 라벨 텍스트: 시군구명 + 줄바꿈 + 퍼센트 */
const LABEL_TEXT: ExpressionSpecification = [
  'format',
  ['get', 'sggnm'],
  { 'font-scale': 0.85 },
  '\n',
  {},
  ['get', 'pct'],
  { 'font-scale': 1.05 },
]

/** 블록 높이 (feature-state h) */
const HEIGHT: ExpressionSpecification = ['coalesce', ['feature-state', 'h'], 0]

export function createLayers(look: Look, maskOpacity = 0.35, glow = 0.7): LayerSpecification[] {
  const p = paletteOf(look.color, look.dimLightness)
  return [
    // 시도 바깥 배경 지도를 어둡게 눌러 선택한 시도에 시선이 가도록
    {
      id: LAYER.mask,
      type: 'fill',
      source: SRC.mask,
      paint: { 'fill-color': BASEMAP_COLORS.background, 'fill-opacity': maskOpacity },
    },
    // 바닥: 시도 전체 면 (블록 사이 틈으로 보이는 색)
    {
      id: LAYER.floor,
      type: 'fill',
      source: SRC.outline,
      paint: { 'fill-color': p.floor, 'fill-opacity': 0.95 },
    },
    // 시도 외곽 글로우
    {
      id: LAYER.sidoGlow,
      type: 'line',
      source: SRC.outline,
      paint: { 'line-color': p.glow, 'line-width': 14, 'line-blur': 14, 'line-opacity': 0.3 * glow },
    },
    // 바닥 외곽선
    {
      id: LAYER.floorLine,
      type: 'line',
      source: SRC.outline,
      paint: { 'line-color': p.floorLine, 'line-width': 1.5, 'line-blur': 1, 'line-opacity': 0.8 },
    },
    // 100% 블록 바닥 글로우 (블록 아래로 번지는 빛)
    {
      id: LAYER.peakGlow,
      type: 'line',
      source: SRC.sgg,
      filter: ['==', ['get', 'peak'], true],
      paint: { 'line-color': p.glow, 'line-width': 22, 'line-blur': 20, 'line-opacity': 0.9 * glow },
    },
    // 100% 블록 — 메인 색 그대로, 불투명
    // (fill-extrusion-opacity는 레이어 단위라 100%/그 외를 레이어로 나누고, 소스 속성 peak로 필터)
    {
      id: LAYER.extrusionPeak,
      type: 'fill-extrusion',
      source: SRC.sgg,
      filter: ['==', ['get', 'peak'], true],
      paint: {
        'fill-extrusion-color': p.peak,
        'fill-extrusion-height': HEIGHT,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // 0~99.9% 블록 — 연한 색, 반투명
    {
      id: LAYER.extrusion,
      type: 'fill-extrusion',
      source: SRC.sgg,
      filter: ['!=', ['get', 'peak'], true],
      paint: {
        'fill-extrusion-color': dimColor(look),
        'fill-extrusion-height': HEIGHT,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': look.dimOpacity,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // 일반 라벨 — 지면에 그려지므로 text-translate로 블록 윗면 높이만큼 올린다
    {
      id: LAYER.label,
      type: 'symbol',
      source: SRC.labels,
      filter: ['!', ['get', 'peak']],
      layout: {
        'text-field': LABEL_TEXT,
        'text-font': LABEL_FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9.5, 11, 13],
        'text-line-height': 1.15,
        'text-padding': 1,
        'text-variable-anchor': ['center', 'top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.4,
        // 값이 큰 곳 우선 표시
        'symbol-sort-key': ['-', 0, ['get', 'v']],
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': p.labelHalo,
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
        'text-translate-anchor': 'viewport',
      },
    },
    // 100% 라벨 — 항상 표시, 더 크게
    {
      id: LAYER.labelPeak,
      type: 'symbol',
      source: SRC.labels,
      filter: ['get', 'peak'],
      layout: {
        'text-field': LABEL_TEXT,
        'text-font': LABEL_FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 11, 17],
        'text-line-height': 1.15,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': p.labelHalo,
        'text-halo-width': 2,
        'text-halo-blur': 0.5,
        'text-translate-anchor': 'viewport',
      },
    },
  ]
}

/** 색 설정 변경 시 갱신할 paint 속성 */
export function lookPaint(look: Look): [string, string, string | number | ExpressionSpecification][] {
  const p = paletteOf(look.color, look.dimLightness)
  return [
    [LAYER.floor, 'fill-color', p.floor],
    [LAYER.floorLine, 'line-color', p.floorLine],
    [LAYER.extrusionPeak, 'fill-extrusion-color', p.peak],
    [LAYER.sidoGlow, 'line-color', p.glow],
    [LAYER.peakGlow, 'line-color', p.glow],
    [LAYER.extrusion, 'fill-extrusion-color', dimColor(look)],
    [LAYER.extrusion, 'fill-extrusion-opacity', look.dimOpacity],
    [LAYER.label, 'text-halo-color', p.labelHalo],
    [LAYER.labelPeak, 'text-halo-color', p.labelHalo],
  ]
}
