// Server kecil: sajikan folder public + proxy ke API MangaDex (hindari CORS)
// Jalankan: node server.js  (butuh Node 18+)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    try {
      const r = await fetch("https://api.mangadex.org" + req.url.slice(4), {
        headers: { "User-Agent": "MangaWebApp/1.0" },
      });
      res.writeHead(r.status, { "Content-Type": "application/json" });
      res.end(await r.text());
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }
  let file = req.url.split("?")[0];
  if (file === "/") file = "/index.html";
  const full = path.join(PUBLIC, path.normalize(file));
  if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("Jalan di http://localhost:" + PORT));
