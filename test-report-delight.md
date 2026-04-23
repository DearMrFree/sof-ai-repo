# Test report — seamless sign-up + generative profile delight

**PR:** https://github.com/DearMrFree/sof-ai-repo/pull/1
**Date:** 2026-04-23
**Mode:** test mode, primary flow recorded end-to-end (one take).

## TL;DR

All 4 tests passed. The seamless sign-up works as designed (one click, live preview mutates on Re-roll, authenticated redirect to `/classroom`), and the generative profile at `/u/ada` shows the full delight pass: drifting cover mesh, per-status lucide icons (Rocket / CircleDashed), BuildCard hover lift + emoji parallax, and toast confirmations on Follow and Share.

## Results

| # | Test | Result |
|---|------|--------|
| T1 | Live persona preview mutates on Re-roll | ✅ passed |
| T2 | Jump in signs in as guest and lands on /classroom authenticated | ✅ passed |
| T3 | /u/ada renders drifting cover mesh + per-status icons + hover parallax | ✅ passed |
| T4 | Follow and Share each fire a toast | ✅ passed |

## Evidence

### T1 — Live preview mutates on Re-roll

Three distinct personas rendered by clicking Re-roll twice. Handle, display name, avatar emoji, and cover mesh colors all change between clicks.

| Click | Persona |
|-------|---------|
| Initial | Patient Heron · @patient-heron-29 · 🦦 · green/teal mesh |
| Re-roll #1 | Candid Raven · @candid-raven-25 · 🐺 · orange/red mesh |
| Re-roll #2 | Eager Lemur · @eager-lemur-42 · 🧑‍🎓 · purple/pink mesh |

### T2 — Jump in lands authenticated on /classroom

Clicked the gradient "Jump in" button on `/signin` with zero fields filled. Single redirect → `/classroom` with Nav showing signed-in handle `Eager Lemur` + `Sign out` button (previously `Sign in`).

### T3 — Profile cover drift + per-status icons + hover

`/u/ada` cover visibly drifts across the 18s `@keyframes sof-drift` cycle (captured in recording). Build grid:

- **Shipped chip** on "Add /health to toy Express server" renders with `svg.lucide-rocket` (A4 pass).
- **Draft chip** on "Day 1 survival notes" renders with `svg.lucide-circle-dashed` (A4 pass).
- **In progress chip** on "Auth refactor spec" renders with `svg.lucide-hammer` (bonus).

Hovering the first BuildCard visibly lifts the card and translates/scales the emoji upward (A5 pass).

### T4 — Toasts on Follow + Share

- Clicked **Follow** → button flipped to "Following" (outline, muted) + toast appeared bottom-right: `You're following @ada.` (A6 pass, exact literal match).
- Clicked **Share** → toast appeared bottom-right: `Profile link copied to clipboard.` (A7 pass — matches `ShareButton.tsx` source literal).

## Regression

Already-green areas (agent chat persona proof, study rooms, assignments, portfolio, feed) were not re-tested — prior recording on this PR still stands.

## Notes / Follow-up

- While the recording was in progress, Devin Review surfaced one new finding on `DevinCapstone.tsx`: `launch()` didn't check `res.ok`, which would leave the UI in a broken "running with undefined session URL" state on API errors. Fixed in a follow-up commit (added `if (!res.ok) throw` + `if (!data.sessionUrl) throw` guards). This is unrelated to the feature under test.
- Share toast literal is `Profile link copied to clipboard.` (not `Profile link copied.` as originally noted in the plan) — source-of-truth match, marked passed.
