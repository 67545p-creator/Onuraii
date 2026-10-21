
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const CHAT_MODEL = "gemini-3.1-flash";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    if (!ai) throw new Error("GEMINI_API_KEY ayarlanmamış.");

    const message = String(req.body?.message || "").trim();
    if (!message) return res.status(400).json({ error: "Mesaj boş." });

    const replies = [
      [/seni kim yaptı|geliştiricin kim|yapımcın kim/i, "Beni Breynot.Editzz yaptı! 💙"],
      [/^(merhaba|selam|sa|hey)\b/i, "Merhaba! 😊"],
      [/nasılsın|naber/i, "İyiyim, teşekkür ederim! Sen nasılsın? 😊"]
    ];

    for (const [pattern, reply] of replies) {
      if (pattern.test(message)) return res.json({ text: reply });
    }

    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: message
    });

    res.json({ text: result.text || "Yanıt oluşturulamadı." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Yanıt oluşturulamadı." });
  }
});

app.post("/api/drawing-plan", async (req, res) => {
  try {
    if (!ai) throw new Error("GEMINI_API_KEY ayarlanmamış.");

    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Tarif boş." });
    if (prompt.length > 1000) {
      return res.status(400).json({ error: "Tarif çok uzun." });
    }

    const instruction = `
Kullanıcı tarifi: ${JSON.stringify(prompt)}

Tarife uygun, renkli ve ayrıntılı 512x512 illüstrasyon çizim planı hazırla.
Yalnızca geçerli JSON döndür, açıklama veya Markdown yazma.
Biçim:
{
  "background":"#ffffff",
  "shapes":[
    {"type":"ellipse","cx":256,"cy":280,"rx":100,"ry":65,"fill":"#ffaa33","stroke":"#222222","strokeWidth":3},
    {"type":"circle","cx":256,"cy":180,"r":55,"fill":"#ffaa33","stroke":"#222222","strokeWidth":3},
    {"type":"path","d":"M 200 200 Q 150 160 175 130","fill":"none","stroke":"#222222","strokeWidth":4}
  ]
}
15-70 şekil üretmeye çalış. Büyük şekillerden başlayıp küçük ayrıntılara geç.
Sadece circle, ellipse, rect, line, polygon ve path şekillerini kullan.
Koordinatları 0-512 arasında tut. Renkleri hex biçiminde ver.
Path içinde sadece M L H V C S Q T Z komutlarına izin var.
HTML, script veya başka SVG etiketleri üretme.
`;

    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: instruction,
      config: { responseMimeType: "application/json" }
    });

    const plan = JSON.parse(result.text || "{}");
    if (!Array.isArray(plan.shapes)) throw new Error("Geçersiz plan.");

    res.json({
      plan: {
        background: plan.background,
        shapes: plan.shapes.slice(0, 100)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Görsel oluşturulamadı." });
  }
});

app.listen(PORT, () => console.log(`Onur AI: ${PORT}`));
