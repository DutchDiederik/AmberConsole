## What this changes, and why

<!-- If it changes a value in src/tokens/, say what makes it a bug rather than a
     preference — see CONTRIBUTING.md § Changing a value. Accessibility criteria
     are a valid reason; taste is not. -->

## Gates

```bash
npm test               # lint + check + gas + contrast + build (needs npm i)
npm run test:computed  # computed styles: blink, persistence, corners
npm run test:visual    # screenshots (run locally — CI cannot, font rasterisation)
```

- [ ] `npm test` passes
- [ ] `npm run test:computed` passes
- [ ] `npm run test:visual` passes, and any moved baseline was reviewed by eye and committed
- [ ] **`dist/` is rebuilt and committed** — CI fails the run if `git diff -- dist/` is dirty

## If this adds or changes a component

- [ ] Its own file in `src/components/`, added to the `@import` list in `src/amber-console.css`
- [ ] Header comment: what it is, the minimum markup, and **when not to use it**
- [ ] A live specimen in `docs/guide-controls.html` or `docs/guide-display.html`, with a copyable class string
- [ ] A row in the README class reference **and** in `docs/guide-reference.html`
- [ ] Correct under `prefers-reduced-motion`, `forced-colors: active` and `@media print`
- [ ] 44×44 minimum hit area if interactive, and a `:focus-visible` ring that reads on both `--ac-screen` and inverse video

## If this removes or renames anything public

- [ ] Listed in `DEPRECATIONS.md` with the release that removes it
- [ ] Nothing is removed outside a major version

## Notes

<!-- Screenshots help for anything visual. Both palettes if the change touches
     color: a plasma gas and a CRT phosphor behave differently. -->
