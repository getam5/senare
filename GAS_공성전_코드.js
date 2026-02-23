/**
 * ============================================================
 *  길드전 작전상황실 — Google Apps Script (전체 코드)
 *  이 파일을 GAS 프로젝트에 전부 붙여넣으세요.
 * ============================================================
 *
 *  [Google Sheets 시트 구조]
 *
 *  ── 시트명: "멤버" ──
 *  A열: 닉네임   B열: 키
 *  (1행 헤더: 닉네임 | 키)
 *
 *  ── 시트명: "적군" ──
 *  A열: 이름   B열: 수비덱
 *  (1행 헤더: 이름 | 수비덱)
 *
 *  ── 시트명: "공략" ──
 *  A열: 대상   B열: 공격덱   C열: 펫   D열: 진형   E열: 핵심템   F열: 메모   G열: 작성자
 *  (1행 헤더: 대상 | 공격덱 | 펫 | 진형 | 핵심템 | 메모 | 작성자)
 *
 *  ── 시트명: "전투기록" ──
 *  A열: 타임스탬프   B열: 닉네임   C열: 대상   D열: 내덱   E열: 상대덱   F열: 펫   G열: 진형   H열: 결과
 *  (1행 헤더 자동 생성)
 *
 *  ── 시트명: "공성전" ──
 *  A열: 닉네임   B열: 요일   C열: 덱   D열: 펫   E열: 진형   F열: 메모   G열: 스킬파이프라인
 *  (1행 헤더: 닉네임 | 요일 | 덱 | 펫 | 진형 | 메모 | 스킬파이프라인)
 *  ※ 닉네임 + 요일 조합 기준 UPSERT (기존 행 덮어쓰기)
 *
 *  ── 시트명: "강림원정대" ──  ← 신규 추가
 *  A열: 닉네임   B열: 보스
 *  C열: 1팀덱    D열: 1팀펫   E열: 1팀진형   F열: 1팀메모   G열: 1팀파이프라인
 *  H열: 2팀덱    I열: 2팀펫   J열: 2팀진형   K열: 2팀메모   L열: 2팀파이프라인
 *  M열: 클리어 (true/false 문자열)
 *  ※ 닉네임 + 보스 조합 기준 UPSERT (기존 행 덮어쓰기)
 *  ※ 보스 종류: 테오, 카일, 연희, 카르마, 파괴신
 * ============================================================
 */

var SHEET_ID = "1s0M6vsJPqDPQUpKh7pBjGJvOD4_MMD4uQuJT_4P3Cbw"; // URL의 /d/와 /edit 사이의 긴 문자열

// ── doGet: 전체 데이터 반환 ──
function doGet(e) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  const members    = readMembers(ss);
  const enemies    = readEnemies(ss);
  const strategies = readStrategies(ss);
  const siege      = readSiegeSheet(ss);
  const advent     = readAdventSheet(ss);

  return ContentService
    .createTextOutput(JSON.stringify({ members, enemies, strategies, siege, advent }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doPost: action 분기 처리 ──
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss   = SpreadsheetApp.getActiveSpreadsheet();

  switch (data.action) {
    case "record":
      recordBattle(ss, data);
      break;
    case "add_strategy":
      addStrategy(ss, data);
      break;
    case "add_enemy":
      addEnemy(ss, data);
      break;
    case "save_siege":
      saveSiege(ss, data);
      break;
    case "save_advent":
      saveAdventData(ss, data);
      break;
  }

  return ContentService.createTextOutput("OK");
}

// ============================================================
//  읽기 함수
// ============================================================

// 멤버 읽기 → [{nick, key}, ...]
function readMembers(ss) {
  const sheet = ss.getSheetByName("멤버");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    result.push({ nick: String(rows[i][0]), key: String(rows[i][1]) });
  }
  return result;
}

// 적군 읽기 → [{name, deck}, ...]
function readEnemies(ss) {
  const sheet = ss.getSheetByName("적군");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    result.push({ name: String(rows[i][0]), deck: String(rows[i][1]) });
  }
  return result;
}

// 공략 읽기 → [{target, attack, pet, formation, items, note, author}, ...]
function readStrategies(ss) {
  const sheet = ss.getSheetByName("공략");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    result.push({
      target:    String(rows[i][0]),
      attack:    String(rows[i][1]),
      pet:       String(rows[i][2]),
      formation: String(rows[i][3]),
      items:     String(rows[i][4]),
      note:      String(rows[i][5]),
      author:    String(rows[i][6])
    });
  }
  return result;
}

