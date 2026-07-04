// =====================================================
// ✦ AllHub API 설정 파일
// 
// 1단계 (테스트): 아래 무료 API 키를 발급받아 입력
// 2단계 (배포):   유료 API 키로 교체
// =====================================================

const CONFIG = {

  // ── 이미지 생성 ──────────────────────────────────
  // 테스트: Hugging Face (무료) → https://huggingface.co/settings/tokens
  // 배포:   Replicate (유료)   → https://replicate.com/account/api-tokens
  IMAGE: {
    provider: "huggingface",         // 배포 시 → "replicate"
    apiKey: "YOUR_HF_API_KEY",       // 배포 시 → "r8_xxxxxxxxxxxx"
    model: "black-forest-labs/FLUX.1-schnell", // 배포 시 → "black-forest-labs/flux-1.1-pro"
  },

  // ── 텍스트 생성 (보고서·교정·PPT) ────────────────
  // 테스트: Google Gemini (무료) → https://aistudio.google.com/app/apikey
  // 배포:   Anthropic Claude (유료) → https://console.anthropic.com
  TEXT: {
    provider: "gemini",              // 배포 시 → "anthropic"
    apiKey: "YOUR_GEMINI_API_KEY",   // 배포 시 → "sk-ant-xxxxxxxxxxxx"
    model: "gemini-2.0-flash",       // 배포 시 → "claude-sonnet-4-6"
  },

  // ── 검색·리서치 ──────────────────────────────────
  // 테스트: Google Gemini 동일 키 사용 (무료)
  // 배포:   Perplexity (유료) → https://www.perplexity.ai/settings/api
  SEARCH: {
    provider: "gemini",              // 배포 시 → "perplexity"
    apiKey: "YOUR_GEMINI_API_KEY",   // 배포 시 → "pplx-xxxxxxxxxxxx"
  },

};

export default CONFIG;

// =====================================================
// 무료 API 키 발급 방법
//
// [Hugging Face - 이미지 생성]
// 1. https://huggingface.co 접속 → 무료 가입
// 2. 우측 상단 프로필 → Settings → Access Tokens
// 3. New Token → Read 권한 → 생성
// 4. 위 apiKey에 붙여넣기
//
// [Google Gemini - 텍스트·검색]
// 1. https://aistudio.google.com 접속
// 2. 구글 계정으로 로그인
// 3. 좌측 메뉴 "Get API Key" → Create API key
// 4. 위 apiKey에 붙여넣기 (TEXT, SEARCH 둘 다)
//
// 하루 무료 사용량:
// - Hugging Face: 수백 회 (이미지)
// - Gemini: 1,500회 (텍스트/검색)
// =====================================================
