/* app.js — router, data and views. */
import * as C from "./corpus.js";
import { corpus } from "./corpus.js";

export const D = {};
const view = document.getElementById("view");

export const esc = s => String(s ?? "").replace(/[&<>"']/g, m =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
export const nf = n => new Intl.NumberFormat("en-GB").format(n);
const el = h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstElementChild; };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const datum = s => s ? new Date(s).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }) : "—";

const HUE = ["#c9a227", "#9db8a4", "#c07a5a", "#a89bc4", "#7fa9c9", "#c9968f", "#8fb3a0", "#b9a06a", "#a0b6c9"];
const feldColor = i => HUE[i % HUE.length];
const feldOf = id => (D.schema.felder || []).find(f => f.id === id);
const initOf = id => (D.initiatives || []).find(i => i.id === id);
const kapOf = nr => (D.structure.chapters || []).find(c => c.nr === nr);

async function boot() {
  const names = ["schema", "structure", "initiatives", "tracker", "recommendations"];
  const res = await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  names.forEach((n, i) => D[n] = res[i]);
  try { await C.restore(D.structure.chapters); } catch (e) { console.warn("restore failed", e); }
  refreshBadge();
  window.addEventListener("hashchange", route);
  route();
}

const ROUTES = {
  overview: viewOverview, tracker: viewTracker, initiatives: viewInitiatives,
  structure: viewStructure, register: viewRegister, concordance: viewConcordance,
  method: viewMethod, privacy: viewPrivacy, imprint: viewImprint,
};
function route() {
  const h = (location.hash || "#/overview").slice(2).split("/");
  const name = (h[0] || "overview").split("?")[0];
  document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.v === name));
  view.innerHTML = ""; window.scrollTo(0, 0);
  (ROUTES[name] || viewOverview)(h.slice(1));
}

/* ------------------------------------------------------------- pieces */
function stand(id) {
  return (D.tracker.initiativen || {})[id] || { stufen: {}, prozent: 0, berichtet: [] };
}
function balken(pct, { h = 8 } = {}) {
  return `<div class="pbar" style="--h:${h}px" role="img" aria-label="${pct} per cent">
    <i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}
function stufenReihe(id) {
  const s = stand(id);
  return `<div class="stufen">${D.schema.stufen.map(st => {
    const v = s.stufen[st.id] || {};
    const cls = v.rueckgaengig ? "rev" : (v.belegt ? "on" : "off");
    const t = v.rueckgaengig ? "reversed" : (v.belegt ? "documented" : "not documented");
    return `<span class="st ${cls}" title="${esc(st.titel)} — ${t}">${st.gewicht}</span>`;
  }).join("")}</div>`;
}
function quelleChip(v) {
  if (!v || !v.quelle) return "";
  let host = v.quelle;
  try { host = new URL(v.quelle).hostname.replace(/^www\./, ""); } catch (e) {}
  return `<a class="chip sm" href="${esc(v.quelle)}" target="_blank" rel="noopener">${esc(host)}</a>`;
}

/* ============================================================ OVERVIEW */
function viewOverview() {
  const t = D.tracker, inits = D.initiatives;
  const werte = inits.map(i => stand(i.id).prozent);
  const mittel = werte.length ? werte.reduce((a, b) => a + b, 0) / werte.length : 0;
  const ohne = werte.filter(v => v === 0).length;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Documentation</span>
      <h1>Mandate for Leadership</h1>
      <p class="lede">The 2023 volume edited by Paul Dans and Steven Groves for The Heritage Foundation,
      published as part of the Project 2025 Presidential Transition Project. 887 printed pages, five
      sections, 30 policy chapters, each with named authors. This site documents what it contains and
      tracks, week by week, how far its proposals correspond to actions on the public record.</p></div>

    <div class="statebox warn" style="margin-bottom:1.4rem">
      <strong>Read this before the numbers.</strong> Correspondence is not causation: a government action
      matching a proposal is not evidence that this document produced it, and many of these proposals have
      long-standing advocates elsewhere. The tracker measures correspondence with this text only — it is
      not a scorecard of the administration, which does much that this document never mentions. Nothing
      here evaluates whether any proposal or any action is desirable.
    </div>

    <div class="grid g4" style="margin-bottom:1.6rem">
      <div class="kpi"><b>30</b><span>policy chapters</span></div>
      <div class="kpi"><b>${nf(D.recommendations.length)}</b><span>recommendations indexed</span></div>
      <div class="kpi"><b>${inits.length}</b><span>initiatives tracked</span></div>
      <div class="kpi"><b>${mittel.toFixed(0)}%</b><span>mean stage score</span></div>
      <div class="kpi"><b>${ohne}</b><span>with nothing documented</span></div>
      <div class="kpi"><b>${t.laeufe}</b><span>weekly runs</span></div>
    </div>

    <div class="grid g2" style="margin-bottom:2rem">
      <div class="card">
        <span class="tag">The new part</span>
        <h3>An implementation tracker with a fixed ladder</h3>
        <p style="font-size:.92rem;color:var(--fg2)">Sixty initiatives, each scored not by judgement but by
        which of six publicly documented stages can be evidenced — authority, stated intent, formal process,
        adoption, force, durability. A stage counts only with a primary source. Press reporting is shown
        separately and scores nothing.</p>
        <p><a class="btn" href="#/tracker">Open the tracker →</a></p>
      </div>
      <div class="card">
        <span class="tag">The documentation</span>
        <h3>What the volume actually says</h3>
        <p style="font-size:.92rem;color:var(--fg2)">All ${nf(D.recommendations.length)} bulleted
        recommendations with chapter and page, the structure of all 32 chapters with their authors, and a
        concordance that runs against your own copy. No paraphrase, no summary of somebody else's summary.</p>
        <p><a class="btn" href="#/register">The recommendation register →</a></p>
      </div>
    </div>

    <div class="panel"><h2>Two things worth knowing about the document itself</h2>
      <p class="readable"><strong>It disagrees with itself in two places.</strong> Chapter 23 carries both
      “The Export–Import Bank Should Be Abolished” (de Rugy, p. 717) and “The Case for the Export–Import
      Bank” (Hazelton, p. 724). Chapter 26 carries both “The Case for Fair Trade” (Navarro, p. 765) and
      “The Case for Free Trade” (Lassman, p. 796). The volume prints the disagreement rather than resolving
      it, and both sides are tracked here as separate initiatives.</p>
      <p class="readable"><strong>Its own framing is four “promises”,</strong> set out in the foreword at
      pages 3 to 13. Where an initiative maps onto one of them, that mapping is shown — it is the
      document's own organising idea, not a category invented here.</p>
    </div>

    <div class="chartbox" style="margin-top:1.4rem">
      <span class="tag">Stage score by field, mean of its initiatives</span>
      <div id="feldbars"></div>
      <p class="fine">Baseline taken ${datum(t.baseline)}. Every score starts at zero on that date and moves
      only when a stage is evidenced.</p>
    </div>
  </div>`));

  const box = view.querySelector("#feldbars");
  D.schema.felder.forEach((f, i) => {
    const xs = D.initiatives.filter(x => x.feld === f.id).map(x => stand(x.id).prozent);
    const m = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    box.append(el(`<div class="feldrow">
      <a href="#/initiatives?feld=${f.id}">${esc(f.titel)}</a>
      <span class="fine">${xs.length} initiatives</span>
      <div class="pbar" style="--h:8px"><i style="width:${m}%;background:${feldColor(i)}"></i></div>
      <b>${m.toFixed(0)}%</b></div>`));
  });
}

