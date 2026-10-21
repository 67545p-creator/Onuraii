
import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const ROOT = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(ROOT, "public")));

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

const characters = {
  "Poppy Playtime": [
    "Huggy Wuggy", "Kissy Missy", "Mommy Long Legs",
    "Poppy", "CatNap", "DogDay", "Bunzo Bunny",
    "Boxy Boo", "Yarnaby", "Doey the Doughman",
    "PJ Pug-a-Pillar", "The Prototype"
  ],
  "Five Nights at Freddy's": [
    "Freddy Fazbear", "Bonnie", "Chica", "Foxy",
    "Golden Freddy", "Springtrap", "Circus Baby",
    "Ballora", "Puppet", "Lefty", "Glamrock Freddy",
    "Roxanne Wolf", "Montgomery Gator", "The Mimic"
  ],
  "Friday Night Funkin": [
    "Boyfriend", "Girlfriend", "Pico", "Daddy Dearest",
    "Mommy Mearest", "Skid", "Pump", "Senpai",
    "Tankman", "Whitty", "Tricky", "Hex", "Garcello",
    "Sarvente", "Ruv", "Tabi", "Agoti", "Zardy"
  ],
  "Among Us": [
    "Red Crewmate", "Blue Crewmate", "Green Crewmate",
    "Yellow Crewmate", "Black Crewmate", "White Crewmate",
    "Impostor", "Shapeshifter", "Engineer", "Scientist",
    "Guardian Angel"
  ],
  "Minecraft": [
    "Steve", "Alex", "Creeper", "Enderman", "Warden",
    "Zombie", "Skeleton", "Ender Dragon", "Wither",
    "Iron Golem", "Villager", "Witch", "Blaze",
    "Ghast", "Piglin", "Herobrine", "Allay", "Sniffer"
  ],
  "Garten of Banban": [
    "Banban", "Banbaleena", "Jumbo Josh", "Opila Bird",
    "Tarta Bird", "Stinger Flynn", "Nabnab",
    "Nabnaleena", "Captain Fiddles", "Sheriff Toadster",
    "Slow Seline", "Bittergiggle", "Syringeon"
  ],
  "Sonic": [
    "Sonic", "Tails", "Knuckles", "Amy Rose", "Shadow",
    "Silver", "Metal Sonic", "Rouge", "Blaze"
  ],
  "Super Mario": [
    "Mario", "Luigi", "Princess Peach", "Bowser",
    "Yoshi", "Toad", "Rosalina", "Wario", "Waluigi",
    "Donkey Kong", "King Boo", "Goomba"
  ],
  "Pokemon": [
    "Pikachu", "Eevee", "Charizard", "Mewtwo", "Lucario",
    "Gengar", "Greninja", "Bulbasaur", "Squirtle",
    "Charmander", "Snorlax", "Mimikyu"
  ],
  "Roblox": [
    "Noob", "Bacon Hair", "Guest", "Classic Roblox Avatar"
  ],
  "Bendy": [
    "Bendy", "Ink Bendy", "Boris", "Alice Angel",
    "Ink Demon", "Audrey"
  ],
  "Undertale": [
    "Sans", "Papyrus", "Frisk", "Chara", "Toriel",
    "Asgore", "Undyne", "Alphys", "Flowey", "Asriel"
  ],
  "Cuphead": [
    "Cuphead", "Mugman", "Ms. Chalice", "The Devil", "King Dice"
  ],
  "Plants vs Zombies": [
    "Peashooter", "Sunflower", "Wall-nut", "Chomper",
    "Cherry Bomb", "Zombie", "Conehead Zombie",
    "Buckethead Zombie", "Gargantuar"
  ],
  "Horror": [
    "Granny", "Slendrina", "Slenderman", "Cartoon Cat",
    "Siren Head", "The Rake", "Hello Neighbor",
    "Ice Scream"
  ],
  "Brawl Stars": [
    "Shelly", "Colt", "Spike", "Leon", "Crow", "Nita",
    "Bull", "Jessie", "Dynamike", "El Primo", "Poco", "Surge"
  ],
  "Clash": [
    "Barbarian", "Archer", "Giant", "Wizard", "P.E.K.K.A",
    "Hog Rider", "Valkyrie", "Goblin", "Knight"
  ],
  "Other Games": [
    "Fall Guys Bean", "Angry Birds Red", "Terraria Guide",
    "Hollow Knight", "Subway Surfers Jake",
    "Geometry Dash Cube"
  ]
};

