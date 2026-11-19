// Vercel Function: proxy ke MangaDex (tanpa route dinamis, jadi tidak ada parameter tambahan dari Vercel)
module.exports = async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const p = u.searchParams.get("__p") || "";
    if (!/^[\w\-\/]+$/.test(p)) return res.status(400).json({ error: "path tidak valid" });
    u.searchParams.delete("__p");
    const r = await fetch("https://api.mangadex.org/" + p + u.search, {
      headers: { "User-Agent": "MangaWebApp/1.0 (personal project)", Accept: "application/json" },
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
};
