# SnipMD Production Release & Tactile Archival Studio

Transition SnipMD from a developer-diagnostic build into a refined, distraction-free production Markdown & screenshot studio defined by a signature **Tactile Archival Studio** aesthetic, an expanded 14-theme creative collection, a thoroughly audited titlebar/UX layout, and rigorous automated + live-browser End-to-End (E2E) verification.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product, UX audit, and verification decisions are incorporated into this plan:

- **Confirmed Decision 1 — Clean Production UI Replacement**: All development and diagnostic UI chrome (`Win11 Release` packager buttons/modals, `+ Simulate Snip` synthetic generators, and raw `localStorage` / Mark-and-Sweep GC telemetry boxes) will be removed from the interface while keeping background persistence and garbage collection running silently.
- **Confirmed Decision 2 — Signature Look: Tactile Archival Studio**: The application's default identity and flagship theme will be **Archival Studio** — inspired by warm unbleached craft paper (`#F5F0E6`), fountain pen iron-gall ink (`#1C1916`), burnished brass accents (`#9A6B26`), editorial serif display headings (`Fraunces`), and crisp hairline drafting borders.
- **Confirmed Decision 3 — Streamlined Studio Drawer**: The collapsible right-hand Studio Drawer will focus exclusively on three creative workflows: **Document Outline**, **Note Assets Gallery** (with native image upload/drop & one-click insertion), and the **Theme Studio & Export** controls (`.md` and self-contained `.html`).
- **Confirmed Decision 4 — Titlebar UX Audit & Ergonomic Refactor**:
  - *Identified Issues in Current Titlebar*:
    1. **Web vs. Native Window Controls**: The `─`, `□`, and `✕` window buttons are always rendered, even in standard web browser viewports where `─` and `✕` are dead no-ops (`isTauriRuntime()` returns false). In production, native window controls will only render when running inside the Tauri desktop shell, while browser users get a clean, full-height workspace toggle without dead window buttons.
    2. **Cramped Action Grouping & Tab Overflow**: Mixing `+`, `Open`, and `Save` directly inside the tab strip without visual separation makes the top bar feel like a debug toolbar. We will organize the 38px production titlebar into three intuitive zones: **Left** (Brand Wordmark + File Actions `New`, `Open`, `Save` + Scrollable Tab Strip with an inline `+` New Tab button at the end of the tabs), **Center** (Flexible Drag/Spacer Region + Subtle Toast status), and **Right** (Segmented View Mode `Editor | Split | Reading` + Quick Theme Picker + `Studio` Drawer toggle).
- **Confirmed Decision 5 — Multi-Stage Rigorous Testing & Live User-Walkthrough E2E**: Before finalizing, we will execute automated unit/integration tests alongside a real headless browser End-to-End (E2E) user walkthrough verifying every button, tab interaction, keyboard shortcut, theme switch, image import/paste, and layout boundary.

---

### 1. Overview & Core Concept

