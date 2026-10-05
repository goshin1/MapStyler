<template>
  <aside class="remocon" :class="{ collapsed }" :style="{ '--accent': config.color }">
    <header>
      <strong>지도 리모컨</strong>
      <button class="ghost" :title="collapsed ? '펼치기 (H)' : '접기 (H)'" @click="collapsed = !collapsed">
        {{ collapsed ? '◀' : '▶' }}
      </button>
    </header>

    <div v-show="!collapsed" class="body">
      <!-- 지역 -->
      <section>
        <h3>지역</h3>
        <select v-model="sido">
          <option v-for="s in sidoList" :key="s.sido" :value="s.sido">{{ s.sidonm }} ({{ s.count }})</option>
        </select>
      </section>

      <!-- 배경 -->
      <section>
        <h3>배경 지도</h3>
        <label class="check"><input v-model="background.basemap" type="checkbox" /> 도로/강 배경 표시</label>
        <Slider
          v-model="background.maskOpacity"
          label="시도 바깥 어둡게"
          :min="0"
          :max="1"
          :step="0.05"
          :disabled="!background.basemap"
        />
      </section>

      <!-- 색상 -->
      <section>
        <h3>색상</h3>
        <div class="row">
          <label>메인 색상 (100%)</label>
          <input v-model="config.color" type="color" />
        </div>
        <div class="swatches">
          <button
            v-for="c in PRESETS"
            :key="c"
            class="swatch"
            :class="{ on: c.toLowerCase() === config.color.toLowerCase() }"
            :style="{ background: c }"
            @click="config.color = c"
          />
        </div>
        <Slider v-model="config.dimLightness" label="0~99% 연한 정도" :min="0" :max="0.7" :step="0.01" />
        <Slider v-model="config.dimOpacity" label="0~99% 불투명도" :min="0.2" :max="1" :step="0.01" />
      </section>

      <!-- 강조 효과 -->
      <section>
        <h3>강조 효과</h3>
        <Slider v-model="effects.glow" label="글로우 강도" :min="0" :max="1" :step="0.05" />
        <label class="check"><input v-model="effects.pulse" type="checkbox" /> 100% 글로우 숨쉬기</label>
        <label class="check"><input v-model="effects.callout" type="checkbox" /> 100% 말풍선</label>
        <label class="check">
          <input v-model="effects.calloutTopWhenNoPeak" type="checkbox" :disabled="!effects.callout" />
          100%가 없으면 1위에 말풍선
        </label>
        <div class="row">
          <label>말풍선 문구</label>
          <input v-model="effects.calloutText" class="text" type="text" :disabled="!effects.callout" />
        </div>
        <p class="hint">{시도}, {시군구} 는 이름으로 바뀝니다</p>
      </section>

      <!-- 높이 -->
      <section>
        <h3>높이 (m)</h3>
        <Slider v-model="config.maxHeight" label="0~99% 최대 높이" :min="100" :max="6000" :step="50" />
        <Slider v-model="config.peakHeight" label="100% 높이" :min="100" :max="9000" :step="50" />
        <p v-if="config.peakHeight <= config.maxHeight" class="warn">100% 높이가 최대 높이보다 낮거나 같습니다.</p>
      </section>

      <!-- 애니메이션 -->
      <section>
        <h3>애니메이션</h3>
        <div class="row">
          <label>순서</label>
          <select v-model="animation.order">
            <option value="ascending">낮은 값부터 (100% 마지막)</option>
            <option value="together">동시에</option>
            <option value="random">무작위</option>
          </select>
        </div>
        <Slider v-model="animation.duration" label="차오르는 시간 (ms)" :min="0" :max="5000" :step="100" />
        <Slider
          v-model="animation.stagger"
          label="시작 간격 (ms)"
          :min="0"
          :max="400"
          :step="10"
          :disabled="animation.order === 'together'"
        />
        <Slider v-model="animation.peakDuration" label="100% 솟는 시간 (ms)" :min="0" :max="2000" :step="50" />
        <label class="check"><input v-model="autoplay" type="checkbox" /> 값이 바뀌면 자동 애니메이션</label>
        <div class="buttons">
          <button class="primary" @click="emit('play')">▶ 재생</button>
          <button @click="emit('reset')">리셋</button>
          <button @click="emit('showNow')">즉시 표시</button>
        </div>
      </section>

      <!-- 시군구별 값 -->
      <section>
        <h3>
          시군구별 값
          <small v-if="match">값 없음 {{ match.missing.length }} · 매칭 실패 {{ match.unmatched.length }}</small>
        </h3>
        <div class="buttons">
          <button @click="emit('randomize')">임의 값</button>
          <button @click="setAll(0)">전체 0</button>
          <button @click="showImport = !showImport">JSON 붙여넣기</button>
        </div>
        <div v-if="showImport" class="import">
          <textarea v-model="importText" rows="5" placeholder='{"서울특별시 종로구": 72.4, ...}' />
          <div class="buttons">
            <button class="primary" @click="applyImport">적용</button>
            <span v-if="importError" class="warn">{{ importError }}</span>
          </div>
        </div>
        <p v-if="match?.unmatched.length" class="warn">매칭 실패: {{ match.unmatched.join(', ') }}</p>
        <ul class="sgg-list">
          <li v-for="row in rows" :key="row.name" :class="{ peak: (values[row.name] ?? 0) >= 100 }">
            <span class="name">{{ row.sggnm }}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              :value="values[row.name] ?? 0"
              @input="setValue(row.name, ($event.target as HTMLInputElement).valueAsNumber)"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              :value="values[row.name] ?? ''"
              @change="setValue(row.name, ($event.target as HTMLInputElement).valueAsNumber)"
            />
            <button class="ghost tiny" title="100%로" @click="setValue(row.name, 100)">100</button>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { AnimationConfig, BackgroundConfig, EffectConfig, SidoConfig, SidoGeo, TurnoutInput } from '../types'
