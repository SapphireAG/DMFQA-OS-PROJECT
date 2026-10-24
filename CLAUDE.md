# CLAUDE.md — DMFQ-A Scheduler Lab (multi-page demo website)

> Instructions for Claude Code. Read this file fully before writing any code. When a rule here conflicts with a habit, follow this file.

## 1. What we are building

A **multi-page, demo-ready website** for the Operating Systems final review of
**DMFQ-A — Dynamic Multilevel Feedback Queue scheduling with Aging** (team: Aman Golani, Bhargav Mahanta, Kriday Narula).

The site pitches DMFQ-A as a **tunable scheduling layer for AI infrastructure**. It shows, live in the browser, how the same scheduler behaves in three settings:

1. **CPU processes**: the textbook core study (four-policy ablation).
2. **LLM inference serving**: requests with unknown output length share one GPU through an iteration-level batch of 16 KV-cache slots.
3. **GPU training clusters**: gang-scheduled jobs on 64 GPUs.

It replaces the single Streamlit page from Review 1. Streamlit is **not** used anywhere in this site.

**Audience:** faculty reviewers during a 10-minute live demo, then anyone who opens the link afterwards. Every page must work on a projector at 1920×1080 and on a phone.

**Primary demo moment:** on `/llm`, a reviewer drags the load slider toward saturation and watches the chat replies under FCFS freeze while DMFQ-A keeps them streaming. Then they see the long requests that pay for it.

### Non-goals
- No backend, database, auth or user accounts. The site is a **static export**.
- No real LLM calls. The "chat" on `/llm` is simulated text driven by the simulator's token timeline.
- No fabricated results. Every number shown comes from the in-browser engine or from `research/results/*.csv`. Workloads are labelled **synthetic** wherever results appear.

---

## 2. Tech stack (do not substitute without asking)

| Concern | Choice |
|---|---|
| Framework | Next.js 14+ (App Router) with `output: 'export'` |
| Language | TypeScript, `strict: true` |
| Styling | Tailwind CSS with the design tokens below as CSS variables; no component library |
| Charts | Hand-built SVG components using `d3-scale`, `d3-shape` and `d3-array` only (no Recharts or Chart.js) |
| State | Zustand (one store per page) |
| Simulation | TypeScript port of `research/dmfqa_ai_sim.py`, run in a **Web Worker** (`comlink`) |
| Math | KaTeX for the quantum formula on `/method` |
| Motion | CSS transitions plus `requestAnimationFrame`; Framer Motion only for page transitions |
| Tests | Vitest (engine parity and unit), Playwright (smoke tests per page) |
| Lint/format | ESLint (next/core-web-vitals) + Prettier |
| Deploy | Vercel (static). `npm run build` must produce `out/` with zero errors |

Package manager: `pnpm`. Node 20.

---

## 3. Repository layout

```
/
├─ CLAUDE.md
├─ research/                    # reference implementation — READ ONLY
│  ├─ dmfqa_ai_sim.py           # Python reference simulator (source of truth for rules)
│  ├─ charts.py                 # figures used in the deck/report
│  ├─ export_golden.py          # writes research/golden/*.json fixtures
│  ├─ golden/*.json             # workloads + expected summaries for parity tests
│  └─ results/llm_sweep.csv, gpu_sweep.csv   # 5-seed sweeps shown on /results
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx             # masthead, nav, footer, fonts
│  │  ├─ page.tsx               # 01 Overview
│  │  ├─ lab/page.tsx           # 02 Scheduler Lab (CPU)
│  │  ├─ llm/page.tsx           # 03 LLM Serving Live  ← hero demo
│  │  ├─ gpu/page.tsx           # 04 GPU Cluster
│  │  ├─ results/page.tsx       # 05 Results Explorer
│  │  └─ method/page.tsx        # 06 Method & References
│  ├─ engine/
│  │  ├─ types.ts               # Policy, Request, Job, Config, Summary, TraceEvent
│  │  ├─ rng.ts                 # mulberry32 + lognormal/exponential samplers
│  │  ├─ quantum.ts             # dynQuantum(b, R, ref)
│  │  ├─ cpu.ts                 # CPU discrete-event engine (4 policies)
│  │  ├─ llm.ts                 # iteration-level LLM engine (5 policies)
│  │  ├─ gpu.ts                 # GPU cluster engine (5 policies)
│  │  ├─ metrics.ts             # percentile, summaries
│  │  └─ worker.ts              # comlink-exposed API
│  ├─ components/
│  │  ├─ ui/                    # Button, Slider, Segmented, Stat, Card, Tag, Tooltip
│  │  ├─ charts/                # LineChart, BarChart, Scatter, Gantt, QueueStack, GpuGrid
│  │  └─ editorial/             # Masthead, Kicker, PullQuote, Byline, Figure
│  ├─ styles/tokens.css
│  └─ lib/format.ts             # number/unit formatting (always with units)
├─ tests/ (engine.parity.test.ts, engine.unit.test.ts, e2e/*.spec.ts)
└─ public/ (og-image.png, favicon.svg)
```

