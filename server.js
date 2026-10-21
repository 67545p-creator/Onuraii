
import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    if (!prompt) return res.status(400).json({ error: "Görsel tarifi boş." });
    if (prompt.length > 1500) {
      return res.status(400).json({ error: "Görsel tarifi çok uzun." });
    }

    const instruction = `
Kullanıcı tarifi: ${JSON.stringify(prompt)}

Sen Onur AI'nin görsel kalıbı JSON hazırlayıcısısın.
Harici görsel üretim servisi kullanma. Yalnızca JSON üret.
JSON, tarayıcıdaki Canvas çizim motoru tarafından işlenecek.

Şu şemaya uygun geçerli JSON döndür:
{
  "template": "animal",
  "subject": "kurt",
  "style": "realistic",
  "background": "#dce5e8",
  "layers": [
    {
      "part": "background",
      "type": "rect",
      "x": 0, "y": 0, "width": 512, "height": 512,
      "fill": "#dce5e8"
    },
    {
      "part": "body",
      "type": "ellipse",
      "cx": 260, "cy": 300, "rx": 125, "ry": 60,
      "fill": "#777d80", "stroke": "#45494c", "strokeWidth": 3
    }
  ]
}

Kalıp türleri:
animal, human, character, landscape, building, vehicle,
food, flower, tree, fantasy, robot, logo, icon, object.

Desteklenen katman türleri:
circle, ellipse, rect, line, polygon, path, gradient, text.

Katman alanları:
circle: cx, cy, r, fill, stroke, strokeWidth
ellipse: cx, cy, rx, ry, fill, stroke, strokeWidth
rect: x, y, width, height, fill, stroke, strokeWidth
line: x1, y1, x2, y2, stroke, strokeWidth
polygon: points, fill, stroke, strokeWidth
path: d, fill, stroke, strokeWidth
gradient: x, y, width, height, color1, color2, direction
text: x, y, text, fill, fontSize

Kurallar:
- Görselin ana konusu tanınabilir olsun.
- Büyük katmanları önce, küçük ayrıntıları sonra üret.
- Koordinatları 0-512 arasında tut.
- En fazla 120 katman üret.
- Renkler #RRGGBB biçiminde olsun.
- path yalnızca M L H V C Q Z komutlarını kullansın.
- polygon points alanı "x,y x,y x,y" biçiminde olsun.
- Gerçekçi stil için anatomik oranlar, kürk izleri, gölgeler,
  ışık vurguları ve arka plan ayrıntıları oluştur.
- Tarif edilen konuya uygun şablonu otomatik seç.
- Yalnızca JSON döndür.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: instruction,
      config: { responseMimeType: "application/json" }
    });

    const plan = JSON.parse(result.text || "{}");

    if (!Array.isArray(plan.layers)) {
      throw new Error("Geçersiz çizim kalıbı.");
    }

    const allowed = new Set([
      "circle", "ellipse", "rect", "line", "polygon",
      "path", "gradient", "text"
    ]);

    const layers = plan.layers
      .filter(layer => layer && allowed.has(layer.type))
      .slice(0, 120)
      .map(layer => {
        const clean = { ...layer };

        for (const key of [
          "x", "y", "width", "height", "cx", "cy",
          "r", "rx", "ry", "x1", "x2", "y1", "y2",
          "strokeWidth", "fontSize"
        ]) {
          if (clean[key] !== undefined) {
            const n = Number(clean[key]);
            clean[key] = Number.isFinite(n)
              ? Math.max(-1000, Math.min(512, n))
              : 0;
          }
        }

        if (typeof clean.points === "string") {
          if (
            clean.points.length > 3000 ||
            !/^[0-9+.,\s-]+$/.test(clean.points)
          ) clean.points = "";
        }

        if (typeof clean.d === "string") {
          if (
            clean.d.length > 3000 ||
            !/^[0-9MmLlHhVvCcQqZz+.,\s-]+$/.test(clean.d)
          ) clean.d = "";
        }

        if (typeof clean.text === "string") {
          clean.text = clean.text.slice(0, 100);
        }

        for (const key of ["fill", "stroke", "color1", "color2"]) {
          if (
            clean[key] !== undefined &&
            clean[key] !== "none" &&
            !/^#[0-9a-fA-F]{6}$/.test(clean[key])
          ) {
            clean[key] = "#777777";
          }
        }

        return clean;
      });

    return res.json({
      plan: {
        template: String(plan.template || "object"),
        subject: String(plan.subject || prompt).slice(0, 200),
        style: String(plan.style || "realistic"),
        background: /^#[0-9a-fA-F]{6}$/.test(plan.background || "")
          ? plan.background
          : "#ffffff",
        layers
      }
    });
  } catch (error) {
    console.error("Drawing plan:", error);
    return res.status(500).json({
      error: "Kalıp JSON oluşturulamadı. API anahtarını ve model adını kontrol et."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI: http://localhost:${PORT}`);
});
