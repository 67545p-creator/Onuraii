
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const STYLES = {
  auto: "Tarife en uygun görsel stilini seç.",
  realistic: "Fotogerçekçi, doğal ışık, ayrıntılı dokular.",
  cartoon: "Kaliteli çizgi film, belirgin konturlar ve canlı renkler.",
  "3d": "Üç boyutlu render, hacimli nesneler ve gerçekçi gölgeler.",
  anime: "Anime çizimi, temiz çizgiler ve ayrıntılı gölgelendirme.",
  horror: "Korku konsept sanatı, atmosferik ışık ve derin gölgeler.",
  pixel: "Düzenli piksel sanatı, tutarlı piksel boyutu.",
  sketch: "Ayrıntılı kurşun kalem çizimi ve tarama gölgeleri.",
  fantasy: "Ayrıntılı fantastik konsept sanatı.",
  watercolor: "Suluboya, yumuşak renkler ve kâğıt dokusu."
};

const TEMPLATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    description: { type: "STRING" },
    style: { type: "STRING" },
    background: { type: "STRING" },
    width: { type: "INTEGER" },
    height: { type: "INTEGER" },
    layers: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING" },
          x: { type: "NUMBER" },
          y: { type: "NUMBER" },
          width: { type: "NUMBER" },
          height: { type: "NUMBER" },
          cx: { type: "NUMBER" },
          cy: { type: "NUMBER" },
          r: { type: "NUMBER" },
          rx: { type: "NUMBER" },
          ry: { type: "NUMBER" },
          x1: { type: "NUMBER" },
          y1: { type: "NUMBER" },
          x2: { type: "NUMBER" },
          y2: { type: "NUMBER" },
          color: { type: "STRING" },
          stroke: { type: "STRING" },
          strokeWidth: { type: "NUMBER" },
          opacity: { type: "NUMBER" },
          d: { type: "STRING" },
          text: { type: "STRING" },
          points: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                x: { type: "NUMBER" },
                y: { type: "NUMBER" }
              },
              required: ["x", "y"]
            }
          }
        },
        required: ["type"]
      }
    }
  },
  required: [
    "title", "description", "style",
    "background", "width", "height", "layers"
  ]
};

function ensureAI(res) {
  if (!ai) {
    res.status(500).json({
      error: "API anahtarı eksik. .env dosyasını kontrol et."
    });
    return false;
  }
  return true;
}

function boundedNumber(value, fallback = 0, min = -1000, max = 3000) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(min, Math.min(max, n))
    : fallback;
}

function safeColor(value, fallback = "#888888") {
  if (typeof value !== "string") return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function normalizeTemplate(data, prompt, style) {
  const allowedTypes = new Set([
    "rect", "ellipse", "circle", "line", "polygon", "text", "path"
  ]);

  const layers = Array.isArray(data.layers) ? data.layers : [];

  const normalizedLayers = layers.slice(0, 160)
    .filter(layer => layer && allowedTypes.has(layer.type))
    .map(layer => {
      const out = {
        type: layer.type,
        color: safeColor(layer.color),
        stroke: layer.stroke === "none"
          ? "none"
          : safeColor(layer.stroke, "none"),
        strokeWidth: boundedNumber(layer.strokeWidth, 1, 0, 100),
        opacity: boundedNumber(layer.opacity, 1, 0, 1)
      };

      for (const key of [
        "x", "y", "width", "height", "cx", "cy",
        "r", "rx", "ry", "x1", "y1", "x2", "y2"
      ]) {
        if (layer[key] !== undefined) {
          out[key] = boundedNumber(layer[key]);
        }
      }

      if (layer.type === "polygon") {
        out.points = Array.isArray(layer.points)
          ? layer.points.slice(0, 100).map(point => ({
              x: boundedNumber(point?.x),
              y: boundedNumber(point?.y)
            }))
          : [];
      }

      if (layer.type === "path") {
        out.d = typeof layer.d === "string"
          ? layer.d.slice(0, 5000)
          : "";
      }

      if (layer.type === "text") {
        out.text = typeof layer.text === "string"
          ? layer.text.slice(0, 200)
          : "";
      }

      return out;
    });

  return {
    title: String(data.title || prompt).slice(0, 150),
    description: String(data.description || "").slice(0, 500),
    style: String(data.style || style).slice(0, 40),
    background: safeColor(data.background, "#ffffff"),
    width: 1024,
    height: 1024,
    layers: normalizedLayers
  };
}

async function generateJson(model, prompt, schema) {
  const result = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  const text = result.text;
  if (!text) throw new Error("Model boş yanıt döndürdü.");

  return JSON.parse(text);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, configured: Boolean(ai), model: CHAT_MODEL });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Mesaj boş." });
    }

    if (!ensureAI(res)) return;

    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: `
Sen Onur AI adlı yardımcı bir asistansın.
Türkçe ve doğal konuş. Normal sohbeti koru.
Kullanıcı açıkça görsel şablonu istemedikçe JSON döndürme.
Kullanıcı mesajı: ${message}
`
    });

    res.json({ reply: result.text || "Yanıt oluşturulamadı." });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Sohbet yanıtı oluşturulamadı." });
  }
});

app.post("/api/drawing-plan", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const style = String(req.body?.style || "auto").toLowerCase();

    if (!prompt) {
      return res.status(400).json({ error: "Görsel tarifi boş." });
    }

    if (prompt.length > 4000) {
      return res.status(400).json({ error: "Görsel tarifi çok uzun." });
    }

    if (!ensureAI(res)) return;

    const template = await generateJson(
      CHAT_MODEL,
      `
Bir görsel çizim şablonu hazırla.
Kullanıcı tarifi: ${prompt}
Görsel stili: ${STYLES[style] || STYLES.auto}

1024x1024 tuval için geçerli JSON üret.
Yalnızca JSON verisi oluştur; Markdown, kod çiti ve açıklama ekleme.
Karakterin yüzünü, gövdesini, uzuvlarını ve önemli ayrıntılarını katmanlara ayır.
Arka planı ilk, öndeki ayrıntıları son katmanlara koy.
Mümkün olduğunca ayrıntılı bir kompozisyon oluştur.
Tüm renkler #RRGGBB biçiminde olsun.
Koordinatlar sayısal olsun.
Katman türleri: rect, ellipse, circle, line, polygon, text, path.
Her katmanın type alanı zorunludur.
`,
      TEMPLATE_SCHEMA
    );

    const normalized = normalizeTemplate(template, prompt, style);

    res.json({ template: normalized });
  } catch (error) {
    console.error("Drawing plan error:", error);
    res.status(500).json({
      error: "JSON şablonu oluşturulamadı. Model ayarlarını kontrol et."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI hazır: http://localhost:${PORT}`);
});
