import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

const engineAssetsPlugin = () => ({
  name: 'engine-assets',
  configureServer(server: any) {
    server.middlewares.use('/api/save-hitl', (req: any, res: any, next: any) => {
      if (req.method === 'POST') {
        const url = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
        const sequence = url.searchParams.get('sequence');
        if (!sequence) {
          res.statusCode = 400;
          return res.end('Missing sequence parameter');
        }
        
        let body = '';
        req.on('data', (chunk: any) => { body += chunk.toString(); });
        req.on('end', () => {
          try {
            const hitlDataPath = path.join(process.cwd(), 'engine', 'output', sequence, 'LLM_Export_Package', `${sequence}_hitl_data.json`);
            fs.writeFileSync(hitlDataPath, body);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(err.message);
          }
        });
      } else {
        next();
      }
    });

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

    server.middlewares.use('/api/regenerate-director-cut', (req: any, res: any, next: any) => {
      if (req.method === 'POST') {
        const url = new URL(req.originalUrl || req.url, `http://${req.headers.host}`);
        const sequence = url.searchParams.get('sequence');
        if (!sequence) {
          res.statusCode = 400;
          return res.end('Missing sequence parameter');
        }
        
        const pythonExecutable = path.join(process.cwd(), 'engine', 'venv', 'bin', 'python');
        const script = `import sys; sys.path.append('engine'); import update_cut; update_cut.update_cut('${sequence}')`;
        
        exec(`${pythonExecutable} -c "${script}"`, { cwd: process.cwd() }, (error: any, stdout: any, stderr: any) => {
          if (error) {
            console.error("Director Error:", stderr || error.message);
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: stderr || error.message }));
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, output: stdout }));
        });
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