---

## 4. Design system: "editorial luxe, engineering-grade"

The look is inspired by fashion-magazine editorial design (high-contrast serif headlines, generous white space, black-and-ivory pages, a single sharp accent). It is applied with the restraint of a technical report.

**Do not** reproduce any magazine's logo, masthead lettering, name or trade dress. The site has its own wordmark, "DMFQ-A", set in the display serif.

### 4.1 Colour tokens (`src/styles/tokens.css`)

```css
:root {
  /* surfaces */
  --paper:      #FAF8F4;  /* ivory page */
  --paper-2:    #F1EDE6;  /* bone: alternate sections, cards */
  --ink:        #111111;  /* headlines, primary text */
  --ink-2:      #3A3835;  /* body text */
  --stone:      #77726A;  /* captions, axis text (≥4.5:1 on paper) */
  --hairline:   #D9D3C7;  /* rules, gridlines, borders */
  /* accents — use sparingly */
  --accent:     #B3122E;  /* editorial red: DMFQ-A, primary CTA, live indicators */
  --accent-ink: #8E0E24;  /* red text on paper */
  --gold:       #B8904A;  /* secondary accent: Aging MLFQ, "premium" details, thin rules only */
  /* policy series (fixed order, never cycled) */
  --s-fcfs:     #A39E93;
  --s-mlfq:     #1C1C1C;
  --s-dynamic:  #4A6FA5;
  --s-aging:    #B8904A;
  --s-dmfqa:    #B3122E;
  /* queue levels */
  --q0: #B3122E; --q1: #4A6FA5; --q2: #1C1C1C; --idle: #E7E2D9;
}
:root[data-theme="dark"] {
  --paper: #0E0E0E; --paper-2: #181716; --ink: #F4F1EA; --ink-2: #D6D1C7; --stone: #A39E93;
  --hairline: #2E2C29; --accent: #E0485F; --accent-ink: #F07186; --gold: #D1AE6C;
  --s-fcfs: #8F8A80; --s-mlfq: #E8E4DC; --s-dynamic: #7C9CCB; --s-aging: #D1AE6C; --s-dmfqa: #E0485F;
  --q0: #E0485F; --q1: #7C9CCB; --q2: #E8E4DC; --idle: #2A2826;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* same as dark block */ } }
```

**Colour rules**
- Pages are about 85% ivory and ink. Red appears on **one thing per view**: DMFQ-A's series, the primary CTA, or a live indicator. Never use it as a background fill for large areas.
- Gold is for hairline rules, small caps kickers and the Aging MLFQ series only.
- The five policy colours are fixed. FCFS is deliberately the quietest (grey). **Every chart also gives each series its own marker shape and a direct label.** The grey and gold have contrast below 3:1 on ivory, so identity must never depend on colour alone.
- The palette passes CVD checks (worst adjacent ΔE ≈ 18 deutan). If you change any series colour, re-validate it.

### 4.2 Typography (Google Fonts, all OFL)

| Role | Font | Use |
|---|---|---|
| Display | **Bodoni Moda** 500–800, optical size on | Page titles, the wordmark, big stat numerals, pull quotes |
| Text / UI | **Inter** 400/500/600 | Body, nav, controls, table text |
| Data | **IBM Plex Mono** 400/500 | Numbers in stats, tables, axis ticks, parameter values |

