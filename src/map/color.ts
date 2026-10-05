/** "#rrggbb" 두 색을 t(0~1) 비율로 섞는다 */
export function mix(a: string, b: string, t: number): string {
  const pa = parse(a)
  const pb = parse(b)
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

function parse(hex: string): number[] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

/**
 * 메인 색상에서 파생되는 팔레트
 * - peak: 100% → 메인 색 그대로 (원색)
 * - dimLow ~ dimHigh: 0% ~ 99.9% → 메인 색을 흰색 쪽으로 연하게 (값이 낮을수록 더 연함)
 */
export function paletteOf(main: string, dimLightness = 0.35, theme: 'dark' | 'light' = 'dark') {
  const light = theme === 'light'
  return {
    peak: main,
    glow: main,
    dimHigh: mix(main, '#ffffff', dimLightness),
    dimLow: mix(main, '#ffffff', Math.min(0.85, dimLightness + 0.3)),
    floor: light ? mix(main, '#ffffff', 0.86) : mix(main, '#000000', 0.88),
    floorLine: light ? mix(main, '#000000', 0.1) : mix(main, '#ffffff', 0.15),
    /** 0~99% 라벨: 다크는 흰 글자 + 어두운 테두리, 화이트는 진한 글자 + 흰 테두리 */
    labelText: light ? '#1b2232' : '#ffffff',
    labelHalo: light ? '#ffffff' : mix(main, '#000000', 0.75),
    /** 100% 라벨: 원색 블록 위라 두 테마 모두 흰 글자 + 진한 테두리 */
    peakLabelText: '#ffffff',
    peakLabelHalo: mix(main, '#000000', light ? 0.55 : 0.75),
  }
}
