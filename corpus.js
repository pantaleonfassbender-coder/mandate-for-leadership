/* corpus.js — the local full-text layer.

   This site ships no running text of the document. It is under copyright
   (© 2023 The Heritage Foundation, all rights reserved) and free to download is
   not the same as free to redistribute. What is shipped is derived: structure,
   the recommendation register, page anchors, counts.

   Full-text search works on a copy the reader fetches themselves. pdf.js reads
   it in the browser, the text is kept in IndexedDB on the reader's own device,
   and nothing is uploaded. */

const DB = "mandate-for-leadership", STORE = "text";
export const EXPECTED_PAGES = 922;
/* Verified against every one of the 864 pages that carry a running head:
   printed page = PDF page − 32, without exception. */
export const OFFSET = 32;

export const corpus = {
  pages: null, meta: null, chapters: null,
  _inv: null, _chunks: [], _bm25: null,
};

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (mode, fn) => idb().then(db => new Promise((res, rej) => {
  const st = db.transaction(STORE, mode).objectStore(STORE);
  const rq = fn(st);
  rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
}));
const dbGet = k => tx("readonly", s => s.get(k)).catch(() => null);
const dbPut = (k, v) => tx("readwrite", s => s.put(v, k));
const dbDel = k => tx("readwrite", s => s.delete(k));

export function normalize(s) {
  return s.replace(/ﬀ/g, "ff").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/­/g, "").replace(/ /g, " ").normalize("NFC");
}
const STOP = new Set(("the a an and or but of to in on at by for with from as is are was were be " +
  "been being it its this that these those he she they we you your his her their our not no so " +
  "such then than there here which who what when where while if because will would can could may " +
  "do does did have has had more most much many other same very just only even all any both each").split(" "));
export const tokens = s => (s.toLowerCase().match(/[a-z][a-z0-9'\-]{1,}/g) || []);

export async function readPdf(file, onProgress) {
  const pdfjs = await import("./vendor/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const n = doc.numPages, out = new Array(n);
  for (let i = 1; i <= n; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let last = null, s = "";
    for (const it of tc.items) {
      if (last !== null && Math.abs(it.transform[5] - last) > 2) s += "\n";
      s += it.str;
      if (it.hasEOL) s += "\n";
      last = it.transform[5];
    }
    out[i - 1] = normalize(s).replace(/([A-Za-z])-\n([a-z])/g, "$1$2").replace(/[ \t]+/g, " ");
    if (onProgress && (i % 8 === 0 || i === n)) onProgress(i, n);
    if (i % 40 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return out;
}

export async function install(pages, filename) {
  const meta = { n: pages.length, quelle: filename, geladen: new Date().toISOString(),
                 seitenOk: pages.length === EXPECTED_PAGES };
  corpus.pages = pages; corpus.meta = meta;
  await dbPut("pages", pages); await dbPut("meta", meta);
  reindex();
  return meta;
}
export async function forget() {
  await dbDel("pages"); await dbDel("meta");
  corpus.pages = null; corpus.meta = null;
  corpus._inv = null; corpus._chunks = []; corpus._bm25 = null;
}
export async function restore(chapters) {
  corpus.chapters = chapters;
  const pages = await dbGet("pages"), meta = await dbGet("meta");
  if (pages && meta) { corpus.pages = pages; corpus.meta = meta; reindex(); return true; }
  return false;
}
export const isOpen = () => !!corpus.pages;

/** Citation: the document is cited by printed page, which the running heads fix. */
export function citeFor(pdfIndex) {
  const seite = pdfIndex + 1 - OFFSET;
  if (seite < 1) return null;
  const c = (corpus.chapters || []).find(x => x.pdf_start <= pdfIndex && pdfIndex <= x.pdf_end);
  return { seite, kapitel: c ? c.nr : null, kapitel_titel: c ? c.titel : "",
           label: c ? `ch. ${c.nr}, p. ${seite}` : `p. ${seite}` };
}

export function reindex() {
  corpus._inv = new Map(); corpus._chunks = [];
  if (!corpus.pages) return;
  corpus.pages.forEach((txt, p) => {
    if (!txt) return;
    for (const t of new Set(tokens(txt))) {
      if (t.length < 3) continue;
      let a = corpus._inv.get(t); if (!a) corpus._inv.set(t, (a = []));
      a.push(p);
    }
    const clean = txt.replace(/\s+/g, " ").trim();
    if (clean.length < 140) return;
    let cur = "";
    for (const s of clean.split(/(?<=[.!?])\s+/)) {
      if ((cur + " " + s).length > 1000 && cur.length > 260) {
        corpus._chunks.push({ page: p, text: cur.trim() }); cur = s;
      } else cur += " " + s;
    }
    if (cur.trim().length > 160) corpus._chunks.push({ page: p, text: cur.trim() });
  });
  buildBm25();
}
function buildBm25() {
  const df = new Map(); let total = 0;
  const docs = corpus._chunks.map(c => {
    const tf = new Map();
    const tk = tokens(c.text).filter(t => t.length > 2 && !STOP.has(t));
    for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    total += tk.length;
    return { tf, len: tk.length };
  });
  corpus._bm25 = { df, docs, avg: total / Math.max(1, docs.length), N: docs.length };
}

function pagesWith(terms) {
  let cand = null;
  for (const t of terms) {
    const s = new Set(corpus._inv.get(t) || []);
    cand = cand === null ? s : new Set([...cand].filter(x => s.has(x)));
    if (!cand.size) break;
  }
  return [...(cand || [])].sort((a, b) => a - b);
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function kwic(q, { win = 58, limit = 300 } = {}) {
  if (!isOpen()) return [];
  const terms = tokens(q).filter(t => t.length > 2);
  if (!terms.length) return [];
  const rx = new RegExp("(" + q.trim().split(/\s+/).map(esc).join("\\s+") + ")", "gi");
  const out = [];
  for (const p of pagesWith(terms)) {
    const txt = corpus.pages[p].replace(/\s+/g, " ");
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(txt))) {
      out.push({ l: txt.slice(Math.max(0, m.index - win), m.index), k: m[0],
                 r: txt.slice(m.index + m[0].length, m.index + m[0].length + win),
                 page: p, cite: citeFor(p) });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function hitCounts(q) {
  const res = {};
  if (!isOpen()) return res;
  const terms = tokens(q).filter(t => t.length > 2);
  const rx = new RegExp(q.trim().split(/\s+/).map(esc).join("\\s+"), "gi");
  for (const p of pagesWith(terms)) {
    const c = citeFor(p);
    if (!c || c.kapitel == null) continue;
    res[c.kapitel] = (res[c.kapitel] || 0) + (corpus.pages[p].replace(/\s+/g, " ").match(rx) || []).length;
  }
  return res;
}
