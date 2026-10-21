
import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = "gemini-3.1-flash-lite";
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
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

app.post("/api/template", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY ayarlanmamış." });
    }

    const prompt = String(req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({ error: "Görsel tarifi boş." });
    }

    if (prompt.length > 1500) {
      return res.status(400).json({ error: "Görsel tarifi çok uzun." });
    }

    const instruction = `
Kullanıcının görsel tarifi:
${JSON.stringify(prompt)}

Görevin görselin kendisini çizmek değil, görsel üretiminde kullanılacak ayrıntılı bir JSON kalıbı hazırlamak.

Yalnızca geçerli JSON döndür. Markdown veya açıklama ekleme.

JSON şeması:
{
  "template_version": 1,
  "subject": "konu",
  "style": "photorealistic",
  "scene": {
    "background": "orman",
    "environment": "doğal ortam",
    "composition": "full_body",
    "camera_angle": "eye_level",
    "aspect_ratio": "1:1"
  },
  "subject_details": {
    "anatomy": "doğal ve gerçekçi",
    "pose": "ayakta",
    "colors": [],
    "materials": [],
    "textures": [],
    "distinctive_features": []
  },
  "lighting": {
    "type": "natural",
    "direction": "side",
    "shadows": true,
    "mood": "cinematic"
  },
  "quality": {
    "detail_level": "high",
    "depth_of_field": true,
    "realistic_proportions": true
  },
  "negative_prompt": [
    "deformed anatomy",
    "extra limbs",
    "blurry"
  ],
  "image_prompt": "Görseli oluşturmak için ayrıntılı İngilizce açıklama"
}

Kullanıcının tarifine uygun alanları doldur.
Hayvanlarda anatomiyi, kürkü, gözleri, duruşu ve kuyruğu tarif et.
İnsanlarda yüzü, saçları, kıyafetleri ve pozu tarif et.
Manzaralarda çevreyi, hava durumunu, ışığı ve perspektifi tarif et.
Logolarda sembolü, kompozisyonu ve renkleri tarif et.
Tarif edilmemiş önemli ayrıntıları tutarlı biçimde tamamla.
image_prompt alanına görsel üretme modelinin doğrudan kullanabileceği
ayrıntılı bir istem yaz.
`;

    const result = await ai.models.generateContent({
      model: MODEL,
      contents: instruction,
      config: {
        responseMimeType: "application/json"
      }
    });

    const template = JSON.parse(result.text || "{}");

    if (
      !template.subject ||
      !template.style ||
      !template.scene ||
      typeof template.image_prompt !== "string"
    ) {
      throw new Error("Gemini geçerli bir görsel kalıbı döndürmedi.");
    }

    return res.json({ template });
  } catch (error) {
    console.error("Template error:", error);
    return res.status(500).json({
      error: "Görsel kalıbı oluşturulamadı."
    });
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: "GEMINI_API_KEY ayarlanmamış." });
    }

    const template = req.body?.template;

    if (
      !template ||
      typeof template.image_prompt !== "string" ||
      template.image_prompt.length > 12000
    ) {
      return res.status(400).json({ error: "Geçersiz görsel kalıbı." });
    }

    const prompt = `
Create an image using this structured visual template.
Subject: ${template.subject}
Style: ${template.style}
Scene: ${JSON.stringify(template.scene)}
Subject details: ${JSON.stringify(template.subject_details || {})}
Lighting: ${JSON.stringify(template.lighting || {})}
Quality: ${JSON.stringify(template.quality || {})}
Avoid: ${JSON.stringify(template.negative_prompt || [])}

Detailed image prompt:
${template.image_prompt}

Return the generated image.
`;

    const result = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    const parts = result.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(part => part.inlineData?.data);

    if (!imagePart) {
      const textPart = parts.find(part => part.text)?.text;

      return res.status(502).json({
        error: textPart || "Görsel modeli resim döndürmedi. Model adını kontrol et."
      });
    }

    return res.json({
      image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
      mimeType: imagePart.inlineData.mimeType || "image/png"
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return res.status(500).json({
      error: "Görsel oluşturulamadı. Görsel modelinin API erişimini kontrol et."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI çalışıyor: http://localhost:${PORT}`);
});
