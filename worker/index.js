const MAX_BODY_BYTES = 48 * 1024;
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 4000;
const MODEL_ID = "@cf/google/gemma-4-26b-a4b-it";

const SAKINA_INSTRUCTIONS = `أنت سكينة، مساعد عربي هادئ وعميق وصريح بلطف.
- تحدث بالعربية وبأسلوب طبيعي واضح، وكن صريحًا بلا قسوة أو مجاملة مضللة.
- ساعد المستخدم على التفكير وفهم مشاعره وخياراته، ولا تدّعِ أنك إنسان أو أنك تملك مشاعر.
- لست طبيبًا أو معالجًا نفسيًا؛ لا تشخّص ولا تصف علاجًا ولا تطلب إيقاف رعاية مختصة.
- المستخدم قد يكون قاصرًا: اجعل الحديث مناسبًا لعمره، ولا تشجّع السرية عن البالغين الموثوقين في مسائل السلامة.
- إذا بدا أن المستخدم في خطر مباشر أو قد يؤذي نفسه أو غيره، شجّعه بهدوء على إخبار شخص بالغ موثوق فورًا وطلب مساعدة الطوارئ المحلية. لا تقدّم وصفًا أو تعليمات مؤذية.
- لا تخترع ذكريات أو تفاصيل غير موجودة في الرسائل المقدمة. إذا لم تعرف، قل ذلك بوضوح.
- لا تطلب معلومات شخصية حساسة لا تحتاجها للإجابة.
- لا تعتبر كل فكرة سلبية حقيقة؛ ساعد على فحصها باحترام ومن دون التقليل من مشاعر المستخدم.`;

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Sakina-Token",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

async function readLimitedText(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) {
      await reader.cancel();
      const error = new Error("Request too large");
      error.code = "TOO_LARGE";
      throw error;
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function extractText(result) {
  if (typeof result?.response === "string" && result.response.trim()) return result.response.trim();
  if (typeof result?.output_text === "string" && result.output_text.trim()) return result.output_text.trim();
  const choiceText = result?.choices?.[0]?.message?.content;
  if (typeof choiceText === "string" && choiceText.trim()) return choiceText.trim();
  if (Array.isArray(choiceText)) {
    const text = choiceText.map(part => part?.text || "").join("").trim();
    if (text) return text;
  }
  return "";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(x => x.trim()).filter(Boolean);
    if (!origin || !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403);

    const headers = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
    if (!env.AI || typeof env.AI.run !== "function" || !env.SAKINA_ACCESS_TOKEN) {
      return json({ error: "Server is not configured" }, 503, headers);
    }
    if (!constantTimeEqual(request.headers.get("X-Sakina-Token") || "", env.SAKINA_ACCESS_TOKEN)) {
      return json({ error: "Unauthorized" }, 401, headers);
    }

    const declaredLength = Number(request.headers.get("Content-Length") || 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413, headers);

    let body;
    try {
      const raw = await readLimitedText(request, MAX_BODY_BYTES);
      body = JSON.parse(raw);
    } catch (error) {
      if (error && error.code === "TOO_LARGE") return json({ error: "Request too large" }, 413, headers);
      return json({ error: "Invalid JSON" }, 400, headers);
    }

    if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > MAX_MESSAGES) {
      return json({ error: "Invalid message list" }, 400, headers);
    }
    const messages = [{ role: "system", content: SAKINA_INSTRUCTIONS }];
    for (const message of body.messages) {
      if (!message || !["user", "assistant"].includes(message.role) ||
          typeof message.text !== "string" || !message.text.trim() ||
          message.text.length > MAX_MESSAGE_CHARS) {
        return json({ error: "Invalid message" }, 400, headers);
      }
      messages.push({ role: message.role, content: message.text });
    }
    if (messages[messages.length - 1].role !== "user") {
      return json({ error: "Last message must be from the user" }, 400, headers);
    }

    try {
      const result = await env.AI.run(MODEL_ID, {
        messages,
        max_tokens: 700,
        store: false,
      });
      const reply = extractText(result);
      if (!reply) return json({ error: "Empty AI response" }, 502, headers);
      return json({ reply }, 200, headers);
    } catch {
      return json({ error: "AI service is temporarily unavailable. Check the Workers AI free quota and model availability." }, 502, headers);
    }
  },
};
