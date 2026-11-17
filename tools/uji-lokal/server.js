// Server statis mini untuk uji lokal (tanpa dependensi).
// Jalankan: node tools/uji-lokal/server.js  -> http://localhost:8123
var http = require('http');
var fs = require('fs');
var path = require('path');
var root = path.resolve(__dirname, '..', '..');
var tipe = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.pdf': 'application/pdf', '.webp': 'image/webp'
};
http.createServer(function (req, res) {
  var url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  var file = path.join(root, path.normalize(url).replace(/^([.][.][\\/])+/, ''));
  if (file.indexOf(root) !== 0) {
    res.writeHead(403);
    return res.end('forbidden');
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': tipe[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8123, function () {
  console.log('Server uji di http://localhost:8123');
});
