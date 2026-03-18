/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRONOTEBOOST_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
