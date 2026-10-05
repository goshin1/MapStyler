import type { AnimationConfig } from '../types'

/** 한 시군구의 현재 표시 상태 */
export interface Frame {
  /** 표시 값(0~100) */
  v: number
  /** 100% 연출 진행도(0~1). 0보다 크면 100% 상태 */
  peak: number
}

export type Frames = Record<string, Frame>

interface Track {
  from: number
  to: number
  /** 애니메이션 시작 지연(ms) */
  delay: number
  /** 목표가 100%인가 */
  toPeak: boolean
  /** 시작 시점의 peak 진행도 (이미 100%였던 경우 유지) */
  fromPeak: number
}

export const DEFAULT_ANIMATION: AnimationConfig = {
  duration: 1800,
  stagger: 90,
  peakDuration: 700,
  order: 'ascending',
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

/**
 * 시군구별 값을 from → to 로 차오르게 하는 rAF 애니메이터.
 * 100% 목표는 값이 100에 닿은 뒤 peak 진행도(0→1)를 따로 올려서 "한 번 더 솟는" 연출을 만든다.
 */
export function createAnimator(onFrame: (frames: Frames) => void) {
  let frames: Frames = {}
  let raf = 0

  function stop() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  /** 즉시 적용 (애니메이션 없음) */
  function set(targets: Record<string, number | undefined>, isPeak: (v: number) => boolean) {
    stop()
    frames = {}
    for (const [key, v] of Object.entries(targets)) {
      frames[key] = { v: v ?? 0, peak: v !== undefined && isPeak(v) ? 1 : 0 }
    }
    onFrame(frames)
  }

  /**
   * 현재 표시 상태에서 목표 값까지 애니메이션.
   * @param fromZero true면 모든 시군구를 0에서 다시 시작 (재생 버튼)
   */
  function animateTo(
    targets: Record<string, number | undefined>,
    cfg: AnimationConfig,
    isPeak: (v: number) => boolean,
    fromZero = false,
  ): Promise<void> {
    stop()
    const keys = Object.keys(targets)
    const order = sortKeys(keys, targets, cfg.order)
    const tracks: Record<string, Track> = {}
    order.forEach((key, i) => {
      const cur = fromZero ? undefined : frames[key]
      const to = targets[key] ?? 0
      const toPeak = targets[key] !== undefined && isPeak(to)
      tracks[key] = {
        from: cur?.v ?? 0,
        to: Math.min(100, to),
        delay: cfg.order === 'together' ? 0 : i * cfg.stagger,
        toPeak,
        fromPeak: toPeak ? (cur?.peak ?? 0) : 0,
      }
    })

    const total =
      Math.max(0, ...Object.values(tracks).map((t) => t.delay)) + cfg.duration + cfg.peakDuration

    return new Promise((resolve) => {
      const start = performance.now()
      const tick = (now: number) => {
        const elapsed = now - start
        const next: Frames = {}
        for (const [key, t] of Object.entries(tracks)) {
          const local = elapsed - t.delay
          const p = Math.min(1, Math.max(0, local / cfg.duration))
          const v = t.from + (t.to - t.from) * easeOutCubic(p)
          let peak = 0
          if (t.toPeak) {
            if (t.fromPeak >= 1) peak = 1
            else if (p >= 1) peak = Math.min(1, (local - cfg.duration) / Math.max(1, cfg.peakDuration))
          }
          next[key] = { v, peak }
        }
        frames = next
        onFrame(frames)
        if (elapsed < total) raf = requestAnimationFrame(tick)
        else {
          raf = 0
          resolve()
        }
      }
      raf = requestAnimationFrame(tick)
    })
  }

  return { set, animateTo, stop, get frames() { return frames } }
}

function sortKeys(
  keys: string[],
  targets: Record<string, number | undefined>,
  order: AnimationConfig['order'],
): string[] {
  if (order === 'ascending') return [...keys].sort((a, b) => (targets[a] ?? 0) - (targets[b] ?? 0))
  if (order === 'random') {
    const arr = [...keys]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }
  return keys
}

/** 100% 연출용: 살짝 넘쳤다가 자리잡는 easing */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
