# Honorarios design system

Visual direction for the Arc app. It documents the identity of the original Honorarios app (Stellar, 2026) so it can be rebuilt here. Swiss precision with one object that carries the idea: a receipt with a torn-off tax stub.

## Thesis

A payment arrives and part of it is set aside for tax. Every screen shows that split as an object, never as a pie chart: one dark bar for what reaches the wallet, one short orange bar for the reserve, and a receipt whose perforated stub reads "TAX RESERVE 8%". Warm paper, black ink, one orange accent used only for the reserve.

## Tokens

```css
:root {
  --paper: #F3F1EC; --surface: #FAF9F6; --sunk: #E9E6DF;
  --ink: #1B1A17; --ink-2: #5E5A52; --ink-3: #8D887E;
  --rule: rgba(27, 26, 23, .10); --rule-strong: rgba(27, 26, 23, .22);
  --accent: #D2461E; --accent-ink: #FAF9F6;   /* the reserve, and only the reserve */
  --ok: #3D6B4F; --warn: #9A6A12;
  --shadow: 0 1px 0 rgba(27, 26, 23, .04), 0 12px 32px -18px rgba(60, 48, 30, .28);
  --r: 2px;
  --f-sans: "Archivo", ui-sans-serif, sans-serif;
  --f-mono: "IBM Plex Mono", ui-monospace, monospace;
  --t-xs: .64rem; --t-s: .8rem; --t-b: 1rem; --t-m: 1.25rem; --t-l: 1.563rem;
  --t-xl: 1.953rem; --t-2xl: 3.052rem; --t-3xl: 4.768rem;   /* Major Third, 1.25 */
  --ease: cubic-bezier(.23, 1, .32, 1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #141412; --surface: #1C1B18; --sunk: #252420;
    --ink: #F1EEE7; --ink-2: #C9C4BA; --ink-3: #A39E94;
    --rule: rgba(236, 233, 226, .14); --rule-strong: rgba(236, 233, 226, .32);
    --accent: #E8633A; --accent-ink: #141412; --ok: #7FAE8F; --warn: #D9A94A;
    --shadow: 0 12px 32px -18px rgba(0, 0, 0, .6);
  }
}
```

Fonts from Google Fonts: `Archivo:wdth,wght@62..125,400..700` and `IBM Plex Mono:wght@400;500`. Body is Archivo at `font-stretch: 96%`. Display headings use `font-stretch: 88%`.

Icons: Phosphor, Light weight only (`@phosphor-icons/react`, `weight="light"`), one size per context. No emojis, no other icon set.

## Typography rules

- Every amount, hash, address, date and percentage is IBM Plex Mono with `font-variant-numeric: tabular-nums lining-nums slashed-zero`.
- The hero figure is huge: `clamp(3.2rem, 1.5rem + 6.5vw, 6.5rem)`, line-height .88, letter-spacing -.05em, mono, with its unit ("USDC" or "S/") small and grey beside it. Next to a 12px label that is a 6-8x jump; keep it.
- Labels: mono 500, `--t-xs`, uppercase, letter-spacing .08em, `--ink-3`. Example: `INVOICE · E001-1`, `TAX RESERVE · 8% ON NEW RECEIPTS`.
- Headings: Archivo 600, letter-spacing -.018em (display -.035em), `text-wrap: balance`. Sentence case.

## The signature object: the stub receipt

```css
.receipt { background: var(--surface); border: 1px solid var(--rule-strong); border-radius: var(--r); box-shadow: var(--shadow);
  display: grid; grid-template-columns: 1fr 56px; position: relative }
.receipt .body { padding: 24px; display: grid; gap: 18px; min-width: 0 }
.receipt .stub { border-left: 1px dashed var(--rule-strong); display: flex; align-items: center; justify-content: center; padding: 20px 0 }
.receipt .stub span { writing-mode: vertical-rl; transform: rotate(180deg); font: 500 var(--t-xs) var(--f-mono); letter-spacing: .1em;
  text-transform: uppercase; color: var(--accent) }
/* two half-moon notches where the perforation meets the edges */
.receipt::before, .receipt::after { content: ""; position: absolute; right: 48px; width: 16px; height: 8px; background: var(--paper);
  border: 1px solid var(--rule-strong); z-index: 1 }
.receipt::before { top: -1px; border-top: 0; border-radius: 0 0 8px 8px }
.receipt::after { bottom: -1px; border-bottom: 0; border-radius: 8px 8px 0 0 }
.receipt.torn .stub { transform: translate(14px, 6px) rotate(3deg) }   /* after payment the stub tears off */
```

