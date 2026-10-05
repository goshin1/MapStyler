/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 배경 지도 타일 URL (.env.example 참고) */
  readonly VITE_BASEMAP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
