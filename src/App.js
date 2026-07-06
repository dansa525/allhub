import { useState, useEffect } from "react";

// ══════════════════════════════════════════════════════
// API 설정
// - 이미지: Pollinations.ai (완전 무료, 키 불필요)
// - 텍스트: Groq API (무료, 분당 30회, 하루 14400회)
//   발급: https://console.groq.com → 무료 가입 → API Keys
// - 음악/동영상/쇼츠: Hugging Face Inference API (완전 무료, 카드 불필요)
//   발급: https://huggingface.co → 가입 → Settings → Access Tokens → New token (Read 권한)
//   ⚠️ 무료 모델이라 화질·음질은 낮고 속도가 느립니다 (콜드 스타트 시 20~30초 소요될 수 있음)
//   ⚠️ 나중에 품질을 올리려면 genMusic/genVideo 함수만 유료 API로 교체하면 됩니다
// - 파일 변환: CloudConvert API (하루 25회 무료)
//   발급: https://cloudconvert.com/api/v2 → 무료 가입 → API Key 발급
//   ⚠️ 무료 한도 소진 시 같은 키에 유료 크레딧만 충전하면 계속 작동함
// ══════════════════════════════════════════════════════
const GROQ_KEY         = process.env.REACT_APP_GROQ_API_KEY || "";
const GROQ_MODEL       = "llama-3.3-70b-versatile";
const CLOUDCONVERT_KEY = process.env.REACT_APP_CLOUDCONVERT_KEY || "";
const JAMENDO_ID       = process.env.REACT_APP_JAMENDO_CLIENT_ID || "";
const ADSENSE_CLIENT   = process.env.REACT_APP_ADSENSE_CLIENT || "";
const ADSENSE_SLOT     = process.env.REACT_APP_ADSENSE_SLOT || "";

// 크레딧 차감표
const COST = {
  image:  { low:0.5, mid:1,   high:2 },
  music:  { low:0.5, mid:1,   high:2 },
  video:  { low:3,   mid:6,   high:12 },
  shorts: { low:2,   mid:4,   high:8 },
  file:   { low:0.5, mid:0.5, high:0.5 },
  search: { low:0,   mid:0.5, high:1 },
  office: { low:0.5, mid:1,   high:2 },
  shop:   { low:0,   mid:0.5, high:1 },
  life:   { low:0,   mid:0.5, high:1 },
  health: { low:0,   mid:0.5, high:1 },
  sportsmovie: { low:0, mid:0.5, high:1 },
  code:   { low:0,   mid:0.5, high:1 },
  auto:   { low:0,   mid:0.5, high:1 },
};

// 카테고리 목록
const CATS = [
  { id:"search",   icon:"🔍", name:"검색",            group:"검색·업무",   phase:1, grad:["#a7cdfd","#2563eb"] },
  { id:"research", icon:"📚", name:"리서치",           group:"검색·업무",   phase:1, grad:["#a0d8fb","#0369a1"] },
  { id:"office",   icon:"📝", name:"스마트 오피스",     group:"검색·업무",   phase:1, grad:["#c2c3ff","#4f46e5"], sub:"보고서·PPT·문서 교정" },
  { id:"file",     icon:"🔄", name:"파일변환·도구",     group:"검색·업무",   phase:1, grad:["#a4ede0","#0d9488"] },
  { id:"image",    icon:"🖼️", name:"이미지 스튜디오",   group:"창작 스튜디오", phase:1, grad:["#c4b8fe","#6455e0"] },
  { id:"music",    icon:"🎵", name:"음악 스튜디오",     group:"창작 스튜디오", phase:1, grad:["#fbc0e2","#c026a3"] },
  { id:"video",    icon:"🎬", name:"동영상 스튜디오",   group:"창작 스튜디오", phase:1, grad:["#a6e2fc","#0284c7"] },
  { id:"shorts",   icon:"📱", name:"쇼츠 제작 스튜디오", group:"창작 스튜디오", phase:1, grad:["#b3f0cb","#16a34a"] },
  { id:"health",   icon:"🩺", name:"건강·의학 정보",    group:"건강",      phase:1, grad:["#fcb3c0","#e11d48"] },
  { id:"sportsmovie", icon:"🍿", name:"스포츠·영화",   group:"스포츠·영화", phase:1, grad:["#93c5fd","#1d4ed8"] },
  { id:"shop",     icon:"🛍️", name:"쇼핑·여행·교통",   group:"생활편의",   phase:1, grad:["#fee1a1","#d97706"] },
  { id:"life",     icon:"🏠", name:"부동산·세무·공공",  group:"생활편의",   phase:1, grad:["#fdcda3","#c2410c"] },
  { id:"code",     icon:"💻", name:"코딩 작업",        group:"추가 업데이트", phase:1, grad:["#7dd3fc","#0284c7"] },
  { id:"auto",     icon:"⚙️", name:"워크플로우 자동화", group:"추가 업데이트", phase:1, grad:["#c4b5fd","#7c3aed"] },
];

const GROUP_GROUPS = ["검색·업무","창작 스튜디오","생활편의","추가 업데이트"];
const GC = {
  "검색·업무":   "#60A5FA",
  "창작 스튜디오": "#4ADE80",
  "건강":       "#F472B6",
  "스포츠·영화":  "#3B82F6",
  "생활편의":    "#FBBF24",
  "추가 업데이트": "#9CA3AF",
};

