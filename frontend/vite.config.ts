import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the SPA and proxies backend routes to uvicorn (default :8000).
// Prod: `npm run build` output is served by FastAPI itself (one origin, cookies simple).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/auth": "http://localhost:8000",
      "/m": "http://localhost:8000",
    },
  },
  build: {
    outDir: "dist",
  },
});
