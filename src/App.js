import { useState } from "react";

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

// 크레딧 차감표
const COST = {
  image:  { low:0.5, mid:1,   high:2 },
  music:  { low:0.5, mid:1,   high:2 },
  video:  { low:1,   mid:2,   high:4 },
  shorts: { low:1,   mid:2,   high:4 },
  file:   { low:0.5, mid:0.5, high:0.5 },
  search: { low:0,   mid:0.5, high:1 },
  office: { low:0.5, mid:1,   high:2 },
  life:   { low:0,   mid:0.5, high:1 },
  health: { low:0,   mid:0.5, high:1 },
};

// 카테고리 목록
const CATS = [
  { id:"image",  icon:"🖼️",  name:"이미지 생성",      group:"창작",    phase:1 },
  { id:"music",  icon:"🎵",  name:"음악 생성",        group:"창작",    phase:1 },
  { id:"video",  icon:"🎬",  name:"동영상 생성",      group:"창작",    phase:1 },
  { id:"shorts", icon:"📱",  name:"쇼츠 제작",       group:"창작",    phase:1 },
  { id:"search", icon:"🔍",  name:"검색·리서치",      group:"업무·정보", phase:1 },
  { id:"office", icon:"📝",  name:"스마트 오피스",    group:"업무·정보", phase:1 },
  { id:"file",   icon:"🔄",  name:"파일 도구·변환",   group:"업무·정보", phase:1 },
  { id:"shop",   icon:"🛍️", name:"쇼핑·여행·교통",  group:"생활편의", phase:1 },
  { id:"life",   icon:"🏠",  name:"부동산·세무·공공", group:"생활편의", phase:1 },
  { id:"health", icon:"🩺",  name:"건강·의학 정보",   group:"건강",    phase:1 },
  { id:"code",   icon:"💻",  name:"코딩 보조",       group:"추후",    phase:2 },
  { id:"auto",   icon:"⚡",  name:"워크플로우 자동화", group:"추후",    phase:2 },
];

const GROUP_GROUPS = ["창작","업무·정보","생활편의","건강","추후"];
const GC = {
  "창작":     "#4CAF50",
  "업무·정보": "#2196F3",
  "생활편의": "#FF9800",
  "건강":     "#E91E63",
  "추후":     "#9E9E9E",
};

