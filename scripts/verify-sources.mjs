/* verify-sources.mjs — die Quellenpruefung auf den vorhandenen Bestand anwenden.
 *
 * Braucht keinen Modellzugang: es wird nichts neu recherchiert, sondern nur
 * nachgesehen, ob die schon eingetragenen Federal-Register-Belege die
 * Dokumente sind, als die sie zitiert werden. Was diese Pruefung nicht
 * besteht, verliert seine Punkte und behaelt den Grund.
 *
 *   node scripts/verify-sources.mjs           schreibt data/tracker.json
 *   node scripts/verify-sources.mjs --probe   zeigt nur, was sich aendern wuerde
 */
import { readFileSync, writeFileSync } from "node:fs";
import { istFR, pruefeFR } from "./fr.mjs";

const probe = process.argv.includes("--probe");
const schema = JSON.parse(readFileSync("data/schema.json", "utf8"));
const tracker = JSON.parse(readFileSync("data/tracker.json", "utf8"));

let geprueft = 0, verworfen = 0, berichtigt = 0, ungeprueft = 0;
const protokoll = [];

for (const [id, eintrag] of Object.entries(tracker.initiativen)) {
  for (const st of schema.stufen) {
    const s = eintrag.stufen[st.id];
    if (!s || !s.belegt || !s.quelle || !istFR(s.quelle)) continue;
    geprueft++;
    const pr = await pruefeFR(s.quelle);
    if (pr.ungeprueft) { ungeprueft++; continue; }
    if (!pr.ok) {
      verworfen++;
      protokoll.push(`  - ${id} / ${st.id}: ${pr.grund}\n      ${s.quelle}`);
      s.belegt = false; s.rueckgaengig = false; s.quelle = null;
      s.verworfen = pr.grund;
    } else {
      if (pr.url && pr.url !== s.quelle) berichtigt++;
      s.quelle = pr.url || s.quelle;
      s.quelltitel = pr.titel || null;
      s.verworfen = null;
    }
  }
  /* Punkte neu bilden -- immer aus den Stufen, nie fortgeschrieben. */
  eintrag.prozent = schema.stufen
    .filter(st => eintrag.stufen[st.id] && eintrag.stufen[st.id].belegt && !eintrag.stufen[st.id].rueckgaengig)
    .reduce((n, st) => n + st.gewicht, 0);
}

const werte = Object.values(tracker.initiativen).map(v => v.prozent);
const mittel = werte.reduce((a, b) => a + b, 0) / Math.max(1, werte.length);
console.log(`Federal-Register-Belege geprueft: ${geprueft}`);
console.log(`  verworfen  : ${verworfen}`);
console.log(`  URL berichtigt: ${berichtigt}`);
console.log(`  nicht pruefbar (Dienst gestoert): ${ungeprueft}`);
if (protokoll.length) console.log("\n" + protokoll.join("\n"));
console.log(`\nMittelwert jetzt ${mittel.toFixed(1)}%`);

if (probe) { console.log("\n(--probe: nichts geschrieben)"); process.exit(0); }
tracker.quellen_geprueft = new Date().toISOString().slice(0, 10);
writeFileSync("data/tracker.json", JSON.stringify(tracker));
console.log("data/tracker.json geschrieben.");
