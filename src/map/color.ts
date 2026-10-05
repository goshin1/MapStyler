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

/** 메인 색상에서 파생되는 팔레트 */
export function paletteOf(main: string) {
  return {
    low: mix(main, '#000000', 0.55), // 0%
    main, // 99.9%
    peak: mix(main, '#ffffff', 0.28), // 100%
    floor: mix(main, '#000000', 0.88),
    floorLine: mix(main, '#ffffff', 0.15),
    labelHalo: mix(main, '#000000', 0.75),
  }
}