// ── API 호출 함수 ──────────────────────────────────────
async function genImage(prompt, quality) {
  const width  = quality==="high" ? 1024 : quality==="mid" ? 768 : 512;
  const height = width;
  const seed   = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

async function genText(system, user) {
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
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  if (res.status === 429) throw new Error("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
  if (res.status === 401) throw new Error("API 키가 올바르지 않습니다. Vercel 환경변수를 확인해 주세요.");
  if (!res.ok) throw new Error("텍스트 생성 실패: " + res.status);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "응답 없음";
}

// 음악 생성 (Vercel 서버 함수 /api/music 경유 → 서버가 Hugging Face 호출)
// ⚠️ Hugging Face는 브라우저 직접 호출을 막아두어(CORS), 반드시 서버를 거쳐야 합니다.
async function genMusic(prompt) {
  const res = await fetch("/api/music", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "음악 생성 실패: " + res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// 동영상 생성 (Vercel 서버 함수 /api/video 경유 → 서버가 Hugging Face 호출)
// ⚠️ 무료 모델이라 짧고(2~3초) 저해상도입니다. 세로 변환은 지원하지 않아 쇼츠도 같은 방식으로 생성됩니다.
async function genVideo(prompt) {
  const res = await fetch("/api/video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "동영상 생성 실패: " + res.status);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// 파일 변환 (CloudConvert API: job 생성 → 업로드 → 대기 → 다운로드 URL)
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
    alignItems:"center", justifyContent:"center", padding:16,
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
function QualityBar({ val, set }) {
  return (
    <div style={{display:"flex", gap:8, marginBottom:14}}>
      {[["low","저품질 (0.5회)"],["mid","일반 (1회)"],["high","고품질 (2회)"]].map(([k,v])=>(
        <button key={k} style={css.qualityBtn(val===k)} onClick={()=>set(k)}>{v}</button>
      ))}
    </div>
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

// ── 이미지 생성 패널 ───────────────────────────────────
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
      <div style={css.title}>🖼️ 이미지 생성</div>
      <label style={css.label}>품질 선택</label>
      <QualityBar val={quality} set={setQuality} />
      <CostTag n={cost} />
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

// ── 음악 생성 패널 ─────────────────────────────────────
function MusicPanel({ credits, onDeduct, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.music.mid;

  async function run() {
    if (!prompt.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const url = await genMusic(prompt);
      setResult(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🎵 음악 생성</div>
            <div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#81C784",marginBottom:14}}>
        💡 완전 무료 모델을 사용합니다. 약 8~10초 길이의 짧은 연주곡이 생성되며, 첫 호출 시 20~30초 정도 걸릴 수 있습니다.
      </div>
      <CostTag n={cost} />
      <label style={css.label}>음악 설명 (분위기, 장르 등)</label>
      <textarea style={css.textarea}
        placeholder="예) 잔잔한 로파이 힙합, 비 오는 밤 감성"
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 생성 중... (최대 30초 소요)" : "✨ 음악 생성하기"}
      </button>
      {result && (
        <div style={css.result}>
          <div style={{fontSize:12,color:"#6B7280",marginBottom:10}}>✅ 생성 완료</div>
          <audio controls style={{width:"100%"}} src={result} />
        </div>
      )}
    </>
  );
}

// ── 동영상 생성 패널 ───────────────────────────────────
function VideoPanel({ credits, onDeduct, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.video.mid;

  async function run() {
    if (!prompt.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const url = await genVideo(prompt);
      setResult(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🎬 동영상 생성</div>
            <div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#81C784",marginBottom:14}}>
        💡 완전 무료 모델을 사용합니다. 2~3초 길이의 짧고 저해상도 영상이 생성되며, 첫 호출 시 20~30초 정도 걸릴 수 있습니다.
      </div>
      <CostTag n={cost} />
      <label style={css.label}>영상 설명</label>
      <textarea style={css.textarea}
        placeholder="예) 파도가 치는 해변 위로 갈매기가 날아가는 모습"
        value={prompt} onChange={e=>setPrompt(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 생성 중... (최대 30초 소요)" : "✨ 동영상 생성하기"}
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
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [script, setScript] = useState(null);
  const [err, setErr] = useState("");
  const cost = COST.shorts.mid;

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
      const url = await genVideo(scene);
      setVideoUrl(url); onDeduct(cost);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>📱 쇼츠 제작</div>
            <div style={{background:"rgba(76,175,80,0.08)",border:"1px solid rgba(76,175,80,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#81C784",marginBottom:14}}>
        💡 완전 무료 모델을 사용합니다. 무료 모델 한계로 세로(9:16) 비율은 지원하지 않아 가로 영상으로 생성됩니다. AI가 대본을 먼저 만들고, 그 장면으로 짧은 영상을 생성합니다.
      </div>
      <CostTag n={cost} />
      <label style={css.label}>쇼츠 주제</label>
      <textarea style={css.textarea}
        placeholder="예) 아침 루틴 꿀팁, 여름 다이어트 3가지 방법"
        value={topic} onChange={e=>setTopic(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 제작 중... (최대 30초 소요)" : "✨ 쇼츠 만들기"}
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
      <div style={css.title}>🔄 파일 도구·변환</div>
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
function SearchPanel({ credits, onDeduct, onClose }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = mode==="simple" ? 0 : COST.search.mid;

  async function run() {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      if (mode==="simple") {
        setResult({ type:"links", items:[
          { name:"Google 검색", url:`https://www.google.com/search?q=${encodeURIComponent(query)}` },
          { name:"네이버 검색", url:`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}` },
          { name:"Wikipedia",  url:`https://ko.wikipedia.org/wiki/${encodeURIComponent(query)}` },
        ]});
      } else {
        const text = await genText(
          "당신은 전문 리서치 어시스턴트입니다. 사용자의 질문에 대해 핵심 정보를 명확하게 한국어로 정리해 주세요. 근거와 함께 체계적으로 설명하세요.",
          query
        );
        setResult({ type:"text", text }); onDeduct(cost);
      }
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🔍 검색·리서치</div>
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>{ setMode("ai");     setResult(null); }}>🤖 AI 검색 ({COST.search.mid}회)</button>
      </div>
      {mode==="ai" && <CostTag n={cost} />}
      <label style={css.label}>검색어 또는 질문</label>
      <textarea style={css.textarea}
        placeholder={mode==="simple" ? "예) 파이썬 무료 강의" : "예) 2026년 AI 시장 트렌드를 정리해줘"}
        value={query} onChange={e=>setQuery(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 검색 중..." : "🔍 검색하기"}
      </button>
      <ResultBox result={result} />
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

  async function run() {
    if (!input.trim()) return;
    if (credits < cost) { setErr("작업 횟수가 부족합니다."); return; }
    setLoading(true); setErr(""); setResult(null);
    try {
      const s = SUBS.find(x=>x.id===sub);
      const text = await genText(s.sys, input);
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
      <QualityBar val={quality} set={setQuality} />
      <CostTag n={cost} />
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = mode==="simple" ? 0 : COST.life.mid;

  const SUBS = [
    { id:"shop",    label:"🛒 쇼핑" },
    { id:"travel",  label:"✈️ 여행" },
    { id:"traffic", label:"🚇 교통" },
  ];

  const LINKS = {
    shop: [
      { name:"네이버쇼핑", url:q=>`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}&where=shopping` },
      { name:"쿠팡",       url:q=>`https://www.coupang.com/np/search?q=${encodeURIComponent(q)}` },
      { name:"11번가",     url:q=>`https://search.11st.co.kr/Search.tmall?kwd=${encodeURIComponent(q)}` },
    ],
    travel: [
      { name:"네이버 여행", url:q=>`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}+여행` },
      { name:"야놀자",      url:q=>`https://www.yanolja.com/search?keyword=${encodeURIComponent(q)}` },
      { name:"스카이스캐너", url:q=>`https://www.skyscanner.co.kr/flights/${encodeURIComponent(q)}` },
    ],
    traffic: [
      { name:"네이버 지도 길찾기", url:q=>`https://map.naver.com/v5/search/${encodeURIComponent(q)}` },
      { name:"카카오맵 길찾기",    url:q=>`https://map.kakao.com/?q=${encodeURIComponent(q)}` },
      { name:"코레일 기차 예매",   url:()=>"https://www.letskorail.com" },
    ],
  };

  const SYS = {
    shop:    "전문 쇼핑 어드바이저입니다. 제품 구매 가이드, 가격 범위, 선택 포인트를 한국어로 상세히 정리하세요.",
    travel:  "여행 전문가입니다. 입력된 여행지나 여행 관련 질문에 대해 일정 추천, 명소, 비용, 팁을 한국어로 정리하세요.",
    traffic: "교통 전문가입니다. 대중교통, 기차, 항공, 선박 등 교통 관련 정보를 한국어로 상세히 안내하세요.",
  };

  const PLACEHOLDER = {
    shop:    "예) 노트북 추천, 아이폰 케이스",
    travel:  "예) 제주도 3박 4일 여행 코스",
    traffic: "예) 서울에서 부산 가는 기차 시간표",
  };

  async function run() {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      if (mode==="simple") {
        const links = LINKS[sub].map(l=>({ name:l.name, url:l.url(query) }));
        setResult({ type:"links", items:links });
      } else {
        const text = await genText(SYS[sub], query);
        setResult({ type:"text", text }); onDeduct(cost);
      }
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🛍️ 쇼핑·여행·교통</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setErr(""); setQuery(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>{ setMode("ai");     setResult(null); }}>🤖 AI 분석 ({COST.life.mid}회)</button>
      </div>
      {mode==="ai" && <CostTag n={cost} />}
      <label style={css.label}>검색어</label>
      <input style={css.input}
        placeholder={PLACEHOLDER[sub]}
        value={query} onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>e.key==="Enter" && run()} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 검색 중..." : "🔍 검색하기"}
      </button>
      <ResultBox result={result} />
    </>
  );
}

// ── 부동산·세무·공공 패널 ─────────────────────────────
function LifePanel({ credits, onDeduct, onClose }) {
  const [sub, setSub] = useState("estate");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = mode==="simple" ? 0 : COST.life.mid;

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
    ],
    tax: [
      { name:"국세청 홈택스", url:()=>"https://www.hometax.go.kr" },
      { name:"위택스 (지방세)", url:()=>"https://www.wetax.go.kr" },
      { name:"국세청 세금 계산기", url:()=>"https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2338&cntntsId=7739" },
    ],
    public: [
      { name:"정부24 민원 검색", url:q=>`https://www.gov.kr/search/search.do?sQuery=${encodeURIComponent(q)}` },
      { name:"민원24 바로가기",  url:()=>"https://www.minwon.go.kr" },
      { name:"대법원 인터넷 등기소", url:()=>"https://www.iros.go.kr" },
    ],
  };

  const SYS = {
    estate: "부동산 전문가입니다. 부동산 시세, 세금(취득세·양도세·재산세), 청약, 임대차 관련 정보를 한국어로 상세히 설명하세요. 반드시 '이 정보는 참고용이며 정확한 사항은 전문가와 상담하세요'라는 안내를 포함하세요.",
    tax:    "세무 전문가입니다. 세금 신고, 절세 방법, 세무 관련 절차를 한국어로 명확하게 설명하세요. 반드시 '이 정보는 참고용이며 정확한 세무 처리는 세무사와 상담하세요'라는 안내를 포함하세요.",
    public: "공공 민원 안내 전문가입니다. 필요한 서류, 신청 방법, 관련 기관을 한국어로 상세히 안내하세요.",
  };

  const PLACEHOLDER = {
    estate: "예) 아파트 취득세 계산, 전세 계약 주의사항",
    tax:    "예) 종합소득세 신고 방법, 연말정산 환급",
    public: "예) 주민등록등본 발급 방법, 여권 신청",
  };

  async function run() {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      if (mode==="simple") {
        const links = LINKS[sub].map(l=>({ name:l.name, url:l.url(query) }));
        setResult({ type:"links", items:links });
      } else {
        const text = await genText(SYS[sub], query);
        setResult({ type:"text", text }); onDeduct(cost);
      }
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🏠 부동산·세무·공공</div>
      <div style={css.tabRow}>
        {SUBS.map(s=>(
          <button key={s.id} style={css.tabBtn(sub===s.id)}
            onClick={()=>{ setSub(s.id); setResult(null); setErr(""); setQuery(""); }}>{s.label}</button>
        ))}
      </div>
      <div style={css.divider} />
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 단순 검색 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>{ setMode("ai");     setResult(null); }}>🤖 AI 분석 ({COST.life.mid}회)</button>
      </div>
      {mode==="ai" && <CostTag n={cost} />}
      <label style={css.label}>검색어 또는 질문</label>
      <input style={css.input}
        placeholder={PLACEHOLDER[sub]}
        value={query} onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>e.key==="Enter" && run()} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 검색 중..." : "🔍 검색하기"}
      </button>
      <ResultBox result={result} />
    </>
  );
}

// ── 건강·의학 패널 ─────────────────────────────────────
function HealthPanel({ credits, onDeduct, onClose }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("simple");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const cost = mode==="ai" ? COST.health.mid : 0;

  async function run() {
    if (!query.trim()) return;
    setLoading(true); setErr(""); setResult(null);
    try {
      if (mode==="simple") {
        setResult({ type:"links", items:[
          { name:"건강보험심사평가원 병원찾기", url:`https://www.hira.or.kr/re/finder/findDocInfo.do?sType=N&searchWord=${encodeURIComponent(query)}` },
          { name:"국가건강정보포털", url:"https://health.kdca.go.kr" },
          { name:"네이버 건강 검색", url:`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}+증상` },
        ]});
      } else {
        const text = await genText(
          "의학 정보 어시스턴트입니다. 일반적인 의학 지식을 제공하되, 반드시 마지막에 '⚠️ 이 정보는 참고용이며 정확한 진단은 전문의와 상담하세요.'를 포함하세요. 한국어로 답변하세요.",
          query
        );
        setResult({ type:"text", text }); onDeduct(cost);
      }
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
      <CloseBtn onClose={onClose} />
      <div style={css.title}>🩺 건강·의학 정보</div>
      <div style={{background:"rgba(233,30,99,0.08)",border:"1px solid rgba(233,30,99,0.2)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#F48FB1",marginBottom:14}}>
        ⚠️ 일반 의학 정보 제공 목적이며 의사의 진단을 대체하지 않습니다.
      </div>
      <div style={css.tabRow}>
        <button style={css.modeBtn(mode==="simple")} onClick={()=>{ setMode("simple"); setResult(null); }}>🔗 병원·기관 찾기 (무료)</button>
        <button style={css.modeBtn(mode==="ai")}     onClick={()=>{ setMode("ai");     setResult(null); }}>🤖 AI 건강 정보 ({COST.health.mid}회)</button>
      </div>
      {mode==="ai" && <CostTag n={cost} />}
      <label style={{...css.label,marginTop:8}}>증상 또는 궁금한 내용</label>
      <textarea style={css.textarea}
        placeholder={mode==="simple"?"예) 서울 내과":"예) 두통이 3일째 지속되는데 어떤 과에 가야 하나요?"}
        value={query} onChange={e=>setQuery(e.target.value)} />
      {err && <div style={css.errMsg}>{err}</div>}
      <button style={css.runBtn(loading)} onClick={run} disabled={loading}>
        {loading ? "⏳ 검색 중..." : "🔍 검색하기"}
      </button>
      <ResultBox result={result} />
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

// ── 메인 앱 ────────────────────────────────────────────
export default function App() {
  const [credits, setCredits] = useState(100);
  const [panel, setPanel] = useState(null);
  const [hovered, setHovered] = useState(null);

  function deduct(n) {
    setCredits(prev => Math.max(0, +(prev - n).toFixed(1)));
  }

  function renderPanel() {
    if (!panel) return null;
    const close = () => setPanel(null);
    const props = { credits, onDeduct:deduct, onClose:close };
    if (panel.id==="image")  return <ImagePanel  {...props} />;
    if (panel.id==="music")  return <SoonPanel cat={panel} onClose={close} />;
    if (panel.id==="video")  return <VideoPanel  {...props} />;
    if (panel.id==="shorts") return <ShortsPanel {...props} />;
    if (panel.id==="file")   return <FilePanel   {...props} />;
    if (panel.id==="search") return <SearchPanel {...props} />;
    if (panel.id==="office") return <OfficePanel {...props} />;
    if (panel.id==="shop")   return <ShopPanel   {...props} />;
    if (panel.id==="life")   return <LifePanel   {...props} />;
    if (panel.id==="health") return <HealthPanel {...props} />;
    return <SoonPanel cat={panel} onClose={close} />;
  }

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(135deg,#0F0F1A 0%,#1A1A2E 50%,#16213E 100%)",
      color:"#E8EAF6",
      fontFamily:"'Segoe UI','Apple SD Gothic Neo',sans-serif",
    }}>
      <header style={{
        background:"rgba(255,255,255,0.04)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid rgba(255,255,255,0.08)",
        padding:"0 24px", height:64,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{
          fontSize:22, fontWeight:700,
          background:"linear-gradient(135deg,#7C83FD,#A78BFA)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>✦ AllHub</div>
        <div style={{display:"flex", alignItems:"center", gap:10}}>
          <div style={{
            background:"rgba(124,131,253,0.15)",
            border:"1px solid rgba(124,131,253,0.3)",
            borderRadius:20, padding:"6px 14px",
            fontSize:13, color:"#A78BFA", fontWeight:600,
          }}>⚡ 남은 작업 <strong>{credits}회</strong></div>
          <div style={{
            background:"linear-gradient(135deg,#7C83FD,#A78BFA)",
            borderRadius:20, padding:"6px 14px",
            fontSize:13, fontWeight:700, color:"#fff", cursor:"pointer",
          }}>충전</div>
        </div>
      </header>

      <main style={{maxWidth:1100, margin:"0 auto", padding:"28px 16px"}}>
        <div style={{marginBottom:28}}>
          <h1 style={{fontSize:26, fontWeight:700, color:"#E8EAF6", marginBottom:6, letterSpacing:"-0.5px"}}>
            무엇을 만들까요?
          </h1>
          <p style={{fontSize:14, color:"#6B7280", margin:0}}>
            이미지, 음악, 문서, 검색 — 구독 여러 개가 필요 없습니다.
          </p>
        </div>

        {GROUP_GROUPS.map(group => {
          const cats = CATS.filter(c=>c.group===group);
          if (!cats.length) return null;
          const color = GC[group];
          return (
            <div key={group}>
              <div style={{marginTop:22, marginBottom:10}}>
                <span style={{
                  background:`${color}22`, color,
                  padding:"3px 12px", borderRadius:20,
                  fontSize:11, fontWeight:700,
                  border:`1px solid ${color}44`,
                }}>{group}</span>
              </div>
              <div style={{
                display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",
                gap:10, marginBottom:4,
              }}>
                {cats.map(cat=>(
                  <div key={cat.id}
                    style={{
                      background: hovered===cat.id && cat.phase===1 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                      border:`1px solid rgba(255,255,255,${hovered===cat.id && cat.phase===1 ? "0.15":"0.07"})`,
                      borderRadius:14, padding:"16px 12px",
                      cursor: cat.phase===1 ? "pointer" : "default",
                      opacity: cat.phase===2 ? 0.5 : 1,
                      transition:"all 0.18s",
                      transform: hovered===cat.id && cat.phase===1 ? "translateY(-2px)" : "none",
                      position:"relative",
                    }}
                    onClick={()=>cat.phase===1 && setPanel(cat)}
                    onMouseEnter={()=>setHovered(cat.id)}
                    onMouseLeave={()=>setHovered(null)}
                  >
                    {cat.phase===2 && (
                      <div style={{
                        position:"absolute", top:7, right:7,
                        background:"rgba(100,100,100,0.4)",
                        borderRadius:6, padding:"2px 6px",
                        fontSize:9, color:"#9CA3AF", fontWeight:600,
                      }}>SOON</div>
                    )}
                    <div style={{fontSize:24, marginBottom:7}}>{cat.icon}</div>
                    <div style={{fontSize:12, fontWeight:600, color:"#E8EAF6", lineHeight:1.35}}>{cat.name}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop:40, padding:"16px 20px",
          background:"rgba(124,131,253,0.06)",
          border:"1px solid rgba(124,131,253,0.15)",
          borderRadius:12, fontSize:12, color:"#6B7280", lineHeight:1.7,
        }}>
          <strong style={{color:"#A78BFA"}}>💡 API 키 안내</strong><br/>
          텍스트·검색 기능: <strong style={{color:"#7C83FD"}}>Groq API 키</strong> — <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{color:"#7C83FD"}}>console.groq.com</a> 무료 가입<br/>
          음악·동영상·쇼츠: <strong style={{color:"#7C83FD"}}>Hugging Face 토큰</strong> — <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" style={{color:"#7C83FD"}}>huggingface.co</a> 무료 가입 (완전 무료, 카드 불필요, 서버 함수를 통해서만 호출됨)<br/>
          파일 변환: <strong style={{color:"#7C83FD"}}>CloudConvert API 키</strong> — <a href="https://cloudconvert.com/api/v2" target="_blank" rel="noopener noreferrer" style={{color:"#7C83FD"}}>cloudconvert.com</a> 무료 가입 (하루 25회 무료)<br/>
          Vercel 배포 시 Settings → Environment Variables 에 아래 등록:<br/>
          <code style={{color:"#A78BFA"}}>REACT_APP_GROQ_API_KEY</code>, <code style={{color:"#A78BFA"}}>HF_TOKEN</code>, <code style={{color:"#A78BFA"}}>REACT_APP_CLOUDCONVERT_KEY</code>
        </div>
      </main>

      {panel && (
        <div style={css.overlay} onClick={e=>e.target===e.currentTarget && setPanel(null)}>
          <div style={css.box}>{renderPanel()}</div>
        </div>
      )}
    </div>
  );
}