/* ============================================================= TRACKER */
function viewTracker() {
  const t = D.tracker;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Tracker</span>
      <h1>Implementation, stage by stage</h1>
      <p class="lede">Last run ${datum(t.stand)} · ${t.laeufe} weekly ${t.laeufe === 1 ? "run" : "runs"}
      since the baseline of ${datum(t.baseline)}.</p>
      ${(t.nie_geprueft || []).length ? `<div class="statebox warn">A run checks as many initiatives as it can
      within a fixed time budget and then stops, so the baseline fills in over several runs.
      <strong>${(t.nie_geprueft || []).length} of ${D.initiatives.length} initiatives have not been
      checked even once</strong> and are shown at zero for that reason, not because nothing has
      happened. They are first in line on the next run.</div>` : ""}</div>

    <div class="panel"><h2>How the percentage is produced</h2>
      <p class="readable">It is not an estimate. Each initiative has the same six stages, each worth a fixed
      number of points; the score is the sum of the stages that can be evidenced. A stage counts
      <strong>only</strong> with a primary source — the Federal Register, Congress.gov, a court docket, an
      agency's own publication. Reporting in the press is recorded against the initiative and marked as
      such, and contributes nothing to the score.</p>
      <table class="tbl"><thead><tr><th>Stage</th><th class="num">Points</th><th>What counts as evidence</th></tr></thead>
      <tbody>${D.schema.stufen.map(s => `<tr><td>${esc(s.titel)}</td>
        <td class="num">${s.gewicht}</td><td class="fine">${esc(s.beleg)}</td></tr>`).join("")}</tbody></table>
      <p class="readable">A stage can also be marked <em>reversed</em> — enjoined, vacated, rescinded or
      superseded. Its points are removed, and the stage stays visible so that the reversal is part of the
      record rather than a silent subtraction.</p>
    </div>

    <div class="toolbar">
      <input type="search" id="q" placeholder="Filter initiatives…" autocomplete="off">
      <select id="feld"><option value="">All fields</option>
        ${D.schema.felder.map(f => `<option value="${f.id}">${esc(f.titel)}</option>`).join("")}</select>
      <select id="sort"><option value="pct">Highest score first</option>
        <option value="pct-asc">Lowest score first</option>
        <option value="feld">By field</option></select>
    </div>
    <div id="list"></div>
  </div>`));

  const q = view.querySelector("#q"), fs = view.querySelector("#feld"), so = view.querySelector("#sort");
  const list = view.querySelector("#list");
  const draw = () => {
    const term = q.value.trim().toLowerCase(), feld = fs.value;
    let rows = D.initiatives.filter(i =>
      (!term || i.titel.toLowerCase().includes(term)) && (!feld || i.feld === feld));
    if (so.value === "pct") rows.sort((a, b) => stand(b.id).prozent - stand(a.id).prozent);
    else if (so.value === "pct-asc") rows.sort((a, b) => stand(a.id).prozent - stand(b.id).prozent);
    else rows.sort((a, b) => a.feld.localeCompare(b.feld) || a.titel.localeCompare(b.titel));
    list.innerHTML = rows.map(i => {
      const s = stand(i.id);
      const f = feldOf(i.feld);
      return `<div class="trow">
        <div class="th">
          <a class="tw" href="#/initiatives/${i.id}">${esc(i.titel)}</a>
          <span class="pct">${s.prozent}%</span>
        </div>
        <div class="fine">${esc(f ? f.titel : "")} · ch. ${i.kapitel}, p. ${i.seite}
          ${s.zuletzt_geprueft ? `· checked ${datum(s.zuletzt_geprueft)}` : "· not yet checked"}</div>
        ${balken(s.prozent)}
        ${stufenReihe(i.id)}
      </div>`;
    }).join("") || `<p class="fine">Nothing matches.</p>`;
  };
  q.oninput = debounce(draw, 120); fs.onchange = draw; so.onchange = draw; draw();
}

/* ========================================================= INITIATIVES */
function viewInitiatives(args) {
  if (args && args[0]) return viewInitiative(args[0]);
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("feld") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Initiatives</span>
      <h1>The ${D.initiatives.length} tracked initiatives</h1>
      <p class="lede">Selected from the ${nf(D.recommendations.length)} recommendations by a stated rule:
      falsifiable as written, prominent in the document, and anchored to a printed page. Everything else
      stays in the <a href="#/register">register</a> and is not tracked. The list is versioned — adding or
      removing an initiative is itself a logged change.</p></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Filter…" autocomplete="off">
      <select id="feld"><option value="">All fields</option>
        ${D.schema.felder.map(f => `<option value="${f.id}"${f.id === pre ? " selected" : ""}>${esc(f.titel)}</option>`).join("")}</select>
    </div>
    <div id="list"></div>
  </div>`));
  const q = view.querySelector("#q"), fs = view.querySelector("#feld"), list = view.querySelector("#list");
  const draw = () => {
    const term = q.value.trim().toLowerCase(), feld = fs.value;
    const rows = D.initiatives.filter(i =>
      (!term || (i.titel + " " + i.grundlage).toLowerCase().includes(term)) && (!feld || i.feld === feld));
    list.innerHTML = rows.map(i => {
      const s = stand(i.id), f = feldOf(i.feld);
      const pr = (D.schema.promises || []).find(p => p.nr === i.promise);
      return `<div class="trow">
        <div class="th"><a class="tw" href="#/initiatives/${i.id}">${esc(i.titel)}</a>
          <span class="pct">${s.prozent}%</span></div>
        <div class="fine">${esc(f ? f.titel : "")} · ch. ${i.kapitel}, p. ${i.seite}${pr ? ` · promise ${pr.nr}` : ""}</div>
        <p class="readable" style="font-size:.9rem;margin:.4rem 0 0">${esc(i.grundlage)}</p>
      </div>`;
    }).join("") || `<p class="fine">Nothing matches.</p>`;
  };
  q.oninput = debounce(draw, 120); fs.onchange = draw; draw();
}

