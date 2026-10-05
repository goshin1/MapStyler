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
export function paletteOf(main: string, dimLightness = 0.35) {
  return {
    peak: main,
    dimHigh: mix(main, '#ffffff', dimLightness),
    dimLow: mix(main, '#ffffff', Math.min(0.85, dimLightness + 0.3)),
    floor: mix(main, '#000000', 0.88),
    floorLine: mix(main, '#ffffff', 0.15),
    labelHalo: mix(main, '#000000', 0.75),
  }
}
