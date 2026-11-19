const $ = s => document.querySelector(s);
const LS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const S = { tab: "latest", type: "all", status: "all", lang: "id", q: "", offset: 0, total: 0 };
const TYPES = [["all", "Semua"], ["ja", "Manga"], ["ko", "Manhwa"], ["zh", "Manhua"]];
const STATS = [["all", "Semua Status"], ["ongoing", "Ongoing"], ["completed", "Tamat"]];
const TAG_ID = { "Action":"Aksi","Romance":"Romantis","Comedy":"Komedi","Fantasy":"Fantasi","Drama":"Drama","Slice of Life":"Kehidupan Sehari-hari","Horror":"Horor","Adventure":"Petualangan","Mystery":"Misteri","Sci-Fi":"Fiksi Ilmiah","Supernatural":"Supranatural","School Life":"Kehidupan Sekolah","Martial Arts":"Seni Bela Diri","Historical":"Sejarah","Psychological":"Psikologis","Tragedy":"Tragedi","Sports":"Olahraga","Magic":"Sihir","Reincarnation":"Reinkarnasi","Monsters":"Monster","Crime":"Kriminal","Demons":"Iblis","Survival":"Bertahan Hidup","Time Travel":"Perjalanan Waktu","Video Games":"Game","Medical":"Medis","Music":"Musik","Cooking":"Memasak","Ghosts":"Hantu","Vampires":"Vampir","Post-Apocalyptic":"Pasca-Apokaliptik","Military":"Militer","Police":"Polisi","Philosophical":"Filosofis","Animals":"Hewan","Office Workers":"Pekerja Kantor","Royalty":"Kerajaan","Villainess":"Tokoh Antagonis","Girls' Love":"Cinta Sesama Wanita","Boys' Love":"Cinta Sesama Pria","Gore":"Gore","Thriller":"Thriller","Isekai":"Isekai","Harem":"Harem" };
const TITLES = { latest: "Update Terbaru", popular: "Paling Populer", fav: "Favoritmu", hist: "Riwayat Baca" };
const STATUS_ID = { ongoing: "Ongoing", completed: "Tamat", hiatus: "Hiatus", cancelled: "Dibatalkan" };
const LIMIT = 24;

/* ---------- API (proxy Vercel -> langsung -> proxy publik) ---------- */
const BASES = [
  u => "/api/" + u,
  u => "https://api.mangadex.org/" + u,
  u => "https://corsproxy.io/?url=" + encodeURIComponent("https://api.mangadex.org/" + u),
  u => "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://api.mangadex.org/" + u),
];
let okBase = 0;
async function api(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach(x => qs.append(k, x));
  const u = path + "?" + qs; let err;
  for (let n = 0; n < BASES.length; n++) {
    const i = (okBase + n) % BASES.length;
    try {
      const r = await fetch(BASES[i](u));
      if (!r.ok) throw new Error("API " + r.status);
      const j = await r.json(); okBase = i; return j;
    } catch (e) { err = e; }
  }
  throw err;
}