Inside the receipt, top to bottom: label `INVOICE · <ref>` with a status badge on the right (`PAID` in `--ok`, `AWAITING PAYMENT` neutral), the concept in `--t-m`, the amount in mono `--t-2xl` with "USDC" small, the split bar, a two-row legend, and a footer with the transaction link in mono.

Split bar: 8px tall, 2px gap. Net segment `--ink` with `flex: <100 - rate>`, reserve segment `--accent` with `flex: <rate>`. Each segment grows with `transform: scaleX()` from the left, 420ms, reserve delayed 70ms.

Legend rows: square 8px swatch, icon, label ("To your wallet · 92%", "Tax reserve · 8%"), amount right-aligned in mono.

## Layout

- Max width 1120px, gutter 16px on phones, 48px from 768px.
- Payment page: two columns from 960px, 7fr / 5fr, gap 64px. Left: who is charging, the due amount as the hero figure, a definition list (Service, Receipt, Pay to, Network) with 1px rules, then the three steps (Connect wallet, Get USDC, Sign payment). Right: the stub receipt and one sentence explaining the split.
- Dashboard: hero row (reserve as the hero figure with its verdict tag next to it; stats list on the right: net received this month, payments this month, reserve rate), then a two-column grid of blocks separated by 1px hairlines (`gap: 1px; background: var(--rule-strong)`), then the receipts list as dense rows (ref, concept, amount right-aligned, actions).
- Hairlines only, 1px, `--rule` or `--rule-strong`. Radius 2px everywhere. No cards with big radius, no colored left borders, no gradients.
- Spacing has rhythm: 2px inside the bar, 8-18px inside blocks, 48-128px between sections.

## Components

- Button: Archivo 500 `--t-s`, padding 14px 20px, radius 2px, solid `--ink` with `--paper` text. Ghost variant: transparent with `--rule-strong` border. Hover opacity .88, active `scale(.97)`, focus-visible 2px `--accent` outline offset 2px, disabled opacity .4. Loading shows a 12px spinner inside the button.
- Field: label above in `--t-xs` mono uppercase, input on `--surface`, 1px `--rule-strong`, radius 2px, padding 12px 14px; numeric inputs in mono.
- Badge: mono `--t-xs` uppercase, 1px border in currentColor, padding 6px 8px. `ok` green, `warn` amber, `accent` orange.
- Verdict tag next to the reserve: `--warn` border and text when the reserve falls short of the estimated prepayment, neutral otherwise.
- Meter (threshold): 8px track on `--sunk` with 1px border; fill `--ink`, `--warn` once over the threshold.
- Notice for the read-only sample account: 1px `--rule-strong` box, eye icon, `--ink-2` text, link to the account on the explorer.
- Skeleton: `--sunk` blocks pulsing to .55 opacity every 1.2s. Never print 0 while loading.

## Motion

- Entrance: blocks rise (opacity 0 to 1, translateY 6px) in 250ms with `--ease`, staggered 60ms per block; list rows 30ms each, capped at 8.
- The split bar grows with scaleX as above. After a successful payment the stub tears off (`.receipt.torn`), 260ms.
- Only transform and opacity. `prefers-reduced-motion: reduce` turns every animation off.

## Brand mark

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" role="img" aria-label="Honorarios">
  <g transform="rotate(-90 12 12)" fill="none" stroke-width="4">
    <circle cx="12" cy="12" r="8.5" pathLength="100" stroke="#1B1A17" stroke-dasharray="90 10" stroke-dashoffset="-9"/>
    <circle cx="12" cy="12" r="8.5" pathLength="100" stroke="#D2461E" stroke-dasharray="6 94" stroke-dashoffset="-1"/>
  </g>
</svg>
```

A ring that is mostly ink with a small orange arc: the payment and its reserve. Next to it, "Honorarios" in Archivo 600, letter-spacing -.02em. In dark mode the ink stroke uses `--ink`.

Top bar: mark and name on the left; network label on the right in mono `--t-xs` uppercase (`ARC MAINNET` or `ARC TESTNET`), with a small orange dot.

## Voice

Plain English for a freelancer who is not an engineer. Short sentences. Name the money: "to your wallet", "set aside for tax", "only you can move it". No crypto jargon in headings. Every number carries its unit.
