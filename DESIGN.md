---
name: Agent HQ
description: The owner's command center for an autonomous AI agent company. Sci-fi HUD, dark only.
colors:
  bg: "#03050B"
  panel: "rgba(9,16,31,.82)"
  panel-2: "#0D1729"
  panel-3: "#13213A"
  sheet: "#07101F"
  field: "rgba(4,8,18,.8)"
  line: "rgba(56,189,248,.16)"
  line-2: "rgba(56,189,248,.38)"
  ink: "#E6F1FF"
  ink-2: "#8FA3BF"
  placeholder: "#6F84A3"
  cyan: "#22D3EE"
  cyan-ink: "#67E8F9"
  magenta: "#E879F9"
  atlas-violet: "#A78BFA"
  atlas-violet-ink: "#C4B5FD"
  good: "#34D399"
  good-ink: "#6EE7B7"
  warn: "#FBBF24"
  warn-ink: "#FCD34D"
  bad: "#F43F5E"
  bad-ink: "#FDA4AF"
typography:
  display:
    fontFamily: "'Orbitron', 'Exo 2', system-ui, sans-serif"
    fontWeight: 700
    letterSpacing: "0.14em"
  brand:
    fontFamily: "'Orbitron', 'Exo 2', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    letterSpacing: "0.12em"
  panel-title:
    fontFamily: "'Orbitron', 'Exo 2', system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.16em"
  label:
    fontFamily: "'Orbitron', 'Exo 2', system-ui, sans-serif"
    fontSize: "10.5px"
    fontWeight: 600
    letterSpacing: "0.16em"
  body:
    fontFamily: "'Exo 2', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  body-sm:
    fontFamily: "'Exo 2', system-ui, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
  data:
    fontFamily: "'Share Tech Mono', ui-monospace, Consolas, monospace"
    fontSize: "12px"
  kpi:
    fontFamily: "'Share Tech Mono', ui-monospace, Consolas, monospace"
    fontSize: "28px"
    lineHeight: 1.05
    fontFeature: "tnum"
rounded:
  sm: "3px"
  md: "4px"
  full: "50%"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "22px"
components:
  button-primary:
    backgroundColor: "rgba(34,211,238,.16)"
    textColor: "{colors.cyan-ink}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "rgba(34,211,238,.26)"
  button-small:
    height: "36px"
    padding: "0 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
  button-kill:
    backgroundColor: "rgba(244,63,94,.12)"
    textColor: "{colors.bad-ink}"
    rounded: "{rounded.md}"
    height: "44px"
  icon-button:
    backgroundColor: "rgba(4,8,18,.8)"
    textColor: "{colors.cyan-ink}"
    rounded: "{rounded.md}"
    size: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  pill:
    textColor: "{colors.ink-2}"
    typography: "{typography.data}"
    rounded: "{rounded.sm}"
    padding: "1px 7px"
---

# Design System: Agent HQ

The source of truth is the `:root` block and styles in `office.html`. This file describes them so new screens
stay on-brand. If the two disagree, the code wins and this file gets updated.

## Overview

**Creative North Star: "The Command Deck"**

Agent HQ is the bridge of a starship that runs a company. The owner looks at a live operations display: near-black
space, cyan neon readouts, glass panels with corner brackets, and data in a terminal mono face. It should feel like
mission control, never like a generic SaaS dashboard. The sci-fi look is the owner's choice and is fixed: refinements
stay inside it, and changing it needs his approval.

It is an **Operate** surface: the owner checks status and makes decisions (approve, dismiss, plan, stop). Readability
and scanning come before effects. The theme lives in precise details (brackets, glows, uppercase spaced labels),
not in motion or decoration that slows him down.

**Key Characteristics:**
- Dark only (`color-scheme: dark`). There is no light mode.
- One accent: cyan. Magenta and violet are rare secondary accents. Green / amber / red only mean status.
- Three type voices: Orbitron for labels and titles, Exo 2 for reading, Share Tech Mono for numbers and data.
- Calmer HUD (2.19.0, the owner's choice): the same world with fewer glows, no background grid, more space and bigger reading text.
- Two places: **HQ** (the whole company) and **projects you step into**. A rail on the far left holds HQ plus one tile per approved
  project; entering a project gives it its own menu, colour and pages. Ideas are not projects: an idea becomes a project when the
  owner approves Serge's plan.
- Decisions first: **Today** answers "what waits for me, who is blocked, who is working, what finished", grouped by project. Every
  waiting item carries its own buttons, so the owner rarely needs the chat.
- Atlas lives in a drawer that opens from any page; opened inside a project he is told which project the owner means.

## Colors

A cold, deep-space palette: near-black blue backgrounds, translucent navy panels, cyan as the single "live" color.

- **Space Black** (`bg #03050B`): page background with one soft radial glow top right in the current accent.
- **Project tints** (2.19.0): inside a project the accent tokens (`--cyan`, `--cyan-ink`, `--line`, `--line-2`, `--acc-soft`, `--acc-soft2`,
  `--acc-glow`) are re-set from the project's hue (`HUES[id % 8]`: 318, 210, 172, 24, 280, 196, 100, 340, chosen to avoid the status
  hues). Status colours never change. The 3D office keeps its own colours.
