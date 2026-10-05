import { setWorkerUrl } from 'maplibre-gl'
// MapLibre v6 ESM은 워커를 별도 파일로 띄운다. Vite 번들 후에는 기본 경로를 찾지 못하므로
// Vite가 워커(+의존 청크)를 직접 번들하게 하고 그 URL을 넘겨준다.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
