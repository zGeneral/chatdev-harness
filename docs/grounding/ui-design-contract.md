# UI design contract — for the `spec-architect` role

When the product is **UI-heavy** (web page/app, dashboard, game HUD, any rendered interface), the spec
MUST include a **Design System** section defining tokens BEFORE any component is described. Downstream,
the `programmer` may consume ONLY these tokens — no raw hex, no inline styles, no per-component ad-hoc
values — and the `reviewer` rejects any literal color/size that isn't a token.

> Extracted (distilled, not installed) from `mustafakendiguzel/claude-code-ui-agents` (MIT) — its
> "Universal UI/UX Design Methodology", design-system-generator token taxonomy, and accessibility checklist.

## Design principle (state once in the spec)
Styles live in a central design system, never in components; components vary by **named variants**, not
overrides. Every UI decision must answer: **Purpose, Hierarchy, Context, Accessibility, Performance.**

## Required token taxonomy (the spec must enumerate concrete values for each)
1. **Color** — HSL semantic tokens only: `--primary --primary-glow --accent --secondary --background
   --foreground --muted`; semantic `--success/--warning/--error/--info`; a neutral gray ramp of 6–9 shades;
   light AND dark values. No literal colors downstream.
2. **Typography** — one font + fallback; ≤3 weights; a fixed type scale (body ≥16px; steps
   body→subhead→section→page→hero); line-height 1.4–1.6 body / 1.1–1.3 headings; measure 45–75 chars.
3. **Spacing** — a single 8px-based scale (4/8/16/24/32/48/64/96), referenced by name; ≥8px between
   interactive elements. No off-grid spacing.
4. **Radius** — one radius scale (sm/md/lg/full), applied consistently.
5. **Elevation** — a named shadow scale; never one-off box-shadows.
6. **Motion** — duration + easing tokens (e.g. `0.3s cubic-bezier(0.4,0,0.2,1)`); animate transform/opacity
   only; 60fps; must respect `prefers-reduced-motion`. (For motion *feel*, see `motion-math.md`.)

## Responsive contract (if it renders)
Mobile-first, named breakpoints (sm 640/768 · md 768–1024 · lg 1024+ · xl 1280–1400); Flexbox for 1-D,
Grid for 2-D; touch targets ≥44px (48px preferred) with ≥8px gaps.

## Accessibility contract (acceptance criteria — bake into the test plan, not aspirations)
- WCAG **AA contrast ≥4.5:1** for text against its token background.
- Semantic HTML; every interactive element keyboard-reachable with logical Tab order; **visible focus**
  on all of them; Escape closes overlays; Arrow-key nav for composite widgets.
- ARIA where native semantics fall short: roles, `aria-labelledby`/`-describedby`, states
  (`aria-expanded`/`-selected`), live regions for dynamic updates.
- Alt text on all images; hover/focus/loading/error states designed for every interactive element.

## Spec output
Emit the tokens as a concrete table or a CSS-variable / JSON block in the spec so the programmer copies
values rather than inventing them, and the reviewer can diff the build against the named tokens. Treat
**"no raw hex / no inline styles / on the 8px grid / AA contrast / visible focus"** as reviewer-enforced
acceptance gates.

CREDITS: distilled from `mustafakendiguzel/claude-code-ui-agents` (MIT); rewritten in our words; nothing installed.
