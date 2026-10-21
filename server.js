
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY ayarlanmamış.");
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const MODEL =
  process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function readyAnswer(message) {
  const text = message.toLocaleLowerCase("tr-TR");

  if (
    text.includes("seni kim yaptı") ||
    text.includes("seni kim oluşturdu")
  ) {
    return "Beni Breynot.editzz yaptı.";
  }

  if (
    text.includes("adın ne") ||
    text.includes("ismin ne") ||
    text === "sen kimsin"
  ) {
    return "Ben Onur AI!";
  }

  return null;
}

function extractJson(text) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Geçerli JSON kalıbı alınamadı.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function num(value, fallback = 0, min = -1000, max = 2000) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(min, Math.min(max, n));
}

function color(value, fallback = "#777777") {
  if (typeof value !== "string") return fallback;

  const v = value.trim();

  if (
    /^#[0-9a-f]{3,8}$/i.test(v) ||
    /^[a-z]{1,24}$/i.test(v)
  ) {
    return v;
  }

  return fallback;
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shapeToSvg(s) {
  if (!s || typeof s !== "object") return "";

  const type = String(s.type || "").toLowerCase();
  const fill = color(s.fill);
  const stroke = color(s.stroke, "none");
  const sw = num(s.strokeWidth, 0, 0, 30);

  const common =
    `fill="${esc(fill)}" ` +
    `stroke="${esc(stroke)}" ` +
    `stroke-width="${sw}"`;

  const x = num(s.x);
  const y = num(s.y);

  if (type === "rect") {
    return `<rect x="${x}" y="${y}" ` +
      `width="${num(s.width, 10, 0, 1024)}" ` +
      `height="${num(s.height, 10, 0, 1024)}" ` +
      `rx="${num(s.rx, 0, 0, 512)}" ${common}/>`;
  }

  if (type === "circle") {
    return `<circle cx="${x}" cy="${y}" ` +
      `r="${num(s.r, 10, 0, 1024)}" ${common}/>`;
  }

  if (type === "ellipse") {
    return `<ellipse cx="${x}" cy="${y}" ` +
      `rx="${num(s.rx, 10, 0, 1024)}" ` +
      `ry="${num(s.ry, 10, 0, 1024)}" ${common}/>`;
  }

  if (type === "polygon") {
    if (
      typeof s.points !== "string" ||
      !/^[\d\s.,+-]+$/.test(s.points)
    ) return "";

    return `<polygon points="${s.points}" ${common}/>`;
  }

  if (type === "line") {
    return `<line x1="${x}" y1="${y}" ` +
      `x2="${num(s.x2)}" y2="${num(s.y2)}" ` +
      `stroke="${esc(color(s.stroke, fill))}" ` +
      `stroke-width="${num(s.strokeWidth, 2, 0, 30)}"/>`;
  }

  if (type === "path") {
    if (
      typeof s.d !== "string" ||
      !/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]+$/.test(s.d)
    ) return "";

    return `<path d="${s.d}" ${common}/>`;
  }

  return "";
}

function renderSvg(drawing) {
  if (
    !drawing ||
    !Array.isArray(drawing.shapes) ||
    drawing.shapes.length === 0 ||
    drawing.shapes.length > 250
  ) {
    throw new Error("JSON kalıbı geçersiz.");
  }

  const width = Math.round(num(drawing.width, 512, 64, 1024));
  const height = Math.round(num(drawing.height, 512, 64, 1024));
  const bg = color(drawing.background, "#151525");

  const shapes = drawing.shapes.map(shapeToSvg).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg"
    width="${width}" height="${height}"
    viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="${esc(bg)}"/>
    ${shapes}
  </svg>`;
}

async function generateJsonTemplate(character) {
  const prompt = `
Sen Onur AI için karakter JSON kalıbı hazırlıyorsun.

Karakter isteği: ${character}

Yalnızca geçerli JSON döndür.
Markdown, kod bloğu veya açıklama yazma.

Şema:
{
  "width": 512,
  "height": 512,
  "background": "#151525",
  "shapes": [
    {
      "type": "ellipse",
      "x": 256,
      "y": 200,
      "rx": 80,
      "ry": 100,
      "fill": "#1769d2",
      "stroke": "#111111",
      "strokeWidth": 2
    }
  ]
}

İzin verilen şekiller:
rect, circle, ellipse, polygon, line, path.

Karakteri mümkün olduğunca ayrıntılı oluştur.
Yüz, göz, ağız, saç, maske, kıyafet, eller, bacaklar,
ayakkabılar ve karaktere özgü aksesuarları ekle.
Renkleri doğru seç ve şekilleri arka plandan ön plana sırala.
Karakterin tamamı 512x512 tuvalde görünsün.
Mümkün olduğunca çok anlamlı ve katmanlı şekil kullan.
JSON dışında hiçbir şey döndürme.
`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt
  });

  if (!response.text) {
    throw new Error("Gemini JSON kalıbı oluşturamadı.");
  }

  return extractJson(response.text);
}

async function createPng(character) {
  const template = await generateJsonTemplate(character);
  const svg = renderSvg(template);

  const png = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return { png, template };
}

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Mesaj boş olamaz."
      });
    }

    const answer = readyAnswer(message);

    if (answer) {
      return res.json({ text: answer });
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message
    });

    res.json({
      text: response.text || "Şu anda cevap oluşturamadım."
    });
  } catch (error) {
    console.error("Sohbet hatası:", error.message);

    res.status(500).json({
      error: "Sohbet yanıtı oluşturulamadı. Model adını ve API anahtarını kontrol et."
    });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    let character = String(req.body?.prompt || "")
      .replace(/^@gorselolustur\s*/i, "")
      .trim();

    if (!character) {
      return res.status(400).json({
        error: "Bir karakter adı yaz."
      });
    }

    character = character.slice(0, 500);

    const { png } = await createPng(character);

    res.json({
      image: `data:image/png;base64,${png.toString("base64")}`,
      mimeType: "image/png"
    });
  } catch (error) {
    console.error("Görsel oluşturma hatası:", error.message);

    res.status(500).json({
      error: "JSON kalıbı veya PNG oluşturulamadı. Model ayarlarını kontrol et."
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Onur AI hazır: ${PORT}`);
});
