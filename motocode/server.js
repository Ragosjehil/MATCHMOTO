const http = require('http');
const fs = require('fs');
const path = require('path');
const chatHandler = require('./api/chat');
const firebaseConfigHandler = require('./api/firebase-config');

const root = __dirname;
const port = process.env.PORT || 3000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        const cleanBody = body.replace(/^\uFEFF/, '').trim();
        resolve(cleanBody ? JSON.parse(cleanBody) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(data) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    }
  };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/firebase-config') {
    await firebaseConfigHandler(req, createResponse(res));
    return;
  }

  if (req.url === '/api/chat') {
    try {
      req.body = await readBody(req);
      await chatHandler(req, createResponse(res));
    } catch (error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: error.message || 'Bad request.' }));
    }
    return;
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const fileName = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, fileName);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', types[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`MotoMatch running at http://localhost:${port}`);
});
