import type { LayerSpecification } from 'maplibre-gl'
import { LABEL_FONT } from './style'

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
} as const

/** 3단계에서 값이 연결되기 전 임시 높이(m) */
export const DEFAULT_HEIGHT = 500

export const COLORS = {
  floor: '#1c0609',
  floorLine: '#ff3b3b',
  block: '#cf161e',
  labelHalo: '#3a0306',
}

export function createLayers(): LayerSpecification[] {
  return [
    // 바닥: 시도 전체 면 (블록 사이 틈으로 보이는 색)
    {
      id: LAYER.floor,
      type: 'fill',
      source: SRC.outline,
      paint: { 'fill-color': COLORS.floor, 'fill-opacity': 0.95 },
    },
    // 바닥 외곽선
    {
      id: LAYER.floorLine,
      type: 'line',
      source: SRC.outline,
      paint: { 'line-color': COLORS.floorLine, 'line-width': 1.5, 'line-blur': 1, 'line-opacity': 0.8 },
    },
    // 시군구 3D 블록 — 높이는 feature-state 'h' (3·4단계에서 값/애니메이션으로 갱신)
    {
      id: LAYER.extrusion,
      type: 'fill-extrusion',
      source: SRC.sgg,
      paint: {
        'fill-extrusion-color': COLORS.block,
        'fill-extrusion-height': ['coalesce', ['feature-state', 'h'], DEFAULT_HEIGHT],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.96,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // 시군구 라벨 — 지면에 그려지므로 text-translate로 블록 윗면 높이만큼 올린다 (liftLabels)
    {
      id: LAYER.label,
      type: 'symbol',
      source: SRC.labels,
      layout: {
        'text-field': ['get', 'sggnm'],
        'text-font': LABEL_FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 11, 14],
        'text-allow-overlap': false,
        'text-padding': 2,
        'symbol-sort-key': 0,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': COLORS.labelHalo,
        'text-halo-width': 1.5,
        'text-halo-blur': 0.5,
        'text-translate-anchor': 'viewport',
      },
    },
  ]
}
