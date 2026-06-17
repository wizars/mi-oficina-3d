// Servidor web local mínimo (solo Node, sin instalar nada).
// Sirve esta carpeta en http://localhost:8123
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// Sirve un fichero, resolviendo "carpeta/" -> "carpeta/index.html"
// (igual que GitHub Pages, para que las URLs limpias funcionen en local).
function serve(filePath, urlPath, res) {
  fs.stat(filePath, (err, stat) => {
    if (err) { res.writeHead(404); return res.end('No encontrado: ' + urlPath); }
    if (stat.isDirectory()) {
      return serve(path.join(filePath, 'index.html'), urlPath, res);
    }
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { res.writeHead(404); return res.end('No encontrado: ' + urlPath); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  serve(filePath, urlPath, res);
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('  Claude Arcade  ->  http://localhost:' + PORT);
  console.log('  Abre esa direccion en Chrome (o usa start.bat).');
  console.log('  Para PARAR el servidor: cierra esta ventana.');
  console.log('====================================================');
});
