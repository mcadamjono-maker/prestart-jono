const fs = require("fs");
const http = require("http");
const path = require("path");

const port = Number(process.env.WEB_PREVIEW_PORT || 8082);
const root = path.resolve(process.env.WEB_PREVIEW_DIR || "web-build");

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

if (!fs.existsSync(path.join(root, "index.html"))) {
  console.error(`Missing web export at ${root}. Run: npm run web:build`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = safeFilePath(requestedPath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Web preview listening on http://localhost:${port}`);
});

function safeFilePath(requestedPath) {
  const relativePath = requestedPath === "/" ? "index.html" : requestedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(root, relativePath);

  if (!resolvedPath.startsWith(root)) {
    return path.join(root, "index.html");
  }

  return fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
    ? resolvedPath
    : path.join(root, "index.html");
}
