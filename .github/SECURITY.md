# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 2.x | Yes |
| 1.x | No — upgrade path is in [DEPRECATIONS.md](../DEPRECATIONS.md) |

## What the attack surface actually is

Worth stating plainly, because it is small and it shapes what is worth reporting.

Amber Console is a stylesheet plus two **optional**, independently loadable client-side JavaScript
modules. It has no server component, no build-time plugin, and no runtime dependencies — nothing is
installed alongside it. Neither JS module makes a network request, and neither writes HTML: the DOM
work is `createElement`, `setAttribute` and `classList`, with no `innerHTML`, `eval` or
`new Function` anywhere in `src/`.

The only state it persists is a handful of display and simulation preferences under the `ac.sim.*`
prefix in `localStorage`, and every read is validated against a fixed set of known values before it
reaches a selector or an attribute. All access is wrapped in `try`/`catch`, because `localStorage`
throws in private mode and in sandboxed `file://` frames.

Realistic report classes, then:

- A stored preference that reaches the DOM without being validated first.
- A CSS value that can escape its custom property and alter a rule it should not.
- A `@font-face` or asset reference that resolves somewhere unintended.
- Anything in `scripts/` that reads or writes outside the repository.

Not in scope: the demo pages in `docs/` invent all their data — no fixture there represents a real
system, account or credential.

## Reporting

Report privately through
[GitHub Security Advisories](https://github.com/DutchDiederik/AmberConsole/security/advisories/new).
Please do not open a public issue for a vulnerability first.

Include the version, the browser, and the smallest page that reproduces it. You will get an
acknowledgement within a week. If the report is confirmed, the fix ships in the next release and the
advisory credits you unless you would rather it did not.
