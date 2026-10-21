
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "gemini-3.5-flash-lite";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY ayarlanmamış." });
    }

    const message = String(req.body?.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Mesaj boş." });
    }

    const replies = [
      [/seni kim yaptı|geliştiricin kim|yapımcın kim/i, "Beni Breynot.Editzz yaptı! 💙"],
      [/^(merhaba|selam|sa|hey)\b/i, "Merhaba! 😊"],
      [/nasılsın|naber/i, "İyiyim, teşekkür ederim! Sen nasılsın? 😊"]
    ];

    for (const [pattern, reply] of replies) {
      if (pattern.test(message)) {
        return res.json({ text: reply });
      }
    }

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: message
    });

    return res.json({
      text: result.text || "Yanıt oluşturulamadı."
    });
  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ error: "Yanıt oluşturulamadı." });
  }
});

app.post("/api/drawing-plan", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY ayarlanmamış." });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "Görsel tarifi gerekli." });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({ error: "Tarif çok uzun." });
    }

    const instruction = `
Kullanıcı tarifi:
${JSON.stringify(prompt)}

512x512 boyutunda ayrıntılı bir görsel için JSON çizim planı oluştur.
Yalnızca geçerli JSON döndür. Markdown veya açıklama yazma.

Desteklenen stiller:
photorealistic, 3d, anime, watercolor, painting, cartoon,
vector, pixel_art, fantasy, pencil, comic.

Kullanıcı bir stil belirtirse onu seç. Belirtmezse uygun stili seç.

JSON şeması:
{
  "style": "photorealistic",
  "background": "#d9e5ed",
  "lighting": {
    "direction": "upper_left",
    "intensity": 0.8
  },
  "details": {
    "texture": "fur",
    "shadows": true,
    "highlights": true,
    "depth": true
  },
  "shapes": [
    {
      "type": "ellipse",
      "cx": 256,
      "cy": 280,
      "rx": 100,
      "ry": 65,
      "fill": "#ffaa33",
      "stroke": "#222222",
      "strokeWidth": 2
    }
  ]
}

Kurallar:
- Mümkün olduğunca 40-100 şekil üret.
- Önce arka plan ve büyük nesneleri, sonra ayrıntıları oluştur.
- Işık, gölge, perspektif, renk geçişleri ve dokuları çizim planına yansıt.
- Fotoğraf gerçekçiliği istenirse gerçekçi oranlar, ince renk farklılıkları ve doğal gölgeler kullan.
- 3D istenirse hacim, ışık ve gölgeyi şekillerle göster.
- Anime, suluboya, çizgi film ve diğer stillerde o stile uygun çizim yap.
- Şekiller yalnızca circle, ellipse, rect, line, polygon ve path olabilir.
- Koordinatlar 0-512 aralığında olmalı.
- Renkler #RRGGBB formatında olmalı.
- path yalnızca M L H V C S Q T Z komutlarını kullanmalı.
- Her şeklin gereken sayısal alanlarını doldur.
- HTML, script, URL veya SVG etiketi üretme.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: instruction,
      config: {
        responseMimeType: "application/json"
      }
    });

    const plan = JSON.parse(result.text || "{}");

    const validStyles = new Set([
      "photorealistic",
      "3d",
      "anime",
      "watercolor",
      "painting",
      "cartoon",
      "vector",
      "pixel_art",
      "fantasy",
      "pencil",
      "comic"
    ]);

    const validTypes = new Set([
      "circle",
      "ellipse",
      "rect",
      "line",
      "polygon",
      "path"
    ]);

    if (!Array.isArray(plan.shapes)) {
      throw new Error("JSON çizim planında shapes dizisi yok.");
    }

    const shapes = plan.shapes
      .filter(shape =>
        shape &&
        validTypes.has(shape.type)
      )
      .slice(0, 100);

    return res.json({
      plan: {
        style: validStyles.has(plan.style) ? plan.style : "cartoon",
        background:
          typeof plan.background === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(plan.background)
            ? plan.background
            : "#ffffff",
        lighting: {
          direction: String(plan.lighting?.direction || "upper_left"),
          intensity: Math.max(
            0,
            Math.min(1, Number(plan.lighting?.intensity) || 0.7)
          )
        },
        details: {
          texture: String(plan.details?.texture || "smooth").slice(0, 40),
          shadows: plan.details?.shadows === true,
          highlights: plan.details?.highlights === true,
          depth: plan.details?.depth === true
        },
        shapes
      }
    });
  } catch (error) {
    console.error("Drawing plan error:", error);
    return res.status(500).json({
      error: "Görsel oluşturulamadı. API anahtarını ve model adını kontrol et."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI: ${PORT}`);
});
