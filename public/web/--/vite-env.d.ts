/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_ID?: string;
  readonly VITE_DATA_FOLDER_PATH?: string;
  readonly VITE_API_KEY?: string;
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