function viewInitiative(id) {
  const i = initOf(id);
  if (!i) { location.hash = "#/initiatives"; return; }
  const s = stand(id), f = feldOf(i.feld), k = kapOf(i.kapitel);
  const pr = (D.schema.promises || []).find(p => p.nr === i.promise);
  const regs = (i.register || []).map(rid => D.recommendations.find(r => r.id === rid)).filter(Boolean);
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">${esc(f ? f.titel : "Initiative")}</span>
      <h1>${esc(i.titel)}</h1>
      <p class="lede">Chapter ${i.kapitel}${k ? ` · ${esc(k.titel)}` : ""}${k ? ` · ${esc(k.autoren)}` : ""}
      · printed page ${i.seite}${pr ? ` · the document files this under promise ${pr.nr}` : ""}.</p></div>

    <div class="panel"><h2>Current stage score: ${s.prozent}%</h2>
      ${balken(s.prozent, { h: 12 })}
      <p class="fine">${s.zuletzt_geprueft ? `Last checked ${datum(s.zuletzt_geprueft)}.` : "Not yet checked."}
      The score is the sum of the evidenced stages below — no part of it is an estimate.</p>
      <table class="tbl"><thead><tr><th>Stage</th><th class="num">Points</th><th>Status</th><th>Source</th></tr></thead>
      <tbody>${D.schema.stufen.map(st => {
        const v = s.stufen[st.id] || {};
        const status = v.rueckgaengig ? "<span class='rev'>reversed</span>"
          : v.belegt ? "<span class='on'>documented</span>" : "<span class='off'>not documented</span>";
        return `<tr><td>${esc(st.titel)}</td><td class="num">${st.gewicht}</td>
          <td>${status}${v.notiz ? `<br><span class="fine">${esc(v.notiz)}</span>` : ""}</td>
          <td>${quelleChip(v)}</td></tr>`;
      }).join("")}</tbody></table>
    </div>

    ${s.berichtet && s.berichtet.length ? `<div class="panel"><h2>Reported, not counted</h2>
      <p class="readable">Secondary reporting found for this initiative. It is recorded so that the reader
      can follow it, and it contributes nothing to the score, because a report is not a public act.</p>
      <ul class="toclist">${s.berichtet.map(b => `<li>
        <a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titel || b.url)}</a>
        <span class="fine">${esc(b.datum || "")}</span></li>`).join("")}</ul></div>` : ""}

    <div class="panel"><h2>What the document says</h2>
      <p class="readable">${esc(i.grundlage)}</p>
      ${regs.length ? `<p class="readable fine">Register entries on the same page:</p>
        <ul class="toclist">${regs.map(r => `<li><span>${esc(r.text)}</span>
          <span class="fine">p. ${r.seite}</span></li>`).join("")}</ul>` : ""}
      <p class="readable"><a class="chip" href="#/concordance?q=${encodeURIComponent(i.titel.split(" ").slice(0, 3).join(" "))}">
        search the text</a> <span class="fine">— needs your own copy</span></p>
    </div>
  </div>`));
}

/* =========================================================== STRUCTURE */
function viewStructure() {
  const sec = D.structure.sections, ch = D.structure.chapters;
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Structure</span>
      <h1>Five sections, 30 policy chapters</h1>
      <p class="lede">Recovered from the volume's own table of contents and verified against the running
      heads, which give the printed page on 864 of the 922 pages. Every chapter carries named authors; the
      document is a collection, not a single-authored plan.</p></div>
    <table class="tbl"><thead><tr><th>Ch.</th><th>Title</th><th>Authors</th>
      <th class="num">Pages</th><th class="num">Recs</th></tr></thead><tbody>
      ${ch.map(c => {
        const n = D.recommendations.filter(r => r.kapitel === c.nr).length;
        const s = sec.find(x => x.nr === c.section);
        return `<tr><td class="mono">${c.nr === 0 || c.nr === 31 ? "—" : c.nr}</td>
          <td>${esc(c.titel)}${c.paired ? `<br><span class="fine">contains two opposing contributions: ${c.paired.map(esc).join(" · ")}</span>` : ""}
            ${s ? `<br><span class="fine">Section ${s.nr}: ${esc(s.titel)}</span>` : ""}</td>
          <td class="fine">${esc(c.autoren)}</td>
          <td class="num">${c.seite_von}–${c.seite_bis}</td>
          <td class="num">${n || "—"}</td></tr>`;
      }).join("")}</tbody></table>
    <p class="fine">Chapters 1 to 3 show no register entries because they argue in prose rather than in
    bulleted recommendations. That is a limit of the extraction, not of the chapters — see
    <a href="#/method">Method</a>.</p>
  </div>`));
}

