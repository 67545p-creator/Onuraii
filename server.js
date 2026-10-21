
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

const CHAT_MODEL = "gemini-3.1-flash";
const IMAGE_MODEL = "gemini-3.1-flash-image";

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY ortam değişkeni ayarlanmamış.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const readyReplies = [
  {
    patterns: [
      /seni kim yaptı/i,
      /seni kim yarattı/i,
      /geliştiricin kim/i,
      /yapımcın kim/i,
      /kim geliştirdi seni/i
    ],
    reply: "Beni Breynot.Editzz yaptı! 💙"
  },
  {
    patterns: [/^(merhaba|selam|sa|hey|hi|hello)\b/i],
    reply: "Merhaba! Ben Onur AI. 😊"
  },
  {
    patterns: [/nasılsın/i, /naber/i, /ne haber/i],
    reply: "İyiyim, teşekkür ederim! Sen nasılsın? 😊"
  },
  {
    patterns: [/adın ne/i, /sen kimsin/i, /^kimsin/i],
    reply: "Ben Onur AI, sana yardımcı olmak için buradayım. 🤖"
  },
  {
    patterns: [/hangi modelsin/i, /modelin ne/i],
    reply: "Sohbet için Gemini 3.1 Flash kullanıyorum."
  },
  {
    patterns: [/ne yapabilirsin/i, /özelliklerin neler/i],
    reply: "Soruları cevaplayabilir, kod yazabilir, fikir üretebilir ve @gorselolustur komutuyla görsel oluşturmayı deneyebilirim."
  },
  {
    patterns: [/günaydın/i],
    reply: "Günaydın! ☀️"
  },
  {
    patterns: [/iyi geceler/i],
    reply: "İyi geceler! 🌙"
  },
  {
    patterns: [/iyi akşamlar/i],
    reply: "İyi akşamlar! 😊"
  },
  {
    patterns: [/teşekkürler/i, /teşekkür ederim/i, /sağ ol/i],
    reply: "Rica ederim! 😊"
  },
  {
    patterns: [/seni seviyorum/i],
    reply: "Çok naziksin! 💙 Sana yardımcı olmak için buradayım."
  },
  {
    patterns: [/şaka yap/i, /bir şaka anlat/i],
    reply: "Bilgisayar neden doktora gitmiş? Çünkü virüs kapmış! 😂"
  },
  {
    patterns: [/bilmece sor/i],
    reply: "Bilmece: Dört ayağı var ama yürüyemez. Nedir? 🤔"
  },
  {
    patterns: [/görsel nasıl oluştururum/i, /resim nasıl oluştururum/i],
    reply: "Mesajına @gorselolustur yazıp ardından istediğin görseli tarif et. Örnek: @gorselolustur uzayda yürüyen bir kedi"
  },
  {
    patterns: [/insan mısın/i, /gerçek misin/i],
    reply: "Ben bir yapay zekâ asistanıyım, gerçek bir insan değilim."
  },
  {
    patterns: [/yardım/i, /komutlar neler/i],
    reply: "Normal şekilde mesaj yazabilirsin. Görsel oluşturmak için @gorselolustur komutunu kullan."
  },
  {
    patterns: [/^test$/i, /^ping$/i],
    reply: "Onur AI çalışıyor! ✅"
  }
];

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mesaj boş olamaz." });
    }

    const text = message.trim();

    for (const item of readyReplies) {
      if (item.patterns.some(pattern => pattern.test(text))) {
        return res.json({
          text: item.reply,
          source: "ready-reply"
        });
      }
    }

    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: text
    });

    res.json({
      text: result.text || "Yanıt oluşturulamadı.",
      source: "gemini"
    });
  } catch (error) {
    console.error("Sohbet hatası:", error);
    res.status(500).json({
      error: error.message || "Sohbet yanıtı oluşturulamadı."
    });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const prompt = req.body?.prompt;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Görsel açıklaması boş olamaz."
      });
    }

    const result = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt.trim(),
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    for (const candidate of result.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData?.data && part.inlineData?.mimeType) {
          return res.json({
            image: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
            text: result.text || ""
          });
        }
      }
    }

    res.status(502).json({
      error: "Model görsel döndürmedi."
    });
  } catch (error) {
    console.error("Görsel üretme hatası:", error);
    res.status(500).json({
      error: error.message || "Görsel oluşturulamadı."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI çalışıyor: ${PORT}`);
});
