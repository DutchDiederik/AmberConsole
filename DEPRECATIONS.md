# Deprecations & Migration

Everything Amber Console has taken away, everything it is going to take away, and what to write
instead. If you are upgrading from 1.x, this is the only file you need.

**Short version:** the 1.x **token names** are gone. The 1.x **attributes and JavaScript calls** all
still work. So the upgrade only breaks for people who overrode custom properties — if you linked the
stylesheet and wrote your own markup, 2.0 is a drop-in and there is nothing on this page for you.

---

## The policy

| Stage | What it means |
| --- | --- |
| **Deprecated** | Still works, still tested, still shipped. Announced in the `CHANGELOG` and listed here with the release that removes it. |
| **Removed** | Gone from the code. Only ever happens in a **major** version. |

Two rules this project holds itself to:

1. **Nothing is removed in a minor or patch release.** A deprecation announced in 2.x is removed in
   3.0 at the earliest, so you always have a whole major cycle to migrate.
2. **A deprecated feature is not left to rot.** While it is listed as deprecated it keeps working as
   documented — it does not quietly degrade first.

There is a deliberate exception to rule 2 for the custom properties below, and it is explained where
it happens: they were removed outright rather than aliased, because a silently-ignored alias turned
out to be worse than an honest absence.

---

## Status at a glance

| Feature | Status | Deprecated in | Removed in | Use instead |
| --- | --- | --- | --- | --- |
| Unprefixed tokens — `--ink`, `--gap`, … | **Removed** | — | **2.0** | `--ac-ink`, `--ac-gap`, … |
| `--amber-*` ramp tokens | **Removed** | 1.x | **2.0** | `--ac-emit-100` … `--ac-emit-30` |
| `--gas-*` halo tokens | **Removed** | 1.x | **2.0** | `--ac-halo-1` … `--ac-halo-4` |
| `data-ac-style-smear` | **Removed** | — | **2.0** | Nothing — the smear is automatic now |
| `data-ac-gas="neon" \| "amber"` | Deprecated | 2.0 | 3.0 | `data-ac-tech` + `data-ac-emitter` |
| `data-ac-gas-toggle` | Deprecated | 2.0 | 3.0 | `[data-ac-display]` radios |
| `AmberConsole.afterglow(el)` | Deprecated | 2.0 | 3.0 | `AmberConsoleEffects.afterglow(el)` |

---

## Removed in 2.0

### Every custom property is now `--ac-*` prefixed

**This is the only breaking change in 2.0, and it fails silently.** Setting `--ink: lime` does not
error, does not warn, and does not work — the framework reads `--ac-ink` and never looks at `--ink`.

```css
/* 1.x — silently ignored in 2.0 */
:root { --ink: #ffb000; --radius: 0; --leading: 1.4; }

/* 2.0 */
:root { --ac-ink: #ffb000; --ac-radius: 0; --ac-leading: 1.4; }
```

**To migrate: put `ac-` in front of every Amber Console property you set.** Values, cascade behaviour
and per-palette resolution are all unchanged — this is a rename and nothing more.

#### Why they were not kept as aliases

They were, briefly, and it was worse than useless. Nothing in the framework *read* the old names, so
`--ink: red` did nothing **and said nothing** — the hardest kind of bug to diagnose. An absent name at
least behaves consistently: it does nothing, everywhere, for one obvious reason.

The rename itself was not tidiness. `dist/amber-console.layer.css` exists so the framework can be
embedded in an app that owns the page, and **cascade layers do not protect custom properties** — an
unlayered `:root { --radius: 12px }` in the host beats a layered one. A host that happened to use
`--radius`, `--gap` or `--cols` silently re-cornered every button, panel, dialog, input, toggle and
meter in the framework. `--gap` and `--cols` were near-certain collisions in any real codebase.

`stylelint` now enforces the prefix (`custom-property-pattern`), so the next token cannot go bare.

#### `--ac-gap` and `--ac-cols` need renaming at the call site

These two are **consumer-set**: `.ac-row`, `.ac-stack` and `.ac-grid` read them off *your* element,
not off `:root`. So there is no framework-level value to bridge, and no alias was possible even in
principle. Rename them where you write them:

```html
<!-- 1.x -->
<div class="ac-row" style="--gap: 12px">
<div class="ac-grid" style="--cols: 3">

<!-- 2.0 -->
<div class="ac-row" style="--ac-gap: 12px">
<div class="ac-grid" style="--ac-cols: 3">
```

#### `--amber-*` and `--gas-*`

Deprecated in 1.x, removed here with the rest.

| 1.x | 2.0 |
| --- | --- |
| `--amber-100` … `--amber-30` | `--ac-emit-100` … `--ac-emit-30` |
| `--gas-1` … `--gas-4` | `--ac-halo-1` … `--ac-halo-4` |

`--amber-*` named a *hue* rather than a *ramp*, which stopped being defensible once the catalog held
a lavender and a pink. `--gas-*` named a *gas* when what it carried was the halo — the light
scattered in the glass — which is a property of the emitter, not the fill.

