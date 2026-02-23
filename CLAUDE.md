# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

길드전 작전상황실 (Guild War Operations Room) — a mobile-optimized web tool for coordinating guild war strategies in a Korean RPG game. Hosted on GitHub Pages (`senare.github.io`).

## Architecture

- **Single-page app** with no build system, bundler, or framework. Everything runs as vanilla HTML/CSS/JS.
- **`index.html`**: Contains all UI markup, styles (inline `<style>`), and application logic (inline `<script>`). This is the entire app.
- **`gamedata.js`**: Defines the `HEROES` array (character roster). Loaded before `index.html`'s script via `<script src>`. Also exports empty `PETS` and `ACC` arrays (pet/accessory lists are hardcoded in `index.html` instead).
- **`images/`**: Hero/pet portrait PNGs. Filenames are Korean character names (e.g., `루디.png`). Referenced dynamically via template strings like `` `images/${name}.png` ``.
- **Backend**: Google Apps Script (GAS) endpoint. The app fetches all data (members, enemies, strategies) on login and sends POST requests for writes (record results, add enemies, add strategies). Requests use `mode: "no-cors"`.

## Key Data Flow

1. **Login**: Fetches full dataset from GAS (`members`, `enemies`, `strategies` arrays) → stored in `globalData`
2. **Session**: Uses `localStorage` with a 60-minute timeout, auto-extended on user interaction
3. **Deck composition**: Each deck has 5 hero slots with equipment (2 weapons, 2 armor, 1 accessory per hero) + 1 pet slot
4. **Equipment format**: Stored as `SetName(MainOption)` strings (e.g., `선봉장(치명타 확률)`)
5. **Deck serialization**: Heroes with gear exported as `HeroName(w1/a1/w2/a2/acc), ...` comma-separated string

## Development

No build, lint, or test commands. To develop:
- Open `index.html` directly in a browser, or serve via any static file server
- The GAS backend URL is hardcoded in the `GAS_URL` constant in `index.html`

## Conventions

- All UI text is in Korean
- Abbreviations for gear sets/options are mapped in the `getAbbr()` function
- Two parallel deck state systems exist: `myDeckState` (player's battle deck) and `adminDeckState` (admin strategy registration deck), both sharing the same rendering via `renderInteractiveDeck(mode)`