- **Navy Glass** (`panel`, `panel-2`, `panel-3`, `sheet`): panels, rows, meters' track, the dossier sheet. Layer by going lighter, not by adding shadows.
- **Hairline Cyan** (`line`, `line-2`): borders and dividers. `line` for structure, `line-2` for controls and emphasis.
- **Starlight** (`ink #E6F1FF`): main text. **Instrument Grey** (`ink-2 #8FA3BF`): secondary text, labels, metadata.
- **Reactor Cyan** (`cyan #22D3EE`, `cyan-ink #67E8F9`): primary actions, active state, focus, links, panel titles, the "now" step. Use `cyan-ink` for text on dark (better contrast), `cyan` for borders, dots and glows.
- **Status** (`good`, `warn`, `bad` + their `-ink` text variants): only for meaning (done, needs attention, error/stop). Each is used as a border at ~50-70% alpha, a fill at ~8-12% alpha, and its `-ink` color for text.
- **Atlas Violet** (`#A78BFA` / `#C4B5FD`): only for Atlas's messages in the chat.
- **Verdict pills** have their own mapping: approve = green, smaller version = teal `#5EEAD4`, needs more data = amber, reject = red.

## Typography

- **Orbitron** (display): always UPPERCASE with wide tracking (0.08-0.16em). Panel titles 11.5px/700, labels 9.5-10.5px/600, buttons 10-11.5px/700, brand 20px/800. Never use it for sentences.
- **Exo 2** (body): 14px base, 13-13.5px in lists, chat and dossier text. Line height 1.4-1.65. Headings in the dossier 16-20px, `text-wrap: balance`. Long reading text max 70ch.
- **Share Tech Mono** (data): times, counts, money, IDs, pills, log lines, system line. KPI numbers 28px with tabular numerals and a faint cyan text glow.
- Minimum size: 12px for anything the owner reads (9.5-10.5px only for uppercase Orbitron labels).

## Layout

- **Shell** (`.shell`): rail 76px | menu 248px | main (max 1500px, padding 22-28px). Sticky top bar: breadcrumb, mode tag, spend chip
  (opens Spend & limits), Ask Atlas, Stop all agents; it never wraps (the breadcrumb shortens). Under 860px the menu hides and the rail
  stays.
- **HQ pages:** Today (`#pg-today`), Ideas (4 columns: new pitches, being researched, judged, plans), Office & team (3D office +
  agent panel, Ops below: Mission / Activity / Crew), Learning, Spend & limits (KPI row + limits).
- **Project pages** (`#contentTop`, rendered by `projectHtml`): Overview (hero with monogram, progress line, "waits for you" box,
  team / episodes / latest here), Episodes (filter steps Scripts to review > Approved > Ready to upload > Published > Retired, then
  the episode cards), Voice & characters (animated only), Reference board, Plan.
- **Order of importance:** what waits for the owner > blocked > working > done. Anything the owner must act on appears on Today, in
  its project's "waits for you" box and as a badge on the rail and menu.
- Narrow columns stack an item's buttons under its text (`.stack .item`). Text always wraps inside its box (`overflow-wrap:anywhere`,
  pills wrap); nothing may stick out of its box (the owner checks for this).
- Panel header (`.ch`): 44px tall, 10-14px padding, bottom hairline.
- Spacing steps: 6, 8, 10, 12, 14, 22px. Tight inside groups (6-8px), 12-14px between groups.

## Elevation & Depth

Flat and luminous, not shadowed. Depth comes from:
1. Lighter navy layers (`panel` → `panel-2` → `panel-3`).
2. Glass: panels are translucent with `backdrop-filter: blur(6px)`.
3. **Glow** instead of drop shadows: active and hovered elements get a cyan `box-shadow: 0 0 10-18px rgba(34,211,238,.15-.35)`. Status-colored glow for status buttons (kill switch).
4. Overlays: dark scrim `rgba(2,4,10,.78)`, sheet with a wide soft cyan glow.

## Shapes