/* ============================================================ REGISTER */
function viewRegister() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Register</span>
      <h1>Every bulleted recommendation</h1>
      <p class="lede">${nf(D.recommendations.length)} recommendations, taken as the document words them and
      anchored to chapter and printed page. This is documentation, not selection: what is tracked is a
      subset, and the rest is here so that the subset can be checked against the whole.</p></div>
    <div class="toolbar">
      <input type="search" id="q" placeholder="Search the recommendations…" autocomplete="off">
      <select id="kap"><option value="">All chapters</option>
        ${D.structure.chapters.filter(c => D.recommendations.some(r => r.kapitel === c.nr))
          .map(c => `<option value="${c.nr}">${c.nr}. ${esc(c.titel.slice(0, 40))}</option>`).join("")}</select>
    </div>
    <div id="list" class="reglist"></div><p class="fine" id="cnt"></p>
  </div>`));
  const q = view.querySelector("#q"), ks = view.querySelector("#kap");
  const list = view.querySelector("#list"), cnt = view.querySelector("#cnt");
  const draw = () => {
    const term = q.value.trim().toLowerCase(), kap = ks.value;
    const rows = D.recommendations.filter(r =>
      (!term || r.text.toLowerCase().includes(term)) && (!kap || String(r.kapitel) === kap));
    list.innerHTML = rows.slice(0, 300).map(r => `<div class="reg">
      <span class="mono">${esc(r.id)}</span>
      <span>${esc(r.text)}</span>
      <span class="fine">ch. ${r.kapitel}, p. ${r.seite}</span></div>`).join("");
    cnt.textContent = `${rows.length} of ${D.recommendations.length}${rows.length > 300 ? " · first 300 shown" : ""}`;
  };
  q.oninput = debounce(draw, 150); ks.onchange = draw; draw();
}

/* ========================================================= CONCORDANCE */
function viewConcordance() {
  const pre = new URLSearchParams((location.hash.split("?")[1] || "")).get("q") || "";
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Concordance</span>
      <h1>Keyword in context</h1>
      <p class="lede">Runs against the copy you open, and cites every hit by chapter and printed page.
      Nothing is sent anywhere.</p></div>
    <div class="toolbar"><input type="search" id="cq" placeholder="A word or phrase…" value="${esc(pre)}" autocomplete="off"></div>
    <div id="out"></div>
  </div>`));
  const q = view.querySelector("#cq"), out = view.querySelector("#out");
  if (!C.isOpen()) {
    const b = el(`<div class="locked"><strong>Full text not shipped</strong>
      <p style="margin:.3rem 0 .9rem;font-size:.9rem">The document is under copyright, so its text is not
      distributed here. Its publisher offers it as a free download; open your copy once and it stays on this
      device.</p><button class="primary">Open your own copy</button></div>`);
    b.querySelector("button").onclick = openUnlock;
    out.append(b); return;
  }
  const draw = () => {
    const t = q.value.trim();
    if (t.length < 2) { out.innerHTML = ""; return; }
    const hits = C.kwic(t);
    out.innerHTML = hits.length
      ? `<p class="fine">${hits.length}${hits.length >= 300 ? " (first 300)" : ""} occurrences</p>
         <table class="kwic"><tbody>${hits.map(h => `<tr>
           <td class="l">${esc(h.l)}</td><td class="k">${esc(h.k)}</td><td class="r">${esc(h.r)}</td>
           <td class="c"><span class="cite">${esc(h.cite ? h.cite.label : "")}</span></td></tr>`).join("")}</tbody></table>`
      : `<p class="fine">No occurrence found.</p>`;
  };
  q.oninput = debounce(draw, 220);
  if (pre) draw();
}