/* ---------- helpers ---------- */
const title = m => m.attributes.title.en || Object.values(m.attributes.title)[0] || "Tanpa judul";
const coverUrl = (m, size = 256) => {
  const f = m.relationships.find(r => r.type === "cover_art")?.attributes?.fileName;
  return f ? `https://uploads.mangadex.org/covers/${m.id}/${f}.${size}.jpg` : "";
};
const badge = m => ({ ja: "MANGA", ko: "MANHWA", zh: "MANHUA", "zh-hk": "MANHUA" }[m.attributes.originalLanguage] || "KOMIK");
// kalau gambar gagal dimuat langsung, coba lewat wsrv.nl
window.imgErr = el => {
  if (el.dataset.f) return; el.dataset.f = 1;
  el.src = "https://wsrv.nl/?url=" + encodeURIComponent(el.src.replace(/^https?:\/\//, ""));
};
const img = (src, cls = "") => src
  ? `<img class="${cls}" loading="lazy" referrerpolicy="no-referrer" src="${src}" onerror="imgErr(this)" alt="">`
  : `<div class="noimg"></div>`;

/* ---------- filter chips ---------- */
function chips(el, list, key) {
  $(el).innerHTML = list.map(([v, l]) => `<button class="chip ${S[key] === v ? "on" : ""}" data-v="${v}">${l}</button>`).join("");
  $(el).onclick = e => { const v = e.target.dataset.v; if (!v) return; S[key] = v; renderChips(); load(true); };
}
const renderChips = () => { chips("#types", TYPES, "type"); chips("#stats", STATS, "status");  };

$("#tabs").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  S.tab = b.dataset.v; S.q = ""; $("#q").value = "";
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
  window.scrollTo({ top: 0 }); load(true);
};

/* ---------- daftar komik ---------- */
const skeleton = n => Array(n).fill('<div class="sk"></div>').join("");
async function load(reset) {
  const grid = $("#grid"); $("#more").style.display = "none";
  $("#secTitle").textContent = S.q ? `Hasil: "${S.q}"` : TITLES[S.tab];
  if (reset) { S.offset = 0; grid.innerHTML = skeleton(12); }
  const p = { limit: LIMIT, offset: S.offset, "includes[]": "cover_art", "contentRating[]": ["safe", "suggestive"], "availableTranslatedLanguage[]": S.lang };
  if (S.q) p.title = S.q;
  if (S.type === "zh") p["originalLanguage[]"] = ["zh", "zh-hk"];
  else if (S.type !== "all") p["originalLanguage[]"] = S.type;
  if (S.status !== "all") p["status[]"] = S.status;
  if (S.tab === "latest") p["order[latestUploadedChapter]"] = "desc";
  if (S.tab === "popular") p["order[followedCount]"] = "desc";
  if (S.tab === "fav" || S.tab === "hist") {
    const ids = S.tab === "fav" ? LS("fav", []) : LS("hist", []).map(h => h.id);
    if (!ids.length) { grid.innerHTML = `<div class="msg">Belum ada data di sini.</div>`; return; }
    p["ids[]"] = ids.slice(0, 100); p.limit = 100; delete p.offset; delete p["availableTranslatedLanguage[]"];
  }
  try {
    const d = await api("manga", p);
    if (reset) grid.innerHTML = "";
    if (!d.data.length && reset) grid.innerHTML = `<div class="msg">Tidak ada hasil. Coba ubah filter atau kata kunci.</div>`;
    grid.insertAdjacentHTML("beforeend", d.data.map((m, i) => `
      <div class="card" data-id="${m.id}" style="animation-delay:${i * 25}ms">
        ${img(coverUrl(m))}<span class="badge">${badge(m)}</span>
        <span class="dot ${m.attributes.status === "completed" ? "end" : ""}"></span>
        <div class="ov"><p>${esc(title(m))}</p></div></div>`).join(""));
    S.offset += d.data.length; S.total = d.total ?? d.data.length;
    if (!["fav", "hist"].includes(S.tab) && S.offset < S.total) $("#more").style.display = "block";
  } catch (e) { grid.innerHTML = `<div class="msg">Gagal memuat (${esc(e.message)}). Coba refresh.</div>`; }
}
$("#grid").onclick = e => { const c = e.target.closest(".card"); if (c) openDetail(c.dataset.id); };
$("#more").onclick = () => load(false);
$("#sf").onsubmit = e => { e.preventDefault(); S.q = $("#q").value.trim(); S.tab = "latest";
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x.dataset.v === "latest")); $("#q").blur(); load(true); };