- Corners are nearly square: 4px for panels, buttons, inputs; 3px for pills, tags and segmented buttons. Circles only for dots, avatars and pipeline nodes.
- **Corner brackets** are the signature: every `.card` has a 12px cyan L-bracket top-left and bottom-right (`::before` / `::after`, 2px). New panels must use `.card` to get them.
- Status rows use a 2px left border in the status color (feed items, inbox, Atlas messages, notes). This is part of this HUD world.

## Components

- **Rail tile (`.tile`):** 48px rounded square with the project's 2-letter monogram in its hue; amber count badge; the current one
  has a ring and a bar on its left edge. Hover shows the name (`.rtip`).
- **Entering a project (`.enter`):** two doors slide open over the project's monogram and name (0.8 s), then the page settles in.
  Skipped when reduced motion is on.
- **Waiting item (`.item`):** title, one line of context, who it's from (`.avz` dot in the agent's visor colour), and its own buttons.
  Today shows 4 per group and a "See all" button. The browser tab title shows the total, e.g. `(3) Agent HQ`.
- **Status pill (`.stp`):** Working (green), Waiting for you (amber), Blocked (red), Idle (grey). The same four words and colours
  are used on the 3D office name plates, Crew, the agent panel and project teams (`agentState`).
- **Progress line (`.prog`):** the project's steps; done = filled accent, now = ringed.
- **Panel (`.card` + `.ch` header + `.cb` body):** the container for everything. Title in Orbitron uppercase cyan with an optional glowing dot (`.blip`) and a mono `small` counter.
- **Primary button (`.btn`):** cyan border, 16% cyan fill, Orbitron uppercase, 46px tall (`.sm` 36px). Hover: fill to 26% + cyan glow. Disabled: 45% opacity, no glow.
- **Ghost button (`.btn.ghost`):** for "dismiss/reject"; turns red on hover.
- **Mini button (`.mini`):** amber, 32px, for inbox actions.
- **Kill switch (`.kill`):** red when running ("STOP"), green when stopped ("RESUME").
- **Icon button (`.tools button`, `.x`):** 44x44px, outlined, cyan icon.
- **Segmented control (`.seg`):** small Orbitron buttons; selected = `aria-pressed="true"`, cyan border and fill.
- **Pills / tags:** mono, uppercase, 3px radius, colored border + 8% fill.
- **Inputs:** dark field `rgba(4,8,18,.8)`, `line-2` border, 4px radius; focus = cyan border + 2px cyan ring.
- **Meters:** 4px track, cyan-to-magenta gradient fill with glow; amber-to-red when "hot".
- **Pipeline steps:** 3 columns; done = green, now = cyan with glow and a pulsing node.
- **Chat:** Atlas left (navy, violet left border, violet "ATLAS" label), owner right (cyan tint). Suggestion chips under the messages.
- **Toast:** bottom center, navy, cyan glow.
- **3D office:** the hand-drawn canvas, kept as it was (the owner likes it), with a scanline overlay and a slow scan sweep (only when
  reduced motion is off). Each agent's name plate shows the status word; what they're doing shows when zoomed in, selected or
  blocked. A red ring pulses at a blocked agent's feet; agents who wait for the owner walk to his office ("N WAITING FOR YOU HERE").
  Clicking one fills the agent panel (`#agentDetail`) with what they do, what they did last and the button that unblocks them.
- **Atlas drawer (`.drawer`):** slides in from the right over a scrim; shows what the conversation is "about" (a project or an
  agent) with a way back to the whole company. A violet dot on Ask Atlas means an unread reply.
- Icons: inline SVG, 18px, 2px stroke, round caps, `currentColor`.

## Do's and Don'ts

**Do**
- Build new UI from the existing classes and `:root` tokens. Add a token before adding a new hard-coded color.
- Keep every clickable target at least 44px on main controls (32-36px only for secondary inline buttons).
- Keep the visible focus ring (`:focus-visible` 2px `cyan-ink`). Scrollable panels with only text get `tabindex="0"` and a `role="region"` label.
- Pressable things shrink slightly on press (`scale(.97)`, 160ms); scrollbars and text selection use the cyan palette.
- Wrap any looping animation in `prefers-reduced-motion: no-preference`, and keep UI transitions short (~180ms, color/border/shadow only).
- Use mono + tabular numerals for every number the owner compares.
- Check new screens at 1920, 1280, 900 and 375px wide.

**Don't**
- Don't add a light mode, a second accent color, or change fonts without asking the owner.
- Don't use status colors (green/amber/red) as decoration.
- Don't use big drop shadows, gradients on text, or rounded "SaaS" cards (radius > 4px).
- Don't put Orbitron on body sentences or anything over ~6 words.
- Don't animate things the owner uses all the time (tabs, chat send, buttons) beyond a quick color/glow change.
