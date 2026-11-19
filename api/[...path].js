// Vercel Function: proxy ke MangaDex dengan User-Agent sendiri
module.exports = async (req, res) => {
  try {
    const target = "https://api.mangadex.org" + req.url.replace(/^\/api/, "");
    const r = await fetch(target, {
      headers: { "User-Agent": "MangaWebApp/1.0 (personal project)", Accept: "application/json" },
    });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(r.status).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
};
