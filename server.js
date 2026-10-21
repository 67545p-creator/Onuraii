
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

const SHAPES = [
  "circle", "ellipse", "rect", "square", "line", "triangle",
  "polygon", "star", "heart", "diamond", "ring", "arc",
  "cloud", "leaf", "flame", "spiral", "path", "cross",
  "plus", "minus", "hexagon", "pentagon", "octagon",
  "trapezoid", "parallelogram", "crescent", "semicircle",
  "quarter_circle", "arrow", "double_arrow", "lightning",
  "moon", "sun", "flower", "petal", "eye", "speech_bubble",
  "wave", "rays", "gear", "cylinder", "cone", "cube",
  "pyramid", "cylinder_3d", "sparkle"
];

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
      if (pattern.test(message)) return res.json({ text: reply });
    }

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: message
    });

    return res.json({ text: result.text || "Yanıt oluşturulamadı." });
  } catch (error) {
    console.error("Chat:", error);
    return res.status(500).json({ error: "Yanıt oluşturulamadı." });
  }
});

app.post("/api/drawing-plan", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY ayarlanmamış." });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) return res.status(400).json({ error: "Tarif boş." });
    if (prompt.length > 1000) {
      return res.status(400).json({ error: "Tarif çok uzun." });
    }

    const instruction = `
Kullanıcı tarifi: ${JSON.stringify(prompt)}

512x512 görsel için ayrıntılı bir JSON çizim planı oluştur.
Yalnızca JSON döndür, Markdown yazma.

Stiller: photorealistic, 3d, anime, watercolor, painting,
cartoon, vector, pixel_art, fantasy, pencil, comic.

JSON:
{
  "style": "cartoon",
  "background": "#ffffff",
  "lighting": {"direction": "upper_left", "intensity": 0.7},
  "details": {
    "texture": "smooth",
    "shadows": true,
    "highlights": true,
    "depth": true
  },
  "shapes": [
    {"type":"circle","cx":256,"cy":256,"r":80,"fill":"#ffaa33","stroke":"#222222","strokeWidth":2}
  ]
}

Kullanılabilen bütün shape türleri:
${SHAPES.join(", ")}

Alanlar:
- circle: cx, cy, r
- ellipse: cx, cy, rx, ry
- rect: x, y, width, height, rx
- square: x, y, size
- line: x1, y1, x2, y2
- triangle, hexagon, pentagon, octagon, trapezoid,
  parallelogram, diamond: cx, cy, r
- polygon: points ("x,y x,y x,y")
- star: cx, cy, r, pointsCount, innerRadius
- heart, cloud, leaf, flame, crescent, semicircle,
  quarter_circle, arrow, double_arrow, lightning, moon,
  sun, flower, petal, eye, speech_bubble, wave, rays,
  gear, cylinder, cone, cube, pyramid, cylinder_3d,
  cross, plus, minus, sparkle: cx, cy, r
- ring: cx, cy, r, ringWidth
- arc: x1, y1, x2, y2, rx, ry
- spiral: cx, cy, r, turns
- path: d

Bütün koordinatları 0-512 aralığında tut.
Renkleri #RRGGBB veya "none" biçiminde ver.
strokeWidth için 0-30 aralığını kullan.
Path komutları yalnızca M L H V C S Q T Z olsun.
Şekilleri büyük nesnelerden küçük ayrıntılara doğru sırala.
Tarif edilen nesneyi tanınabilir biçimde çiz.
Işık, gölge, doku ve perspektifi şekillerle mümkün olduğunca göster.
HTML, script veya SVG etiketleri üretme.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: instruction,
      config: { responseMimeType: "application/json" }
    });

    const plan = JSON.parse(result.text || "{}");

    if (!Array.isArray(plan.shapes)) {
      throw new Error("Geçersiz JSON çizim planı.");
    }

    const validTypes = new Set(SHAPES);
    validTypes.add("path");

    const shapes = plan.shapes
      .filter(s => s && validTypes.has(s.type))
      .slice(0, 150);

    return res.json({
      plan: {
        style: String(plan.style || "cartoon"),
        background:
          /^#[0-9a-fA-F]{6}$/.test(plan.background || "")
            ? plan.background
            : "#ffffff",
        lighting: plan.lighting || {},
        details: plan.details || {},
        shapes
      }
    });
  } catch (error) {
    console.error("Drawing plan:", error);
    return res.status(500).json({
      error: "Görsel oluşturulamadı. API anahtarını ve model adını kontrol et."
    });
  }
});

app.listen(PORT, () => console.log(`Onur AI: ${PORT}`));
