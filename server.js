
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const READY_ANSWERS = [
  {
    patterns: [/seni kim yaptı/i, /yapımcın kim/i, /seni kim oluşturdu/i],
    reply: "Beni Breynot.editzz yaptı."
  },
  {
    patterns: [/adın ne/i, /ismin ne/i, /sen kimsin/i],
    reply: "Ben Onur AI! Sohbet edebilir, kod yazabilir ve çizim şablonları hazırlayabilirim."
  },
  {
    patterns: [/^merhaba[!. ]*$/i, /^selam[!. ]*$/i, /^hey[!. ]*$/i],
    reply: "Merhaba! Sana nasıl yardımcı olabilirim?"
  },
  {
    patterns: [/nasılsın/i, /ne haber/i],
    reply: "İyiyim, teşekkürler! Sen nasılsın?"
  },
  {
    patterns: [/teşekkürler/i, /sağ ol/i, /sağol/i],
    reply: "Rica ederim!"
  },
  {
    patterns: [/kaç yaşındasın/i, /yaşın kaç/i],
    reply: "Ben bir yapay zekâyım; insanlar gibi bir yaşım yok."
  },
  {
    patterns: [/ne yapabilirsin/i, /neler yapabiliyorsun/i],
    reply: "Sohbet, kodlama, oyun karakterleri ve JSON çizim şablonları konusunda yardımcı olabilirim."
  },
  {
    patterns: [/minecraft biliyor musun/i, /minecraft hakkında/i],
    reply: "Evet! Minecraft add-on, entity, animasyon, komut ve animation controller kodlarında yardımcı olabilirim."
  },
  {
    patterns: [/poppy playtime biliyor musun/i],
    reply: "Evet! Huggy Wuggy, Kissy Missy, CatNap, DogDay ve diğer Poppy Playtime karakterleri hakkında konuşabiliriz."
  },
  {
    patterns: [/fnf biliyor musun/i, /friday night funkin biliyor musun/i],
    reply: "Evet! Friday Night Funkin karakterleri, modları ve müzik savaşları hakkında yardımcı olabilirim."
  },
  {
    patterns: [/among us biliyor musun/i],
    reply: "Evet! Among Us, Impostor ve oyun rolleri hakkında konuşabiliriz."
  },
  {
    patterns: [/garten of banban biliyor musun/i],
    reply: "Evet! Banban, Jumbo Josh, Opila Bird, Nabnab ve diğer karakterleri konuşabiliriz."
  },
  {
    patterns: [/fnaf biliyor musun/i, /five nights at freddy/i],
    reply: "Evet! Freddy Fazbear, Bonnie, Chica, Foxy ve diğer FNAF karakterlerini biliyorum."
  },
  {
    patterns: [/cartoon cat kim/i, /cartoon cat nedir/i],
    reply: "Cartoon Cat, Trevor Henderson tarafından tasarlanan bir korku karakteridir."
  },
  {
    patterns: [/siren head kim/i, /siren head nedir/i],
    reply: "Siren Head, Trevor Henderson tarafından tasarlanan, siren benzeri başı bulunan uzun bir korku yaratığıdır."
  },
  {
    patterns: [/kod yazabilir misin/i, /programlama biliyor musun/i],
    reply: "Evet! JavaScript, HTML, CSS, Node.js ve Minecraft add-on kodlarında yardımcı olabilirim."
  },
  {
    patterns: [/görsel nasıl oluştururum/i, /resim nasıl yaparım/i],
    reply: "Örneğin @gorselolustur uçan bir kedi yazabilirsin."
  },
  {
    patterns: [/iyi geceler/i],
    reply: "İyi geceler!"
  },
  {
    patterns: [/günaydın/i],
    reply: "Günaydın!"
  },
  {
    patterns: [/seni seviyorum/i],
    reply: "Çok naziksin! Sana yardımcı olmak için buradayım."
  }
];

function findReadyAnswer(message) {
  const normalized = message.toLocaleLowerCase("tr-TR").trim();
  return READY_ANSWERS.find(item =>
    item.patterns.some(pattern => pattern.test(normalized))
  )?.reply ?? null;
}