const READY_ANSWERS = [
  [/seni kim yaptı|yapımcın kim/i, "Beni Breynot.editzz yaptı."],
  [/adın ne|ismin ne/i, "Ben Onur AI!"],
  [/^merhaba[!. ]*$|^selam[!. ]*$/i, "Merhaba! 😊"],
  [/nasılsın/i, "İyiyim, teşekkürler! Sen nasılsın?"],
  [/teşekkürler|sağ ol|sağol/i, "Rica ederim! 😊"],
  [/fnf biliyor musun/i, "Evet! FNF karakterleri hakkında yardımcı olabilirim."],
  [/among us biliyor musun/i, "Evet! Crewmate ve Impostor karakterlerini tanıyorum."],
  [/minecraft biliyor musun/i, "Evet! Minecraft karakterleri, moblar ve add-on'lar hakkında yardımcı olabilirim."]
];

function readyAnswer(message) {
  return READY_ANSWERS.find(([pattern]) => pattern.test(message))?.[1] ?? null;
}

function parseJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("JSON sonucu alınamadı.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function safeColor(value, fallback = "#cccccc") {
  return typeof value === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(512, n)) : fallback;
}

function sanitizePlan(raw) {
  const allowed = new Set([
    "rect", "ellipse", "circle", "line", "polygon", "text"
  ]);

  const layers = (Array.isArray(raw.layers) ? raw.layers : [])
    .slice(0, 120)
    .filter(layer => layer && allowed.has(layer.type))
    .map(layer => {
      const out = { type: layer.type };

      for (const key of [
        "x", "y", "width", "height", "radius",
        "x1", "y1", "x2", "y2", "strokeWidth", "fontSize"
      ]) {
        if (layer[key] !== undefined) {
          out[key] = safeNumber(layer[key]);
        }
      }

      out.color = safeColor(layer.color, "#cccccc");
      out.stroke = safeColor(layer.stroke, "#222222");
      out.strokeWidth = safeNumber(layer.strokeWidth, 2);

      if (layer.type === "polygon" && Array.isArray(layer.points)) {
        out.points = layer.points
          .slice(0, 100)
          .filter(p => Array.isArray(p) && p.length >= 2)
          .map(p => [safeNumber(p[0]), safeNumber(p[1])]);
      }

      if (layer.type === "text") {
        out.text = String(layer.text || "").slice(0, 100);
      }

      return out;
    });

  if (!layers.length) {
    throw new Error("Çizim için geçerli katman yok.");
  }

  return {
    name: String(raw.name || "Karakter").slice(0, 100),
    style: String(raw.style || "cartoon").slice(0, 40),
    background: safeColor(raw.background, "#ffffff"),
    layers
  };
}

async function generate(prompt) {
  if (!ai) throw new Error("GEMINI_API_KEY .env dosyasında ayarlanmalı.");

  return ai.models.generateContent({
    model: MODEL,
    contents: prompt
  });
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    configured: Boolean(ai),
    characterGroups: Object.keys(characters)
  });
});

app.get("/api/characters", (_req, res) => {
  res.json({ characters });
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Mesaj boş." });
    }

    const answer = readyAnswer(message);
    if (answer) return res.json({ reply: answer });

    const result = await generate(`
Sen Onur AI adlı Türkçe konuşan bir asistansın.
Doğal, anlaşılır ve doğru cevap ver.
Kullanıcı: ${message}
`);

    res.json({ reply: result.text || "Yanıt oluşturulamadı." });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: String(error.message || error).slice(0, 300)
    });
  }
});

