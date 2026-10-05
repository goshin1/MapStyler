import type { SidoConfig } from '../types'

/**
 * 시도별 표현 설정.
 * 높이(m)는 시도 크기에 따라 화면상 느낌이 달라지므로 시도마다 직접 튜닝한다.
 * - maxHeight : 0 ~ 99.9% 구간의 최대 높이 (값에 비례, 낮게 유지)
 * - peakHeight: 100%일 때 높이 (maxHeight보다 살짝 높게)
 */
export const DEFAULT_COLOR = '#e3141c'

/** 기본 색 표현: 100%는 메인 색 그대로, 0~99.9%는 연하게 + 반투명 */
export const DEFAULT_LOOK = { color: DEFAULT_COLOR, dimOpacity: 0.78, dimLightness: 0.35 }

export const SIDO_CONFIG: Record<string, SidoConfig> = {
  '11': { maxHeight: 600, peakHeight: 950, ...DEFAULT_LOOK }, // 서울
  '26': { maxHeight: 900, peakHeight: 1400, ...DEFAULT_LOOK }, // 부산
  '27': { maxHeight: 1100, peakHeight: 1700, ...DEFAULT_LOOK }, // 대구
  '28': { maxHeight: 1800, peakHeight: 2800, ...DEFAULT_LOOK }, // 인천
  '30': { maxHeight: 600, peakHeight: 950, ...DEFAULT_LOOK }, // 대전
  '31': { maxHeight: 900, peakHeight: 1400, ...DEFAULT_LOOK }, // 울산
  '36': { maxHeight: 600, peakHeight: 950, ...DEFAULT_LOOK }, // 세종
  '41': { maxHeight: 2400, peakHeight: 3700, ...DEFAULT_LOOK }, // 경기
  '43': { maxHeight: 2400, peakHeight: 3700, ...DEFAULT_LOOK }, // 충북
  '44': { maxHeight: 2400, peakHeight: 3700, ...DEFAULT_LOOK }, // 충남
  '47': { maxHeight: 3000, peakHeight: 4600, ...DEFAULT_LOOK }, // 경북
  '48': { maxHeight: 2600, peakHeight: 4000, ...DEFAULT_LOOK }, // 경남
  '50': { maxHeight: 1400, peakHeight: 2200, ...DEFAULT_LOOK }, // 제주
  '51': { maxHeight: 3000, peakHeight: 4600, ...DEFAULT_LOOK }, // 강원
  '52': { maxHeight: 2400, peakHeight: 3700, ...DEFAULT_LOOK }, // 전북
  '12': { maxHeight: 3000, peakHeight: 4600, ...DEFAULT_LOOK }, // 전남광주
}

export function getSidoConfig(sido: string): SidoConfig {
  return { ...(SIDO_CONFIG[sido] ?? { maxHeight: 1500, peakHeight: 2300, ...DEFAULT_LOOK }) }
}

/** 0% 블록도 형태가 보이도록 깔아 두는 최소 높이 비율 (maxHeight 기준) */
export const MIN_HEIGHT_RATIO = 0.12

/**
 * 서버에서 오는 시도명 별칭 → 현재 행정구역 시도명.
 * (예전 명칭이나 통합 전 명칭으로 오는 경우 대비)
 */
export const SIDO_ALIAS: Record<string, string> = {
  광주광역시: '전남광주통합특별시',
  전라남도: '전남광주통합특별시',
  전라북도: '전북특별자치도',
  강원도: '강원특별자치도',
  제주도: '제주특별자치도',
}
