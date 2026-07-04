# ✦ AllHub — 올인원 생활밀착형 AI 플랫폼

## 📁 폴더 구조

```
allhub/
├── public/
│   └── index.html        ← HTML 진입점
├── src/
│   ├── index.js          ← React 진입점
│   ├── App.js            ← 메인 앱 (12개 카테고리)
│   └── config.js         ← API 키 설정 (여기만 수정!)
├── package.json          ← 프로젝트 설정
└── README.md             ← 이 파일
```

---

## 🚀 1단계: 내 컴퓨터에서 실행 (테스트)

### 필요한 것
- Node.js 설치: https://nodejs.org (LTS 버전 다운로드)

### 실행 순서

```bash
# 1. 이 폴더로 이동
cd allhub

# 2. 필요한 패키지 설치 (최초 1회만)
npm install

# 3. 앱 실행
npm start
```

→ 브라우저에서 http://localhost:3000 자동으로 열립니다.

---

## 🔑 2단계: API 키 입력 (실제 기능 활성화)

`src/config.js` 파일을 열어서 API 키를 입력하세요.

### 무료 API 키 발급 (카드 불필요)

**이미지 생성 — Hugging Face**
1. https://huggingface.co 접속 → 무료 가입
2. 우측 상단 프로필 → Settings → Access Tokens
3. New Token → Read 권한 선택 → 생성
4. config.js의 `IMAGE.apiKey`에 붙여넣기

**텍스트·검색 — Google Gemini**
1. https://aistudio.google.com 접속
2. 구글 계정으로 로그인
3. "Get API Key" → Create API key
4. config.js의 `TEXT.apiKey`, `SEARCH.apiKey`에 붙여넣기

---

## 🌐 3단계: 무료 배포 (Vercel)

```bash
# 1. 빌드
npm run build

# 2. Vercel CLI 설치
npm install -g vercel

# 3. 배포 (Vercel 계정 필요 — https://vercel.com 무료 가입)
vercel
```

→ 배포 완료 후 https://allhub-xxxx.vercel.app 주소 자동 생성

---

## 💰 4단계: 배포 전 유료 API로 교체

`src/config.js`에서 아래 부분만 수정:

| 기능 | 테스트 (무료) | 배포 (유료) |
|------|------------|-----------|
| 이미지 | Hugging Face | Replicate |
| 텍스트 | Gemini | Claude API |
| 검색 | Gemini | Perplexity |

---

## 📋 현재 구현된 기능 (1차)

| 카테고리 | 상태 | 모드 |
|---------|------|------|
| 🖼️ 이미지 생성 | ✅ 작동 | 저품질/일반/고품질 |
| 🔍 검색·리서치 | ✅ 작동 | 단순검색(무료)/AI검색 |
| 📝 스마트 오피스 | ✅ 작동 | 보고서/교정/PPT |
| 🛍️ 쇼핑·여행·교통 | ✅ 작동 | 단순검색(무료)/AI분석 |
| 🏠 부동산·세무·공공 | ✅ 작동 | 단순검색(무료)/AI분석 |
| 🩺 건강, 의학 정보 | ✅ 작동 | 병원찾기(무료)/AI정보 |
| 🎵 음악 생성 | 🚧 준비중 | — |
| 🎬 동영상 생성 | 🚧 준비중 | — |
| 📱 쇼츠 제작 | 🚧 준비중 | — |
| 🔄 파일 도구, 변환 | 🚧 준비중 | — |
| 💻 코딩 보조 | 🔜 추후 | — |
| ⚡ 워크플로우 | 🔜 추후 | — |

---

## 💳 크레딧 차감 기준

| 기능 | 저품질 | 일반 | 고품질 |
|------|--------|------|--------|
| 이미지 생성 | 0.5회 | 1회 | 2회 |
| 보고서·PPT | 0.5회 | 1회 | 2회 |
| 단순 검색 | 무료 | 무료 | 무료 |
| AI 검색 | 0.5회 | 0.5회 | 1회 |
| 건강 AI 정보 | — | 0.5회 | — |

---

문의사항이나 추가 기능 요청은 Claude에게 말씀해 주세요!
