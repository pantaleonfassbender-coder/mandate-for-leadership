/* merge-earlier-evidence.mjs — carry verified evidence forward.
 *
 * Applies the retention rule retroactively: a stage that an earlier committed
 * state documents with a primary source stays documented, unless the current
 * state marks it reversed or its source was rejected on checking. Needed once,
 * after the run of 2026-08-24 silently dropped stages the run of 2026-08-19
 * had documented and verified — 35 of 60 scores moved within five days on
 * nothing but search variance. Kept in the repository because the situation
 * can recur whenever the retention rule has to be re-applied to published
 * data, and because the repair itself should be reproducible.
 *
 *   git show <commit>:data/tracker.json > /tmp/earlier.json
 *   node scripts/merge-earlier-evidence.mjs /tmp/earlier.json
 *
 * No model, no key, no network. Restored stages carry `bewahrt` with today's
 * date, exactly as the weekly run marks stages it retains.
 */
import { readFileSync, writeFileSync } from "node:fs";

const earlierPath = process.argv[2];
if (!earlierPath) {
  console.error("usage: node scripts/merge-earlier-evidence.mjs <earlier tracker.json>");
  process.exit(2);
}

const schema = JSON.parse(readFileSync("data/schema.json", "utf8"));
const tracker = JSON.parse(readFileSync("data/tracker.json", "utf8"));
const earlier = JSON.parse(readFileSync(earlierPath, "utf8"));
const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()) /* ET-Kalendertag: der Aktenbestand und die Leser sind amerikanisch; das UTC-Datum liefe abends ET einen Tag voraus */;
const gewicht = Object.fromEntries(schema.stufen.map(s => [s.id, s.gewicht]));

let restauriert = 0, betroffen = 0;
for (const [id, alt] of Object.entries(earlier.initiativen || {})) {
  const neu = tracker.initiativen[id];
  if (!neu) continue;
  let getroffen = false;
  for (const [sid, altSt] of Object.entries(alt.stufen || {})) {
    const neuSt = (neu.stufen || {})[sid];
    if (!altSt.belegt || altSt.rueckgaengig) continue;         // nichts zu tragen
    if (neuSt && neuSt.belegt) continue;                        // schon belegt
    if (neuSt && neuSt.rueckgaengig) continue;                  // ausdruecklich zurueckgenommen
    if (neuSt && neuSt.verworfen) continue;                     // Quelle bei Pruefung verworfen
    neu.stufen[sid] = { ...altSt, bewahrt: heute };
    restauriert++;
    getroffen = true;
  }
  if (getroffen) {
    betroffen++;
    neu.prozent = schema.stufen.reduce((sum, st) => {
      const v = neu.stufen[st.id] || {};
      return sum + (v.belegt && !v.rueckgaengig ? gewicht[st.id] : 0);
    }, 0);
  }
}

const werte = Object.values(tracker.initiativen).map(v => v.prozent);
const mittel = werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length);
writeFileSync("data/tracker.json", JSON.stringify(tracker));
console.log(`${restauriert} Stufen in ${betroffen} Initiativen getragen; Mittelwert jetzt ${mittel.toFixed(1)}%`);
