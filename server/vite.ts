/**
    * @description      : Vite development server setup (development only)
    * @author           : 
    * @group            : 
    * @created          : 13/06/2025 - 14:03:08
    * 
    * MODIFICATION LOG
    * - Version         : 1.0.0
    * - Date            : 13/06/2025
    * - Author          : 
    * - Modification    : 
**/
import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Only run in development - vite should be external in production builds
  if (process.env.NODE_ENV === 'production') {
    throw new Error('setupVite should never be called in production');
  }

  const { createServer: createViteServer, createLogger } = await import('vite');
  const viteLogger = createLogger();
  
  // Dynamic import of vite config to avoid bundling
  const { default: viteConfig } = await import('../vite.config.js');
  
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      allowedHosts: [".replit.dev"], 
      hmr: { server },
    },
    appType: "custom",
  });

  // Serve static files from the public directory
  app.use(express.static(path.resolve(vite.config.root, 'public')));

  app.use(vite.middlewares);

  // Fallback to client-side routing
  app.use("*", async (req, res, next) => {
    // Let API routes pass through
    if (req.originalUrl.startsWith('/api') || 
        req.originalUrl.startsWith('/auth') ||
        req.originalUrl.startsWith('/health')) {
      return next();
    }
    
    const url = req.originalUrl;

    try {
      // Always read from disk to get fresh content during development
      let template = fs.readFileSync(
        path.resolve(vite.config.root, 'index.html'),
        'utf-8'
      );
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (error) {
      console.error('Vite SSR error:', error);
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });

  console.log("Vite middleware configured successfully");
}

export function serveStatic(app: express.Express) {
  // This is only used in development fallback scenarios
  if (process.env.NODE_ENV === 'production') {
    throw new Error('serveStatic should never be called in production');
  }
  
  const clientPath = path.join(__dirname, "..", "client");
  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));
  }
}