/* ============================================================== METHOD */
function viewMethod() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Transparency</span>
      <h1>Method, sources and limits</h1>
      <p class="lede">How each number here was produced, and what it does not establish.</p></div>

    <div class="panel"><h2>What this site is for, and what it refuses to do</h2>
      <p class="readable">This is a documentation apparatus. It records two kinds of fact: what the volume
      proposes, cited to a printed page, and what the public record shows, cited to a primary source. It
      does not argue that any proposal is good or bad, wise or dangerous, and it does not characterise the
      motives of anyone who wrote it or acts on it. Readers who want that argument will find it in
      abundance elsewhere; the point of this site is to make the argument checkable by supplying what both
      sides of it usually assert without citation.</p>
      <p class="readable">Three consequences follow, and they are constraints on the reader as much as on
      the author. <strong>Correspondence is not causation.</strong> Many proposals in this volume have been
      advanced by others for decades; an action that matches one is evidence of correspondence and nothing
      more. <strong>The tracker is not a scorecard.</strong> It measures only how far actions correspond to
      this text, so it is silent on everything an administration does that the volume never mentions — which
      is most of what any administration does. <strong>A high score is not an endorsement and a low score is
      not a criticism.</strong> The number describes the state of a public process.</p>
    </div>

    <div class="panel"><h2>Why the percentage is a sum and not a judgement</h2>
      <p class="readable">The obvious way to build such a tracker is to ask, each week, how far along
      something is and record the answer as a percentage. That produces a number that looks objective and
      is a matter of impression: it drifts without cause, it cannot be checked, and it cannot be defended
      when challenged.</p>
      <p class="readable">So the number here is a <strong>computed quantity</strong>. Federal policy changes
      through a small set of publicly documented mechanisms, each of which leaves a citable artefact. Six
      such stages are defined once, weighted once, and applied identically to all
      ${D.initiatives.length} initiatives; the score is the sum of the stages for which evidence exists. No
      part of it is a holistic assessment, and changing a score means adding or withdrawing a specific
      citation.</p>
      <p class="readable">A stage counts only on a <strong>primary source</strong>: the Federal Register,
      Congress.gov, the Government Publishing Office, a federal court docket, or the acting agency's own
      publication. Press reporting is recorded against the initiative under “reported, not counted” and
      contributes nothing. This is deliberate and it makes the tracker lag the news — a proposal reported on
      Monday and published in the Federal Register on Friday moves on Friday.</p>
      <p class="readable">Reversal is representable. Where a documented stage is enjoined, vacated,
      rescinded or superseded, it is marked reversed, its points are removed, and the entry stays visible.
      A tracker that could only go up would be a poor instrument.</p>
    </div>

    <div class="panel"><h2>How the initiatives were chosen</h2>
      <p class="readable">The volume contains far more recommendations than can be tracked, and a tracker of
      several hundred entries of wildly differing specificity would produce an average that means nothing.
      ${D.initiatives.length} were selected by a rule stated in advance: the proposal must be
      <em>falsifiable as written</em> — naming an action, an authority or a rule, so that one can say
      whether it happened; it must be <em>prominent</em> in its chapter rather than an aside; and it must be
      <em>anchored to a printed page</em>, so that a reader can check the wording.</p>
      <p class="readable">Titles follow the document's own wording. Where the volume uses contested or
      loaded terms, the title reproduces them; that is quotation, not endorsement. Both sides of the two
      chapters that contradict themselves are tracked as separate initiatives, so that the volume's internal
      disagreement is visible rather than resolved by an editor's preference.</p>
      <p class="readable">The selection is versioned. Adding or removing an initiative changes what the
      averages mean, so it is logged as a change like any other.</p>
    </div>

    <div class="panel"><h2>Where the document data comes from</h2>
      <p class="readable">The PDF carries no bookmarks, so the structure was rebuilt: chapter boundaries
      from the volume's own table of contents, and the mapping from PDF page to printed page from the
      running heads, which give it on 864 of the 922 pages. Across all 864 the offset is a constant 32,
      without a single exception, so the page for any passage is exact rather than approximate.</p>
      <p class="readable">The register takes the chapters' bulleted recommendations as they are worded. A
      bullet is admitted only if it reads as a directive — an imperative, or a sentence containing
      “should”, “must” or a similar modal — which keeps list fragments and ordinary prose out.
      ${nf(D.recommendations.length)} entries result.</p>
      <p class="readable"><strong>The register is uneven, and the unevenness is not random.</strong>
      Chapters 1 to 3 — the White House Office, the Executive Office of the President, and the central
      personnel agencies — produce no entries at all, because they argue in continuous prose rather than in
      bullets. Those are precisely the chapters most concerned with the machinery of executive control, so
      anyone reading the register as a map of the document's emphasis will be misled. Initiatives from those
      chapters were anchored by targeted search instead, and they are marked as such.</p>
    </div>

    <div class="panel"><h2>The weekly run</h2>
      <p class="readable">A scheduled job runs once a week. For each initiative it searches for evidence
      against each stage, requires a primary source, and writes the result back into the repository as a
      commit. The commit history is therefore the tracker's audit trail: every change to every score is
      dated, attributable and reversible, and anyone can see what the evidence was before and after. That
      is the reason for choosing this arrangement over a database that would show only the current state.</p>
      <p class="readable">The job uses a language model with web search. It can miss things, and it can
      misread a document. It is instructed to leave a stage unevidenced when in doubt rather than to guess,
      because a false negative here is a gap and a false positive is a false claim. Every stage it marks
      carries the URL it relied on, so each one can be checked in a few seconds — and readers who find an
      error are asked to say so.</p>
    </div>

    <div class="panel"><h2>Rights</h2>
      <p class="readable">The volume is under copyright: © 2023 by The Heritage Foundation, all rights
      reserved. Its publisher distributes it as a free download, which is not a licence to redistribute, so
      this site ships none of its running text — only structure, page anchors, counts and the recommendation
      register in the document's own words, which is quotation for the purpose of documentation and
      comment. The concordance runs on a copy the reader fetches themselves.</p>
      <p class="readable">This site is not affiliated with, endorsed by or connected to The Heritage
      Foundation, the Project 2025 Presidential Transition Project, the volume's editors or authors, or any
      government body. If a rightsholder considers anything here to exceed what documentation and citation
      permit, the address in the <a href="#/imprint">legal notice</a> reaches the operator and it will be
      dealt with promptly.</p>
    </div>

    <div class="panel"><h2>Known limits</h2>
      <ul style="color:var(--fg2);font-size:.93rem">
        <li>The six stages fit rulemaking and executive action well, statutory change adequately, and
          informal shifts in enforcement priority poorly. Initiatives of the last kind will read as less
          advanced than they are.</li>
        <li>“Primary source” is a proxy for reliability, not a guarantee of one; an agency's own description
          of what it has done is still that agency's description.</li>
        <li>Absence of evidence is recorded as absence of evidence. A zero means nothing was found, not that
          nothing happened.</li>
        <li>The page anchors are tied to the 922-page edition of July 2024. Earlier or later printings will
          not line up.</li>
        <li>Weighting the stages is itself a choice. The weights are published, fixed, and applied to every
          initiative alike, but a different set would produce different numbers.</li>
      </ul>
    </div>
  </div>`));
}

/* ===================================================== PRIVACY, IMPRINT */
function viewPrivacy() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Privacy</span>
      <h1>Privacy notice</h1>
      <p class="lede">What this site does with data, at the level of detail at which it is actually true.
      Every claim below describes code you can read in this page's source.</p></div>

    <div class="panel"><h2>Who is responsible</h2>
      <p class="readable">Operated by a private individual from the United States; details in the
      <a href="#/imprint">legal notice</a>. A personal documentation project, not run on behalf of any
      institution, employer, publisher, party, campaign or advocacy organisation. Because it is reachable
      from the European Economic Area, this notice is written to satisfy the GDPR as well as United States
      law; where the GDPR applies, the operator is the controller within the meaning of Article 4(7).</p>
    </div>

    <div class="panel"><h2>What this site is, technically</h2>
      <p class="readable">Static files. No accounts, no login, no contact form, no newsletter, no comment
      function. <strong>No cookies whatsoever</strong>, no analytics, no tag manager, no advertising, no
      session recording. <strong>Nothing is loaded from third-party servers</strong>: pdf.js is served from
      this site, as are all data files. Opening a page contacts exactly one host — the one in your address
      bar — and reading the tracker involves no request to anyone else.</p>
      <p class="readable">There is no server function on this site and nothing you do here is sent anywhere.
      The weekly tracker update runs elsewhere, on a schedule, without any input from visitors.</p>
    </div>

    <div class="panel"><h2>Server logs</h2>
      <p class="readable">Hosting is by Netlify, whose infrastructure records the requests it serves — IP
      address, timestamp, URL, status, bytes, user-agent and referrer. Unavoidable in delivering a website
      and the only collection that takes place; it serves operation and security, is not analysed by the
      operator, and is retained per Netlify's own periods. Legal basis: Article 6(1)(f) GDPR. The site is
      operated and hosted in the United States, so for readers in the EEA this is processing outside the
      EEA.</p>
      <p class="readable">This matters more here than on an ordinary site: what someone reads about a
      politically contested document is sensitive by context, even when no special category of data under
      Article 9 is involved. That is a reason for the absence of analytics rather than an afterthought about
      it.</p>
    </div>

    <div class="panel"><h2>Your own copy of the document</h2>
      <p class="readable">If you open a PDF for the concordance, pdf.js reads its text layer inside your
      browser and stores the extracted text — with the file name and the time — in your browser's own
      <strong>IndexedDB</strong> database, named <span class="mono">mandate-for-leadership</span>. The file
      is never uploaded, and neither is the text: it is written to your device, not to any server. Nobody,
      including the operator, can tell that you opened it.</p>
      <p class="readable">The storage is <strong>persistent</strong> and unencrypted, like all browser
      storage. On a shared machine another person with access to that browser profile could see it. The
      button in the top right clears it; so does clearing site data for this domain.</p>
    </div>

    <div class="panel"><h2>Rights of readers in the European Economic Area</h2>
      <p class="readable">Where the GDPR applies you have the rights of access (Art. 15), rectification
      (Art. 16), erasure (Art. 17), restriction (Art. 18), portability (Art. 20) and objection (Art. 21),
      and the right to complain to a supervisory authority under Article 77. Requests go to the address in
      the <a href="#/imprint">legal notice</a>. The answer will be short: apart from the server logs nothing
      about you is held here.</p>
      <p class="readable">No representative in the Union has been designated under Article 27, on the
      exemption in Article 27(2)(a): the processing is occasional, involves no large-scale processing of
      special categories of data, and is unlikely to result in a risk to the rights and freedoms of natural
      persons.</p>
    </div>

    <div class="panel"><h2>Notice for California residents</h2>
      <p class="readable">Under CalOPPA (Cal. Bus. &amp; Prof. Code §§ 22575–22579): the information
      collected is network activity information in the form of the server logs above. No name, postal
      address, email address or telephone number is collected — there is no field for them, and nothing you
      type on this site leaves your browser. The only recipient is the hosting provider, Netlify Inc.;
      nothing is sold, rented or shared for marketing. There are no accounts and no stored profiles, so
      there is no record to review or amend. <strong>Do Not Track:</strong> this site does not track
      visitors over time or across third-party sites and so does not change behaviour on the signal — there
      is no tracking to disable, and no third-party content is loaded. Material changes are posted here with
      a revised date.</p>
    </div>

    <div class="panel"><h2>Children · Changes</h2>
      <p class="readable">Addressed to adult readers; not directed to children, and no information is
      knowingly collected from them. Effective 19 August 2026. Where this notice and the site's behaviour
      ever diverge, the notice is wrong and will be corrected — the description follows the code, not the
      other way round.</p>
    </div>
  </div>`));
}

