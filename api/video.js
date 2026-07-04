// Vercel 서버 함수: 공식 Hugging Face SDK로 fal-ai 제공자를 통해 동영상 생성
// (hf-inference 무료 제공자는 text-to-video를 지원하지 않아, 실제로 지원되는 fal-ai 경로를 사용합니다)
import { InferenceClient } from "@huggingface/inference";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "허용되지 않은 요청 방식입니다." });
  }

  const { prompt } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "영상 설명을 입력해 주세요." });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  if (!HF_TOKEN) {
    return res.status(500).json({ error: "서버에 HF_TOKEN이 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요." });
  }

  try {
    const client = new InferenceClient(HF_TOKEN);
    const videoBlob = await client.textToVideo({
      provider: "fal-ai",
      model: "Wan-AI/Wan2.2-TI2V-5B",
      inputs: prompt,
    });

    const arrayBuffer = await videoBlob.arrayBuffer();
    res.setHeader("Content-Type", videoBlob.type || "video/mp4");
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (e) {
    const msg = e?.message || "알 수 없는 오류";
    if (msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("unauthorized")) {
      return res.status(401).json({ error: "HF 토큰이 올바르지 않습니다. Vercel 환경변수를 확인해 주세요." });
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return res.status(429).json({ error: "무료 사용량(쿼터)을 초과했습니다. huggingface.co/settings/billing 에서 확인해 주세요." });
    }
    res.status(500).json({ error: "동영상 생성 실패: " + msg });
  }
}

export const config = {
  api: {
    responseLimit: "20mb",
  },
};
