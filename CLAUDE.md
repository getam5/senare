# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

길드전 작전상황실 (Guild War Operations Room) — a mobile-optimized web tool for coordinating guild war strategies in a Korean RPG game. Hosted on GitHub Pages (`senare.github.io`).

## Architecture

- **Single-page app** with no build system, bundler, or framework. Everything runs as vanilla HTML/CSS/JS.
- **`index.html`**: Contains all UI markup, styles (inline `<style>`), and application logic (inline `<script>`). This is the entire app.
- **`gamedata.js`**: Defines `HEROES` (87개), `PETS` (39개), `ACC` (70개 장신구 전 등급) 배열. `index.html`의 `DATA_PETS`/`GEAR_ACCESSORIES`가 이 배열을 직접 참조함.
- **`images/heros/`**: Hero portrait PNGs. Filenames match the `HEROES` array in `gamedata.js` (e.g., `루디.png`).
- **`images/pets/`**: Pet portrait PNGs. Filenames match the `PETS` array in `gamedata.js`.
- **`images/accesories/`**: Accessory (ring) PNGs. Filenames match the `ACC` array in `gamedata.js`. (Note: folder name is intentionally `accesories`, one 's'.)
- Image paths are resolved via helper functions `heroImg(n)`, `petImg(n)`, `accImg(n)` defined at the top of the `<script>` block.
- **`supabase_schema.sql`**: SQL for creating all required Supabase tables. Run once in Supabase SQL Editor to initialize the database.
- **Backend**: Supabase (`https://zobzzgvbqmkistvdlexi.supabase.co`). Uses the Supabase REST API (`/rest/v1/`) directly from the browser with the anon public key. No server-side code.

## Supabase Tables

| 테이블 | 설명 | UPSERT 키 |
|---|---|---|
| `members` | 닉네임, 키(SHA-256 해시), role(`admin`/`user`), status(`active`/`pending`/`rejected`), must_change_pw | — |
| `enemies` | 적군 이름 + 수비덱 | — |
| `strategies` | 공략 (대상, 공격덱, 펫, 진형, 메모 등) | — |
| `battle_records` | 전투 결과 기록 (result, enemy_name, enemy_deck, my_deck) | — |
| `siege` | 공성전 요일별 덱/파이프라인 | `nickname + day` |
| `advent` | 강림원정대 보스별 1팀/2팀 덱 | `nickname + boss` |

- `advent` 테이블은 snake_case 컬럼(`team1_deck`, `team1_pet` 등)으로 저장되며, 로그인 시 JS에서 camelCase(`team1Deck`, `team1Pet` 등)로 변환하여 `globalData.advent`에 저장된다.
- 비밀번호는 Web Crypto API(`crypto.subtle.digest('SHA-256', ...)`)로 클라이언트에서 해시한 후 저장한다.

## Key Data Flow

1. **Login**: 6개 테이블을 `Promise.all`로 병렬 조회 → `globalData`에 저장. `siege`/`advent`는 해당 닉네임 행만 필터링. `battle_records`는 `result, enemy_name, enemy_deck, my_deck` 4개 컬럼만 조회.
2. **Session**: Uses `localStorage` with a 60-minute timeout, auto-extended on user interaction.
3. **Deck composition**:
   - 길드전(myBattle/attack/enemy): 각 3 hero slots + 1 pet slot
   - 공성전(siege): 5 hero slots + 1 pet slot + 스킬 파이프라인
   - 강림원정(advent1/advent2): 각 5 hero slots + 1 pet slot + 스킬 파이프라인
4. **Equipment format**: Stored as `SetName(MainOption)` strings (e.g., `선봉장(치명타 확률)`)
5. **Deck serialization**: `serializeHero(x)` → `HeroName(w1/a1/w2/a2/acc)[statKey:val;statKey:val]`. `parseHeroToken(p)` for reverse. 기어 없으면 괄호 생략, 능력치 없으면 `[...]` 생략.
6. **Write operations**: All writes use `async/await` + `sbFetch()` helper. UPSERT는 `?on_conflict=col1,col2` + `Prefer: resolution=merge-duplicates` 헤더 사용.

## API Helper

```js
sbFetch(method, table, body, params, extraHeaders, signal)
```
- `method`: `"GET"` / `"POST"` / `"PATCH"`
- `params`: URL query string (e.g., `"?select=*&nickname=eq.홍길동"`)
- `extraHeaders`: e.g., `{"Prefer": "return=minimal"}` for INSERT, `{"Prefer": "resolution=merge-duplicates,return=minimal"}` for UPSERT

## Deck State Management

모든 덱은 `emptyHero()` 팩토리 함수로 생성된 객체 배열로 관리:
```js
const emptyHero = () => ({name:"", w1:"", a1:"", w2:"", a2:"", acc:"", stats:{}});
```

