import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { pathToFileURL } from 'url';
import { defineConfig } from 'vite';
import express from 'express';
import fs from 'fs';
import dotenv from 'dotenv';
const localEnvPath = path.resolve(__dirname, '.env.local');
const defaultEnvPath = path.resolve(__dirname, '.env');
dotenv.config({ path: fs.existsSync(localEnvPath) ? localEnvPath : defaultEnvPath });

const apiRoutes = {
  '/api/ai-assistant': 'api/ai-assistant.js',
  '/api/auth': 'api/auth.js',
  '/api/user': 'api/user.js',
  '/api/data': 'api/data.js',
  '/api/password-reset': 'api/password-reset.js',
  '/api/auth-google': 'api/auth-google.js',
  '/api/auth-google-config': 'api/auth-google-config.js',
  '/api/auth-google/callback': 'api/auth-google/callback.js',
};

const vercelApiPlugin = () => ({
  name: 'vercel-api',
  configureServer(server: any) {
    const app = express();
    app.use(express.json({ limit: '16kb' }));
    for (const [route, modulePath] of Object.entries(apiRoutes)) {
      app.all(route, async (req, res) => {
        try {
          const handler = await import(pathToFileURL(path.resolve(__dirname, modulePath)).href);
          await handler.default(req, res);
        } catch (err) {
          console.error(`Local API Error (${route}):`, err);
          res.status(500).json({ error: 'Local API Server Error' });
        }
      });
    }
    server.middlewares.use(app);
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), vercelApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});