// 공성전 읽기 → [{nickname, day, deck, pet, formation, memo, pipeline}, ...]
function readSiegeSheet(ss) {
  const sheet = ss.getSheetByName("공성전");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    result.push({
      nickname:  String(rows[i][0]),
      day:       String(rows[i][1]),
      deck:      String(rows[i][2]),
      pet:       String(rows[i][3]),
      formation: String(rows[i][4]),
      memo:      String(rows[i][5]),
      pipeline:  String(rows[i][6])
    });
  }
  return result;
}

// 강림원정대 읽기 → [{nickname, boss, team1Deck, team1Pet, ...}, ...]
function readAdventSheet(ss) {
  const sheet = ss.getSheetByName("강림원정대");
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    result.push({
      nickname:      String(rows[i][0]),
      boss:          String(rows[i][1]),
      team1Deck:     String(rows[i][2]),
      team1Pet:      String(rows[i][3]),
      team1Formation:String(rows[i][4]),
      team1Memo:     String(rows[i][5]),
      team1Pipeline: String(rows[i][6]),
      team2Deck:     String(rows[i][7]),
      team2Pet:      String(rows[i][8]),
      team2Formation:String(rows[i][9]),
      team2Memo:     String(rows[i][10]),
      team2Pipeline: String(rows[i][11]),
      cleared:       String(rows[i][12])
    });
  }
  return result;
}

// ============================================================
//  쓰기 함수
// ============================================================

// 전투 결과 기록 (전투기록 시트에 append)
function recordBattle(ss, data) {
  let sheet = ss.getSheetByName("전투기록");
  if (!sheet) {
    sheet = ss.insertSheet("전투기록");
    sheet.appendRow(["타임스탬프", "닉네임", "대상", "내덱", "상대덱", "펫", "진형", "결과"]);
  }
  sheet.appendRow([
    new Date(),
    data.nickname   || "",
    data.enemyName  || "",
    data.myDeck     || "",
    data.enemyDeck  || "",
    data.pet        || "",
    data.formation  || "",
    data.result     || ""
  ]);
}

// 공략 추가 (공략 시트에 append)
function addStrategy(ss, data) {
  let sheet = ss.getSheetByName("공략");
  if (!sheet) {
    sheet = ss.insertSheet("공략");
    sheet.appendRow(["대상", "공격덱", "펫", "진형", "핵심템", "메모", "작성자"]);
  }
  sheet.appendRow([
    data.targetEnemy || "",
    data.attackDeck  || "",
    data.pet         || "",
    data.formation   || "",
    data.keyItems    || "",
    data.note        || "",
    data.author      || ""
  ]);
}

// 적군 추가 (적군 시트에 append)
function addEnemy(ss, data) {
  let sheet = ss.getSheetByName("적군");
  if (!sheet) {
    sheet = ss.insertSheet("적군");
    sheet.appendRow(["이름", "수비덱"]);
  }
  sheet.appendRow([
    data.enemyName   || "",
    data.defenseDeck || ""
  ]);
}

// 공성전 저장 (닉네임 + 요일 기준 UPSERT)
function saveSiege(ss, data) {
  let sheet = ss.getSheetByName("공성전");
  if (!sheet) {
    sheet = ss.insertSheet("공성전");
    sheet.appendRow(["닉네임", "요일", "덱", "펫", "진형", "메모", "스킬파이프라인"]);
  }

  const rows = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === data.nickname && String(rows[i][1]) === data.day) {
      foundRow = i + 1; // 시트는 1-indexed
      break;
    }
  }

  const rowData = [
    data.nickname  || "",
    data.day       || "",
    data.deck      || "",
    data.pet       || "",
    data.formation || "",
    data.memo      || "",
    data.pipeline  || ""
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, 7).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}

// 강림원정대 저장 (닉네임 + 보스 기준 UPSERT)
function saveAdventData(ss, data) {
  let sheet = ss.getSheetByName("강림원정대");
  if (!sheet) {
    sheet = ss.insertSheet("강림원정대");
    sheet.appendRow([
      "닉네임", "보스",
      "1팀덱", "1팀펫", "1팀진형", "1팀메모", "1팀파이프라인",
      "2팀덱", "2팀펫", "2팀진형", "2팀메모", "2팀파이프라인",
      "클리어"
    ]);
  }

  const rows = sheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === data.nickname && String(rows[i][1]) === data.boss) {
      foundRow = i + 1; // 시트는 1-indexed
      break;
    }
  }

  const rowData = [
    data.nickname      || "",
    data.boss          || "",
    data.team1Deck     || "",
    data.team1Pet      || "",
    data.team1Formation|| "",
    data.team1Memo     || "",
    data.team1Pipeline || "",
    data.team2Deck     || "",
    data.team2Pet      || "",
    data.team2Formation|| "",
    data.team2Memo     || "",
    data.team2Pipeline || "",
    data.cleared       || "false"
  ];

  if (foundRow > 0) {
    sheet.getRange(foundRow, 1, 1, 13).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
}
