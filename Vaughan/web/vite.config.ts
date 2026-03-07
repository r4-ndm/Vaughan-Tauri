/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    // Polyfill Node.js globals & modules required by @railgun-community SDK
    // (ffjavascript -> assert -> util chain needs process, Buffer, etc.)
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'crypto', 'assert', 'events', 'string_decoder', 'path', 'os', 'url', 'http', 'https'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],

  // Treat .wasm files as assets so Vite serves them with correct MIME type
  assetsInclude: ['**/*.wasm'],

  // Apply the same polyfills inside WebWorker contexts (Shadow Engine)
  worker: {
    format: 'es' as const,
    plugins: () => [
      wasm(),
      topLevelAwait(),
    ],
  },

  // Exclude WASM-dependent packages from dependency optimization
  // so Vite doesn't pre-bundle them (which breaks sibling .wasm file resolution)
  optimizeDeps: {
    exclude: [
      '@railgun-community/poseidon-hash-wasm',
      '@railgun-community/curve25519-scalarmult-wasm',
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    proxy: {
      '/rpc/eth': {
        target: 'https://cloudflare-eth.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/eth/, ''),
      },
      '/rpc/eth2': {
        target: 'https://rpc.ankr.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/eth2/, '/eth'),
      },
      '/rpc/polygon': {
        target: 'https://rpc.ankr.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/polygon/, '/polygon'),
      },
      '/rpc/polygon2': {
        target: 'https://polygon.llamarpc.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/polygon2/, ''),
      },
      '/rpc/bsc': {
        target: 'https://rpc.ankr.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/bsc/, '/bsc'),
      },
      '/rpc/bsc2': {
        target: 'https://bsc.publicnode.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/bsc2/, ''),
      },
      '/rpc/arb': {
        target: 'https://rpc.ankr.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/arb/, '/arbitrum'),
      },
      '/rpc/arb2': {
        target: 'https://arbitrum.llamarpc.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/arb2/, ''),
      },
      '/rpc/pulse': {
        target: 'https://rpc.pulsechain.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/pulse/, ''),
      },
      '/rpc/pulse2': {
        target: 'https://pulsechain-rpc.publicnode.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/pulse2/, ''),
      },
      '/rpc/pulse-test': {
        target: 'https://rpc.v4.testnet.pulsechain.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/pulse-test/, ''),
      },
      '/rpc/pulse-test2': {
        target: 'https://pulsechain-testnet-rpc.publicnode.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/rpc\/pulse-test2/, ''),
      },
    },
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    ignored: ["**/src-tauri/**"],
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
  },
}));

