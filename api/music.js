// Vercel 서버 함수: 공식 Hugging Face SDK로 wavespeed 제공자를 통해 음악 생성 시도
// (hf-inference 무료 제공자는 musicgen을 지원하지 않아, wavespeed 경로로 시도합니다)
import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "허용되지 않은 요청 방식입니다." });
  }

  const { prompt } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "음악 설명을 입력해 주세요." });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: "서버에 HF_TOKEN이 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요." });
  }

  try {
    const client = new InferenceClient(HF_TOKEN);
    const audioBlob = await client.textToSpeech({
      provider: "wavespeed",
      model: "facebook/musicgen-small",
      inputs: prompt,
    });

    const arrayBuffer = await audioBlob.arrayBuffer();
    res.setHeader("Content-Type", audioBlob.type || "audio/flac");
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    const msg = e?.message || "알 수 없는 오류";
    if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("unauthorized")) {
      return res.status(401).json({ error: "HF 토큰이 올바르지 않습니다. Vercel 환경변수를 확인해 주세요." });
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return res.status(429).json({ error: "무료 사용량(쿼터)을 초과했습니다. huggingface.co/settings/billing 에서 확인해 주세요." });
    }
    res.status(500).json({ error: "음악 생성 실패: " + msg });
  }
}
