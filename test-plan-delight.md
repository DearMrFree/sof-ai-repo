# Test plan — seamless sign-up + generative profile delight

## What changed (user-visible)
- `/signin` replaced with a seamless one-click "Jump in" flow: server-generated persona (handle, display name, colors) + a **live profile preview** on the right that mirrors `/u/[handle]`. A "Re-roll persona" button mutates the preview. Email collapsed behind a single-field one-liner.
- `/u/[handle]` gains motion: cover mesh drifts (`animate-sof-drift`, 18s), BuildCards `sof-lift` on hover with emoji parallax and per-status lucide icons (Rocket / Hammer / CircleDashed), stagger entrance.
- Global: Toast system wired into FollowButton + ShareButton. Nav gains gradient underline on active route.

## Code grounding
- Signin UI + preview: `web/src/app/signin/page.tsx` (imports `generatePersona`, "Jump in" button calls `signIn("guest", { handle, displayName, redirect:false, callbackUrl:"/classroom" })` then `router.push("/classroom")`).
- Persona generation: `web/src/lib/personaGen.ts` (seeded RNG; `generatePersona()` with no seed returns fresh persona each call).
- Profile page: `web/src/app/u/[handle]/page.tsx` (drifting cover via `<div className="animate-sof-drift absolute -inset-[10%]" />`).
- BuildCard: `web/src/components/BuildCard.tsx` — `sof-lift` on card, `group-hover:-translate-y-1 group-hover:scale-105` on emoji, `STATUS_STYLE[status].Icon` renders Rocket/Hammer/CircleDashed.
- Toast: `web/src/components/Toast.tsx` + `useToast()` wired in `FollowButton.tsx` (message: ``You're following @${handle}.``) and `ShareButton.tsx` (message: `Profile link copied.`).
- Animations defined in `web/src/app/globals.css` (`@keyframes sof-drift`, `@keyframes sof-in`, `.sof-lift`).

## Primary flow (to record)
1. Open `http://localhost:3000/signin`.
2. **Observe**: right panel shows a live profile preview card (cover + avatar + handle + stats). Left card shows "Jump in" (gradient) and "Re-roll persona" (outline).
3. Click **Re-roll persona** twice. Each click should mutate the preview (handle text, avatar gradient, cover mesh colors).
4. Click **Jump in** (no fields filled).
5. Wait for redirect. Expect to land on `/classroom` within ~2s.
6. **Observe**: top nav shows the user pill (handle) as proof of authenticated session.
7. Click "People" in the nav, then click `@ada` (or navigate directly to `/u/ada`).
8. **Observe** on `/u/ada`:
   - Cover mesh is drifting (slow translate/rotate cycle) — capture ~10s of video.
   - Stats strip shows non-zero numbers (Shipped, In-progress, XP, Streak, Followers, Following).
   - Build grid contains cards with at least one **Rocket** icon (Shipped) and one **CircleDashed** icon (Draft) in the status chip.
9. Hover cursor over the first BuildCard for ~2s. Emoji should translate up + scale; whole card lifts.
10. Click **Follow** button. A toast should appear at the bottom-right with literal text `You're following @ada.`. Toast auto-dismisses after ~3s.
11. Click **Share** button. Toast should appear with literal text `Profile link copied.`

## Assertions (pass/fail)

| # | Assertion | Expected |
|---|-----------|----------|
| A1 | Re-roll mutates preview | After 2 clicks, preview handle text differs from initial; cover colors change |
| A2 | Jump in authenticates & redirects | URL becomes `/classroom`; Nav shows handle (not "Sign in") |
| A3 | Profile cover drifts | Over 10s, cover mesh visibly moves (rotation/translation) — not static |
| A4 | Per-status icons render | Visible `svg.lucide-rocket` inside a Shipped chip, and `svg.lucide-circle-dashed` inside a Draft chip |
| A5 | BuildCard hover lifts + parallaxes | On hover, emoji moves up ~4px and scales up ~5%; card elevates |
| A6 | Follow toast text | Toast contains exactly "You're following @ada." |
| A7 | Share toast text | Toast contains exactly "Profile link copied." |

## Adversarial check
- A broken animation (missing `@keyframes sof-drift`) would fail A3.
- A broken `STATUS_STYLE.Icon` mapping would fail A4 (icon would be missing or wrong).
- A broken `useToast()` wiring (e.g. provider not mounted) would fail A6/A7 (no toast).
- A broken re-roll (e.g. state not lifted, `setPersona` not called) would fail A1.
- A broken guest authorize() (returning null) would keep you on `/signin` → fails A2.

## Out of scope (not retesting)
- Agent chat (regression from prior test, already green).
- Curriculum / lesson player.
- Backend progress writes.
- DNS flip to sof.ai.
