# The Carnival — YSWS

Build an extension, plugin, or widget for an editor you actually use. This repository contains the website for The Carnival program.

## Overview

Participants develop practical, open‑source plugins or extensions that improve their workflow or add something fun and unique to the program. 

### Eligibility and requirements

- The extension must be a QOL improvement and/or solve a real problem faced by the author
- The extension must have at least 5 users
- The extension must be open‑source
- The extension must work properly in the editor of choice
- Provide clear instructions on how to build and run the extension
- The extension should be unique — not a remake of an existing extension

### Example ideas

- Browser: detect spicy text in comment boxes and suggest chill rephrases with short “why” notes
- Figma: generate a 12–15s animated teaser with captions and a swipe sound
- VS Code: turn TODOs/tests into quests with XP, streaks, and rarity drops
- Bring Your Own: anything that shortens time‑to‑wow

### Supported editors

VS Code, Chrome/Firefox, Neovim, Figma, KiCad, and many more.

### Grants

For every approved hour spent working on your extension, you can receive a $5 grant.

---

## Tech stack

- React + TypeScript
- Vite
- Tailwind CSS

## Local development

Requirements:
- Node 18+
- pnpm (recommended) or npm

Install dependencies and run the dev server:

```bash
pnpm install
pnpm dev
```

## Build

Create a production build and preview it locally:

```bash
pnpm build
pnpm preview
```

The static site output is written to `dist/`.

## Deploy

This is a static Vite site. Any static host works.