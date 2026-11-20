// Vercel Function: proxy ke MangaDex
// Vercel Function: proxy ke MangaDex
module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const keep = new URLSearchParams();
    for (const [k, v] of u.searchParams) if (!k.startsWith("_") && k !== "path") keep.append(k, v);
    const qs = keep.toString();
    const target = "https://api.mangadex.org" + u.pathname.replace(/^\/api/, "") + (qs ? "?" + qs : "");
    const r = await fetch(target, {
      headers: { "User-Agent": "MangaWebApp/1.0 (personal project)", Accept: "application/json" },
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
};
