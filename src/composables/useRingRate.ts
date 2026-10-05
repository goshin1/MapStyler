import type { SidoConfig, SidoGeo, RateInput } from '../types'
import { MIN_HEIGHT_RATIO, SIDO_ALIAS } from '../config/sido'

/** 공백 제거 */
export const normalizeKey = (s: string) => s.replace(/\s+/g, '')

/** "광주광역시 동구" → "전남광주통합특별시동구" (시도 별칭 치환 + 공백 제거) */
export function toMatchKey(name: string): string {
  const key = normalizeKey(name)
  for (const [from, to] of Object.entries(SIDO_ALIAS)) {
    if (key.startsWith(from)) return to + key.slice(from.length)
  }
  return key
}

/** 100% 판정 — 반올림 전 원본 값 기준 */
export const isPeak = (v: number) => v >= 100

/** 화면 표시용 퍼센트. 100% 미만은 반올림으로 100.0%가 되지 않도록 99.9%에서 막는다 */
export function formatPct(v: number): string {
  if (isPeak(v)) return '100.0%'
  return `${Math.min(99.9, Math.max(0, v)).toFixed(1)}%`
}

/** 값 → 블록 높이(m) */
export function heightOf(v: number, cfg: SidoConfig): number {
  if (isPeak(v)) return cfg.peakHeight
  const min = cfg.maxHeight * MIN_HEIGHT_RATIO
  const ratio = Math.min(1, Math.max(0, v / 100))
  return min + (cfg.maxHeight - min) * ratio
}

export interface MatchResult {
  /** 매칭 키 → 값 */
  values: Record<string, number>
  /** 지도에 없는 입력 이름 */
  unmatched: string[]
  /** 값이 없는 시군구 이름 */
  missing: string[]
}

/** 서버 입력("서울특별시 종로구": 72.4)을 현재 시도 지도와 매칭 */
export function matchRates(input: RateInput, geo: SidoGeo): MatchResult {
  const keys = new Set(geo.sgg.features.map((f) => f.properties.key))
  const values: Record<string, number> = {}
  const unmatched: string[] = []
  for (const [name, v] of Object.entries(input)) {
    const key = toMatchKey(name)
    if (keys.has(key)) values[key] = v
    else if (key.startsWith(normalizeKey(geo.sidonm))) unmatched.push(name)
  }
  const missing = geo.sgg.features.filter((f) => !(f.properties.key in values)).map((f) => f.properties.sggnm)
  if (unmatched.length) console.warn('[rate] 매칭 안 된 이름:', unmatched)
  return { values, unmatched, missing }
}

/** 테스트용 임의 값 (서버 입력 형식) — 100%는 peaks 곳 (기본: 1~3곳 무작위) */
export function mockRates(geo: SidoGeo, peaks = 1 + Math.floor(Math.random() * 3)): RateInput {
  const out: RateInput = {}
  const feats = geo.sgg.features
  const order = feats.map((_, i) => i).sort(() => Math.random() - 0.5)
  const peakSet = new Set(order.slice(0, Math.min(peaks, feats.length)))
  feats.forEach((f, i) => {
    out[`${f.properties.sidonm} ${f.properties.sggnm}`] = peakSet.has(i)
      ? 100
      : Math.round((60 + Math.random() * 25) * 10) / 10
  })
  return out
}
