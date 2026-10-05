<template>
  <div class="app">
    <div class="map">
      <MapView :sido="sido" />
    </div>
    <div class="map-remocon">
      <!-- 지도 애니메이션 컨트롤 (5단계: MapRemocon.vue) — 지금은 시도 선택만 임시로 -->
      <select v-model="sido">
        <option v-for="s in sidoList" :key="s.sido" :value="s.sido">{{ s.sidonm }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import MapView from './components/MapView.vue'

interface SidoIndex {
  sido: string
  sidonm: string
  bbox: [number, number, number, number]
  count: number
}

const sido = ref('11')
const sidoList = ref<SidoIndex[]>([])

onMounted(async () => {
  sidoList.value = await (await fetch(`${import.meta.env.BASE_URL}geo/index.json`)).json()
})

/*
[개발 계획 — feature/3d-map]
대상: 현재 행정구역 16개 시도 (전남광주통합특별시 포함)
화면: 시도 하나를 선택하면 해당 시도의 시군구를 3D로 표시 (시안 참조)

0. 준비          : maplibre CSS, 폴더 구조, 공통 타입
1. 데이터 전처리 : scripts/build-geo.mjs → public/geo/{sido}.json
                   (시군구 축소 폴리곤, 시도 외곽선 dissolve, bbox, 라벨 위치)
2. 3D 지도 기본  : 시도 선택 → fitBounds, pitch 45° 제한, 바닥 + extrusion + 라벨
3. 값 매칭/표현  : "시도명 시군구명" 공백 제거 정규화 + 별칭표
                   0~99.9% 낮은 높이, 100%(원본 값 기준)는 살짝 더 높게 + 색 강조
4. 애니메이션    : requestAnimationFrame + feature-state 로 차오름
5. 리모컨        : 시도 선택, 메인 색상, 시군구별 %, maxHeight/peakHeight, 재생/리셋
6. 다크 벡터 배경: OpenFreeMap 기반 커스텀 다크 스타일 + 시도 바깥 마스크
7. 연출 다듬기   : 글로우, 하이라이트, 1위 강조
8. 배포 준비     : PMTiles 자체 호스팅, 빌드 검증
*/
</script>

<style scoped>
.app {
  position: relative;
  width: 100%;
  height: 100%;
}
.map {
  position: absolute;
  inset: 0;
}
.map-remocon {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1;
}
.map-remocon select {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 10px;
}
</style>