function ensureAI(res) {
  if (!ai) {
    res.status(500).json({
      error: "GEMINI_API_KEY ayarlanmamış."
    });
    return false;
  }
  return true;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Mesaj boş." });
    }

    if (message.length > 12000) {
      return res.status(400).json({ error: "Mesaj çok uzun." });
    }

    const readyAnswer = findReadyAnswer(message);
    if (readyAnswer) {
      return res.json({ reply: readyAnswer });
    }

    if (!ensureAI(res)) return;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: `
Sen Onur AI adlı Türkçe konuşan bir asistansın.
Doğal ve anlaşılır cevaplar ver.
Normal sohbeti koru.
Kullanıcı istemedikçe JSON döndürme.
Oyun karakterleri, kodlama ve tasarım konularında yardımcı ol.
Emin olmadığın bilgileri uydurma.

Kullanıcı: ${message}
`
    });

    res.json({
      reply: result.text || "Yanıt oluşturulamadı."
    });
  } catch {
    res.status(500).json({
      error: "Yanıt oluşturulamadı."
    });
  }
});

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

function safeColor(value, fallback = "#888888") {
  return typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function num(value, fallback = 0, min = -1000, max = 3000) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.max(min, Math.min(max, n))
    : fallback;
}

function normalizeTemplate(data, prompt, style) {
  const allowed = new Set([
    "rect", "ellipse", "circle", "line",
    "polygon", "text", "path"
  ]);

  const layers = (Array.isArray(data.layers) ? data.layers : [])
    .slice(0, 160)
    .filter(layer => layer && allowed.has(layer.type))
    .map(layer => {
      const item = {
        type: layer.type,
        color: safeColor(layer.color),
        stroke: layer.stroke === "none"
          ? "none"
          : safeColor(layer.stroke, "none"),
        strokeWidth: num(layer.strokeWidth, 1, 0, 100),
        opacity: num(layer.opacity, 1, 0, 1)
      };

      for (const key of [
        "x", "y", "width", "height", "cx", "cy",
        "r", "rx", "ry", "x1", "y1", "x2", "y2"
      ]) {
        if (layer[key] !== undefined) {
          item[key] = num(layer[key]);
        }
      }

      if (layer.type === "polygon") {
        item.points = Array.isArray(layer.points)
          ? layer.points.slice(0, 100).map(point => ({
              x: num(point?.x),
              y: num(point?.y)
            }))
          : [];
      }

      if (layer.type === "path") {
        item.d = typeof layer.d === "string"
          ? layer.d.slice(0, 5000)
          : "";
      }

      if (layer.type === "text") {
        item.text = typeof layer.text === "string"
          ? layer.text.slice(0, 200)
          : "";
      }

      return item;
    });

  return {
    title: String(data.title || prompt).slice(0, 150),
    description: String(data.description || "").slice(0, 500),
    style: String(data.style || style).slice(0, 40),
    background: safeColor(data.background, "#ffffff"),
    width: 1024,
    height: 1024,
    layers
  };
}

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

    const styleDescriptions = {
      auto: "Tarife uygun bir stil seç.",
      realistic: "Fotogerçekçi görünümlü kompozisyon.",
      cartoon: "Renkli çizgi film stili.",
      "3d": "Üç boyutlu render stili.",
      anime: "Anime çizim stili.",
      horror: "Atmosferik korku konsept sanatı.",
      pixel: "Piksel sanatı.",
      sketch: "Kurşun kalem eskizi.",
      fantasy: "Fantastik konsept sanatı.",
      watercolor: "Suluboya stili."
    };

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: `
Yalnızca geçerli JSON üret. Markdown veya açıklama ekleme.
Kullanıcının tarifine uygun, ayrıntılı ve katmanlı bir çizim şablonu hazırla.

Tarif: ${prompt}
Stil: ${styleDescriptions[style] || styleDescriptions.auto}

Tuval 1024x1024 boyutunda.
Önce arka plan, sonra arkadaki nesneler, en son öndeki ayrıntılar.
Karakterin başı, yüzü, gövdesi ve uzuvlarını ayrı şekillerle oluştur.
Renkler #RRGGBB biçiminde olmalı.
Katman türleri: rect, ellipse, circle, line, polygon, text, path.
Koordinatlar sayı olmalı.

Şablon alanları:
title, description, style, background, width, height, layers.
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: TEMPLATE_SCHEMA
      }
    });

    if (!result.text) {
      throw new Error("Empty response");
    }

    const data = JSON.parse(result.text);
    res.json({
      template: normalizeTemplate(data, prompt, style)
    });
  } catch {
    res.status(500).json({
      error: "JSON çizim şablonu oluşturulamadı."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI: http://localhost:${PORT}`);
});