// ── API 호출 함수 ──────────────────────────────────────
async function genImage(prompt, quality) {
  const width  = quality==="high" ? 1024 : quality==="mid" ? 768 : 512;
  const height = width;
  const seed   = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

async function genText(system, user, maxTokens = 1600) {
  if (!GROQ_KEY) {
    throw new Error("Vercel 환경변수에 REACT_APP_GROQ_API_KEY를 등록해 주세요. (console.groq.com에서 무료 발급)");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user",   content: user   },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (res.status === 429) throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  if (res.status === 401) throw new Error("API 키가 올바르지 않습니다. Vercel 환경변수를 확인해 주세요.");
  if (!res.ok) throw new Error("텍스트 생성 실패: " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "응답 없음";
}

// 대화 이어가기용 (AI 검색/분석 패널에서 사용) - 지금까지의 대화 기록 전체를 함께 전송
async function genChat(system, history, maxTokens = 1600) {
  if (!GROQ_KEY) {
    throw new Error("Vercel 환경변수에 REACT_APP_GROQ_API_KEY를 등록해 주세요. (console.groq.com에서 무료 발급)");
  }
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: system }, ...history],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (res.status === 429) throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  if (res.status === 401) throw new Error("API 키가 올바르지 않습니다. Vercel 환경변수를 확인해 주세요.");
  if (!res.ok) throw new Error("응답 생성 실패: " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "응답 없음";
}

// 모든 "단순 검색"에 공통으로 들어가야 하는 대한민국 필수 링크
function coreLinks(q) {
  return [
    { name:"네이버",  url:`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}` },
    { name:"다음",    url:`https://search.daum.net/search?q=${encodeURIComponent(q)}` },
    { name:"구글",    url:`https://www.google.com/search?q=${encodeURIComponent(q)}` },
    { name:"ChatGPT", url:`https://chatgpt.com/?q=${encodeURIComponent(q)}` },
    { name:"Gemini",  url:`https://gemini.google.com/app?q=${encodeURIComponent(q)}` },
    { name:"YouTube", url:`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  ];
}

// 동영상 생성 (Vercel 서버 함수 /api/video 경유 → 서버가 Hugging Face 호출)
// ⚠️ 무료 모델이라 짧고(2~3초) 저해상도입니다. 세로 변환은 지원하지 않아 쇼츠도 같은 방식으로 생성됩니다.
async function genVideo(prompt, opts = {}) {
  const res = await fetch("/api/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, quality: opts.quality, aspectRatio: opts.aspectRatio }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "동영상 생성 실패: " + res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// 파일 변환 (CloudConvert API: job 생성 → 업로드 → 대기 → 다운로드 URL)
// 음악 (Jamendo API: AI 생성이 아닌, 저작권 무료 음악 라이브러리에서 분위기에 맞는 곡 검색)
async function genMusic(promptKo) {
  if (!JAMENDO_ID) {
    throw new Error("Vercel 환경변수에 REACT_APP_JAMENDO_CLIENT_ID를 등록해 주세요. (developer.jamendo.com에서 무료 발급)");
  }
  // 한국어 분위기 설명 → 영어 태그로 변환 (Jamendo는 영어 태그 검색이 잘 맞음). 실패해도 원문으로 계속 진행.
  let tags = "";
  try {
    const raw = await genText(
      "다음 설명에 어울리는 배경음악 분위기를 영어 태그 2~4개로만 출력하세요. 쉼표 없이 공백으로만 구분하고, 소문자 영어 단어만 사용하세요. 다른 설명은 절대 추가하지 마세요. 예시 출력: chill lofi relax",
      promptKo, 30
    );
    tags = raw.trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 4).join("+");
  } catch (e) { /* Groq 실패 시 원문 그대로 검색 시도 */ }

  const fuzzytags = tags || encodeURIComponent(promptKo);
  const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${JAMENDO_ID}&format=json&limit=6&fuzzytags=${fuzzytags}&audioformat=mp32&include=musicinfo`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("음악 검색 실패: " + res.status);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("어울리는 음악을 찾지 못했습니다. 다른 표현으로 다시 시도해 주세요.");
  }
  return data.results.map(t => ({ name: t.name, artist: t.artist_name, url: t.audio, image: t.album_image }));
}


async function convertFile(file, targetFormat) {
  if (!CLOUDCONVERT_KEY) {
    throw new Error("Vercel 환경변수에 REACT_APP_CLOUDCONVERT_KEY를 등록해 주세요. (cloudconvert.com에서 무료 발급)");
  }
  // 1) job 생성
  const jobRes = await fetch("https://api.cloudconvert.com/v2/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${CLOUDCONVERT_KEY}`,
    },
    body: JSON.stringify({
      tasks: {
        "import-file":  { operation: "import/upload" },
        "convert-file": { operation: "convert", input: "import-file", output_format: targetFormat },
        "export-file":  { operation: "export/url", input: "convert-file" },
      },
    }),
  });
  if (jobRes.status === 401 || jobRes.status === 403) throw new Error("API 키가 올바르지 않습니다. Vercel 환경변수를 확인해 주세요.");
  if (!jobRes.ok) throw new Error("변환 작업 생성 실패: " + jobRes.status);
  const job = (await jobRes.json()).data;

  // 2) 파일 업로드
  const importTask = job.tasks.find(t => t.name === "import-file");
  const form = new FormData();
  Object.entries(importTask.result.form.parameters).forEach(([k, v]) => form.append(k, v));
  form.append("file", file);
  const uploadRes = await fetch(importTask.result.form.url, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("파일 업로드 실패");

  // 3) 완료 대기
  const waitRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${job.id}/wait`, {
    headers: { "Authorization": `Bearer ${CLOUDCONVERT_KEY}` },
  });
  if (waitRes.status === 402) throw new Error("무료 변환 횟수(하루 25회)를 초과했습니다. 유료 크레딧을 충전해 주세요.");
  const finished = (await waitRes.json()).data;
  if (finished.status !== "finished") throw new Error("변환 실패: 지원하지 않는 형식이거나 파일에 문제가 있습니다.");

  // 4) 결과 다운로드 URL
  const exportTask = finished.tasks.find(t => t.name === "export-file");
  const resultFile = exportTask?.result?.files?.[0];
  if (!resultFile) throw new Error("변환 결과를 찾을 수 없습니다.");
  return { url: resultFile.url, filename: resultFile.filename };
}

// ── 공통 스타일 ────────────────────────────────────────
const css = {
  overlay: {
    position:"fixed", inset:0,
    background:"rgba(0,0,0,0.8)",
    backdropFilter:"blur(8px)",
    zIndex:200, display:"flex",
    alignItems:"flex-start", justifyContent:"center", padding:16, paddingTop:"6vh",
  },
  box: {
    background:"#1A1A2E",
    border:"1px solid rgba(255,255,255,0.12)",
    borderRadius:20, width:"100%", maxWidth:620,
    maxHeight:"90vh", overflowY:"auto", padding:24,
    position:"relative",
  },
  title: { fontSize:20, fontWeight:700, color:"#E8EAF6", marginBottom:18 },
  label: { fontSize:12, color:"#9CA3AF", marginBottom:6, display:"block", fontWeight:500 },
  textarea: {
    width:"100%", background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.1)", borderRadius:10,
    padding:"12px 14px", color:"#E8EAF6", fontSize:14,
    resize:"vertical", minHeight:90, fontFamily:"inherit",
    outline:"none", boxSizing:"border-box", marginBottom:14,
  },
  input: {
    width:"100%", background:"rgba(255,255,255,0.05)",
    border:"1px solid rgba(255,255,255,0.1)", borderRadius:10,
    padding:"12px 14px", color:"#E8EAF6", fontSize:14,
    fontFamily:"inherit", outline:"none",
    boxSizing:"border-box", marginBottom:14,
  },
  tabRow: { display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" },
  tabBtn: (active) => ({
    padding:"8px 14px", borderRadius:20, cursor:"pointer",
    border: active ? "1px solid #7C83FD" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(124,131,253,0.2)" : "rgba(255,255,255,0.04)",
    color: active ? "#A78BFA" : "#9CA3AF",
    fontSize:13, fontWeight:600, transition:"all 0.15s",
  }),
  modeBtn: (active) => ({
    padding:"7px 16px", borderRadius:20, cursor:"pointer",
    border: active ? "1px solid #7C83FD" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(124,131,253,0.2)" : "transparent",
    color: active ? "#A78BFA" : "#6B7280",
    fontSize:12, fontWeight:600,
  }),
  qualityBtn: (active) => ({
    flex:1, padding:"9px 0", borderRadius:10, cursor:"pointer",
    border: active ? "1px solid #7C83FD" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(124,131,253,0.2)" : "rgba(255,255,255,0.04)",
    color: active ? "#A78BFA" : "#9CA3AF",
    fontSize:13, fontWeight:600, transition:"all 0.15s",
  }),
  runBtn: (loading) => ({
    width:"100%", padding:"14px 0", borderRadius:12,
    border:"none", cursor: loading ? "not-allowed" : "pointer",
    background: loading
      ? "rgba(124,131,253,0.3)"
      : "linear-gradient(135deg,#7C83FD,#A78BFA)",
    color:"#fff", fontSize:15, fontWeight:700,
    marginTop:8, transition:"all 0.2s",
  }),
  closeBtn: {
    position:"absolute", top:16, right:16,
    background:"rgba(255,255,255,0.08)", border:"none",
    borderRadius:8, width:32, height:32,
    color:"#9CA3AF", fontSize:20, cursor:"pointer",
    display:"flex", alignItems:"center", justifyContent:"center",
  },
  result: {
    marginTop:18, background:"rgba(255,255,255,0.04)",
    border:"1px solid rgba(255,255,255,0.08)",
    borderRadius:12, padding:16,
  },
  costTag: {
    display:"inline-flex", alignItems:"center", gap:4,
    background:"rgba(124,131,253,0.1)",
    border:"1px solid rgba(124,131,253,0.2)",
    borderRadius:8, padding:"3px 10px",
    fontSize:12, color:"#A78BFA", marginBottom:14,
  },
  errMsg: { color:"#F87171", fontSize:13, marginBottom:8 },
  linkCard: {
    display:"block", textDecoration:"none",
    background:"rgba(255,255,255,0.05)",
    borderRadius:8, padding:"10px 14px",
    marginBottom:8, color:"#A78BFA", fontSize:14,
    border:"1px solid rgba(255,255,255,0.07)",
  },
  divider: {
    height:1, background:"rgba(255,255,255,0.06)",
    margin:"14px 0",
  },
};

function CloseBtn({ onClose }) {
  return <button style={css.closeBtn} onClick={onClose}>×</button>;
}
function CostTag({ n }) {
  if (!n) return null;
  return <div style={css.costTag}>⚡ {n}회 차감 예정</div>;
}
const QUALITY_LABELS = { low:"드래프트", mid:"스탠다드", high:"프리미엄" };
function QualityBar({ val, set, cost, desc }) {
  const d = desc || {
    low:  "빠르게 핵심만 확인할 때",
    mid:  "균형 잡힌 기본 완성도",
    high: "가장 정교하고 상세하게",
  };
  return (
    <>
      <div style={{display:"flex", gap:8, marginBottom:8}}>
        {["low","mid","high"].map(k=>(
          <button key={k} style={css.qualityBtn(val===k)} onClick={()=>set(k)}>
            {QUALITY_LABELS[k]} ({cost ? cost[k] : ""}회)
          </button>
        ))}
      </div>
      <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:14}}>
        💡 {d[val]}
      </div>
    </>
  );
}
function ResultBox({ result }) {
  if (!result) return null;
  return (
    <div style={css.result}>
      {result.type==="links"
        ? result.items.map((l,i)=>(
            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" style={css.linkCard}>
              🌐 {l.name} →
            </a>
          ))
        : <div style={{fontSize:13,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.text}</div>
      }
    </div>
  );
}

// ── 이어서 대화 가능한 AI 채팅 스레드 (AI 검색/분석 공용) ──
function AiChatThread({ system, cost, credits, onDeduct, placeholder }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    if (!input.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    const next = [...messages, { role:"user", content: input }];
    setMessages(next); setInput(""); setLoading(true); setErr("");
    try {
      const reply = await genChat(system, next);
      setMessages([...next, { role:"assistant", content: reply }]);
      onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      {messages.length > 0 && (
        <div style={{maxHeight:340, overflowY:"auto", marginBottom:12, paddingRight:2}}>
          {messages.map((m,i)=>(
            <div key={i} style={{
              background: m.role==="user" ? "rgba(124,131,253,0.14)" : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius:10, padding:"9px 12px", marginBottom:8,
              fontSize:13, color:"#D1D5DB", whiteSpace:"pre-wrap", lineHeight:1.65,
              marginLeft: m.role==="user" ? 24 : 0, marginRight: m.role==="user" ? 0 : 24,
            }}>
              <div style={{fontSize:10.5, fontWeight:700, marginBottom:3, color: m.role==="user" ? "#A78BFA" : "#4ADE80"}}>
                {m.role==="user" ? "나" : "🤖 AllHub AI"}
              </div>
              {m.content}
            </div>
          ))}
          {loading && <div style={{fontSize:12,color:"#6B7280"}}>⏳ 답변 작성 중...</div>}
        </div>
      )}
      {err && <div style={css.errMsg}>{err}</div>}
      <div style={{display:"flex", gap:8, alignItems:"stretch"}}>
        <input style={{...css.input, flex:1, margin:0, padding:"12px 14px"}}
          placeholder={placeholder}
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter" && !loading && send()} />
        <button style={{...css.runBtn(loading), width:"auto", margin:0, padding:"0 20px", flexShrink:0}}
          onClick={send} disabled={loading}>
          {messages.length===0 ? "질문하기" : "이어서 질문"}
        </button>
      </div>
    </>
  );
}


// ── 음악 스튜디오 패널 (무료 배경음악 찾기) ─────────────
function MusicPanel({ credits, onDeduct, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState(null);
  const [err, setErr] = useState("");

  async function run() {
    if (!prompt.trim()) return;
    setLoading(true); setErr(""); setTracks(null);
    try {
      const list = await genMusic(prompt);
      setTracks(list);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🎵 음악 스튜디오</div>
      <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:14, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
        💡 AI가 직접 곡을 만드는 대신, 분위기에 맞는 저작권 무료 배경음악을 찾아 들려드립니다. 완전 무료입니다.
      </div>
      <label style={css.label}>원하는 분위기</label>
      <textarea style={css.textarea}
        placeholder="예) 잔잔한 로파이 힙합, 비 오는 밤 감성"
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 찾는 중..." : "🎧 배경음악 찾기"}
      </button>
      {tracks && (
        <div style={css.result}>
          {tracks.map((t,i)=>(
            <div key={i} style={{marginBottom: i===tracks.length-1 ? 0 : 14}}>
              <div style={{fontSize:13, color:"#D1D5DB", marginBottom:5}}>🎵 {t.name} · {t.artist}</div>
              <audio controls style={{width:"100%"}} src={t.url} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}


function ImagePanel({ credits, onDeduct, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState("mid");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.image[quality];

  async function run() {
    if (!prompt.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const url = await genImage(prompt, quality);
      setResult(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🖼️ 이미지 스튜디오</div>
      <label style={css.label}>품질 선택</label>
      <QualityBar val={quality} set={setQuality} cost={COST.image} desc={{
        low:  "빠른 미리보기용, 러프한 이미지",
        mid:  "일상적인 용도에 알맞은 기본 완성도",
        high: "정교한 디테일과 선명한 고해상도",
      }} />
      <label style={css.label}>프롬프트</label>
      <textarea style={css.textarea}
        placeholder="예) 석양이 지는 해변, 감성적인 분위기"
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 생성 중..." : "✨ 이미지 생성하기"}
      </button>
      {result && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 생성 완료</div>
          <img src={result} alt="생성 이미지" style={{width:"100%",borderRadius:10,display:"block"}} />
          <a href={result} download="allhub-image.png">
            <button style={{...css.runBtn(false), marginTop:10, background:"rgba(255,255,255,0.08)"}}>
              ⬇️ 다운로드
            </button>
          </a>
        </div>
      )}
    </>
  );
}

// ── 동영상 생성 패널 ───────────────────────────────────
function VideoPanel({ credits, onDeduct, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState("mid");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.video[quality];

  async function run() {
    if (!prompt.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const url = await genVideo(prompt, { quality });
      setResult(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🎬 동영상 스튜디오</div>
      <label style={css.label}>품질 선택</label>
      <QualityBar val={quality} set={setQuality} cost={COST.video} desc={{
        low:  "짧고 빠른 미리보기 영상 (약 3초)",
        mid:  "표준 길이·화질 영상 (약 5초)",
        high: "긴 길이의 고해상도 영상 (약 8초)",
      }} />
      <label style={css.label}>영상 설명</label>
      <textarea style={css.textarea}
        placeholder="예) 파도가 치는 해변 위로 갈매기가 날아가는 모습"
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 생성 중... (최대 1분 소요)" : "✨ 동영상 생성하기"}
      </button>
      {result && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 생성 완료</div>
          <video controls autoPlay loop style={{width:"100%",borderRadius:10}} src={result} />
        </div>
      )}
    </>
  );
}

// ── 쇼츠 제작 패널 ─────────────────────────────────────
function ShortsPanel({ credits, onDeduct, onClose }) {
  const [topic, setTopic] = useState("");
  const [ratio, setRatio] = useState("9:16");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [script, setScript] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.shorts.mid;

  const RATIOS = [
    { id:"9:16", label:"9:16", desc:"쇼츠·릴스·틱톡 (세로 화면)" },
    { id:"16:9", label:"16:9", desc:"유튜브 일반 영상 (가로 화면)" },
    { id:"1:1",  label:"1:1",  desc:"인스타그램 피드 (정방형)" },
    { id:"4:5",  label:"4:5",  desc:"인스타그램 포스트 (세로 직사각)" },
  ];

  async function run() {
    if (!topic.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setVideoUrl(null); setScript(null);
    try {
      const text = await genText(
        "쇼츠·릴스 대본 작가입니다. 주제에 맞는 짧고 임팩트 있는 영상 씬 묘사(장면 1개)와, 그 위에 들어갈 자막 문구 3줄을 한국어로 작성하세요. '[장면]'과 '[자막]'으로 구분해서 출력하세요.",
        topic
      );
      setScript(text);
      const scene = text.split("[자막]")[0].replace("[장면]", "").trim() || topic;
      const url = await genVideo(scene, { aspectRatio: ratio });
      setVideoUrl(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>📱 쇼츠 제작 스튜디오</div>
      <label style={css.label}>화면 비율</label>
      <div style={{display:"flex", gap:8, marginBottom:8, flexWrap:"wrap"}}>
        {RATIOS.map(r=>(
          <button key={r.id} style={css.qualityBtn(ratio===r.id)} onClick={()=>setRatio(r.id)}>{r.label}</button>
        ))}
      </div>
      <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:14}}>
        💡 {RATIOS.find(r=>r.id===ratio)?.desc}
      </div>
      <CostTag n={cost} />
      <label style={css.label}>쇼츠 주제</label>
      <textarea style={css.textarea}
        placeholder="예) 아침 루틴 꿀팁, 여름 다이어트 3가지 방법"
        value={topic} onChange={e=>setTopic(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 제작 중... (최대 1분 소요)" : "✨ 쇼츠 만들기"}
      </button>
      {script && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>📝 생성된 대본</div>
          <div style={{fontSize:13,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{script}</div>
        </div>
      )}
      {videoUrl && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 영상 생성 완료</div>
          <video controls autoPlay loop style={{width:"100%",maxWidth:280,borderRadius:10,display:"block",margin:"0 auto"}} src={videoUrl} />
        </div>
      )}
    </>
  );
}

// ── 파일 도구·변환 패널 ────────────────────────────────
function FilePanel({ credits, onDeduct, onClose }) {
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState("pdf");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.file.mid;

  const TARGETS = ["pdf","docx","jpg","png","xlsx","pptx","mp3","mp4","txt"];

  async function run() {
    if (!file) { setErr("파일을 먼저 선택해 주세요."); return; }
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const res = await convertFile(file, target);
      setResult(res); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🔄 파일변환·도구</div>
      {!CLOUDCONVERT_KEY && (
        <div style={{background:"rgba(255,152,0,0.1)",border:"1px solid rgba(255,152,0,0.3)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#FFB74D",marginBottom:14}}>
          ⚠️ 배포 전 테스트 단계입니다. REACT_APP_CLOUDCONVERT_KEY 등록 후 이용 가능합니다. (무료 하루 25회)
        </div>
      )}
      <label style={css.label}>변환할 파일</label>
      <input type="file" style={{...css.input, padding:"9px 14px"}}
        onChange={e=>{ setFile(e.target.files[0] || null); setResult(null); setErr(""); }} />
      <label style={css.label}>변환할 형식</label>
      <div style={{display:"flex", gap:8, marginBottom:14, flexWrap:"wrap"}}>
        {TARGETS.map(t=>(
          <button key={t} style={css.tabBtn(target===t)} onClick={()=>setTarget(t)}>{t.toUpperCase()}</button>
        ))}
      </div>
      <CostTag n={cost} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 변환 중..." : "✨ 변환하기"}
      </button>
      {result && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 변환 완료</div>
          <a href={result.url} target="_blank" rel="noopener noreferrer" style={css.linkCard}>
            ⬇️ {result.filename} 다운로드 →
          </a>
        </div>
      )}
    </>
  );
}

// ── 검색·리서치 패널 ───────────────────────────────────
function SearchPanel({ credits, onDeduct, onClose, fixedMode }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState(fixedMode || "simple");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.search.mid;

  async function runSimple() {
    if (!query.trim()) return;
    setResult({ type:"links", items:[
      { name:"Google 검색",   url:`https://www.google.com/search?q=${encodeURIComponent(query)}` },
      { name:"네이버 검색",    url:`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}` },
      { name:"다음 검색",     url:`https://search.daum.net/search?q=${encodeURIComponent(query)}` },
      { name:"Bing 검색",     url:`https://www.bing.com/search?q=${encodeURIComponent(query)}` },
      { name:"ChatGPT",      url:`https://chatgpt.com/?q=${encodeURIComponent(query)}` },
      { name:"Gemini",       url:`https://gemini.google.com/app?q=${encodeURIComponent(query)}` },
      { name:"YouTube 검색",  url:`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` },
      { name:"Wikipedia",    url:`https://ko.wikipedia.org/wiki/${encodeURIComponent(query)}` },
    ]});
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>{fixedMode==="ai" ? "📚 리서치" : "🔍 검색"}</div>
      {!fixedMode && (
        <div style={css.tabRow}>
          <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
          <button style={css.modeBtn(mode==="ai")}     onClick={()=>{ setMode("ai"); }}>🤖 AI 검색 ({cost}회/답변)</button>
        </div>
      )}
      {mode==="simple" ? (
        <>
          <div style={{...css.costTag, color:"#4ADE80", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)"}}>🆓 무료</div>
          <label style={css.label}>검색어 또는 질문</label>
          <textarea style={css.textarea}
            placeholder="예) 파이썬 무료 강의"
            value={query} onChange={e=>setQuery(e.target.value)} />
          {err && <div style={css.errMsg}>{err}</div>}
          <button style={css.runBtn(loading)} onClick={runSimple}>🔍 검색하기</button>
          <ResultBox result={result} />
        </>
      ) : (
        <>
          <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
            💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
          </div>
          <AiChatThread
            system="당신은 전문 리서치 어시스턴트입니다. 사용자의 질문에 대해 핵심 정보를 명확하게 한국어로 정리해 주세요. 이전 대화 맥락을 기억하고 이어서 답변하세요."
            cost={cost} credits={credits} onDeduct={onDeduct}
            placeholder="예) 2026년 AI 시장 트렌드를 정리해줘"
          />
        </>
      )}
    </>
  );
}