Scale (desktop): display 88/72, h1 56, h2 36, h3 24, body 18/1.6, small 15, caption 13 (letter-spacing 0.08em, uppercase for kickers). Mobile scales display down to 48.

- Headlines are sentence case, never all caps. Kickers above titles are small caps in `--accent-ink` or `--stone`.
- Numbers always use tabular figures (`font-variant-numeric: tabular-nums`) and always carry a unit (`0.07 s`, `2,290 swaps`, `2.7 h`).

### 4.3 Layout and components
- 12-column grid, max width 1280, 24 px gutters, generous vertical rhythm (multiples of 8; sections separated by 96–128 px).
- **Masthead:** the "DMFQ-A" wordmark centred in Bodoni, a hairline rule below it, then the nav in small caps: `Overview · Scheduler Lab · LLM Serving · GPU Cluster · Results · Method`. It is sticky, collapsing to a thin bar on scroll.
- **Cards:** flat, `--paper-2` background, a 1 px `--hairline` border, no shadows, no rounded corners above 4 px.
- **Stat block:** a big Bodoni numeral, a mono unit, and a one-line Inter caption.
- **Buttons:** primary is ink text on paper with a 1 px ink border, inverting on hover. The CTA variant uses `--accent`. No gradients and no pill shapes.
- **Figures:** each has a numbered caption ("Fig. 3 — …") and a "Synthetic workload · seed 11" source line.
- No stock photos, emoji or generic icons. Diagrams and charts are the imagery.

### 4.4 Charts (all hand-built SVG)
- Thin marks: 2 px lines, 8 px markers, bars ≤ 24 px thick with a 2 px gap. Hairline gridlines in `--hairline`; axis text in `--stone` mono at 13 px.
- **The title states the finding with its number**, e.g. "Aging bounds the stall: 4.2 s vs 8.3 s at 2.2 req/s". It is never a topic label.
- Direct labels sit at the line ends, de-overlapped; a legend appears only when there are more than 5 series.
- Every mark has a hover tooltip (policy, x, value with unit), and every chart has a "View as table" toggle.
- Never use a dual axis. Bars start at zero.
- Animate data changes with 250 ms ease-out tweens. Respect `prefers-reduced-motion`.

### 4.5 Motion
Restrained, as in a magazine: fade and translate (8 px) on section entry, 300 ms. The live simulations animate at 60 fps; everything else is still. Never autoplay anything except the `/llm` hero after the user presses **Run**.

---

## 5. Simulation engine (`src/engine/`)

### 5.1 Rules (port exactly from `research/dmfqa_ai_sim.py`)

Five policies with flags `(multilevel, dynamic, aging)`:

| Policy | multilevel | dynamic quanta | aging |
|---|---|---|---|
| FCFS | ✗ | ✗ | ✗ |
| MLFQ | ✓ | ✗ | ✗ |
| Dynamic MLFQ | ✓ | ✓ | ✗ |
| Aging MLFQ | ✓ | ✗ | ✓ |
| DMFQ-A | ✓ | ✓ | ✓ |

- Three levels, Q0 to Q2. New work enters Q0. Selection is by `(level, seq)`, where `seq` increments whenever an item enters or re-enters a level.
- Quantum: Q0 is fixed. For Q1 and Q2 with dynamic quanta, `q = min(2b, b + floor(b * min(R, ref) / ref))`, where `R` is the number of waiting items excluding the receiver and `ref = 8`.
- Demotion happens when the quantum is exhausted (Q2 re-enqueues at the back of Q2).
- Aging, for waiting items only: if `t - ageStart >= A[level]`, move up one level, assign a fresh quantum and reset `ageStart`. Running items have `ageStart` reset every step.
- Preemption preserves the remaining quantum. It counts as a switch and marks the request `swapped`. Resuming a swapped request costs `t_swap_per_tok_ms × (prompt + generated)`.
- **LLM:** an iteration-level loop. Step time = `12 + 0.6 × batch + 0.02 × prompt` (prefills this step) `+` swap-in costs. Every batched request gains one token per step.
- **GPU:** one-minute steps, gang (all-or-nothing) placement. Multilevel policies fill greedily in priority order (backfill allowed). FCFS is strict FIFO: the head job blocks everything behind it. Restoring after preemption costs 2 minutes.
- **CPU (`cpu.ts`):** the Review 1 C11 rules. Q0 = 4 ms, Q1 base = 8 ms, Q2 base = 16 ms; aging Q1 → Q0 at 24 ms and Q2 → Q1 at 48 ms; four policies (no FCFS). If the team supplies the C11 trace JSON, add a parity test against it.