function viewImprint() {
  view.append(el(`<div>
    <div class="viewhead"><span class="tag">Legal notice</span>
      <h1>Legal notice</h1>
      <p class="lede">Who operates this site, and how to reach them.</p></div>
    <div class="panel"><h2>Operator</h2>
      <p class="readable">Dr. Pantaleon Fassbender<br>16751 NE 5th Street<br>Williston, FL 32696<br>United States</p>
      <p class="readable">Email: <a href="mailto:pantaleonfassbender@gmail.com">pantaleonfassbender@gmail.com</a></p>
      <p class="readable">Responsible for the content: Dr. Pantaleon Fassbender, at the address above. A
      personal documentation project, operated and hosted in the United States by a private individual. No
      company stands behind it; it carries no advertising and no sponsorship; it has received no funding,
      material or direction from any party, campaign, candidate, political committee, government body or
      advocacy organisation, and it endorses none.</p>
    </div>
    <div class="panel"><h2>The document</h2>
      <p class="readable">Paul Dans and Steven Groves (eds.), <em>Mandate for Leadership: The Conservative
      Promise</em>, foreword by Kevin D. Roberts (Washington, DC: The Heritage Foundation, 2023), ISBN
      978-0-89195-174-2. © 2023 by The Heritage Foundation, all rights reserved. The volume is distributed
      by its publisher as a free download.</p>
      <p class="readable">This site is <strong>not affiliated with, endorsed by, or connected to</strong>
      The Heritage Foundation, the 2025 Presidential Transition Project, the volume's editors, its authors,
      its advisory board, or any government body. It reproduces no running text. What it contains is
      structure, page references, counts, and the volume's bulleted recommendations quoted for the purpose
      of documentation and comment. If you hold rights in this work and consider anything here to exceed
      what that permits, write to the address above and it will be dealt with promptly.</p>
    </div>
    <div class="panel"><h2>Accuracy and correction</h2>
      <p class="readable">The tracker will contain errors: a stage marked on a source that does not support
      it, a source that has since been superseded, an initiative whose wording no longer matches what is
      being tracked. Every stage carries the URL it rests on precisely so that such errors can be found. If
      you find one, write to the address above; corrections are made in the open and appear in the
      repository's history like any other change.</p>
      <p class="readable">Offered free of charge and without warranty of any kind. The limits of the method
      are set out under <a href="#/method">Method</a>, and they are part of the instrument rather than a
      disclaimer beside it.</p>
    </div>
  </div>`));
}

