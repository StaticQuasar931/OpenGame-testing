const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 8080;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const requestPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log("Void Dodge server running at http://localhost:" + port);
});