Do not "improve" the rules. If something looks wrong, flag it in a comment and ask.

### 5.2 Determinism and parity
- `rng.ts` uses mulberry32(seed) with Box–Muller for normal/lognormal and an inverse CDF for exponential. Same seed, same workload, same results, in every browser.
- The JS RNG does **not** reproduce numpy's streams. Parity is tested by feeding the **exact workloads stored in `research/golden/*.json`** to the TS engines and comparing every summary field with a relative tolerance of 1e-6. These tests must pass before any UI work on a page that shows engine output.
- `/results` shows the Python 5-seed sweeps from CSV, labelled as such. Live pages show TS-engine runs, labelled with their seed.

### 5.3 Worker API (comlink)
```ts
runLLM(cfg: LLMConfig, policy: Policy, opts: { rate: number; n: number; seed: number; trace?: boolean }): Promise<{ summary: LLMSummary; frames?: Frame[] }>
runGPU(...); runCPU(...);
sweepLLM(cfg, rates: number[], seeds: number[]): Promise<Row[]>   // for "re-run the sweep" on /results
```
`frames` is a compact per-step snapshot for animation: queue membership, batch slots, tokens emitted, and events (arrive, demote, promote, preempt, finish). A 400-request run must finish in under 300 ms on a mid-range laptop.

---

## 6. Pages: specs and acceptance criteria

### 01 Overview `/`
- Hero: kicker "Operating Systems · Final Review", headline in Bodoni ("Short jobs stay fast. Long jobs are never forgotten."), a one-paragraph dek, and the byline with the three names.
- A three-column "same problem, three resources" table (CPU / LLM serving / GPU cluster: unit of work, quantum, context switch, what starvation looks like).
- Three stat blocks from the CSVs: **~110× lower p99 time to first token** (2.0 req/s), **24.3 h → 2.7 h** longest wait for big GPU jobs, **−29% KV swaps vs MLFQ**. Each stat links to its chart on `/results`.
- A CTA, "Watch it live →", linking to `/llm`.
- ✅ Every number is read from the CSV at build time, not typed.

### 02 Scheduler Lab `/lab`
- An editable process table (arrival, burst) with presets: "Textbook", "Heavy CPU", "Bursty".
- A parameter drawer: quanta, `ref`, aging thresholds.
- Four stacked Gantt charts (MLFQ, Dynamic, Aging, DMFQ-A) on a shared time axis. Bars are coloured by queue level. Promotions show as small gold carets, preemptions as hairline ticks.
- A metrics table: average waiting, turnaround, first response, max continuous READY wait, context switches. The best value in each column is set in bold, never coloured.
- ✅ Changing any input re-runs all four policies in under 100 ms.

### 03 LLM Serving Live `/llm` (hero demo)
- **Controls:** arrival-rate slider (1.2–2.4 req/s, with ticks labelled "calm", "busy" and "saturated"), seed field, **Run**, **Pause**, **Step**, a speed selector (1×, 4×, 16×), **Inject long request** and **Burst of 20 chats**. A policy selector offers one policy or "Race all five" (small multiples).
- **Centre stage:** three horizontal queue lanes (Q0 red, Q1 blue, Q2 ink) with request chips (◆ long, ● chat) sliding between lanes on demote or promote. To the right is a 4×4 grid of KV-cache slots that light up while generating. Swaps flash in gold.
- **Chat strip:** four simulated chat windows (two short chats, two long generations) whose replies stream token by token at the times the engine emits them. Placeholder text comes from a fixed lorem-style corpus labelled "simulated output". When a stream stalls, show a subtle "waiting for GPU…" indicator with a live stall timer.
- **Live meters:** p99 TTFT for short requests, longest stall, KV swaps, tokens/s. The DMFQ-A meter uses the accent.
- **Explainer rail:** three short paragraphs (Demotion, Selective aging, Adaptive quanta) with the formula.
- ✅ At 2.2 req/s, FCFS visibly freezes the short chats and DMFQ-A does not. The meters match a non-animated engine run with the same seed.

