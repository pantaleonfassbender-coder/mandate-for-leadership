# Mandate for Leadership — documentation and implementation tracker

A static site that documents *Mandate for Leadership: The Conservative Promise*
(The Heritage Foundation, 2023 — the policy volume of the Project 2025
Presidential Transition Project) and tracks, weekly, how far its proposals
correspond to actions on the public record.

**It takes no position.** It records two kinds of fact: what the volume
proposes, cited to a printed page, and what the public record shows, cited to a
primary source. It does not say whether any proposal or any action is good, bad,
lawful or wise, and it does not characterise anyone's motives.

Three constraints follow, and they bind the reader as much as the author:

- **Correspondence is not causation.** Many of these proposals have been
  advanced by others for decades. An action that matches one is evidence of
  correspondence and of nothing else.
- **The tracker is not a scorecard.** It measures correspondence with this text
  only, and is therefore silent on everything an administration does that the
  volume never mentions — which is most of what any administration does.
- **A high score is not praise and a low score is not criticism.** The number
  describes the state of a public process.

## What is here

- **The tracker** — 60 initiatives, each scored against the same six stages.
- **The recommendation register** — all 773 bulleted recommendations in the
  volume's own words, with chapter and printed page.
- **The structure** — five sections, 32 chapters with their named authors and
  page ranges, including the two chapters that carry opposing contributions.
- **A concordance** over a copy the reader supplies.

## The percentage is computed, not judged

The obvious design — ask a model each week how far along something is — yields a
number that looks objective and is an impression. It drifts without cause and
cannot be defended.

So the score is a **sum**. Federal policy moves through a small set of publicly
documented mechanisms, each leaving a citable artefact. Six stages are defined
once, weighted once, and applied identically to all 60 initiatives:

| Stage | Points | Evidence |
|---|---|---|
| Authority in place | 10 | appointee, office, delegation |
| Intent stated | 10 | executive order, memorandum, budget request |
| Formal process opened | 20 | proposed rule, guidance withdrawal, RIF notice, filed litigation |
| Adopted | 25 | final rule, statute, rescission, completed termination |
| In force | 25 | effective date passed, not stayed |
| Durable | 10 | upheld on review, or codified |

**The host is not enough.** A citation can sit on federalregister.gov, be
perfectly well formed, and still document nothing: the first live run attached
the right short name to the wrong document number twice, so
`.../2025-02007/unleashing-american-energy` in fact pointed at *Protecting the
Meaning and Value of American Citizenship*. Federal Register sources are
therefore resolved against that publication's open API — the document number
must exist, and the name in the citation must match the real title, or the
stage does not count and keeps the reason. That covers the largest block of
evidence; Congress.gov and GovInfo citations are checked for host only, which
is a known gap and is stated here rather than left to be discovered.

`node scripts/verify-sources.mjs` applies the same check to what is already
published, without a model and without an API key; `--probe` reports without
writing.

Two rules make it checkable. **A stage counts only on a primary source** — the
Federal Register, Congress.gov, GovInfo, a court docket, the acting agency.
Press reporting is recorded against the initiative as *reported, not counted*
and scores nothing, which makes the tracker deliberately lag the news. And
**reversal is representable**: a stage that is enjoined, vacated, rescinded or
superseded is marked reversed, its points removed, the entry left visible.

## The weekly run

`.github/workflows/tracker.yml` runs `scripts/update-tracker.mjs` every Monday.
For each initiative it searches the public record, requires a primary source per
stage, recomputes the score from the fixed weights, and **commits the result**.

That is the point of running it as a committing job rather than a service: the
commit history is the audit trail. Every change to every score is dated,
attributable and reversible, and anyone can read what the evidence was before
and after.

A run does not have to finish. Each initiative costs a model call with several
web searches, and sixty of them do not reliably fit in one job, so the script
gives itself a time budget (`BUDGET_MIN`, default 32), stops of its own accord
when it runs out, and writes what it has. Initiatives are taken **oldest check
first**, so what a run leaves undone is what the next run starts with, and the
baseline fills in over the first two or three weeks. Until then the tracker page
says plainly how many initiatives have never been checked, because a zero from a
missing check and a zero from an absent record look identical and must not be
confused.

The first attempt got this wrong: the job was killed at its 45-minute limit and
the commit step was skipped, which threw away every result already paid for.
Hence the budget inside the script, and `if: always()` on the commit.

Needs `ANTHROPIC_API_KEY` as a repository secret. Run it by hand from the
Actions tab, or set `ONLY_ID=<initiative-id>` locally to check a single entry.
`PARALLEL` (default 5) sets how many initiatives are in flight at once.

The job uses a language model with web search. It can miss things and it can
misread a document; it is instructed to leave a stage unevidenced when in doubt,
because a gap is honest and a false positive is a false claim. Every counted
stage carries the URL it rests on, so any of them can be checked in seconds.
**Corrections are welcome** — open an issue with the initiative and the source.

## Deployment

Netlify, straight from this repository. No build step, no dependencies, no
third-party requests, and no server function: the site is entirely static and
sends nothing anywhere.

```
python -m http.server 8000     # then open http://localhost:8000
```

## Where the document data comes from

The PDF carries no bookmarks. Chapter boundaries come from the volume's own
table of contents; the mapping from PDF page to printed page comes from the
running heads, which give it on 864 of the 922 pages — and across all 864 the
offset is a constant 32 without exception, so page citations are exact.

The register admits a bullet only if it reads as a directive. **It is uneven,
and not randomly so:** chapters 1 to 3 — the White House Office, the Executive
Office of the President, the central personnel agencies — yield no entries at
all, because they argue in prose rather than bullets. Those are precisely the
chapters most concerned with executive control, so the register must not be read
as a map of the document's emphasis. Initiatives from those chapters were
anchored by targeted search instead.

## Rights

No running text of the volume is in this repository. See
[LICENSES.md](LICENSES.md) — including the one file that is quotation from a
copyrighted work and is therefore not the operator's to license.

Independent project. Not affiliated with, endorsed by, or connected to The
Heritage Foundation, the 2025 Presidential Transition Project, the volume's
editors or authors, or any government body; no funding or direction from any
party, campaign, committee or advocacy organisation.
