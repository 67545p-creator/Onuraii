
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL || gemini-3.5-flash-lite";

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image";

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY eksik.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function cleanPrompt(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/^@gorselolustur\s*/i, "")
    .trim()
    .slice(0, 1500);
}

function getReadyAnswer(message) {
  const text = message.toLocaleLowerCase("tr-TR");

  if (
    text.includes("seni kim yaptı") ||
    text.includes("seni kim oluşturdu")
  ) {
    return "Beni Breynot.editzz yaptı.";
  }

  if (
    text === "sen kimsin" ||
    text.includes("adın ne") ||
    text.includes("ismin ne")
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

  if (start === -1 || end <= start) {
    throw new Error("JSON kalıbı oluşturulamadı.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function number(value, fallback = 0, min = -1000, max = 2000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function safeColor(value, fallback = "#222222") {
  if (typeof value !== "string") return fallback;

  const color = value.trim();

  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^(rgb|rgba|hsl|hsla)\([\d\s.,%+-]+\)$/i.test(color) ||
    /^[a-z]{1,24}$/i.test(color)
  ) {
    return color;
  }

  return fallback;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shapeToSvg(shape) {
  if (!shape || typeof shape !== "object") return "";

  const type = String(shape.type || "").toLowerCase();
  const fill = safeColor(shape.fill, "#777777");
  const stroke = safeColor(shape.stroke, "none");
  const strokeWidth = number(shape.strokeWidth, 0, 0, 50);

  const common =
    `fill="${escapeXml(fill)}" ` +
    `stroke="${escapeXml(stroke)}" ` +
    `stroke-width="${strokeWidth}"`;

  const x = number(shape.x);
  const y = number(shape.y);

  if (type === "rect") {
    return `<rect x="${x}" y="${y}" ` +
      `width="${number(shape.width, 10, 0, 1000)}" ` +
      `height="${number(shape.height, 10, 0, 1000)}" ` +
      `rx="${number(shape.rx, 0, 0, 500)}" ${common}/>`;
  }

  if (type === "ellipse") {
    return `<ellipse cx="${x}" cy="${y}" ` +
      `rx="${number(shape.rx, 10, 0, 1000)}" ` +
      `ry="${number(shape.ry, 10, 0, 1000)}" ${common}/>`;
  }

  if (type === "circle") {
    return `<circle cx="${x}" cy="${y}" ` +
      `r="${number(shape.r, 10, 0, 1000)}" ${common}/>`;
  }

  if (type === "line") {
    return `<line x1="${x}" y1="${y}" ` +
      `x2="${number(shape.x2)}" y2="${number(shape.y2)}" ` +
      `fill="none" stroke="${escapeXml(safeColor(shape.stroke, fill))}" ` +
      `stroke-width="${number(shape.strokeWidth, 2, 0, 50)}"/>`;
  }

  if (type === "polygon") {
    if (typeof shape.points !== "string") return "";

    if (!/^[\d\s.,+-]+$/.test(shape.points)) return "";

    return `<polygon points="${shape.points}" ${common}/>`;
  }

  if (type === "path") {
    if (typeof shape.d !== "string") return "";

    if (!/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+-]+$/.test(shape.d)) {
      return "";
    }

    return `<path d="${shape.d}" ${common}/>`;
  }

  return "";
}

function renderDrawingSvg(drawing) {
  if (!drawing || !Array.isArray(drawing.shapes)) {
    throw new Error("JSON kalıbında shapes listesi bulunamadı.");
  }

  if (drawing.shapes.length === 0 || drawing.shapes.length > 250) {
    throw new Error("JSON kalıbındaki şekil sayısı geçersiz.");
  }

  const width = Math.round(number(drawing.width, 512, 64, 1024));
  const height = Math.round(number(drawing.height, 512, 64, 1024));
  const background = safeColor(drawing.background, "#151525");

  const shapes = drawing.shapes
    .map(shapeToSvg)
    .join("\n");

  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%"
            fill="${escapeXml(background)}"/>
      ${shapes}
    </svg>
  `;
}

async function createJsonDrawing(prompt) {
  const instructions = `
Kullanıcı isteği: ${prompt}

Yalnızca geçerli JSON döndür.
Markdown kod bloğu, açıklama veya başka metin ekleme.

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

Sadece şu şekil türlerini kullan:
rect, ellipse, circle, line, polygon, path.

Koordinatları 512x512 tuvale göre belirle.
Renkleri ve şekilleri karaktere uygun seç.
Karakterin ayırt edici özelliklerini, kıyafetlerini,
renklerini ve duruşunu mümkün olduğunca iyi tarif eden
çok sayıda katmanlı şekil kullan.
Şekilleri karakterin arkasından önüne doğru sırala.
path için yalnızca standart SVG yol komutlarını kullan.
polygon points alanı yalnızca sayılar, virgül ve boşluk içersin.
JSON içinde açıklama veya yorum yazma.
`;

  const response = await ai.models.generateContent({
    model: CHAT_MODEL,
    contents: instructions
  });

  if (!response.text) {
    throw new Error("JSON kalıbı için metin yanıtı alınamadı.");
  }

  return extractJson(response.text);
}

async function createPngFromTemplate(prompt) {
  const drawing = await createJsonDrawing(prompt);
  const svg = renderDrawingSvg(drawing);

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function improvePngWithGemini(pngBuffer, characterName) {
  const instruction = `
Bu ${characterName} karakterini güzelleştir bu fotoğrafı.

Gönderdiğim PNG görselini doğrudan düzenle ve yeni bir görsel üret.
Karakterin kimliğini, tanınabilir özelliklerini, yüzünü,
kıyafetlerini ve ana tasarımını koru.

Basit taslağı profesyonel kalitede bir oyun karakteri
görünümüne dönüştür. Ayrıntıları, anatomiyi, malzemeleri,
ışıklandırmayı, gölgeleri, renkleri ve derinliği iyileştir.
Yüksek kaliteli, ayrıntılı, temiz bir 3D oyun renderı gibi görünmesini sağla.
Karakterin tamamını kadrajda tut.
Gereksiz metin, filigran veya imza ekleme.
Yalnızca açıklama yazma; düzenlenmiş görsel üret.
`;

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: pngBuffer.toString("base64")
            }
          },
          {
            text: instruction
          }
        ]
      }
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  });

  const parts =
    response.candidates?.[0]?.content?.parts || [];

  const imagePart = parts.find(part =>
    part.inlineData?.data &&
    part.inlineData?.mimeType?.startsWith("image/")
  );

  if (!imagePart) {
    throw new Error(
      "Gemini görsel döndürmedi. Görsel düzenlemeyi destekleyen bir model seç."
    );
  }

  const imageBuffer = Buffer.from(
    imagePart.inlineData.data,
    "base64"
  );

  return sharp(imageBuffer)
    .png()
    .toBuffer();
}

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Mesaj boş olamaz."
      });
    }

    const readyAnswer = getReadyAnswer(message);

    if (readyAnswer) {
      return res.json({ text: readyAnswer });
    }

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: message
    });

    return res.json({
      text: response.text || "Şu anda yanıt oluşturamadım."
    });
  } catch (error) {
    console.error("Sohbet hatası:", error.message);

    return res.status(500).json({
      error: "Mesaj gönderilemedi. API anahtarını ve model ayarını kontrol et."
    });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    const prompt = cleanPrompt(req.body?.prompt);

    if (!prompt) {
      return res.status(400).json({
        error: "Bir karakter veya görsel tarifi yaz."
      });
    }

    // 1. JSON kalıbını üret ve PNG'ye çevir.
    const initialPng = await createPngFromTemplate(prompt);

    // 2. PNG'yi Gemini'ye gönder ve iyileştirilmiş PNG al.
    const finalPng = await improvePngWithGemini(
      initialPng,
      prompt
    );

    // 3. Son PNG'yi arayüze gönder.
    return res.json({
      image: `data:image/png;base64,${finalPng.toString("base64")}`,
      mimeType: "image/png"
    });
  } catch (error) {
    console.error("Görsel oluşturma hatası:", error.message);

    return res.status(500).json({
      error: error.message ||
        "Görsel oluşturulamadı. API ve model ayarlarını kontrol et."
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Onur AI çalışıyor: port ${PORT}`);
});
