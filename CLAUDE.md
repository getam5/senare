# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

길드전 작전상황실 (Guild War Operations Room) — a mobile-optimized web tool for coordinating guild war strategies in a Korean RPG game. Hosted on GitHub Pages (`senare.github.io`).

## Architecture

- **Single-page app** with no build system, bundler, or framework. Everything runs as vanilla HTML/CSS/JS.
- **`index.html`**: Contains all UI markup, styles (inline `<style>`), and application logic (inline `<script>`). This is the entire app.
- **`gamedata.js`**: Defines the `HEROES` array (character roster). Loaded before `index.html`'s script via `<script src>`. Also exports empty `PETS` and `ACC` arrays (pet/accessory lists are hardcoded in `index.html` instead).
- **`images/`**: Hero/pet portrait PNGs. Filenames are Korean character names (e.g., `루디.png`). Referenced dynamically via template strings like `` `images/${name}.png` ``.
- **`supabase_schema.sql`**: SQL for creating all required Supabase tables. Run once in Supabase SQL Editor to initialize the database.
- **Backend**: Supabase (`https://zobzzgvbqmkistvdlexi.supabase.co`). Uses the Supabase REST API (`/rest/v1/`) directly from the browser with the anon public key. No server-side code.

## Supabase Tables

| 테이블 | 설명 | UPSERT 키 |
|---|---|---|
| `members` | 닉네임 + 키(비밀번호) | — |
| `enemies` | 적군 이름 + 수비덱 | — |
| `strategies` | 공략 (대상, 공격덱, 펫, 진형, 메모 등) | — |
| `battle_records` | 전투 결과 기록 | — |
| `siege` | 공성전 요일별 덱/파이프라인 | `nickname + day` |
| `advent` | 강림원정대 보스별 1팀/2팀 덱 | `nickname + boss` |

- `advent` 테이블은 snake_case 컬럼(`team1_deck`, `team1_pet` 등)으로 저장되며, 로그인 시 JS에서 camelCase(`team1Deck`, `team1Pet` 등)로 변환하여 `globalData.advent`에 저장된다.

## Key Data Flow

1. **Login**: 5개 테이블을 `Promise.all`로 병렬 조회 → `globalData`에 저장. `siege`/`advent`는 해당 닉네임 행만 필터링(`?nickname=eq.{nick}`)
2. **Session**: Uses `localStorage` with a 60-minute timeout, auto-extended on user interaction
3. **Deck composition**: Each deck has 5 hero slots with equipment (2 weapons, 2 armor, 1 accessory per hero) + 1 pet slot
4. **Equipment format**: Stored as `SetName(MainOption)` strings (e.g., `선봉장(치명타 확률)`)
5. **Deck serialization**: Heroes with gear exported as `HeroName(w1/a1/w2/a2/acc), ...` comma-separated string
6. **Write operations**: All writes use `async/await` + `sbFetch()` helper. UPSERT는 `?on_conflict=col1,col2` + `Prefer: resolution=merge-duplicates` 헤더 사용

## API Helper

```js
sbFetch(method, table, body, params, extraHeaders, signal)
```
- `method`: `"GET"` / `"POST"`
- `params`: URL query string (e.g., `"?select=*&nickname=eq.홍길동"`)
- `extraHeaders`: e.g., `{"Prefer": "return=minimal"}` for INSERT, `{"Prefer": "resolution=merge-duplicates,return=minimal"}` for UPSERT

## Development

No build, lint, or test commands. To develop:
- Open `index.html` directly in a browser, or serve via any static file server
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants are at the top of the `<script>` block in `index.html`

## Conventions

- All UI text is in Korean
- Abbreviations for gear sets/options are mapped in the `getAbbr()` function
- Two parallel deck state systems exist: `myDeckState` (player's battle deck) and `adminDeckState` (admin strategy registration deck), both sharing the same rendering via `renderInteractiveDeck(mode)`
- Button click handlers that perform async writes (addStrategy, addNewEnemy, record, saveSiege, saveAdvent) receive `event` explicitly: `onclick="fn(event)"` → `async function fn(ev)` — `ev.target` is captured before the first `await`
