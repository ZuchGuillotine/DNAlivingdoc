import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const attachProxyErrorHandler = (proxy: any) => {
  proxy.on("error", (_err: unknown, _req: unknown, res: any) => {
    if (res && !res.headersSent && typeof res.writeHead === 'function') {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Backend server not ready yet');
    }
  });
};

export default defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@db": path.resolve(__dirname, "db"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist", "client"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'wouter'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label'],
          'query-vendor': ['@tanstack/react-query'],
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    fs: {
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: attachProxyErrorHandler
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: attachProxyErrorHandler
      },
      '/graphql': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: attachProxyErrorHandler
      },
      '/auth/google': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: attachProxyErrorHandler
      }
    }
  }
});
