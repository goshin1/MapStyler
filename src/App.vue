<template>
  <div class="app">
    <div class="map">
      <MapView
        ref="mapView"
        :sido="sido"
        :values="values"
        :config="config"
        :animation="animation"
        :autoplay="autoplay"
        :padding="padding"
        :background="background"
        :effects="effects"
        @loaded="onLoaded"
        @matched="match = $event"
      />
    </div>
    <div class="map-remocon">
      <MapRemocon
        v-model:sido="sido"
        v-model:config="config"
        v-model:animation="animation"
        v-model:values="values"
        v-model:autoplay="autoplay"
        v-model:collapsed="collapsed"
        v-model:background="background"
        v-model:effects="effects"
        :sido-list="sidoList"
        :geo="geo"
        :match="match"
        @play="mapView?.play()"
        @reset="mapView?.reset()"
        @show-now="mapView?.showNow()"
        @randomize="randomize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/*
[개발 계획 — feature/3d-map]
대상: 현재 행정구역 16개 시도 (전남광주통합특별시 포함)
화면: 시도 하나를 선택하면 해당 시도의 시군구를 3D로 표시 (시안 참조)

0. 준비          : maplibre CSS, 폴더 구조, 공통 타입
1. 데이터 전처리 : scripts/build-geo.mjs → public/geo/{sido}.json
                   (시군구 축소 폴리곤, 시도 외곽선 dissolve, bbox, 라벨 위치, 일반구 → 시 통합)
2. 3D 지도 기본  : 시도 선택 → fitBounds, pitch 45° 제한, 바닥 + extrusion + 라벨
3. 값 매칭/표현  : "시도명 시군구명" 공백 제거 정규화 + 별칭표
                   0~99.9%: 낮은 높이 + 연한 색/반투명, 100%(원본 값 기준): 살짝 더 높게 + 메인 색 그대로
4. 애니메이션    : requestAnimationFrame + feature-state 로 차오름
5. 리모컨        : 시도 선택, 메인 색상, 시군구별 %, maxHeight/peakHeight, 재생/리셋
6. 다크 벡터 배경: OpenFreeMap 기반 커스텀 다크 스타일 + 시도 바깥 마스크
7. 연출 다듬기   : 글로우, 하이라이트, 1위 강조
8. 배포 준비     : PMTiles 자체 호스팅, 빌드 검증
*/
import { computed, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue'
import MapView from './components/MapView.vue'
import MapRemocon, { type SidoIndex } from './components/MapRemocon.vue'
import type { AnimationConfig, BackgroundConfig, EffectConfig, SidoConfig, SidoGeo, RateInput } from './types'
import { getSidoConfig } from './config/sido'
import { mockRates, type MatchResult } from './composables/useRingRate'
import { DEFAULT_ANIMATION } from './map/animator'
import { DEFAULT_EFFECTS } from './map/effects'

const sido = ref('11')
const sidoList = ref<SidoIndex[]>([])
const config = ref<SidoConfig>(getSidoConfig(sido.value))
const animation = ref<AnimationConfig>({ ...DEFAULT_ANIMATION })
const autoplay = ref(true)
const background = ref<BackgroundConfig>({ basemap: true, maskOpacity: 0.35 })
const effects = ref<EffectConfig>({ ...DEFAULT_EFFECTS })
const values = ref<RateInput>({})
const geo = shallowRef<SidoGeo>()
const match = ref<MatchResult>()
const mapView = useTemplateRef('mapView')
const collapsed = ref(false)
/** 리모컨 패널(폭 320 + 여백)이 펼쳐져 있으면 지도를 왼쪽 영역에 맞춘다 */
const padding = computed(() => ({ top: 60, bottom: 60, left: 60, right: collapsed.value ? 60 : 380 }))

// 시도를 바꾸면 높이는 그 시도 기본값으로, 색 설정은 유지
watch(sido, (code) => {
  const { color, dimOpacity, dimLightness } = config.value
  config.value = { ...getSidoConfig(code), color, dimOpacity, dimLightness }
})

function onLoaded(g: SidoGeo) {
  geo.value = g
  randomize()
}

function randomize() {
  if (geo.value) values.value = mockRates(geo.value)
}

onMounted(async () => {
  sidoList.value = await (await fetch(`${import.meta.env.BASE_URL}geo/index.json`)).json()
})
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
</style>
