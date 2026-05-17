import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'fs'
import path from 'path'

const engineAssetsPlugin = () => ({
  name: 'engine-assets',
  configureServer(server: any) {
    server.middlewares.use('/engine/output', (req: any, res: any, next: any) => {
      const filePath = path.join(process.cwd(), 'engine', 'output', req.url.split('?')[0]);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');

        let contentType = 'application/octet-stream';
        if (ext === '.json') contentType = 'application/json';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.mp4') contentType = 'video/mp4';

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Content-Length': chunksize,
            'Content-Type': contentType,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } else {
        next();
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), engineAssetsPlugin()],
  server: {
    port: 5175,
    strictPort: true, // Questo fa fallire l'avvio se la 5175 è occupata, evitando auto-assegnazioni silenziose
  }
})
