import type { Feature, MultiPolygon, Polygon } from 'geojson'

/**
 * 시도 바깥을 어둡게 누르는 마스크 폴리곤.
 * 넓은 사각형(대한민국 주변)에 시도 외곽선을 구멍으로 뚫는다.
 */
export function createMask(outline: Feature<Polygon | MultiPolygon>): Feature<Polygon> {
  const world = [
    [110, 20],
    [150, 20],
    [150, 50],
    [110, 50],
    [110, 20],
  ]
  const g = outline.geometry
  const parts = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  // 각 파트의 바깥 고리만 구멍으로 (시도 내부 구멍은 마스크하지 않음)
  const holes = parts.map((rings) => rings[0])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...holes] } }
}
