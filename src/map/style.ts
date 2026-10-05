import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'

/**
 * 배경 지도(베이스맵) 스타일
 *
 * 타일 스키마: OpenMapTiles (OpenFreeMap, planetiler 출력 모두 동일)
 *  - 기본(실사용): public/tiles/korea.pmtiles — 인터넷 없이 동작 (README 참고)
 *  - 개발 중 파일이 없을 때: .env.local 에 VITE_BASEMAP_URL=https://tiles.openfreemap.org/planet
 *
 * glyphs URL을 두지 않으면 MapLibre가 라벨을 로컬 폰트로 그린다 → 외부 폰트 서버 불필요.
 * 배경 지도의 지명 라벨은 쓰지 않는다 (시군구 라벨만 표시).
 */
const LOCAL_BASEMAP = `pmtiles://${new URL(`${import.meta.env.BASE_URL}tiles/korea.pmtiles`, location.href).href}`

/** 배경 지도 URL. VITE_BASEMAP_URL 을 빈 값으로 두면 배경 지도 없이 단색 */
export const BASEMAP_URL: string = import.meta.env.VITE_BASEMAP_URL ?? LOCAL_BASEMAP

export const BASEMAP_SOURCE = 'basemap'

/** 배경 지도 색 (시안 톤: 남색 계열 검정 + 저채도 회청색 도로 + 진한 남색 강) */
export const BASEMAP_COLORS = {
  background: '#070b14',
  park: '#0c1526',
  water: '#0f2547',
  waterLine: '#1a3560',
  road: {
    motorway: '#3a4c72',
    major: '#2c3a59',
    minor: '#1d2740',
    rail: '#243050',
  },
  building: '#121a2e',
}

/** 줌에 따른 선 굵기 */
const width = (z8: number, z12: number, z16: number): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  8,
  z8,
  12,
  z12,
  16,
  z16,
]

const notTunnel: ExpressionSpecification = ['!=', ['get', 'brunnel'], 'tunnel']

export function basemapLayers(): LayerSpecification[] {
  const c = BASEMAP_COLORS
  const src = BASEMAP_SOURCE
  return [
    {
      id: 'bm-park',
      type: 'fill',
      source: src,
      'source-layer': 'park',
      paint: { 'fill-color': c.park, 'fill-opacity': 0.6, 'fill-antialias': false },
    },
    {
      id: 'bm-landcover-wood',
      type: 'fill',
      source: src,
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass']]],
      paint: { 'fill-color': c.park, 'fill-opacity': 0.35, 'fill-antialias': false },
    },
    {
      id: 'bm-water',
      type: 'fill',
      source: src,
      'source-layer': 'water',
      // 타일 경계에 가는 격자선이 보이지 않도록 antialias 끔
      paint: { 'fill-color': c.water, 'fill-antialias': false },
    },
    {
      id: 'bm-waterway',
      type: 'line',
      source: src,
      'source-layer': 'waterway',
      filter: ['in', ['get', 'class'], ['literal', ['river', 'canal']]],
      paint: { 'line-color': c.waterLine, 'line-width': width(0.6, 1.5, 4) },
    },
    {
      id: 'bm-building',
      type: 'fill',
      source: src,
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': c.building, 'fill-opacity': 0.8, 'fill-antialias': false },
    },
    {
      id: 'bm-rail',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      filter: ['all', ['==', ['get', 'class'], 'rail'], notTunnel],
      minzoom: 10,
      paint: { 'line-color': c.road.rail, 'line-width': width(0.4, 0.8, 1.6), 'line-dasharray': [3, 2] },
    },
    {
      id: 'bm-road-minor',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      filter: [
        'all',
        ['in', ['get', 'class'], ['literal', ['tertiary', 'minor', 'service']]],
        notTunnel,
      ],
      minzoom: 11,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.road.minor, 'line-width': width(0.3, 0.6, 3) },
    },
    {
      id: 'bm-road-major',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      filter: ['all', ['in', ['get', 'class'], ['literal', ['primary', 'secondary']]], notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.road.major, 'line-width': width(0.5, 1.2, 6) },
    },
    {
      id: 'bm-road-motorway',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      filter: ['all', ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]], notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.road.motorway, 'line-width': width(0.8, 1.8, 8) },
    },
  ]
}

/** 배경 지도 레이어 id (켜기/끄기용) */
export const BASEMAP_LAYER_IDS = basemapLayers().map((l) => l.id)

/**
 * 기본 스타일: 단색 배경만.
 * 배경 지도는 지도 로드 후 addBasemap()으로 따로 붙인다
 * → 배경 지도 파일이 없거나 깨져도 시군구 3D 지도는 정상 동작.
 */
export function createBaseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': BASEMAP_COLORS.background },
      },
    ],
    light: {
      anchor: 'viewport',
      color: '#ffffff',
      intensity: 0.55,
      position: [1.3, 205, 40],
    },
  }
}

/** 라벨 폰트 (로컬 폰트 이름, 앞에서부터 사용) */
export const LABEL_FONT = ['Pretendard Bold', 'Malgun Gothic Bold', 'Noto Sans KR Bold', 'sans-serif']
