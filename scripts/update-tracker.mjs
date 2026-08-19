/* update-tracker.mjs — the weekly run.
 *
 * For each tracked initiative this asks a model with web search to find, for
 * each of the six stages, a PRIMARY source that documents it. The model does
 * not score anything: it reports which stages it can evidence and with what
 * URL. The percentage is computed here, from the weights in schema.json.
 *
 * Two rules do the work:
 *   - a stage counts only if its source is on a primary-source host;
 *   - when in doubt the stage is left unevidenced, because a false negative is
 *     a gap and a false positive is a false claim.
 *
 * The result is written back into the repository, so the commit history is the
 * tracker's audit trail.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }
const MODEL = process.env.TRACKER_MODEL || "claude-sonnet-4-6";
const NUR = process.env.ONLY_ID || "";           // fuer Einzeltests
const BASE = "https://api.anthropic.com/v1/messages";

const schema = JSON.parse(readFileSync("data/schema.json", "utf8"));
const inits = JSON.parse(readFileSync("data/initiatives.json", "utf8"));
const tracker = JSON.parse(readFileSync("data/tracker.json", "utf8"));
const heute = new Date().toISOString().slice(0, 10);

/* Nur diese Hosts belegen eine Stufe. Presse wird gesondert gefuehrt. */
const PRIMAER = [
  "federalregister.gov", "congress.gov", "govinfo.gov", "whitehouse.gov",
  "courtlistener.com", "supremecourt.gov", "uscourts.gov", "gao.gov",
  "opm.gov", "omb.gov", "regulations.gov", "usaspending.gov", "oversight.gov",
];
function istPrimaer(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return PRIMAER.some(p => h === p || h.endsWith("." + p)) || h.endsWith(".gov");
  } catch { return false; }
}

const SYSTEM = `You establish, from the public record, whether specific stages of a United States federal policy process can be documented. You are a records checker, not a commentator.

Absolute rules:
1. Report only what you have retrieved in this conversation. Never rely on memory, and never construct a URL from a pattern.
2. For each stage, either give a URL you actually retrieved that documents it, or report it as not documented. When the evidence is partial, ambiguous or merely reported by a news outlet, report NOT documented. A gap is acceptable; a wrong claim is not.
3. Prefer primary sources: the Federal Register, Congress.gov, GovInfo, the acting agency's own site, a court docket. If all you can find is news reporting, put it under "reported" instead — never under a stage.
4. Note reversals. If something was done and has since been enjoined, vacated, rescinded or superseded, mark that stage reversed and give the source for the reversal.
5. Be strictly neutral. Do not say whether any action is good, bad, lawful, wise or dangerous, and do not characterise anyone's motives. You are recording whether documents exist.
6. This concerns whether government actions correspond to proposals in a 2023 policy volume. Correspondence is not causation and you must not assert or imply that the volume caused anything.

Answer with JSON only, no prose around it.`;

const SCHEMA_TXT = schema.stufen
  .map(s => `  "${s.id}": stage "${s.titel}" — ${s.beleg}`).join("\n");

function prompt(i) {
  return `INITIATIVE
Title: ${i.titel}
As proposed in the document: ${i.grundlage}
(Mandate for Leadership, 2023, chapter ${i.kapitel}, printed page ${i.seite}.)

Search the public record for United States federal government action between January 2025 and today that corresponds to this proposal. Then report, for each stage below, whether it can be documented.

STAGES
${SCHEMA_TXT}

Return exactly this JSON shape:
{
  "stages": {
    "<stage id>": { "documented": true|false, "reversed": true|false, "url": "<retrieved URL or null>", "note": "<one factual sentence, or null>" }
  },
  "reported": [ { "url": "...", "title": "...", "date": "YYYY-MM-DD or null" } ],
  "no_action_found": true|false
}

Every stage id must appear. "reported" is for credible secondary reporting only and may be empty. Set "no_action_found" when you found nothing corresponding at all — that is a legitimate and useful result.`;
}

async function frage(i) {
  const body = {
    model: MODEL, max_tokens: 2000, system: SYSTEM,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: prompt(i) }],
  };
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const r = await fetch(BASE, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": KEY,
                   "anthropic-version": "2023-06-01" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const t = await r.text();
        if (r.status === 429 || r.status >= 500) { await warte(versuch * 20000); continue; }
        throw new Error(`${r.status} ${t.slice(0, 200)}`);
      }
      const d = await r.json();
      const txt = (d.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
      const m = txt.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no JSON in reply");
      return JSON.parse(m[0]);
    } catch (e) {
      if (versuch === 3) throw e;
      await warte(versuch * 15000);
    }
  }
}
const warte = ms => new Promise(r => setTimeout(r, ms));

let geaendert = 0, geprueft = 0, fehler = 0;
const notizen = [];

for (const i of inits) {
  if (NUR && i.id !== NUR) continue;
  const vorher = JSON.stringify(tracker.initiativen[i.id]);
  let antwort;
  try {
    antwort = await frage(i);
  } catch (e) {
    console.error(`  ! ${i.id}: ${e.message}`);
    fehler++;
    continue;
  }
  geprueft++;

  const eintrag = tracker.initiativen[i.id] || { stufen: {}, berichtet: [] };
  let punkte = 0;
  for (const st of schema.stufen) {
    const a = (antwort.stages || {})[st.id] || {};
    const url = typeof a.url === "string" ? a.url : null;
    /* Die entscheidende Pruefung: ohne Primaerquelle keine Stufe. */
    const gilt = !!a.documented && !!url && istPrimaer(url);
    const rev = !!a.reversed;
    eintrag.stufen[st.id] = {
      belegt: gilt, rueckgaengig: rev && gilt,
      quelle: gilt ? url : null,
      notiz: typeof a.note === "string" ? a.note.slice(0, 240) : null,
    };
    if (gilt && !rev) punkte += st.gewicht;
  }
  eintrag.prozent = punkte;
  eintrag.zuletzt_geprueft = heute;
  eintrag.berichtet = Array.isArray(antwort.reported)
    ? antwort.reported.filter(x => x && x.url).slice(0, 5)
        .map(x => ({ url: x.url, titel: (x.title || "").slice(0, 160), datum: x.date || null }))
    : [];
  tracker.initiativen[i.id] = eintrag;

  if (JSON.stringify(eintrag) !== vorher) {
    geaendert++;
    notizen.push(`${i.id}: ${eintrag.prozent}%`);
  }
  console.log(`  ${i.id.padEnd(26)} ${String(eintrag.prozent).padStart(3)}%`);
  await warte(1500);
}

tracker.stand = heute;
tracker.laeufe = (tracker.laeufe || 0) + 1;
writeFileSync("data/tracker.json", JSON.stringify(tracker));

/* Verlaufszeile: eine Zeile je Lauf, damit sich Kurven zeichnen lassen. */
const zeile = { datum: heute, lauf: tracker.laeufe,
  werte: Object.fromEntries(Object.entries(tracker.initiativen).map(([k, v]) => [k, v.prozent])) };
appendFileSync("data/history.jsonl", JSON.stringify(zeile) + "\n");

const werte = Object.values(tracker.initiativen).map(v => v.prozent);
const mittel = werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length);
console.log(`\nchecked ${geprueft}, changed ${geaendert}, errors ${fehler}, mean ${mittel.toFixed(1)}%`);
writeFileSync("/tmp/tracker-summary.txt",
  `checked ${geprueft}, changed ${geaendert}, errors ${fehler}, mean ${mittel.toFixed(1)}%\n\n`
  + notizen.slice(0, 40).join("\n"));