app.post("/api/drawing-plan", async (req, res) => {
  try {
    const userPrompt = String(req.body?.prompt || "").trim();

    if (!userPrompt) {
      return res.status(400).json({ error: "Çizim tarifi boş." });
    }

    if (!ai) {
      return res.status(500).json({ error: "API anahtarı ayarlanmamış." });
    }

    const characterList = JSON.stringify(characters, null, 2);

    const researchResult = await generate(`
Karakter tanıma ve görsel araştırma uzmanısın.
Aşağıdaki karakter listeleri yalnızca isimleri tanımana yardımcı olur:
${characterList}

Kullanıcının istediği:
${userPrompt}

İstenen karakterin bilinen görünüşünü analiz et:
- Hangi oyundan olduğu ve doğru karakter adı
- Siluet ve vücut oranları
- Baş, yüz, göz, ağız ve uzuv ayrıntıları
- Giysi, aksesuar ve ayırt edici işaretler
- Ana ve ikincil renkler
- Çizimde öne çıkarılması gereken ayrıntılar

Kesin bilmediğin ayrıntıları gerçekmiş gibi sunma.
JSON dışında metin döndürme.
Şema:
{
  "name": "karakter adı",
  "game": "oyun adı veya bilinmiyor",
  "silhouette": "görünüş",
  "details": ["ayrıntı"],
  "colors": ["#112233"],
  "style": "istenen çizim stili"
}
`);

    const research = parseJson(researchResult.text);

    const templateResult = await generate(`
Karakter için önce BOYASIZ ÇİZİM KALIBI oluştur.
Araştırma:
${JSON.stringify(research)}

Kullanıcı isteği:
${userPrompt}

512x512 tuval kullan.
Baş, gövde, kollar, bacaklar, yüz ve aksesuarları ayrı katmanlar
olarak tasarla. Katman sırası arkadan öne doğru olsun.
Ana şekillerin sınır çizgilerini belirgin tut.
Boyama aşaması için geçici gri veya beyaz dolgular kullan.
En fazla 120 katman.
Yalnızca JSON döndür:
{
  "name": "karakter adı",
  "style": "cartoon",
  "background": "#ffffff",
  "layers": [
    {
      "type": "ellipse",
      "x": 100,
      "y": 100,
      "width": 120,
      "height": 150,
      "color": "#cccccc",
      "stroke": "#222222",
      "strokeWidth": 3
    }
  ]
}
İzinli katmanlar: rect, ellipse, circle, line, polygon, text.
`);

    const template = parseJson(templateResult.text);

    if (!Array.isArray(template.layers) || template.layers.length === 0) {
      throw new Error("Karakter kalıbı oluşturulamadı.");
    }

    const coloringResult = await generate(`
Sen dijital karakter boyama uzmanısın.
Aşağıda araştırma bilgisi ve boyanmamış kalıp var.

Araştırma:
${JSON.stringify(research)}

Kalıp:
${JSON.stringify(template)}

Görev:
- Katmanların geometrisini ve sırasını değiştirme.
- Her parçaya karakterin görünüşüne uygun renk ver.
- Göz, ağız, kıyafet, gölge ve aksesuar renklerini ayırt et.
- Çizgi renklerini karaktere uygun koru.
- Arka planı uygun seç.
- Katmanları silme ve yeni katman ekleme.
- Yalnızca güncellenmiş tam JSON döndür.
`);

    const colored = parseJson(coloringResult.text);

    if (!Array.isArray(colored.layers)) {
      throw new Error("Boyama sonucu geçersiz.");
    }

    const plan = sanitizePlan({
      ...template,
      ...colored,
      layers: template.layers.map((layer, index) => ({
        ...layer,
        ...(colored.layers[index] || {}),
        type: layer.type
      }))
    });

    res.json({
      plan,
      character: research.name || plan.name
    });
  } catch (error) {
    console.error("Görsel işlemi:", error);
    res.status(500).json({
      error: "Karakter çizimi hazırlanamadı.",
      details: String(error.message || error).slice(0, 300)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Onur AI: http://localhost:${PORT}`);
});
