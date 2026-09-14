# Gradious

A full-screen procedural SVG gradient studio inspired by Justin Jay Wang's [Methods for random gradients](https://justinjay.wang/methods-for-random-gradients/).

Gradious includes deterministic layered-radial and heightmap generators, OKLCH color constraints, URL-based sharing, ambient and interactive motion, direct editing, and dependency-free SVG, React, and CSS exports.

## Development

```bash
pnpm install
pnpm dev
```

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

Generator changes that alter a seed's output require a new module under `src/core/generators/vN`. Existing versions remain immutable so shared links continue to reproduce their original output.
