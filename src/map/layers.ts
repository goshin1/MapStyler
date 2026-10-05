import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl'
import { LABEL_FONT } from './style'
import { paletteOf } from './color'

export const SRC = {
  outline: 'sido-outline',
  sgg: 'sgg',
  labels: 'sgg-labels',
} as const

export const LAYER = {
  floor: 'sido-floor',
  floorLine: 'sido-floor-line',
  extrusion: 'sgg-extrusion',
  label: 'sgg-label',
  labelPeak: 'sgg-label-peak',
} as const

/**
 * 블록 색: 100%는 밝은 강조색, 그 외는 값(0~100)에 따라 어두운 색 → 메인 색
 * feature-state: v(값), peak(100% 여부)
 */
export function blockColor(main: string): ExpressionSpecification {
  const p = paletteOf(main)
  return [
    'case',
    ['boolean', ['feature-state', 'peak'], false],
    p.peak,
    ['interpolate', ['linear'], ['coalesce', ['feature-state', 'v'], 0], 0, p.low, 100, p.main],
  ]
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

export function createLayers(main: string): LayerSpecification[] {
  const p = paletteOf(main)
  return [
    // 바닥: 시도 전체 면 (블록 사이 틈으로 보이는 색)
    {
      id: LAYER.floor,
      type: 'fill',
      source: SRC.outline,
      paint: { 'fill-color': p.floor, 'fill-opacity': 0.95 },
    },
    // 바닥 외곽선
    {
      id: LAYER.floorLine,
      type: 'line',
      source: SRC.outline,
      paint: { 'line-color': p.floorLine, 'line-width': 1.5, 'line-blur': 1, 'line-opacity': 0.8 },
    },
    // 시군구 3D 블록 — 높이/색은 feature-state (h, v, peak)
    {
      id: LAYER.extrusion,
      type: 'fill-extrusion',
      source: SRC.sgg,
      paint: {
        'fill-extrusion-color': blockColor(main),
        'fill-extrusion-height': ['coalesce', ['feature-state', 'h'], 0],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.96,
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
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 11, 13],
        'text-line-height': 1.15,
        'text-padding': 1,
        'text-variable-anchor': ['center', 'top', 'bottom'],
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

/** 메인 색상 변경 시 갱신할 paint 속성 */
export function colorPaint(main: string): [string, string, string | ExpressionSpecification][] {
  const p = paletteOf(main)
  return [
    [LAYER.floor, 'fill-color', p.floor],
    [LAYER.floorLine, 'line-color', p.floorLine],
    [LAYER.extrusion, 'fill-extrusion-color', blockColor(main)],
    [LAYER.label, 'text-halo-color', p.labelHalo],
    [LAYER.labelPeak, 'text-halo-color', p.labelHalo],
  ]
}
