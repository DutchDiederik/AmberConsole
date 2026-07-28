# Contributing

Thanks for taking a look. This is a genre framework with unusually strict rules, so the most useful
thing to read first is [the six laws](README.md#the-six-laws). Almost every review comment on a
change here comes back to one of them.

## Setup

The main workflow needs **nothing installed** — the build is pure Node (18+).

```bash
node scripts/build.mjs      # or: npm run build
npm run dev                 # build + watch + serve docs/ at :4173
```

Two optional gates need dev dependencies:

```bash
npm install
npm run lint
npm run test:visual
```

## Before opening a pull request

```bash
npm test             # check + contrast + build, all zero-dependency
npm run lint         # stylelint: ac- BEM pattern       (needs npm install)
npm run test:visual  # 14 Playwright captures           (needs npm install)
```

`npm test` runs the prohibitions gate (no second hue, no svg, no emoji, no transitions in
components), recomputes the contrast table against both palettes, and rebuilds `dist/`.

`dist/` is committed on purpose: the demo pages link it directly and GitHub Pages serves them
without a build step. Rebuild before you commit or the demos will be stale.

## Rules that are not negotiable

These are enforced by `scripts/check-prohibitions.mjs`, which fails the build:

- **No second hue.** No red, no green, no "success" color. Danger is blink plus inverse video.
  Literal hex is allowed only in `tokens/colors.css`, `tokens/effects.css` and `base/print.css`.
- **No `transition` in `src/components/`.** State changes are instant — a redrawn screen has no
  in-between frames. The only motion in the system is the `steps(1)` blink, the block cursor, and the
  two hardware simulations.
- **No icon set, no emoji, no SVG, no imagery.** Ornament is typographic: `✳ █ ▮ ▯ ▲ ▼ ◄ ►` and
  box-drawing characters, typeset in the terminal font.
- **No `border-radius` above 8px** and no third font family.

And two the linter cannot check:

- **No hairlines on structure.** Every stroke is `var(--border-w)`. `.ac-badge` is the single
  legitimate 1px border, because a chip is not structure.
- **Casing is semantic.** ALL CAPS for system text, Title Case for operator soft keys. Preserve the
  split in every example you write.

## Changing a value

Don't, unless you can show it is a bug. The numbers in `src/tokens/` came from the source design
system and several look odd on purpose — `padding: 8px 24px 20px` on `.ac-tab` is a physical-key
illusion, `min-width: 130px` on `.ac-btn--pad` is a gloved-finger target, the `1px` border on
`.ac-badge` is deliberate.

If you do change one, list it in `CHANGELOG.md` with the reason. Accessibility criteria are a valid
reason; taste is not.

## Adding a component

Derive it from the existing vocabulary. If you cannot justify it from the six laws, it does not
belong here. Every new component needs:

- its own file in `src/components/`, added to the `@import` list in `src/amber-console.css`
- a header comment stating what it is, the minimum markup, and **when not to use it**
- a specimen in `docs/guide.html` §06 or §07 with a copyable class string and that same caveat
- a row in the README class reference
- correct behavior under `prefers-reduced-motion`, `forced-colors: active` and `@media print`
- a 44×44 minimum hit area if it is interactive, and a `:focus-visible` ring

## Accessibility is not optional

This aesthetic actively fights accessibility, which is exactly why the gates exist. Anything
interactive needs a visible focus ring on both `--screen` and inverse-video backgrounds. Anything
that signals state must do so without relying on motion or on a single color intensity. Run
`npm run contrast` if you touch the palette, and paste the regenerated table into the README.

## Packaging

Two things in `package.json` look wrong and are not:

- **`devDependencies` never reach a consumer.** npm does not install the devDependencies of a
  dependency, so `playwright` and `stylelint` cost an app that installs `amber-console` exactly
  nothing. They are needed only by `npm run lint` and `npm run test:visual`; `build`, `check` and
  `contrast` are pure Node and need no install at all.
- **`sideEffects` lists the JS builds as well as `*.css`, and must keep doing so.**
  `import "amber-console/js"` is a bare side-effect import — the module auto-initializes and its
  exports go unused — so a bundler told the file is side-effect free will drop it silently. Trim
  that array to `["*.css"]` and the optional behavior disappears from production builds with no
  error anywhere.

## Fonts

Regular weight only, both faces. There is no bold in this system — `base/reset.css` sets
`font-weight: 400` on the headings and the laws put hierarchy in size, intensity and inverse video.
Silkscreen does publish a 700, and fetching it shipped 10.5kb of woff2 for a weight nothing ever
requests. `scripts/fetch-fonts.mjs` asks for regular only; don't add `:wght@400;700` back.

## Commits

Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`), scoped where it helps
(`feat(components): …`). Keep the slices reviewable.