### 04 GPU Cluster `/gpu`
- An 8×8 GPU grid: each job is a colour block by level, and hovering shows the job id, GPUs, attained GPU-minutes and wait.
- A queue list with level badges, a simulated clock, and a jobs-per-hour slider (5–7).
- Meters for mean JCT (short jobs), longest wait (long jobs), preemptions and utilisation.
- ✅ Strict-FIFO head-of-line blocking is visible (a 16-GPU job at the head with idle GPUs behind it).

### 05 Results Explorer `/results`
- A data source note: "Python reference simulator, 5 seeds per point, synthetic workloads", with a link to `research/`.
- Charts:
  - LLM: short-request p99 TTFT (bars, 2.0 req/s), long-request p99 latency (bars), the swap–stall trade-off (scatter with labelled points), and longest stall vs load and swaps vs load (lines).
  - GPU: short-job JCT, longest wait and preemptions (bars).
- Filters: policies (checkbox chips) and load (segmented control). Colours never change when filters change.
- A "Key findings" block with the four findings, in the same wording as the report.
- ✅ Each chart has a table view and a CSV download of exactly what is plotted.

### 06 Method & References `/method`
- Algorithm rules, the formula (KaTeX), a parameter table for CPU, LLM and GPU, model assumptions, limitations, and future work (load-aware aging, SLO-aware thresholds, real traces, engine prototype).
- References in IEEE style (13 entries; copy them from the report), each with a link where available.

### Global
- Footer: team names, course, "Synthetic workloads; results from the DMFQ-A simulator", a repo link, and the build date.
- A light/dark toggle in the masthead, plus a 404 page in the editorial style.

---

## 7. Quality bar
- **Accessibility:** WCAG AA contrast for all text; full keyboard operation of every control; every chart has `role="img"`, an `aria-label` equal to its finding title, and a table alternative. Live meters use `aria-live="polite"` at most once per second.
- **Performance:** Lighthouse at least 95 for Performance, Accessibility and Best Practices on `/` and `/results`. JS for `/` is 150 KB gzipped or less. Fonts use `display: swap` with the subsets you need.
- **Responsiveness:** at 375 px wide, simulations switch to a single policy and queue lanes stack vertically. There is no horizontal page scroll.
- **Honesty:** never show a number without its unit and source. Never claim real-hardware results. Label every result surface "synthetic workload".

## 8. Commands
```
pnpm i
pnpm dev                 # localhost:3000
pnpm test                # vitest (engine parity must pass)
pnpm test:e2e            # playwright smoke: each page loads, Run works on /llm
pnpm build && pnpm start # static export in out/
python research/export_golden.py   # regenerate fixtures after changing the Python reference
```

## 9. Build order (work in this sequence; commit after each)
1. Scaffold Next.js, tokens, fonts, masthead and footer, plus empty pages with routing.
2. `engine/` port and **parity tests green** against `research/golden`.
3. Chart primitives (LineChart, BarChart, Scatter, Gantt) with table views, then `/results` from the CSVs.
4. `/llm` hero demo (worker, frames, animation, chat strip, meters).
5. `/gpu`, then `/lab`.
6. `/` Overview (stats wired to the CSVs), then `/method`.
7. Accessibility, responsiveness and performance pass; Playwright smoke tests; Vercel deploy.

## 10. Don'ts
- Don't add Streamlit, a Python server or any API route.
- Don't invent data, testimonials, user counts or benchmark claims.
- Don't use drop shadows, gradients, glassmorphism, neon or emoji. Don't put more than one red element in a view.
- Don't copy magazine logos, mastheads or brand names into the UI.
- Don't change engine rules or parameters to make DMFQ-A look better. The research stance is "evaluate trade-offs; do not assume one scheduler wins".
