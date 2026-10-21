
import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = Number(process.env.PORT || 3000);

const API_KEY = process.env.GEMINI_API_KEY;
const CHAT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY ortam değişkeni eksik.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

app.disable("x-powered-by");
app.use(express.json({ limit: "110mb" }));
app.use(express.static("public"));

const styles = {
  "3d": "Premium high-end 3D render, detailed geometry, realistic materials, global illumination, sophisticated lighting, natural shadows, cinematic composition.",
  game: "High-quality professional video game character concept art, distinctive silhouette, intricate costume and material details, polished production artwork.",
  anime: "Professional high-quality anime illustration, expressive eyes, beautiful linework, detailed character design, rich colors and carefully composed background.",
  realistic: "Photorealistic image, physically realistic lighting and materials, fine surface details, natural colors and professional composition.",
  fantasy: "Highly detailed fantasy artwork, imaginative worldbuilding, cinematic atmosphere, rich colors and elaborate environmental details."
};

const preparedAnswers = [
  {
    pattern: /seni kim yaptı|seni kim oluşturdu/i,
    text: "Beni Breynot.editzz yaptı."
  },
  {
    pattern: /adın ne|ismin ne/i,
    text: "Ben Onur AI!"
  }
];

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Bir mesaj yaz." });
    }

    if (message.length > 12000) {
      return res.status(400).json({ error: "Mesaj çok uzun." });
    }

    const prepared = preparedAnswers.find(item =>
      item.pattern.test(message)
    );

    if (prepared) {
      return res.json({ text: prepared.text });
    }

    const history = Array.isArray(req.body?.history)
      ? req.body.history.slice(-12)
      : [];

    const contents = history
      .filter(item =>
        ["user", "model"].includes(item?.role) &&
        typeof item?.text === "string"
      )
      .map(item => ({
        role: item.role,
        parts: [{ text: item.text.slice(0, 12000) }]
      }));

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const result = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents
    });

    return res.json({
      text: result.text || "Yanıt oluşturulamadı."
    });
  } catch (error) {
    console.error("Chat request failed:", error.message);
    return res.status(500).json({
      error: "Sohbet başarısız oldu. Model ve API erişimini kontrol et."
    });
  }
});

app.post("/api/image", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt || "").trim();
    const requestedStyle = String(req.body?.style || "3d");
    const style = styles[requestedStyle] || styles["3d"];

    if (!prompt) {
      return res.status(400).json({
        error: "Oluşturulacak görseli tarif et."
      });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({
        error: "Görsel açıklaması 2000 karakteri geçemez."
      });
    }

    const fullPrompt = [
      "Generate the actual image requested below.",
      "Return a finished image, not a text description, code, JSON, SVG, or drawing instructions.",
      "Create a polished, detailed, high-quality composition suitable for professional digital artwork.",
      "Use full color, carefully designed lighting, rich but coherent colors, detailed textures, and a well-composed background.",
      "Do not use grayscale unless the user explicitly asks for it.",
      "Style requirements:",
      style,
      "User's image request:",
      prompt
    ].join("\n\n");

    const result = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: fullPrompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    const parts = result.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(part => part.inlineData?.data);

    if (!imagePart) {
      console.error(
        "Image model returned no image. Finish reason:",
        result.candidates?.[0]?.finishReason || "unknown"
      );

      return res.status(502).json({
        error: "Model görsel döndürmedi. Görsel modelinin adını ve API erişimini kontrol et."
      });
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";

    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      return res.status(502).json({
        error: "Model desteklenmeyen bir görüntü biçimi döndürdü."
      });
    }

    return res.json({
      image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
      text: parts.find(part => typeof part.text === "string")?.text
        || "Görselin hazır!"
    });
  } catch (error) {
    console.error("Image generation failed:", error.message);

    const status = Number(error.status || error.code);
    const message = status === 429
      ? "Görsel üretim kotası doldu. Bir süre sonra tekrar dene."
      : "Görsel üretilemedi. Model adını, API anahtarını, erişimi ve kotayı kontrol et.";

    return res.status(status === 429 ? 429 : 500).json({
      error: message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Onur AI sunucusu ${PORT} portunda hazır.`);
});
