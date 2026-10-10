import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'wear-birgunj-embedded-api',
      configureServer(server) {
        let appPromise: Promise<any> | null = null;
        server.middlewares.use(async (req, res, next) => {
          if (!req.url || !req.url.startsWith('/api/v1')) {
            return next();
          }
          try {
            if (!appPromise) {
              const { createWearBirgunjApp } = await import('./apps/api/src/main.js');
              appPromise = createWearBirgunjApp({ seed: true });
            }
            const app = await appPromise;

            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', async () => {
              const rawBody = Buffer.concat(chunks).toString('utf8');
              const injectRes = await app.inject({
                method: (req.method || 'GET') as any,
                url: req.url!,
                headers: req.headers as any,
                payload: rawBody ? rawBody : undefined,
              });

              res.statusCode = injectRes.statusCode;
              for (const [k, v] of Object.entries(injectRes.headers)) {
                if (v !== undefined) {
                  res.setHeader(k, v as any);
                }
              }
              res.end(injectRes.body);
            });
          } catch (err) {
            console.error('[Vite API Middleware Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'API bridge error',
                },
              }),
            );
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@api': path.resolve(process.cwd(), 'apps/api/src'),
      '@web': path.resolve(process.cwd(), 'apps/web/src'),
    },
  },
  server: {
    port: 5173,
  },
});
