/**
 * 1단계: 시도별 지도 데이터 전처리
 *
 * 입력 : data/geojson-raw/korea-sgg.geojson (시군구 경계)
 * 출력 : public/geo/{sido}.json  — 시도 하나 분량 (SidoGeo, src/types.ts 참조)
 *        public/geo/index.json   — 시도 목록 (코드, 이름, bbox, 시군구 수)
 *
 * 처리 내용
 *  - 시군구 폴리곤을 안쪽으로 살짝 축소 → 3D 블록 사이에 틈이 생겨 구분선 역할
 *  - 시도 외곽선: 원본 시군구를 합쳐(dissolve) 생성 → 시군구와 경계가 정확히 일치
 *  - 라벨 위치: polylabel (폴리곤 내부에서 가장 넓은 지점)
 *  - 매칭 키: "시도명시군구명" 공백 제거 (서버 값 "서울특별시 종로구" 와 매칭)
 *
 * 실행 : npm run build:geo
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as turf from '@turf/turf'
import polylabel from 'polylabel'

const ROOT = process.env.MAPSTYLER_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'data/geojson-raw/korea-sgg.geojson')
const OUT = path.join(ROOT, 'public/geo')

/** 축소 폭 = 시도 bbox 대각선 길이 × 비율 (최소/최대 m) */
const INSET_RATIO = 0.0012
const INSET_MIN_M = 15
const INSET_MAX_M = 300
/** 외곽선 dissolve 후 남는 작은 틈(구멍) 제거 기준 (㎡) */
const HOLE_MIN_AREA = 200_000
/** 좌표 소수점 자리 (6자리 ≈ 0.1m) */
const PRECISION = 6

export const normalizeKey = (s) => s.replace(/\s+/g, '')

const round = (geom) => turf.truncate(geom, { precision: PRECISION, coordinates: 2, mutate: true })

/** 폴리곤 각 파트를 분리 */
function parts(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates]
  return geom.coordinates
}

/** 시군구 폴리곤 축소. 너무 작은 섬 등 축소 후 사라지는 파트는 원본 유지 */
function inset(feature, meters) {
  const out = []
  for (const rings of parts(feature.geometry)) {
    const poly = turf.polygon(rings)
    let shrunk = null
    try {
      shrunk = turf.buffer(poly, -meters, { units: 'meters' })
    } catch {
      shrunk = null
    }
    if (shrunk && shrunk.geometry && turf.area(shrunk) > 0) {
      out.push(...parts(shrunk.geometry))
    } else {
      out.push(rings)
    }
  }
  return out.length === 1
    ? { type: 'Polygon', coordinates: out[0] }
    : { type: 'MultiPolygon', coordinates: out }
}

/** 시군구들을 합쳐 시도 외곽선 생성 + 자잘한 내부 틈 제거 */
function dissolve(features) {
  const merged =
    features.length === 1 ? turf.clone(features[0]) : turf.union(turf.featureCollection(features))
  const cleaned = parts(merged.geometry).map((rings) => [
    rings[0],
    ...rings.slice(1).filter((hole) => turf.area(turf.polygon([hole])) >= HOLE_MIN_AREA),
  ])
  return turf.feature(
    cleaned.length === 1
      ? { type: 'Polygon', coordinates: cleaned[0] }
      : { type: 'MultiPolygon', coordinates: cleaned },
  )
}

/** 라벨 위치: 가장 넓은 파트에서 polylabel */
function labelPoint(geom) {
  const biggest = parts(geom)
    .map((rings) => ({ rings, area: turf.area(turf.polygon(rings)) }))
    .sort((a, b) => b.area - a.area)[0].rings
  const p = polylabel(biggest, 0.0002)
  return [Number(p[0].toFixed(PRECISION)), Number(p[1].toFixed(PRECISION))]
}

function main() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'))
  fs.mkdirSync(OUT, { recursive: true })

  /** @type {Map<string, any[]>} */
  const bySido = new Map()
  for (const f of raw.features) {
    const sido = f.properties.sgg.slice(0, 2)
    if (!bySido.has(sido)) bySido.set(sido, [])
    bySido.get(sido).push(f)
  }

  const index = []
  for (const [sido, feats] of [...bySido.entries()].sort()) {
    const sidonm = feats[0].properties.sidonm
    const outline = round(dissolve(feats))
    const bbox = turf.bbox(outline).map((v) => Number(v.toFixed(PRECISION)))
    const diag = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[3]], { units: 'meters' })
    const insetM = Math.min(INSET_MAX_M, Math.max(INSET_MIN_M, diag * INSET_RATIO))

    const keys = new Set()
    const sgg = []
    const labels = []
    for (const f of feats) {
      const { sgg: code, sggnm } = f.properties
      const props = { sgg: code, sidonm, sggnm, key: normalizeKey(sidonm + sggnm) }
      if (keys.has(props.key)) throw new Error(`매칭 키 중복: ${props.key}`)
      keys.add(props.key)
      sgg.push(round(turf.feature(inset(f, insetM), props, { id: Number(code) })))
      labels.push(turf.point(labelPoint(f.geometry), props, { id: Number(code) }))
    }

    const data = {
      sido,
      sidonm,
      bbox,
      sgg: turf.featureCollection(sgg),
      outline,
      labels: turf.featureCollection(labels),
    }
    const file = path.join(OUT, `${sido}.json`)
    fs.writeFileSync(file, JSON.stringify(data))
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    index.push({ sido, sidonm, bbox, count: sgg.length })
    console.log(`${sido} ${sidonm.padEnd(10, ' ')} 시군구 ${String(sgg.length).padStart(2)}  축소 ${insetM.toFixed(0)}m  ${kb}KB`)
  }

  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2))
  console.log(`\n완료: ${index.length}개 시도 → public/geo/`)
}

main()