// ── 스마트 오피스 패널 ─────────────────────────────────
function OfficePanel({ credits, onDeduct, onClose }) {
  const [sub, setSub] = useState("report");
  const [input, setInput] = useState("");
  const [quality, setQuality] = useState("mid");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.office[quality];

  const SUBS = [
    { id:"report",  label:"📄 보고서",    sys:"전문 비즈니스 보고서 작성가입니다. 제목, 목차, 본문, 결론 구조로 한국어 보고서를 작성하세요." },
    { id:"correct", label:"✏️ 글쓰기 교정", sys:"전문 교열 편집자입니다. 맞춤법, 문법, 어색한 표현을 교정하고 원문과 수정본을 구분해서 보여주세요." },
    { id:"ppt",     label:"📊 PPT 초안",  sys:"PPT 기획 전문가입니다. 각 슬라이드 제목과 핵심 내용을 목록으로 한국어로 정리하세요." },
  ];

  const QUALITY_ADD = {
    low:  { extra:" 핵심만 간결하게, 3~5문장 이내로 요약해서 작성하세요.", tokens:500 },
    mid:  { extra:" 표준적인 분량과 디테일로 작성하세요.", tokens:1400 },
    high: { extra:" 매우 상세하고 전문적으로, 소제목과 구체적 근거·예시를 포함해 깊이 있게 작성하세요.", tokens:3000 },
  };

  async function run() {
    if (!input.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const s = SUBS.find(x=>x.id===sub);
      const q = QUALITY_ADD[quality];
      const text = await genText(s.sys + q.extra, input, q.tokens);
      setResult(text); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>📝 스마트 오피스</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setErr(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <label style={css.label}>품질 선택</label>
      <QualityBar val={quality} set={setQuality} cost={COST.office} desc={{
        low:  "핵심만 간결하게, 빠른 초안 확인용",
        mid:  "표준 분량과 완성도",
        high: "소제목·근거를 갖춘 심층 작성",
      }} />
      <label style={css.label}>내용 입력</label>
      <textarea style={{...css.textarea, minHeight:120}}
        placeholder={sub==="report"?"보고서 주제 입력":sub==="correct"?"교정할 글 붙여넣기":"PPT 주제 입력"}
        value={input} onChange={e=>setInput(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 생성 중..." : "✨ 생성하기"}
      </button>
      {result && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 생성 완료</div>
          <div style={{fontSize:13,color:"#D1D5DB",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div>
          <button style={{...css.runBtn(false), marginTop:12, background:"rgba(255,255,255,0.08)", fontSize:13}}
            onClick={()=>navigator.clipboard.writeText(result)}>📋 클립보드에 복사</button>
        </div>
      )}
    </>
  );
}

// ── 쇼핑·여행·교통 패널 ───────────────────────────────
function ShopPanel({ credits, onDeduct, onClose }) {
  const [sub, setSub] = useState("shop");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [result, setResult] = useState(null);
  const cost = COST.shop.mid;

  const SUBS = [
    { id:"shop",    label:"🛒 쇼핑" },
    { id:"travel",  label:"✈️ 여행" },
    { id:"traffic", label:"🚇 교통" },
  ];

  const LINKS = {
    shop: [
      { name:"쿠팡",       url:q=>`https://www.coupang.com/np/search?q=${encodeURIComponent(q)}` },
      { name:"11번가",     url:q=>`https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(q)}` },
      { name:"G마켓",      url:q=>`https://browse.gmarket.co.kr/search?keyword=${encodeURIComponent(q)}` },
      { name:"당근마켓",    url:q=>`https://www.daangn.com/search/${encodeURIComponent(q)}` },
    ],
    travel: [
      { name:"야놀자",      url:q=>`https://www.yanolja.com/search?keyword=${encodeURIComponent(q)}` },
      { name:"스카이스캐너", url:q=>`https://www.skyscanner.co.kr/flights/${encodeURIComponent(q)}` },
      { name:"여기어때",    url:q=>`https://www.yeogi.com/search?keyword=${encodeURIComponent(q)}` },
      { name:"에어비앤비",   url:q=>`https://www.airbnb.co.kr/s/${encodeURIComponent(q)}` },
    ],
    traffic: [
      { name:"네이버 지도 길찾기", url:q=>`https://map.naver.com/v5/search/${encodeURIComponent(q)}` },
      { name:"카카오맵 길찾기",    url:q=>`https://map.kakao.com/?q=${encodeURIComponent(q)}` },
      { name:"코레일 기차 예매",   url:()=>"https://www.letskorail.com" },
      { name:"티맵",              url:()=>"https://www.tmap.co.kr" },
      { name:"고속버스 예매",      url:()=>"https://www.kobus.co.kr" },
    ],
  };

  const SYS = {
    shop:    "전문 쇼핑 어드바이저입니다. 제품 구매 가이드, 가격 범위, 선택 포인트를 한국어로 상세히 정리하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
    travel:  "여행 전문가입니다. 입력된 여행지나 여행 관련 질문에 대해 일정 추천, 명소, 비용, 팁을 한국어로 정리하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
    traffic: "교통 전문가입니다. 대중교통, 기차, 항공, 선박 등 교통 관련 정보를 한국어로 상세히 안내하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
  };

  const PLACEHOLDER = {
    shop:    "예) 노트북 추천, 아이폰 케이스",
    travel:  "예) 제주도 3박 4일 여행 코스",
    traffic: "예) 서울에서 부산 가는 기차 시간표",
  };

  function runSimple() {
    if (!query.trim()) return;
    const links = [...LINKS[sub].map(l=>({ name:l.name, url:l.url(query) })), ...coreLinks(query)];
    setResult({ type:"links", items:links });
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🛍️ 쇼핑·여행·교통</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setQuery(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>setMode("ai")}>🤖 AI 분석 ({cost}회/답변)</button>
      </div>
      {mode==="simple" ? (
        <>
          <label style={css.label}>검색어</label>
          <input style={css.input}
            placeholder={PLACEHOLDER[sub]}
            value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && runSimple()} />
          <button style={css.runBtn(false)} onClick={runSimple}>🔍 검색하기</button>
          <ResultBox result={result} />
        </>
      ) : (
        <>
          <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
            💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
          </div>
          <AiChatThread key={sub}
            system={SYS[sub]} cost={cost} credits={credits} onDeduct={onDeduct}
            placeholder={PLACEHOLDER[sub]}
          />
        </>
      )}
    </>
  );
}

// ── 부동산·세무·공공 패널 ─────────────────────────────
function LifePanel({ credits, onDeduct, onClose }) {
  const [sub, setSub] = useState("estate");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [result, setResult] = useState(null);
  const cost = COST.life.mid;

  const SUBS = [
    { id:"estate", label:"🏠 부동산" },
    { id:"tax",    label:"📋 세무"   },
    { id:"public", label:"🏛️ 공공기관" },
  ];

  const LINKS = {
    estate: [
      { name:"국토부 실거래가 조회", url:()=>"https://rt.molit.go.kr" },
      { name:"네이버 부동산",       url:q=>`https://land.naver.com/search/index.naver?query=${encodeURIComponent(q)}` },
      { name:"KB부동산",           url:()=>"https://kbland.kr" },
      { name:"직방",               url:()=>"https://www.zigbang.com" },
      { name:"호갱노노",            url:()=>"https://hogangnono.com" },
    ],
    tax: [
      { name:"국세청 홈택스",   url:()=>"https://www.hometax.go.kr" },
      { name:"위택스 (지방세)", url:()=>"https://www.wetax.go.kr" },
      { name:"국세청 세금 계산기", url:()=>"https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2338&cntntsId=7739" },
      { name:"손택스 (모바일 홈택스)", url:()=>"https://www.hometax.go.kr/websquare/websquare.wq?w2xPath=/ui/pp/index_pp.xml" },
    ],
    public: [
      { name:"정부24 민원 검색",     url:q=>`https://www.gov.kr/search/search.do?sQuery=${encodeURIComponent(q)}` },
      { name:"민원24 바로가기",      url:()=>"https://www.minwon.go.kr" },
      { name:"대법원 인터넷 등기소", url:()=>"https://www.iros.go.kr" },
      { name:"정부민원안내 콜센터(110)", url:()=>"https://www.110.go.kr" },
    ],
  };

  const SYS = {
    estate: "부동산 전문가입니다. 부동산 시세, 세금(취득세·양도세·재산세), 청약, 임대차 관련 정보를 한국어로 상세히 설명하세요. 반드시 '이 정보는 참고용이며 정확한 사항은 전문가와 상담하세요'라는 안내를 포함하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
    tax:    "세무 전문가입니다. 세금 신고, 절세 방법, 세무 관련 절차를 한국어로 명확하게 설명하세요. 반드시 '이 정보는 참고용이며 정확한 세무 처리는 세무사와 상담하세요'라는 안내를 포함하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
    public: "공공 민원 안내 전문가입니다. 필요한 서류, 신청 방법, 관련 기관을 한국어로 상세히 안내하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
  };

  const PLACEHOLDER = {
    estate: "예) 아파트 취득세 계산, 전세 계약 주의사항",
    tax:    "예) 종합소득세 신고 방법, 연말정산 환급",
    public: "예) 주민등록등본 발급 방법, 여권 신청",
  };

  function runSimple() {
    if (!query.trim()) return;
    const links = [...LINKS[sub].map(l=>({ name:l.name, url:l.url(query) })), ...coreLinks(query)];
    setResult({ type:"links", items:links });
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🏠 부동산·세무·공공</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setQuery(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>setMode("ai")}>🤖 AI 분석 ({cost}회/답변)</button>
      </div>
      {mode==="simple" ? (
        <>
          <label style={css.label}>검색어 또는 질문</label>
          <input style={css.input}
            placeholder={PLACEHOLDER[sub]}
            value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && runSimple()} />
          <button style={css.runBtn(false)} onClick={runSimple}>🔍 검색하기</button>
          <ResultBox result={result} />
        </>
      ) : (
        <>
          <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
            💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
          </div>
          <AiChatThread key={sub}
            system={SYS[sub]} cost={cost} credits={credits} onDeduct={onDeduct}
            placeholder={PLACEHOLDER[sub]}
          />
        </>
      )}
    </>
  );
}

// ── 건강·의학 패널 ─────────────────────────────────────
function HealthPanel({ credits, onDeduct, onClose }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [result, setResult] = useState(null);
  const cost = COST.health.mid;

  function runSimple() {
    if (!query.trim()) return;
    setResult({ type:"links", items:[
      { name:"건강보험심사평가원 병원찾기", url:`https://www.hira.or.kr/re/finder/findDocInfo.do?sType=N&searchWord=${encodeURIComponent(query)}` },
      { name:"국가건강정보포털",   url:"https://health.kdca.go.kr" },
      { name:"네이버 건강 검색",   url:`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}+증상` },
      { name:"서울아산병원 질환백과", url:`https://www.amc.seoul.kr/asan/healthinfo/disease/diseaseDetailSearch.do?searchKeyword=${encodeURIComponent(query)}` },
      { name:"약학정보원 약품 검색", url:`https://www.health.kr/searchDrug/search_kor.asp?keyword=${encodeURIComponent(query)}` },
      { name:"응급의료포털 병원 찾기", url:"https://www.e-gen.or.kr" },
      ...coreLinks(query),
    ]});
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🩺 건강·의학 정보</div>
      <div style={{background:"rgba(233,30,99,0.08)",border:"1px solid rgba(233,30,99,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#F48FB1",marginBottom:14,textIndent:"-1.1em"}}>
        ⚠️ 일반 의학 정보 제공 목적이며 의사의 진단을 대체하지 않습니다.
      </div>
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 병원·기관 찾기 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>setMode("ai")}>🤖 AI 건강 정보 ({cost}회/답변)</button>
      </div>
      {mode==="simple" ? (
        <>
          <label style={{...css.label,marginTop:8}}>증상 또는 궁금한 내용</label>
          <textarea style={css.textarea}
            placeholder="예) 서울 내과"
            value={query} onChange={e=>setQuery(e.target.value)} />
          <button style={css.runBtn(false)} onClick={runSimple}>🔍 검색하기</button>
          <ResultBox result={result} />
        </>
      ) : (
        <>
          <div style={{fontSize:11.5, color:"#8B8DA0", marginTop:8, marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
            💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
          </div>
          <AiChatThread
            system="의학 정보 어시스턴트입니다. 일반적인 의학 지식을 제공하되, 반드시 마지막에 '⚠️ 이 정보는 참고용이며 정확한 진단은 전문의와 상담하세요.'를 포함하세요. 한국어로 답변하고, 이전 대화 맥락을 기억해 이어서 답변하세요."
            cost={cost} credits={credits} onDeduct={onDeduct}
            placeholder="예) 두통이 3일째 지속되는데 어떤 과에 가야 하나요?"
          />
        </>
      )}
    </>
  );
}

// ── 스포츠·영화 패널 ───────────────────────────────────
function SportsMoviePanel({ credits, onDeduct, onClose }) {
  const [sub, setSub] = useState("sports");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [result, setResult] = useState(null);
  const cost = COST.sportsmovie.mid;

  const SUBS = [
    { id:"sports", label:"⚽ 스포츠" },
    { id:"movie",  label:"🎬 영화"  },
  ];

  const LINKS = {
    sports: [
      { name:"다음 스포츠",       url:()=>"https://sports.daum.net" },
      { name:"KBO 리그 정보",     url:()=>"https://www.koreabaseball.com" },
      { name:"FlashScore 실시간 스코어", url:q=>`https://www.flashscore.co.kr/search/?q=${encodeURIComponent(q)}` },
    ],
    movie: [
      { name:"CGV 예매",      url:()=>"https://www.cgv.co.kr" },
      { name:"메가박스 예매",  url:()=>"https://www.megabox.co.kr" },
      { name:"왓챠피디아",    url:q=>`https://pedia.watcha.com/ko-KR/search?query=${encodeURIComponent(q)}` },
    ],
  };

  const SYS = {
    sports: "스포츠 전문 어시스턴트입니다. 경기 일정, 규칙, 선수·팀 정보, 최근 이슈 등을 한국어로 명확하게 정리해 주세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
    movie:  "영화 전문 어시스턴트입니다. 줄거리, 평점, 비슷한 영화 추천, 감상 포인트 등을 한국어로 정리해 주세요. 이전 대화 맥락을 기억하고 이어서 답변하세요.",
  };

  const PLACEHOLDER = {
    sports: "예) 오늘 프로야구 경기 일정",
    movie:  "예) 최근 개봉한 SF 영화 추천",
  };

  function runSimple() {
    if (!query.trim()) return;
    const links = [...LINKS[sub].map(l=>({ name:l.name, url:l.url(query) })), ...coreLinks(query)];
    setResult({ type:"links", items:links });
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🍿 스포츠·영화</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setQuery(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>setMode("ai")}>🤖 AI 분석 ({cost}회/답변)</button>
      </div>
      {mode==="simple" ? (
        <>
          <label style={css.label}>검색어 또는 질문</label>
          <input style={css.input}
            placeholder={PLACEHOLDER[sub]}
            value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter" && runSimple()} />
          <button style={css.runBtn(false)} onClick={runSimple}>🔍 검색하기</button>
          <ResultBox result={result} />
        </>
      ) : (
        <>
          <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
            💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
          </div>
          <AiChatThread key={sub}
            system={SYS[sub]} cost={cost} credits={credits} onDeduct={onDeduct}
            placeholder={PLACEHOLDER[sub]}
          />
        </>
      )}
    </>
  );
}

// ── 코딩 작업 패널 ─────────────────────────────────────
function CodePanel({ credits, onDeduct, onClose }) {
  const cost = COST.code.mid;
  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>💻 코딩 작업</div>
      <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
        💬 코드 작성·디버깅·설명을 도와드립니다. 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
      </div>
      <AiChatThread
        system="당신은 실력 있는 시니어 개발자입니다. 사용자의 코드 작성, 디버깅, 리팩토링, 개념 설명 요청을 돕습니다. 코드는 항상 코드블록으로 감싸서 보여주고, 한국어로 설명하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요."
        cost={cost} credits={credits} onDeduct={onDeduct}
        placeholder="예) 파이썬으로 피보나치 수열 함수 짜줘"
      />
    </>
  );
}

// ── 워크플로우 자동화 패널 ─────────────────────────────
function AutoPanel({ credits, onDeduct, onClose }) {
  const cost = COST.auto.mid;
  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>⚙️ 워크플로우 자동화</div>
      <div style={{background:"rgba(124,131,253,0.08)",border:"1px solid rgba(124,131,253,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#B8A6FF",marginBottom:14,textIndent:"-1.1em"}}>
        💡 지금은 자동화 시나리오를 설계해 드리는 단계이며, 실제 실행 연동은 추후 업데이트될 예정입니다.
      </div>
      <div style={{fontSize:11.5, color:"#8B8DA0", marginBottom:12, paddingLeft:"1.1em", textIndent:"-1.1em"}}>
        💬 답변마다 {cost}회씩 차감되며, 대화를 이어가면서 계속 질문할 수 있습니다.
      </div>
      <AiChatThread
        system="당신은 업무 자동화 컨설턴트입니다. 사용자가 반복적으로 하는 작업을 설명하면, 어떤 도구(예: Zapier, Make, n8n, 구글 스프레드시트 등)로 어떻게 자동화할 수 있는지 단계별 시나리오를 한국어로 구체적으로 제안하세요. 이전 대화 맥락을 기억하고 이어서 답변하세요."
        cost={cost} credits={credits} onDeduct={onDeduct}
        placeholder="예) 매일 아침 뉴스 요약해서 카톡으로 받고 싶어"
      />
    </>
  );
}

// ── 준비중 패널 ────────────────────────────────────────
function SoonPanel({ cat, onClose }) {
  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>{cat.icon} {cat.name}</div>
      <div style={{textAlign:"center",padding:"40px 0"}}>
        <div style={{fontSize:48,marginBottom:16}}>🚧</div>
        <div style={{fontSize:18,fontWeight:700,color:"#E8EAF6",marginBottom:8}}>준비 중입니다</div>
        <div style={{fontSize:14,color:"#6B7280"}}>곧 업데이트될 예정입니다!</div>
      </div>
    </>
  );
}

// ── 하단 광고 배너 ─────────────────────────────────────
// REACT_APP_ADSENSE_CLIENT / REACT_APP_ADSENSE_SLOT 등록 시 실제 구글 애드센스 광고가 표시됩니다.
// 등록 전에는 자리 안내용 디자인 배너가 대신 표시됩니다. (강제 클릭 유도 없음 — 정책 준수)
function AdBanner() {
  useEffect(() => {
    if (!ADSENSE_CLIENT || !ADSENSE_SLOT) return;
    try {
      if (!window.__adsbygoogleLoaded) {
        const script = document.createElement("script");
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
        script.async = true;
        script.crossOrigin = "anonymous";
        document.head.appendChild(script);
        window.__adsbygoogleLoaded = true;
      }
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) { /* 광고 로드 실패는 무시 (본 기능에 영향 없음) */ }
  }, []);

  if (ADSENSE_CLIENT && ADSENSE_SLOT) {
    return (
      <div style={{marginTop:10, marginBottom:2}}>
        <ins className="adsbygoogle"
          style={{ display:"block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true" />
      </div>
    );
  }

  // 광고 미설정 시: 텍스트 문구 대신 디자인된 배너 이미지(SVG)로 자리 표시
  return (
    <div style={{marginTop:10, marginBottom:2, borderRadius:14, overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 6px 16px rgba(0,0,0,0.4)"}}>
      <svg viewBox="0 0 400 84" style={{width:"100%", height:"auto", display:"block"}} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="adBg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff9a5a" />
            <stop offset="50%" stopColor="#ff6f9c" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <radialGradient id="adGlow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="84" rx="14" fill="url(#adBg)" />
        <circle cx="340" cy="20" r="60" fill="url(#adGlow1)" />
        <circle cx="40" cy="90" r="50" fill="url(#adGlow1)" />
        <circle cx="60" cy="30" r="16" fill="rgba(255,255,255,0.22)" />
        <circle cx="230" cy="60" r="10" fill="rgba(255,255,255,0.18)" />
        <circle cx="270" cy="24" r="7" fill="rgba(255,255,255,0.25)" />
        <path d="M170 42 l6 -14 l6 14 l14 2 l-11 9 l4 14 l-13 -8 l-13 8 l4 -14 l-11 -9 z" fill="rgba(255,255,255,0.85)" />
        <rect x="344" y="14" width="42" height="18" rx="5" fill="rgba(0,0,0,0.28)" />
        <text x="365" y="27" fontSize="9" textAnchor="middle" fill="#ffffff" fontFamily="sans-serif" fontWeight="700">AD</text>
      </svg>
    </div>
  );
}

// ── 메인 앱 ────────────────────────────────────────────
export default function App() {
  const [credits, setCredits] = useState(100);
  const [panel, setPanel] = useState(null);
  const [hovered, setHovered] = useState(null);

  // 스마트폰 뒤로가기를 눌러도 앱이 종료되지 않고 메인 화면으로 돌아오게 처리
  useEffect(() => {
    const onPop = () => setPanel(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openPanel(cat) {
    window.history.pushState({ allhubPanel: true }, "");
    setPanel(cat);
  }

  function closePanel() {
    if (window.history.state && window.history.state.allhubPanel) {
      window.history.back();
    } else {
      setPanel(null);
    }
  }

  function deduct(n) {
    setCredits(prev => Math.max(0, +(prev - n).toFixed(1)));
  }

  function renderPanel() {
    if (!panel) return null;
    const close = closePanel;
    const props = { credits, onDeduct:deduct, onClose:close };
    if (panel.id==="image")  return <ImagePanel  {...props} />;
    if (panel.id==="music")  return <MusicPanel  {...props} />;
    if (panel.id==="video")  return <VideoPanel  {...props} />;
    if (panel.id==="shorts") return <ShortsPanel {...props} />;
    if (panel.id==="file")   return <FilePanel   {...props} />;
    if (panel.id==="search")   return <SearchPanel {...props} />;
    if (panel.id==="research") return <SearchPanel {...props} fixedMode="ai" />;
    if (panel.id==="office") return <OfficePanel {...props} />;
    if (panel.id==="shop")   return <ShopPanel   {...props} />;
    if (panel.id==="life")   return <LifePanel   {...props} />;
    if (panel.id==="health") return <HealthPanel {...props} />;
    if (panel.id==="sportsmovie") return <SportsMoviePanel {...props} />;
    if (panel.id==="code") return <CodePanel {...props} />;
    if (panel.id==="auto") return <AutoPanel {...props} />;
    return <SoonPanel cat={panel} onClose={close} />;
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"radial-gradient(ellipse 120% 60% at 20% -10%, rgba(124,93,250,0.16), transparent 55%), radial-gradient(ellipse 100% 50% at 100% 10%, rgba(56,189,248,0.08), transparent 50%), #100e1a",
      color:"#E8EAF6",
      fontFamily:"'Segoe UI','Apple SD Gothic Neo',sans-serif",
    }}>
      <header style={{
        background:"rgba(255,255,255,0.04)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.08)",
        padding:"0 22px", height:46,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{
          fontSize:22, fontWeight:600,
          background:"linear-gradient(135deg,#7C83FD,#A78BFA)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>✦ AllHub</div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{
            background:"rgba(124,131,253,0.15)",
            border:"1px solid rgba(124,131,253,0.3)",
            borderRadius:20, padding:"6px 14px",
            fontSize:13, color:"#A78BFA", fontWeight:400,
          }}>⚡ 사용 가능 <strong style={{fontWeight:600}}>{credits}회</strong></div>
          <div style={{
            background:"linear-gradient(135deg,#7C83FD,#A78BFA)",
            borderRadius:20, padding:"6px 14px",
            fontSize:13, fontWeight:500, color:"#fff", cursor:"pointer",
          }}>충전</div>
        </div>
      </header>

      <main style={{maxWidth:1100, margin:"0 auto", padding:"9px 16px 6px"}}>
        <div style={{marginBottom:9}}>
          <h1 style={{fontSize:19, fontWeight:600, color:"#E8EAF6", marginBottom:2, letterSpacing:"-0.4px"}}>
            무엇을 도와 드릴까요?
          </h1>
          <p style={{fontSize:12, color:"#6B7280", margin:0, fontWeight:400}}>
            검색, 문서, 이미지, 음악, 건강, 생활, 코딩 — 구독 여러 개가 필요 없습니다.
          </p>
        </div>

        {["검색·업무","창작 스튜디오"].map(group => {
          const cats = CATS.filter(c=>c.group===group);
          if (!cats.length) return null;
          const color = GC[group];
          return (
            <div key={group}>
              <div style={{marginTop:7, marginBottom:4}}>
                <span style={{
                  background:`${color}22`, color,
                  padding:"2px 10px", borderRadius:20,
                  fontSize:10, fontWeight:700,
                  border:`1px solid ${color}44`,
                }}>{group}</span>
              </div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",
                gap:6, marginBottom:0,
              }}>
                {cats.map(cat=>{
                  const standalone = cats.length % 2 === 1 && cats.indexOf(cat) === cats.length - 1;
                  return (
                  <div key={cat.id}
                    style={{
                      background:"linear-gradient(160deg, #262842 0%, #1a1b2e 55%, #131322 100%)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      borderTop: hovered===cat.id && cat.phase===1 ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(255,255,255,0.22)",
                      borderRadius:13, padding:"8px 9px",
                      cursor: cat.phase===1 ? "pointer" : "default",
                      opacity: cat.phase===2 ? 0.72 : 1,
                      transition:"all 0.18s",
                      transform: hovered===cat.id && cat.phase===1 ? "translateY(-2px)" : "none",
                      boxShadow: hovered===cat.id && cat.phase===1
                        ? "0 14px 26px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45)"
                        : "0 10px 20px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.35)",
                      position:"relative",
                      display:"flex", alignItems: cat.sub ? "flex-start" : "center", gap:10,
                      gridColumn: standalone ? "1 / -1" : "auto",
                    }}
                    onClick={()=>cat.phase===1 && openPanel(cat)}
                    onMouseEnter={()=>setHovered(cat.id)}
                    onMouseLeave={()=>setHovered(null)}
                  >
                    {cat.phase===2 && (
                      <span style={{
                        position:"absolute", top:8, right:8,
                        background:"rgba(255,255,255,0.06)",
                        borderRadius:6, padding:"2px 6px",
                        fontSize:8.5, color:"#8B8DA0", fontWeight:700,
                      }}>SOON</span>
                    )}
                    <div style={{
                      width:29, height:29, borderRadius:9, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:15,
                      background:`radial-gradient(circle at 32% 28%, ${cat.grad[0]}, ${cat.grad[1]} 70%)`,
                      boxShadow:"0 6px 10px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.4), inset 0 1.5px 2px rgba(255,255,255,0.55), inset 0 -3px 4px rgba(0,0,0,0.3)",
                    }}>{cat.icon}</div>
                    <div style={{minWidth:0}}>
                      <div style={{
                        fontSize:12.5, fontWeight:400, letterSpacing:"-0.1px",
                        color: cat.phase===2 ? "#C7C9D6" : "#ECEAFC",
                        lineHeight:1.2, wordBreak:"keep-all", whiteSpace: cat.sub ? "normal" : "nowrap",
                      }}>{cat.name}</div>
                      {cat.sub && (
                        <div style={{color:"#7B7E93", fontSize:9, marginTop:1}}>{cat.sub}</div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 건강 · 스포츠·영화 - 화면 공간 절약을 위해 한 줄로 결합 배치 */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:7, marginBottom:0}}>
          {[
            { group:"건강", cat: CATS.find(c=>c.id==="health") },
            { group:"스포츠·영화", cat: CATS.find(c=>c.id==="sportsmovie") },
          ].map(({group, cat}) => (
            <div key={group}>
              <div style={{marginBottom:6}}>
                <span style={{
                  background:`${GC[group]}22`, color:GC[group],
                  padding:"2px 10px", borderRadius:20,
                  fontSize:10, fontWeight:700,
                  border:`1px solid ${GC[group]}44`,
                }}>{group}</span>
              </div>
              <div
                style={{
                  background:"linear-gradient(160deg, #262842 0%, #1a1b2e 55%, #131322 100%)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderTop: hovered===cat.id ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(255,255,255,0.22)",
                  borderRadius:13, padding:"8px 9px",
                  cursor:"pointer",
                  transition:"all 0.18s",
                  transform: hovered===cat.id ? "translateY(-2px)" : "none",
                  boxShadow: hovered===cat.id
                    ? "0 14px 26px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45)"
                    : "0 10px 20px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.35)",
                  display:"flex", alignItems:"center", gap:10,
                }}
                onClick={()=>openPanel(cat)}
                onMouseEnter={()=>setHovered(cat.id)}
                onMouseLeave={()=>setHovered(null)}
              >
                <div style={{
                  width:29, height:29, borderRadius:9, flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:15,
                  background:`radial-gradient(circle at 32% 28%, ${cat.grad[0]}, ${cat.grad[1]} 70%)`,
                  boxShadow:"0 6px 10px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.4), inset 0 1.5px 2px rgba(255,255,255,0.55), inset 0 -3px 4px rgba(0,0,0,0.3)",
                }}>{cat.icon}</div>
                <div style={{
                  fontSize:12.5, fontWeight:400, letterSpacing:"-0.1px",
                  color:"#ECEAFC", lineHeight:1.2, wordBreak:"keep-all", whiteSpace:"nowrap",
                }}>{cat.name}</div>
              </div>
            </div>
          ))}
        </div>

        {GROUP_GROUPS.slice(2).map(group => {
          const cats = CATS.filter(c=>c.group===group);
          if (!cats.length) return null;
          const color = GC[group];
          return (
            <div key={group}>
              <div style={{marginTop:7, marginBottom:4}}>
                <span style={{
                  background:`${color}22`, color,
                  padding:"2px 10px", borderRadius:20,
                  fontSize:10, fontWeight:700,
                  border:`1px solid ${color}44`,
                }}>{group}</span>
              </div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",
                gap:6, marginBottom:0,
              }}>
                {cats.map(cat=>{
                  const standalone = cats.length % 2 === 1 && cats.indexOf(cat) === cats.length - 1;
                  return (
                  <div key={cat.id}
                    style={{
                      background:"linear-gradient(160deg, #262842 0%, #1a1b2e 55%, #131322 100%)",
                      border:"1px solid rgba(255,255,255,0.08)",
                      borderTop: hovered===cat.id && cat.phase===1 ? "1px solid rgba(255,255,255,0.32)" : "1px solid rgba(255,255,255,0.22)",
                      borderRadius:13, padding:"8px 9px",
                      cursor: cat.phase===1 ? "pointer" : "default",
                      opacity: cat.phase===2 ? 0.72 : 1,
                      transition:"all 0.18s",
                      transform: hovered===cat.id && cat.phase===1 ? "translateY(-2px)" : "none",
                      boxShadow: hovered===cat.id && cat.phase===1
                        ? "0 14px 26px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45)"
                        : "0 10px 20px rgba(0,0,0,0.5), 0 3px 6px rgba(0,0,0,0.35)",
                      position:"relative",
                      display:"flex", alignItems: cat.sub ? "flex-start" : "center", gap:10,
                      gridColumn: standalone ? "1 / -1" : "auto",
                    }}
                    onClick={()=>cat.phase===1 && openPanel(cat)}
                    onMouseEnter={()=>setHovered(cat.id)}
                    onMouseLeave={()=>setHovered(null)}
                  >
                    {cat.phase===2 && (
                      <span style={{
                        position:"absolute", top:8, right:8,
                        background:"rgba(255,255,255,0.06)",
                        borderRadius:6, padding:"2px 6px",
                        fontSize:8.5, color:"#8B8DA0", fontWeight:700,
                      }}>SOON</span>
                    )}
                    <div style={{
                      width:29, height:29, borderRadius:9, flexShrink:0,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:15,
                      background:`radial-gradient(circle at 32% 28%, ${cat.grad[0]}, ${cat.grad[1]} 70%)`,
                      boxShadow:"0 6px 10px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.4), inset 0 1.5px 2px rgba(255,255,255,0.55), inset 0 -3px 4px rgba(0,0,0,0.3)",
                    }}>{cat.icon}</div>
                    <div style={{minWidth:0}}>
                      <div style={{
                        fontSize:12.5, fontWeight:400, letterSpacing:"-0.1px",
                        color: cat.phase===2 ? "#C7C9D6" : "#ECEAFC",
                        lineHeight:1.2, wordBreak:"keep-all", whiteSpace: cat.sub ? "normal" : "nowrap",
                      }}>{cat.name}</div>
                      {cat.sub && (
                        <div style={{color:"#7B7E93", fontSize:9, marginTop:1}}>{cat.sub}</div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <AdBanner />
      </main>

      {panel && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget && setPanel(null)}>
          <div style={css.box}>{renderPanel()}</div>
        </div>
      )}
    </div>
  );
}
