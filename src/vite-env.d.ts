/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full API base URL in production, e.g. https://api.example.org/api/v1. Defaults to /api/v1 (dev proxy). */
  readonly VITE_API_URL?: string;
}