/* ---------- detail ---------- */
let chapters = [], curManga = null, chDesc = true;
const closeBtn = `<button class="back" onclick="document.getElementById('detail').classList.remove('show')">←</button>`;
async function openDetail(id) {
  const box = $("#detail"); box.classList.add("show"); box.scrollTop = 0;
  box.innerHTML = `<div class="dwrap">${closeBtn}<div class="msg">Memuat…</div></div>`;
  try {
    const [md, feed] = await Promise.all([
      api("manga/" + id, { "includes[]": "cover_art" }),
      api(`manga/${id}/feed`, { "translatedLanguage[]": S.lang, "order[chapter]": "desc", limit: 500, includeExternalUrl: 0, "contentRating[]": ["safe", "suggestive"] }),
    ]);
    const m = md.data; curManga = m; const seen = new Set();
    chapters = feed.data.filter(c => c.attributes.pages > 0 && !seen.has(c.attributes.chapter) && seen.add(c.attributes.chapter));
    const isFav = LS("fav", []).includes(id);
    const desc = m.attributes.description.id || m.attributes.description.en || Object.values(m.attributes.description)[0] || "Belum ada deskripsi.";
    const tags = m.attributes.tags.slice(0, 6).map(t => `<span>${esc(TAG_ID[t.attributes.name.en] || t.attributes.name.en)}</span>`).join("");
    box.innerHTML = `<div class="bd" style="background-image:url(${coverUrl(m, 256)})"></div>
      <div class="dwrap">${closeBtn}
        <div class="det">${img(coverUrl(m, 512))}
          <div><h2>${esc(title(m))}</h2>
          <div class="meta">${badge(m)} · ${STATUS_ID[m.attributes.status] || ""} · ${chapters.length} chapter</div>
          <div class="tags">${tags}</div>
          <button class="favbtn ${isFav ? "on" : ""}" id="favBtn">${isFav ? "♥ Favorit" : "♡ Tambah favorit"}</button></div></div>
        <div class="desc" id="desc">${esc(desc)}</div>
        <button class="lnk" id="more2">Selengkapnya</button>
        <div class="chhead"><h3>Chapter</h3><button class="chip" id="sortBtn">Terbaru ↓</button></div>
        <div id="chlist"></div></div>`;
    $("#more2").onclick = () => { const o = $("#desc").classList.toggle("open"); $("#more2").textContent = o ? "Tutup" : "Selengkapnya"; };
    $("#favBtn").onclick = () => { let f = LS("fav", []); f = f.includes(id) ? f.filter(x => x !== id) : [id, ...f]; save("fav", f); openDetail(id); };
    $("#sortBtn").onclick = () => { chDesc = !chDesc; $("#sortBtn").textContent = chDesc ? "Terbaru ↓" : "Terlama ↑"; renderChapters(); };
    renderChapters();
  } catch (e) { box.innerHTML = `<div class="dwrap">${closeBtn}<div class="msg">Gagal: ${esc(e.message)}</div></div>`; }
}
function renderChapters() {
  const read = LS("read", {});
  const list = chapters.map((c, i) => [c, i]); if (!chDesc) list.reverse();
  $("#chlist").innerHTML = list.length ? list.map(([c, i]) => `<div class="ch ${read[c.id] ? "read" : ""}" data-i="${i}">
      <span>Ch. ${esc(c.attributes.chapter ?? "?")}${c.attributes.title ? " – " + esc(c.attributes.title) : ""}</span>
      <small>${new Date(c.attributes.publishAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</small></div>`).join("")
    : `<div class="msg">Belum ada chapter bahasa Indonesia.</div>`;
  $("#chlist").onclick = e => { const c = e.target.closest(".ch"); if (c) openChapter(+c.dataset.i); };
}

/* ---------- reader ---------- */
async function openChapter(i) {
  const c = chapters[i]; if (!c) return;
  const rd = $("#reader"); rd.classList.add("show"); rd.scrollTop = 0; $("#prog").style.width = "0";
  $("#rnav").classList.remove("hide");
  $("#rnav").innerHTML = `<button class="back" id="rb">✕</button><div class="ttl">${esc(title(curManga))} · Ch. ${esc(c.attributes.chapter ?? "?")}</div>
    <button class="s" id="np" ${i >= chapters.length - 1 ? "disabled" : ""}>‹</button><button class="s" id="nn" ${i <= 0 ? "disabled" : ""}>›</button>`;
  $("#rb").onclick = () => { rd.classList.remove("show"); $("#pages").innerHTML = ""; renderChapters(); };
  $("#np").onclick = () => openChapter(i + 1); $("#nn").onclick = () => openChapter(i - 1);
  $("#pages").innerHTML = `<div class="msg" style="color:#888">Memuat halaman…</div>`;
  const read = LS("read", {}); read[c.id] = 1; save("read", read);
  let h = LS("hist", []).filter(x => x.id !== curManga.id); h.unshift({ id: curManga.id }); save("hist", h.slice(0, 100));
  try {
    const d = await api("at-home/server/" + c.id);
    $("#pages").innerHTML = d.chapter.data.map(f =>
      `<img loading="lazy" referrerpolicy="no-referrer" src="${d.baseUrl}/data/${d.chapter.hash}/${f}" alt="">`).join("")
      + `<div class="endnav"><button id="ep" ${i >= chapters.length - 1 ? "disabled" : ""}>‹ Sebelumnya</button><button class="p" id="en" ${i <= 0 ? "disabled" : ""}>Berikutnya ›</button></div>`;
    $("#ep").onclick = () => openChapter(i + 1); $("#en").onclick = () => openChapter(i - 1);
  } catch (e) { $("#pages").innerHTML = `<div class="msg">Gagal memuat: ${esc(e.message)}</div>`; }
}
let lastY = 0;
$("#reader").addEventListener("scroll", e => {
  const el = e.target, y = el.scrollTop, max = el.scrollHeight - el.clientHeight;
  $("#prog").style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
  $("#rnav").classList.toggle("hide", y > lastY && y > 120); lastY = y;
});

renderChips(); load(true);