/* ============================================================ UNLOCKING */
const modal = document.getElementById("unlockModal");
function openUnlock() { modal.hidden = false; }
document.getElementById("unlockBtn").onclick = openUnlock;
document.getElementById("closeUnlock").onclick = () => { modal.hidden = true; };
modal.addEventListener("click", e => { if (e.target === modal) modal.hidden = true; });

const input = document.getElementById("pdfInput"), drop = document.getElementById("drop");
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); handleFile(e.dataTransfer.files[0]); });
input.onchange = () => handleFile(input.files[0]);

async function handleFile(file) {
  if (!file || (file.type && file.type !== "application/pdf")) return;
  const st = document.getElementById("unlockState"), prog = document.getElementById("unlockProgress");
  const fill = document.getElementById("barFill"), ptxt = document.getElementById("progressText");
  st.className = "statebox"; st.textContent = "";
  prog.hidden = false; fill.style.width = "0%"; ptxt.textContent = `Reading ${file.name} …`;
  try {
    const pages = await C.readPdf(file, (i, n) => {
      fill.style.width = (i / n * 100).toFixed(1) + "%";
      ptxt.textContent = `${file.name} — page ${i} of ${n}`;
    });
    const meta = await C.install(pages, file.name);
    st.className = "statebox ok";
    st.innerHTML = meta.seitenOk
      ? `Opened: ${nf(meta.n)} pages, matching the edition these anchors were built against. Page citations
         will line up.`
      : `Opened: ${nf(meta.n)} pages — the anchors were built against an edition of ${nf(C.EXPECTED_PAGES)}.
         Search works; <strong>page citations will not be reliable</strong>.`;
  } catch (e) {
    st.className = "statebox warn";
    st.textContent = "Could not read this file: " + (e && e.message ? e.message : e);
  } finally { prog.hidden = true; refreshBadge(); }
}

document.getElementById("forgetBtn").onclick = async () => {
  await C.forget();
  const st = document.getElementById("unlockState");
  st.className = "statebox"; st.textContent = "Stored text cleared.";
  refreshBadge();
  if (location.hash.startsWith("#/concordance")) route();
};

function refreshBadge() {
  const open = C.isOpen();
  document.getElementById("unlockDot").classList.toggle("on", open);
  document.getElementById("unlockLabel").textContent = open ? "your copy is open" : "locked";
}

boot();
