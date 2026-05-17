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
        if (ext === '.json') res.setHeader('Content-Type', 'application/json');
        if (ext === '.jpg' || ext === '.jpeg') res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        fs.createReadStream(filePath).pipe(res);
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
