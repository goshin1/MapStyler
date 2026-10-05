import { Marker, type Map } from 'maplibre-gl'

export interface CalloutItem {
  key: string
  lngLat: [number, number]
  title: string
  value: string
  sub: string
}

/**
 * 100%(또는 1위) 블록 위 말풍선.
 * MapLibre Marker(HTML)로 띄우고, 블록 높이만큼 위로 올리는 offset을 갱신한다.
 */
export class CalloutManager {
  private markers = new globalThis.Map<string, { marker: Marker; el: HTMLElement; html: string }>()
  private offsetY = 0

  private map: Map

  constructor(map: Map) {
    this.map = map
  }

  /** 표시할 말풍선 목록으로 갱신 (없는 것은 제거, 새 것은 등장 애니메이션) */
  update(items: CalloutItem[], color: string) {
    const keep = new Set(items.map((i) => i.key))
    for (const [key, { marker }] of this.markers) {
      if (!keep.has(key)) {
        marker.remove()
        this.markers.delete(key)
      }
    }
    for (const item of items) {
      let entry = this.markers.get(item.key)
      if (!entry) {
        const el = document.createElement('div')
        el.className = 'peak-callout'
        const marker = new Marker({ element: el, anchor: 'bottom', offset: [0, -this.offsetY] })
          .setLngLat(item.lngLat)
          .addTo(this.map)
        entry = { marker, el, html: '' }
        this.markers.set(item.key, entry)
      }
      entry.el.style.setProperty('--callout-color', color)
      // 마커 루트(el)는 MapLibre가 transform으로 위치를 잡으므로 애니메이션은 안쪽 요소에
      const html = `<div class="peak-callout__inner">
        <div class="peak-callout__box">
          <div class="peak-callout__title"><span>${esc(item.title)}</span><b>${esc(item.value)}</b></div>
          ${item.sub ? `<div class="peak-callout__sub">${esc(item.sub)}</div>` : ''}
        </div>
        <div class="peak-callout__stem"></div>
      </div>`
      // 내용이 바뀔 때만 다시 그림 (다시 그리면 등장 애니메이션이 재생됨)
      if (entry.html !== html) {
        entry.html = html
        entry.el.innerHTML = html
      }
      entry.marker.setLngLat(item.lngLat)
    }
  }

  /** 블록 윗면 높이(px)만큼 말풍선을 올린다 */
  setLift(px: number) {
    if (Math.abs(px - this.offsetY) < 0.5) return
    this.offsetY = px
    for (const { marker } of this.markers.values()) marker.setOffset([0, -px])
  }

  clear() {
    for (const { marker } of this.markers.values()) marker.remove()
    this.markers.clear()
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
