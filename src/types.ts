import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'

/** 시군구 폴리곤 속성 (public/geo/{sido}.json) */
export interface SggProps {
  /** 시군구 코드 (예: 11110) — 지도 feature id로 사용 */
  sgg: string
  sidonm: string
  sggnm: string
  /** 매칭 키: 정규화된 "시도명시군구명" (공백 제거) */
  key: string
}

/** 시도 단위 지도 데이터 (전처리 결과) */
export interface SidoGeo {
  sido: string
  sidonm: string
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number]
  /** 시군구 폴리곤 (구분선이 보이도록 안쪽으로 살짝 축소) */
  sgg: FeatureCollection<Polygon | MultiPolygon, SggProps>
  /** 시도 외곽선 (시군구 dissolve) */
  outline: Feature<Polygon | MultiPolygon>
  /** 시군구 라벨 위치 */
  labels: FeatureCollection<Point, SggProps>
}

/** 서버에서 받는 시군구별 값: "시도명 시군구명" → 퍼센트(0~100) */
export type TurnoutInput = Record<string, number>

/** 시도별 표현 설정 */
export interface SidoConfig {
  /** 0~99.9% 구간 최대 높이(m) */
  maxHeight: number
  /** 100%일 때 높이(m) */
  peakHeight: number
  /** 메인 색상 — 100%일 때 이 색 그대로 */
  color: string
  /** 0~99.9% 블록 불투명도 (0~1). 100% 블록은 항상 1 */
  dimOpacity: number
  /** 0~99.9% 블록을 메인 색보다 얼마나 연하게 할지 (0~1, 클수록 연함) */
  dimLightness: number
}

/** 차오름 애니메이션 설정 */
export interface AnimationConfig {
  /** 한 시군구가 목표 값까지 차오르는 시간(ms) */
  duration: number
  /** 순차 모드에서 시군구 사이 시작 간격(ms) */
  stagger: number
  /** 100% 도달 후 peakHeight까지 솟는 시간(ms) */
  peakDuration: number
  /** together: 동시 / ascending: 낮은 값부터(100%가 마지막) / random: 무작위 순서 */
  order: 'together' | 'ascending' | 'random'
}
