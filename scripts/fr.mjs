/* fr.mjs — nachpruefen, ob eine Federal-Register-Quelle das ist, was sie zu sein behauptet.
 *
 * Der Host-Filter in update-tracker.mjs erkennt, dass eine URL von einer
 * Primaerquelle stammt. Er erkennt nicht, ob das Dokument dahinter das
 * behauptete ist. Der erste echte Lauf hat genau diese Luecke vorgefuehrt:
 * zweimal wurde der richtige Kurzname an die falsche Dokumentnummer gehaengt
 * -- .../2025-02007/unleashing-american-energy zeigt in Wahrheit auf
 * "Protecting the Meaning and Value of American Citizenship". Die URL ist
 * wohlgeformt, liegt auf federalregister.gov, und belegt trotzdem nichts.
 *
 * Der Federal Register hat eine offene API ohne Schluessel. Damit laesst sich
 * die Nummer aufloesen und der zitierte Kurzname gegen den echten Titel
 * halten. Kein Modell ist daran beteiligt: entweder die Nummer existiert und
 * der Titel passt, oder die Stufe zaehlt nicht.
 */
const zwischenspeicher = new Map();

export function istFR(url) {
  try { return /(^|\.)federalregister\.gov$/.test(new URL(url).hostname); }
  catch { return false; }
}

/* Aus .../documents/2025/01/29/2025-01956/unleashing-american-energy
   werden Nummer und Kurzname gezogen. */
function zerlege(url) {
  const m = /\/documents\/\d{4}\/\d{2}\/\d{2}\/([0-9][0-9A-Za-z-]*)\/?([a-z0-9-]*)/.exec(url);
  return m ? { nummer: m[1], kurzname: m[2] || "" } : null;
}

/* Traegt der zitierte Kurzname denselben Gegenstand wie der echte Titel?
   Gemessen an den bedeutungstragenden Woertern; FR bildet seine Kurznamen aus
   dem Titel, ein echtes Paar erreicht muehelos ueber die Haelfte. */
function passt(kurzname, titel) {
  if (!kurzname) return true;                     /* ohne Kurzname nichts zu pruefen */
  const w = kurzname.split("-").filter(x => x.length > 4);
  if (!w.length) return true;
  const t = titel.toLowerCase();
  return w.filter(x => t.includes(x)).length / w.length >= 0.5;
}

export async function pruefeFR(url) {
  const teile = zerlege(url);
  if (!teile) return { ok: true, url };           /* kein Dokumentlink, z.B. Suchseite */
  if (zwischenspeicher.has(teile.nummer)) {
    const v = zwischenspeicher.get(teile.nummer);
    return v.gefunden
      ? (passt(teile.kurzname, v.titel)
          ? { ok: true, url: v.url, titel: v.titel, datum: v.datum }
          : { ok: false, grund: `document ${teile.nummer} is "${v.titel}", not what the citation names` })
      : { ok: false, grund: `document ${teile.nummer} does not exist` };
  }
  let v = { gefunden: false };
  try {
    const r = await fetch(
      `https://www.federalregister.gov/api/v1/documents/${encodeURIComponent(teile.nummer)}.json`
      + `?fields[]=title&fields[]=publication_date&fields[]=html_url`,
      { headers: { "user-agent": "mandate-for-leadership-tracker" } });
    if (r.ok) {
      const d = await r.json();
      if (d && d.title) v = { gefunden: true, titel: d.title, datum: d.publication_date, url: d.html_url || url };
    } else if (r.status !== 404) {
      /* Erreichbarkeitsstoerung ist kein Beleg gegen das Dokument. Die Stufe
         bleibt stehen, aber ungepruefte Quellen werden vermerkt. */
      return { ok: true, url, ungeprueft: true };
    }
  } catch {
    return { ok: true, url, ungeprueft: true };
  }
  zwischenspeicher.set(teile.nummer, v);
  if (!v.gefunden) return { ok: false, grund: `document ${teile.nummer} does not exist` };
  if (!passt(teile.kurzname, v.titel))
    return { ok: false, grund: `document ${teile.nummer} is "${v.titel}", not what the citation names` };
  return { ok: true, url: v.url, titel: v.titel, datum: v.datum };
}
