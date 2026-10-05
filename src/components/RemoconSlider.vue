<template>
  <div class="slider" :class="{ disabled }">
    <div class="head">
      <label>{{ label }}</label>
      <input
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :value="model"
        :disabled="disabled"
        @change="set(($event.target as HTMLInputElement).valueAsNumber)"
      />
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="model"
      :disabled="disabled"
      @input="set(($event.target as HTMLInputElement).valueAsNumber)"
    />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  min: number
  max: number
  step: number
  disabled?: boolean
}>()
const model = defineModel<number>({ required: true })

function set(v: number) {
  if (Number.isNaN(v)) return
  model.value = Math.min(props.max, Math.max(props.min, v))
}
</script>

<style scoped>
.slider {
  margin-bottom: 8px;
}
.slider.disabled {
  opacity: 0.45;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}
label {
  color: var(--text);
}
input[type='number'] {
  width: 72px;
  background: var(--input-bg);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 3px 6px;
  font: inherit;
  text-align: right;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}
</style>