import type { MatchResult } from '../composables/useTurnout'
import Slider from './RemoconSlider.vue'

export interface SidoIndex {
  sido: string
  sidonm: string
  bbox: [number, number, number, number]
  count: number
}

const props = defineProps<{
  sidoList: SidoIndex[]
  geo?: SidoGeo
  match?: MatchResult
}>()

const sido = defineModel<string>('sido', { required: true })
const config = defineModel<SidoConfig>('config', { required: true })
const animation = defineModel<AnimationConfig>('animation', { required: true })
const values = defineModel<TurnoutInput>('values', { required: true })
const background = defineModel<BackgroundConfig>('background', { required: true })
const effects = defineModel<EffectConfig>('effects', { required: true })
const autoplay = defineModel<boolean>('autoplay', { default: true })
/** 패널 접힘 (H 키) — 지도 여백 계산에 쓰이므로 밖으로 노출 */
const collapsed = defineModel<boolean>('collapsed', { default: false })

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'reset'): void
  (e: 'showNow'): void
  (e: 'randomize'): void
}>()

const PRESETS = ['#e3141c', '#ff5a1f', '#f5b400', '#14a44d', '#1565ff', '#6a3cff', '#d6246e']

const showImport = ref(false)
const importText = ref('')
const importError = ref('')

/** 현재 시도의 시군구 목록 (서버 이름 형식 "시도명 시군구명") */
const rows = computed(() =>
  (props.geo?.sgg.features ?? [])
    .map((f) => ({ name: `${f.properties.sidonm} ${f.properties.sggnm}`, sggnm: f.properties.sggnm }))
    .sort((a, b) => a.sggnm.localeCompare(b.sggnm, 'ko')),
)

function setValue(name: string, v: number) {
  if (Number.isNaN(v)) return
  values.value = { ...values.value, [name]: Math.min(100, Math.max(0, v)) }
}

function setAll(v: number) {
  values.value = Object.fromEntries(rows.value.map((r) => [r.name, v]))
}

function applyImport() {
  importError.value = ''
  try {
    const data = JSON.parse(importText.value)
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('{"이름": 값} 형식이어야 합니다')
    const out: TurnoutInput = {}
    for (const [k, v] of Object.entries(data)) {
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      if (!Number.isNaN(n)) out[k] = n
    }
    values.value = out
    showImport.value = false
  } catch (e) {
    importError.value = `JSON 오류: ${(e as Error).message}`
  }
}

/** H 키로 패널 접기/펼치기 (송출 화면 정리용) */
function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
  if (e.key === 'h' || e.key === 'H' || e.key === 'ㅗ') collapsed.value = !collapsed.value
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.remocon {
  width: 320px;
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: rgba(13, 20, 36, 0.92);
  border: 1px solid var(--line);
  border-radius: 10px;
  backdrop-filter: blur(6px);
  font-size: 13px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
}
.remocon.collapsed {
  width: auto;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.collapsed header {
  border-bottom: none;
}
.body {
  overflow-y: auto;
  padding: 4px 12px 12px;
}
section {
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
section:last-child {
  border-bottom: none;
}
h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
h3 small {
  font-weight: 400;
  font-size: 11px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
select,
button,
input[type='number'],
textarea {
  background: #0a1020;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  font: inherit;
}
section > select {
  width: 100%;
}
button {
  cursor: pointer;
}
button:hover {
  border-color: #33456b;
}
button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
button.ghost {
  background: transparent;
  border-color: transparent;
}
button.tiny {
  padding: 2px 4px;
  font-size: 11px;
  color: var(--muted);
}
input[type='color'] {
  width: 44px;
  height: 28px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: transparent;
  padding: 0 2px;
}
.swatches {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}
.swatch.on {
  border-color: #fff;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
.check {
  display: flex;
  gap: 6px;
  align-items: center;
  margin: 6px 0;
  color: var(--muted);
}
.import textarea {
  width: 100%;
  margin-top: 8px;
  resize: vertical;
}
input.text {
  flex: 1;
  min-width: 0;
  background: #0a1020;
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
  font: inherit;
}
.hint {
  margin: -2px 0 0;
  font-size: 11px;
  color: var(--muted);
}
.warn {
  color: #ffb020;
  font-size: 12px;
  margin: 6px 0 0;
}
.sgg-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}
.sgg-list li {
  display: grid;
  grid-template-columns: 78px 1fr 62px 30px;
  gap: 6px;
  align-items: center;
  padding: 3px 4px;
  border-radius: 4px;
}
.sgg-list li.peak {
  background: rgba(255, 42, 42, 0.15);
}
.sgg-list .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sgg-list input[type='number'] {
  width: 100%;
  padding: 3px 4px;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}
</style>