**상태 변수:**
- `myDeckState` — 길드전 내 공격팀 (Array(3))
- `adminDeckState` — 공략 등록용 덱 (Array(3))
- `enemyDeckState` — 적군 추가용 덱 (Array(3))
- `siegeDeckState` — 공성전 현재 요일 덱 (Array(5), `siegeData[day].deck` 참조)
- `adventData[boss].team1.deck` / `.team2.deck` — 강림 팀별 덱 (Array(5))

**`getDeckState(mode)` → 위 상태 변수 반환** (mode: `myBattle`/`attack`/`enemy`/`siege`/`advent1`/`advent2`)

**`renderDeckByMode(mode)` → 해당 렌더 함수 호출**

## Hero/Pet Selector Modal

단일 모달(`#selectorModal`)을 모든 덱 모드가 공유:

```js
// 타입을 변수로 추적 (DOM 텍스트 의존 안 함)
let currentModalType = 'HERO';

openSelector(mode, type, idx)  // currentModalType = type 먼저 세팅
filterItems()                   // currentModalType 사용 (버그 방지)
```

- **해제 버튼**: 검색어 없을 때 목록 맨 앞에 표시. HERO → 슬롯 전체 `emptyHero()` 초기화. PET → 빈 문자열.
- **중복 방지**: `getUsedHeroes(mode)` — 현재 편집 슬롯(`tempHeroIndex`) 제외한 나머지 슬롯의 영웅 목록 반환. 해당 영웅들은 그리드에서 `opacity:0.3; pointer-events:none` 처리.
- 적군 모드(`enemy`)도 동일한 모달과 해제 버튼 기능 사용.

## Hero Stats (능력치)

영웅별 목표 능력치 설정 기능:
```js
const STAT_FIELDS = [
  {key:'atkPhys', label:'공격력(물리)', short:'물공'},
  {key:'atkMagic', label:'공격력(마법)', short:'마공'},
  // ... 총 12개
];
```
- `openStatsModal(mode, idx)` → 모달 열기
- `confirmStats()` → `state[idx].stats = {...}` 저장 후 재렌더
- `renderStatsBtn(mode, idx, stats)` → 📊 버튼 + 설정된 능력치 목록 표시

## Battle Stats (승/패 통계)

- **필터링**: 현재 선택된 적군 덱 + 내 공격 덱이 모두 일치하는 기록만 집계
- **`deckKey(deckStr)`**: 영웅 이름만 추출해 정규화 (장비·능력치 무시하여 유연한 매칭)
- **갱신 시점**: `selectEnemy()`, `renderInteractiveDeck('myBattle')`, `record()` 호출 시
- 적군 미선택 또는 내 덱 미구성 시 통계 바 숨김

## Siege & Advent: 파이프라인

스킬 순서를 기록하는 파이프라인:
- 저장 형식: `HeroName(S1) → HeroName(S2) → ...`
- `siegeData[day].pipeline` / `adventData[boss].teamN.pipeline` 에 `{hero, skill}` 객체 배열로 보관
- 공성전은 `skillPipeline` 전역 변수 경유, 강림은 `adventData` 직접 접근

## Full HD 반응형 레이아웃

`@media (min-width: 1024px)` 블록:
- **`#siteHeader`**: sticky, 브랜드 + 탭 + 사용자정보 한 줄 배치
- **`.guild-panel-row`**: 길드전 좌(타겟/공략) | 우(내덱+결과) (5fr:6fr)
- **`.admin-panel-row`**: 공략등록 | 적군추가 (1fr:1fr)
- **`.siege-panel-row`**: 공성전 덱 | 파이프라인 (3fr:2fr)
- **`.advent-teams-row`**: 강림 1팀 | 2팀 (1fr:1fr)
- `.hdr-brand`: 모바일 `display:none` → 데스크탑 `display:block`
- `.info-row`: 진형 select + 메모 input 한 줄 배치 (flex)

## Permissions

- **모든 로그인 사용자**: 길드전 공략/적군 관리(`#toggleAdminBtn`) 접근 가능
- **관리자(`role=admin`)만**: ⚙️ 관리 탭(멤버 승인/추방/권한변경)

## Conventions

- All UI text is in Korean
- Abbreviations for gear sets/options are mapped in the `getAbbr()` function
- `async` write functions capture `ev.target` before first `await` to avoid button reference issues: `onclick="fn(event)"` → `async function fn(ev)` → `const btn = ev.target`
- 모달 HTML은 파일 하단에 위치 (`#selectorModal`, `#gearModal`, `#accModal`, `#heroStatsModal`, `#pwChangeModal`)

## Development

No build, lint, or test commands. To develop:
- Open `index.html` directly in a browser, or serve via any static file server
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants are at the top of the `<script>` block in `index.html`