- **What It Does**: SnipMD is a fast, frameless Markdown and visual note-taking workspace where pasted screenshots (`Ctrl+V`), imported images, and dropped files are automatically stored as sidecar assets and rendered inline inside the editor.
- **Target Audience / Persona**: Writers, researchers, architects, and engineers who want the tactile calm of an archival notebook combined with instant inline visual capture.
- **Key Value**: Eliminates developer clutter, dead buttons, and telemetry noise so the user's prose, typography, and visual snips take center stage.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Intuitive Titlebar & Tab Management**: Users can create tabs via the `+` button directly adjacent to the open tabs (or `Ctrl+T`), switch tabs, rename or save notes (`Ctrl+S`), open saved notes (`Ctrl+O`), and switch between **Editor**, **Split**, and **Reading** modes with zero layout shift or dead clicks.
  2. **Focused Writing & Inline Capture**: Pasting an image from the clipboard (`Ctrl+V`), dragging and dropping an image file, or clicking **Import Image** in the Assets panel saves the image to `.assets/` and renders it inline with a 360px height cap (single-click to expand to 100%, double-click for full-resolution Lightbox).
  3. **Studio Drawer Navigation**: Users toggle the right-hand **Studio** drawer (`Ctrl+\`) to jump across headings in the **Document Outline**, browse or insert captured images from the **Assets** gallery, export notes as `.md` or self-contained `.html`, or switch visual atmospheres.

- **Visual Identity & Theme (Tactile Archival Studio)**:
  - *Aesthetic Direction*: **Tactile Archival Studio** — modeled after fine archival stationery, architectural drafting vellum, and bespoke bookbinding.
  - *Default Flagship Palette (`archival`)*:
    - **60% Dominant Neutral Canvas**: Warm craft vellum (`#F5F0E6`) and deep archival folio trim (`#EAE2D3`).
    - **30% Structural Surfaces**: Crisp drafting hairlines (`#D5CBB8`), elevated ivory cards (`#FBF8F2`), and deep walnut-charcoal ink (`#1C1916`) with warm umber muted metadata (`#6E6256`).
    - **10% Accent Budget**: Burnished Antique Brass (`#9A6B26`) for active tab indicators, focus rings, and primary interactive states, paired with Venetian crimson (`#9F2B2B`) and verdigris teal (`#1F6357`) syntax tokens.
  - *Expanded 14-Theme Creative Collection*:
    1. **Archival Studio** *(Signature Default · Light)* — Warm craft paper, iron-gall ink, burnished brass accents.
    2. **Alabaster Daylight** *(Light)* — Pure gallery paper, deep ink prose, teal & crimson accents.
    3. **Warm Parchment** *(Light)* — Solarized drafting vellum, espresso ink, terracotta & olive tokens.
    4. **Kyoto Matcha** *(New · Light)* — Soft bamboo washi paper, ceremonial matcha green, sumi charcoal ink.
    5. **Swiss Editorial** *(New · Light)* — Stark architectural white, exposed grid hairlines, international orange accent.
    6. **Botanical Mist** *(In-Between)* — Soft sage drafting surface, deep pine ink, zero daytime glare.
    7. **Desert Terracotta** *(New · In-Between)* — Sun-baked sandstone canvas, canyon clay & turquoise patina accents.
    8. **Nordic Polar Dusk** *(In-Between)* — Mid-tone Arctic slate, frost-blue accents, aurora syntax palette.
    9. **Tokyo Twilight** *(In-Between)* — Deep indigo-violet twilight, electric periwinkle & coral tokens.
    10. **Velvet Espresso** *(New · Dark)* — Roasted mahogany & dark cocoa study, warm gold & cognac highlights.
    11. **Cyberpunk Solstice** *(New · Dark)* — Deep synthwave night canvas, bioluminescent cyan & electric magenta tokens.
    12. **Linear Spatial** *(Dark)* — Floating pill tabs, obsidian-slate canvas, indigo elevation.
    13. **Obsidian Stealth** *(Dark)* — Matte zinc monochrome, razor hairlines, amethyst accents.
    14. **Carbon OLED** *(Dark)* — True pitch-black `#050507`, phosphor amber & emerald tokens.
  - *Typography & Hierarchy (2+1 Font Rule)*:
    - **Display & Headings (`--font-display`)**: `Fraunces` (expressive editorial serif for headings, brand mark, and rendered manuscript titles).
    - **UI & Prose (`--font-sans`)**: `Plus Jakarta Sans` (clean geometric sans for tabs, buttons, and body legibility).
    - **Editor & Tabular Metrics (`--font-mono`)**: `JetBrains Mono` with `tabular-nums` for Markdown source editing, line numbers, and word/character counts.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Titlebar Ergonomics & Environment-Aware Window Controls**:
  - *Chosen Approach*: Group file actions (`Open`, `Save`) cleanly after the brand mark, place the `+` (New Tab) button right at the trailing edge of the tab list (like a modern browser/editor), and conditionally render the frameless window control buttons (`─`, `□`, `✕`) only when `isTauriRuntime()` is active.
  - *Why*: Fixes the broken UX where clicking Minimize or Close in a web browser did nothing, and makes creating and managing tabs feel natural and muscle-memory friendly.
- **Decision 2 — Removing Dev Controls While Preserving Real Image Import**:
  - *Chosen Approach*: Remove `+ Simulate Snip` and `Win11 Release` from the titlebar and drawer. Add a clean **Import Image** file picker action inside the Assets section alongside native `Ctrl+V` clipboard paste and drag-and-drop.
  - *Why*: Users can paste real screenshots (`Ctrl+V`) or import/drop local images without development simulation buttons cluttering the workspace.

---

### 4. Technical Architecture & Verification Strategy *(Technical Reference)*

- **Architecture & Verification Pipeline Diagram**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SnipMD Production Shell                          │
├──────────────────────────────────────────────────────────────────────────┤
│  TitlebarUI (38px Ergonomic Bar)                                         │
│  ├─ Left: Brand (Fraunces) + File Actions (Open, Save) + Tabs + [+]      │
│  ├─ Center: Drag Region + Contextual Toast Notification                  │
│  └─ Right: View Mode (Editor | Split | Reading) + Theme + Studio Toggle  │
├────────────────────────────────────┬─────────────────────────────────────┤
│  Main Workspace Viewport           │  Studio Drawer (WorkspaceInspector) │
│  ├─ CodeMirror 6 Editor Pane       │  ├─ Document Outline (Headings)     │
│  │  ├─ Paste & Drop Interceptor    │  ├─ Note Assets Gallery + Import    │
│  │  └─ InlineSnipWidget (360px/100)│  ├─ Export Note (.md / .html)       │
│  └─ Rendered Manuscript Preview    │  └─ 14-Theme Creative Studio Grid   │
├────────────────────────────────────┴─────────────────────────────────────┤
│  Editorial Status Bar                                                    │
│  └─ Document Status · Words · Characters · Read Time · Images · Mode     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│             Multi-Agent / Multi-Stage Verification Pipeline              │
├──────────────────────────────────────────────────────────────────────────┤
│  Stage 1: State & Theme Unit Suite │  Verifies all 14 palettes, storage  │
│                                    │  migration, GC, and tab lifecycles  │
│  Stage 2: UX & DOM Audit Agent     │  Verifies zero dev buttons, titlebar│
│                                    │  layout, and keyboard accessibility │
│  Stage 3: Live Browser E2E Suite   │  Runs real user walkthrough: tabs,  │
│                                    │  modes, outline jump, asset import, │
│                                    │  theme switching, and export flows  │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Rigorous Verification & E2E Testing Plan**:
  1. **Automated Unit & State Tests**: Validate `EditorStoragePersistence`, all 14 `THEME_PALETTES` token definitions, default `archival` fallback, and virtual filesystem asset promotion/garbage collection.
  2. **Simulated User Walkthrough & E2E Browser Test**: Launch the running application and programmatically interact with the DOM as a real user to verify:
     - **Zero Dev Clutter**: Confirm `#win11ReleaseBtn`, `#simSnipBtn`, and `#manualGcBtn` are completely absent.
     - **Titlebar Intuitiveness**: Verify tab creation (`+`), tab switching, dirty state indicators, tab closing (`×` and middle-click), `Open` modal flow, `Save` flow, and responsive overflow behavior.
     - **View Modes (`Editor`, `Split`, `Reading`)**: Verify switching across all three modes updates the layout cleanly and preserves scroll/content state.
     - **Inline Image & Lightbox UX**: Verify clicking an inline image toggles the 360px cap vs. 100% full height, and clicking Lightbox/Zoom opens and closes the high-res modal cleanly via button or `Escape`.
     - **Studio Drawer & 14 Themes**: Verify cycling through all 14 themes updates CSS custom properties on `document.documentElement` and synchronizes the titlebar selector and studio cards.