> **The full token list** is in [README.md § Tokens](README.md). Every single one begins `--ac-`,
> which is what makes the check below reliable: in 2.0, *any* Amber Console property without that
> prefix is wrong.

### `data-ac-style-smear`

The scroll smear no longer has a switch. It is simply part of what `amber-console.effects.js` does:
on wherever the persistence simulation is running and the engine flag permits it, off everywhere
else.

It was a style flag that could only ever be on under CRT — every selector implementing it is scoped
to `.ac-afterglow`, and a plasma cell is driven continuously and has nothing that trails. So it spent
most of its life disabled and explaining why, which is a third axis of state for a preference nobody
was expressing. `prefers-reduced-motion` still stops the smear, which was the only accessibility case
the flag was actually carrying.

**Nothing breaks if you leave the attribute in your markup** — it is simply inert. Delete it at your
convenience.

The *mechanism* it was written for did not go with it. A style flag can still declare the frame class
it is a no-op without, and its switch will disable itself and say why — `data-ac-style-retrace` is
the flag that uses it now.

---

## Deprecated — still works, removed in 3.0

### `data-ac-gas="neon" | "amber"`

The 1.x one-attribute palette switch. **It still selects a palette**, so a 1.x page keeps rendering.

```html
<!-- Deprecated, works through 2.x -->
<html data-ac-gas="neon">
<html data-ac-gas="amber">

<!-- 2.0 -->
<html data-ac-tech="plasma" data-ac-emitter="neon">
<html data-ac-tech="crt"    data-ac-emitter="p3">
```

**The name was the bug.** `amber` was never a gas — it is P3, a CRT phosphor — and a control that
calls a phosphor a gas is exactly the confusion 2.0 exists to remove. An emitter is only meaningful
inside its technology, which is why naming a palette now takes two attributes: `data-ac-tech` is what
is making light at all, `data-ac-emitter` is which gas or which phosphor inside it.

> #### It is a partial alias, and this is the one behavioural difference worth knowing
>
> `data-ac-gas` carries the **colour** but not the **persistence**:
>
> | Markup | Ink | Tail |
> | --- | --- | --- |
> | `data-ac-tech="crt" data-ac-emitter="p3"` | `#ffae1e` | **25 ms** — P3's real decay |
> | `data-ac-gas="amber"` | `#ffae1e` | **105 ms** — the generic default |
>
> So a 1.x page gets P3's amber with the generic plasma tail rather than P3's own. Visually it is a
> slightly longer afterglow and nothing more; nothing breaks. It is not worth fixing in the
> deprecated path, because the two-attribute form is right there — but if your page leans on
> persistence timing, migrate it rather than relying on the alias.

Migrating also **unlocks the other nine palettes**. `data-ac-gas` can only ever reach these two and
will not grow to reach more.

### `data-ac-gas-toggle`

The old two-position GAS button hook. Still cycles the same two palettes through the new attributes,
so a page using it stays correct while it migrates. It cannot reach the rest of the catalog.

Replace it with one `[data-ac-display]` radio per palette — the catalog is markup, not a table inside
the JavaScript, so you can ship your own rows without touching the module:

```html
<input type="radio" name="ac-display" data-ac-display
       data-ac-tech="crt" data-ac-emitter="p3" data-ac-sims="crt">
```

### `AmberConsole.afterglow(el)`

A forwarding shim. Ghosting moved to `amber-console.effects.js`, because it is an *effect* and
`amber-console.js` is *behaviour*.

```js
AmberConsole.afterglow(row);         // deprecated, still works
AmberConsoleEffects.afterglow(row);  // 2.0
row.remove();
```

The shim delegates when the effects module is present and does nothing when it is not — the same
no-op it always was with the simulation switched off. Call it **before** you remove or empty the
element: a detached node has no rect, so there is nowhere to pin the ghost.

---

## Checking your own codebase

**Find bare tokens** — every line this prints sets or reads an Amber Console property that 2.0 no
longer sees:

```bash
grep -rnE '\-\-(ink|fill|screen|radius|leading|gap|cols|stroke|emit|halo|glow|space|type|tracking|font|border-w|decay|persist|drive|edge|on-fill|mesh|blink|flicker|smear|ghost|afterimage|amber|gas)\b' .
```

**Or list the property names themselves**, which also catches any bare token the list above misses.
Your own custom properties show up here too, so read it as a shortlist rather than a verdict:

```bash
grep -rhoE '\-\-[a-z][a-z0-9-]*' . | grep -v '^--ac-' | sort -u
```

**Find the deprecated hooks** — these all still work today and go in 3.0:

```bash
grep -rn 'data-ac-gas\|AmberConsole\.afterglow\|data-ac-style-smear' .
```

---

## See also

- **[System Guide § 09 DEPRECATED](https://dutchdiederik.github.io/AmberConsole/docs/guide-deprecations.html)**
  — this page on the site, as a chapter of the guide. Same content; this file is the canonical copy
  and the one that ships in the npm package.
- [CHANGELOG.md](CHANGELOG.md) — the full reasoning behind each change, per release.
- [README.md](README.md) — the token reference, the display catalog and the component classes.
- [RATIONALE.md](RATIONALE.md) — why the palettes are derived rather than picked.
