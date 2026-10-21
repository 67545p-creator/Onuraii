
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

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    chat: true,
    drawingPlan: true
  });
});

// Normal sohbet
app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY .env dosyasına eklenmemiş."
      });
    }

    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    if (message.length > 10000) {
      return res.status(400).json({ error: "Mesaj çok uzun." });
    }

    const replies = [
      {
        pattern: /seni kim yaptı|geliştiricin kim|yapımcın kim/i,
        text: "Beni Breynot.Editzz yaptı! 💙"
      },
      {
        pattern: /^(merhaba|selam|sa|hey)\b/i,
        text: "Merhaba! 😊 Sana nasıl yardımcı olabilirim?"
      },
      {
        pattern: /nasılsın|naber/i,
        text: "İyiyim, teşekkür ederim! Sen nasılsın? 😊"
      }
    ];

    for (const item of replies) {
      if (item.pattern.test(message)) {
        return res.json({ text: item.text });
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

    return res.status(500).json({
      error: "Gemini yanıt oluşturamadı. Model adını ve API anahtarını kontrol et."
    });
  }
});

// Gemini'den çizim planı JSON'u alır.
// PNG, HTML tarafında Canvas ile oluşturulur.
app.post("/api/drawing-plan", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({
        error: "GEMINI_API_KEY .env dosyasına eklenmemiş."
      });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        error: "Görsel tarifi boş olamaz."
      });
    }

    if (prompt.length > 1500) {
      return res.status(400).json({
        error: "Görsel tarifi en fazla 1500 karakter olabilir."
      });
    }

    const instruction = `
Sen Onur AI için Canvas çizim motoruna uygun görsel planı hazırlıyorsun.

Kullanıcının tarifi:
${JSON.stringify(prompt)}

Harici görsel üretim servisi çağırma.
Görsel üretim API'si kullanma.
Yalnızca istenen çizimi tarif eden geçerli JSON üret.
Açıklama, Markdown veya kod çiti ekleme.

Tam olarak şu yapıyı kullan:
{
  "template": "animal",
  "subject": "kurt",
  "style": "realistic",
  "background": "#dce5e8",
  "layers": [
    {
      "type": "ellipse",
      "cx": 256,
      "cy": 280,
      "rx": 120,
      "ry": 70,
      "fill": "#777777",
      "stroke": "#333333",
      "strokeWidth": 3
    }
  ]
}

Şablon türleri:
animal, human, character, landscape, building, vehicle,
food, flower, tree, fantasy, robot, logo, icon, object.

Desteklenen katman türleri:

circle:
cx, cy, r, fill, stroke, strokeWidth

ellipse:
cx, cy, rx, ry, fill, stroke, strokeWidth

rect:
x, y, width, height, fill, stroke, strokeWidth

line:
x1, y1, x2, y2, stroke, strokeWidth

polygon:
points, fill, stroke, strokeWidth

path:
d, fill, stroke, strokeWidth

gradient:
x, y, width, height, color1, color2, direction

text:
x, y, text, fill, fontSize

Kurallar:
- Tuval 512x512 boyutundadır.
- En fazla 120 katman oluştur.
- Önce arka planı, sonra büyük nesneleri, sonra ayrıntıları çiz.
- Konunun şekli ve oranları tanınabilir olsun.
- Mümkün olduğunca çok uygun geometrik ayrıntı kullan.
- Hayvanlarda kulak, göz, burun, ağız, gövde, bacak ve kuyruk
  gibi uygun anatomik ayrıntıları ekle.
- İnsanlarda yüz, saç, gövde, kollar ve bacakları çiz.
- Manzaralarda gökyüzü, arazi, bitki ve derinlik ayrıntıları ekle.
- Binalarda duvar, çatı, kapı ve pencereleri ekle.
- Robotlarda gövde, eklemler, sensörler ve mekanik ayrıntılar ekle.
- Gerçekçi stil istenirse gölge, ışık vurgusu, renk geçişi ve
  küçük ayrıntılar kullan.
- Anime, çizgi film, piksel sanatı, 3B görünüm, karakalem,
  suluboya ve diğer istenen stillere uygun renk ve şekiller kullan.
- Renkleri #RRGGBB biçiminde yaz.
- polygon.points değerini "x,y x,y x,y" biçiminde yaz.
- path.d yalnızca M, L, H, V, C, Q ve Z komutlarını kullansın.
- Koordinatlar yaklaşık 0 ile 512 arasında olsun.
- Kullanıcının istediği konuyu değiştirip başka bir şey çizme.
- Yalnızca JSON döndür.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: instruction,
      config: {
        responseMimeType: "application/json"
      }
    });

    const raw = result.text;

    if (!raw) {
      throw new Error("Gemini boş yanıt döndürdü.");
    }

    const plan = JSON.parse(raw);

    if (!plan || !Array.isArray(plan.layers)) {
      throw new Error("JSON çizim katmanları içermiyor.");
    }

    const allowedTypes = new Set([
      "circle",
      "ellipse",
      "rect",
      "line",
      "polygon",
      "path",
      "gradient",
      "text"
    ]);

    const numericFields = [
      "x", "y", "width", "height",
      "cx", "cy", "r", "rx", "ry",
      "x1", "y1", "x2", "y2",
      "strokeWidth", "fontSize"
    ];

    const layers = plan.layers
      .filter(layer => layer && allowedTypes.has(layer.type))
      .slice(0, 120)
      .map(layer => {
        const clean = { ...layer };

        for (const key of numericFields) {
          if (clean[key] !== undefined) {
            const value = Number(clean[key]);

            clean[key] = Number.isFinite(value)
              ? Math.max(-1000, Math.min(512, value))
              : 0;
          }
        }

        if (typeof clean.points === "string") {
          if (
            clean.points.length > 3000 ||
            !/^[0-9+.,\s-]+$/.test(clean.points)
          ) {
            clean.points = "";
          }
        }

        if (typeof clean.d === "string") {
          if (
            clean.d.length > 3000 ||
            !/^[0-9MmLlHhVvCcQqZz+.,\s-]+$/.test(clean.d)
          ) {
            clean.d = "";
          }
        }

        if (typeof clean.text === "string") {
          clean.text = clean.text.slice(0, 100);
        }

        for (const key of ["fill", "stroke", "color1", "color2"]) {
          if (clean[key] !== undefined) {
            const color = clean[key];

            if (
              color !== "none" &&
              (typeof color !== "string" ||
                !/^#[0-9a-fA-F]{6}$/.test(color))
            ) {
              clean[key] = "#777777";
            }
          }
        }

        return clean;
      });

    const background =
      typeof plan.background === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(plan.background)
        ? plan.background
        : "#ffffff";

    return res.json({
      plan: {
        template: String(plan.template || "object").slice(0, 50),
        subject: String(plan.subject || prompt).slice(0, 200),
        style: String(plan.style || "realistic").slice(0, 50),
        background,
        layers
      }
    });
  } catch (error) {
    console.error("Drawing plan error:", error);

    return res.status(500).json({
      error: "Görsel JSON'u oluşturulamadı. API anahtarını, model adını ve JSON yanıtını kontrol et."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI çalışıyor: http://localhost:${PORT}`);
  console.log(`Gemini modeli: ${MODEL}`);
});
