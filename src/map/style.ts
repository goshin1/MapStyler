import type { StyleSpecification } from 'maplibre-gl'

/**
 * 기본 지도 스타일 (2단계: 단색 배경)
 * 6단계에서 다크 벡터 배경(도로/강)으로 교체한다.
 *
 * glyphs URL을 두지 않으면 MapLibre가 라벨을 로컬 폰트로 그린다 → 외부 폰트 서버 불필요.
 */
export const BASE_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#070b14' },
    },
  ],
  light: {
    anchor: 'viewport',
    color: '#ffffff',
    intensity: 0.45,
    position: [1.2, 210, 35],
  },
}

/** 라벨 폰트 (로컬 폰트 이름, 앞에서부터 사용) */
export const LABEL_FONT = ['Pretendard Bold', 'Malgun Gothic Bold', 'Noto Sans KR Bold', 'sans-serif']
