# Tab Shelf - Chrome Extension 구현 계획

## 개요

비활성 탭을 도메인 규칙에 따라 자동으로 닫거나 Shelf에 보관하는 Chrome 확장 프로그램.
탭 수백 개를 열어두는 연구자 워크플로우에 최적화.

---

## 핵심 개념

| 용어 | 설명 |
|------|------|
| **Shelf** | 자동으로 닫힌 탭을 보관하는 공간. 도메인별로 그룹핑되어 나중에 복원 가능 |
| **Domain Rule** | 도메인별로 동작 방식(close / shelf / ignore)과 비활성 시간을 지정하는 설정 |
| **Blacklist** | `close` 모드 도메인. Shelf에 저장 없이 그냥 닫힘 (Gmail, Calendar 등) |

---

## 기능 목록

### 1. Domain Rule 엔진

- 도메인별 3가지 모드 지정:
  - `close` — 비활성 후 Shelf 저장 없이 탭 닫기
  - `shelf` — 비활성 후 Shelf에 저장하고 탭 닫기
  - `ignore` — 건드리지 않음 (기본값)
- 도메인별 비활성 시간 개별 설정 (분 단위)
- 규칙 없는 도메인은 `ignore` 처리
- 고정(Pinned) 탭은 모든 규칙에서 제외

**기본 제공 규칙 (사용자가 수정 가능)**

| 도메인 | 모드 | 비활성 시간 |
|--------|------|------------|
| mail.google.com | close | 2시간 |
| calendar.google.com | close | 2시간 |
| arxiv.org | shelf | 4시간 |
| www.nature.com | shelf | 4시간 |
| www.sciencedirect.com | shelf | 4시간 |
| www.biorxiv.org | shelf | 4시간 |

---

### 2. Shelf (탭 보관함)

- 닫힌 탭을 도메인별로 그룹핑하여 보관
- 각 항목에 저장되는 정보:
  - URL, 페이지 제목, 도메인, favicon, 닫힌 시각
- 보관 기간 설정 가능 (기본 30일), 기간 초과 시 자동 삭제
- 저장 방식: `chrome.storage.local` (디스크 저장, RAM 영향 없음)
- 탭 하나씩 복원: 현재 창의 새 탭으로 열리고 Shelf에서 항목 삭제
- 도메인 전체 복원: `chrome.windows.create`로 새 창을 열어 해당 도메인 탭 전부 복원 후 그룹 삭제
- 검색: Shelf 내 제목/URL 필터링

---

### 3. 팝업 UI

브라우저 툴바 아이콘 클릭 시 표시.

```
┌─────────────────────────────────────────┐
│  Tab Shelf                    [설정 ⚙]  │
│  보관된 탭 127개                         │
├─────────────────────────────────────────┤
│  📄 arxiv.org (42)          [전체 복원]  │
│  ├ Attention Is All You Need  · 2시간 전 │
│  ├ Scaling Laws for LLMs      · 5시간 전 │
│  └ + 40개 더 보기                        │
├─────────────────────────────────────────┤
│  📄 nature.com (18)         [전체 복원]  │
│  ├ Boosting reservoir compu   · 1일 전   │
│  └ + 17개 더 보기                        │
├─────────────────────────────────────────┤
│  [전체 비우기]              [모두 복원]   │
└─────────────────────────────────────────┘
```

- 도메인 그룹 기본 상태: 전체 접힘, 클릭 시 펼치기
- 항목 클릭: 새 탭으로 열고 Shelf에서 제거
- 도메인 [전체 복원]: 새 창으로 열고 그룹 제거
- 항목 hover 시 전체 제목 툴팁
- favicon 표시
- 닫힌 시각 상대 표시 (2시간 전, 3일 전 등)
- 검색창: 제목/URL 실시간 필터링, 매칭된 그룹만 자동 펼침

---

### 4. 설정(Options) 페이지

`chrome://extensions` 또는 팝업 설정 아이콘으로 접근.

#### 4-1. Domain Rules 관리
- 규칙 목록 테이블 (도메인 / 모드 / 비활성시간 / 삭제)
- 새 규칙 추가 폼
- 모드 변경 드롭다운 (close / shelf / ignore)
- 비활성 시간 입력 (분 단위, UI는 "2시간" 형태로 표시)

#### 4-2. Shelf 설정
- 보관 기간 설정 (7일 / 14일 / 30일 / 90일 / 영구)
- 현재 보관 항목 수 및 예상 용량 표시
- Shelf 전체 비우기 버튼

#### 4-3. 일반 설정
- 확장 활성화/비활성화 토글
- 비활성 감지 주기 (기본 1분)

---

### 5. 수동 Shelf 이동

- 모든 탭 우클릭 → 컨텍스트 메뉴 "Send to Shelf"
- `ignore` 모드 도메인 탭도 수동으로 Shelf에 보낼 수 있음
- `chrome.contextMenus` API 사용

---

### 6. 탭 활동 추적

- `chrome.tabs.onActivated` — 탭 포커스 시 마지막 활성 시각 갱신
- `chrome.tabs.onUpdated` — URL 변경 시 마지막 활성 시각 갱신
- `chrome.alarms` — 1분마다 비활성 탭 점검
- 탭별 마지막 활성 시각: `chrome.storage.session` 저장

---

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| Manifest | V3 | Chrome 현행 표준 |
| 백그라운드 | Service Worker | MV3 요구사항 |
| UI | Vanilla JS + Tailwind CDN | 빌드 단계 불필요 |
| 저장소 | chrome.storage.local / session | RAM 영향 없음 |
| 타이머 | chrome.alarms | Service Worker sleep 대응 |

---

## 파일 구조

```
tab-shelf/
├── manifest.json
├── background.js          # Service worker: 탭 추적, 규칙 적용
├── popup.html             # Shelf UI
├── popup.js
├── options.html           # 설정 페이지
├── options.js
├── shared/
│   └── storage.js         # storage 읽기/쓰기 공통 함수
├── styles/
│   └── common.css         # 공통 스타일 (팝업 + 옵션 공유)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 구현 순서

### Phase 1 - 백그라운드 엔진 (기능 핵심)
1. `manifest.json` 작성
2. `shared/storage.js` — 규칙/Shelf 데이터 읽기/쓰기 함수
3. `background.js` — 탭 활동 추적 + 비활성 감지 + 규칙 적용

### Phase 2 - 팝업 UI (Shelf 뷰어)
4. `popup.html` / `popup.js` — Shelf 목록, 도메인 그룹핑, 복원 기능

### Phase 3 - 설정 페이지
5. `options.html` / `options.js` — Domain Rule CRUD, Shelf 설정

### Phase 4 - 아이콘 및 마무리
6. 아이콘 제작 (SVG → PNG)
7. Chrome에 로드 후 전체 동작 검증
8. 엣지케이스 처리 (탭 이미 닫힘, storage 용량 초과 등)

---

## 결정된 사항

- [x] 팝업 그룹 기본 상태: 전체 접힘
- [x] `ignore` 도메인도 우클릭 "Send to Shelf"로 수동 이동 가능
- [x] 검색 기능 포함
- [x] 단일 항목 복원: 현재 창 새 탭 + Shelf에서 제거
- [x] 도메인 전체 복원: 새 창 + Shelf 그룹 삭제
