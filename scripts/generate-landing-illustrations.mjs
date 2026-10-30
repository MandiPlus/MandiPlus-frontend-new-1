import fs from "node:fs";
import path from "node:path";

const root = "/Users/omi/products/omisaur";
const outDir = "/Users/omi/mandi/frontend/public/images/landing";
fs.mkdirSync(outDir, { recursive: true });

function loadEnv(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(root, ".env"));

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is missing.");
  process.exit(1);
}

const shared = `
Flat editorial product illustration for Mandiplus, an Indian agri trade app.
Color system: soft lavender/lilac wash background (#eeeafc to #f5f6fb), deep slate-navy (#203044), muted purple accent (#7c6ee6), soft white surfaces, gentle warm wood/produce accents only where needed.
Style: clean, genuine, calm, modern minimal — like a premium fintech explainer illustration, NOT AI slop.
Strict avoid: glowing shields, neon glows, lens flares, chrome reflections, 3D glassmorphism, purple cosmic gradients, cartoon mascots, stock-photo faces, watermarks, logos, text labels, busy backgrounds, cyberpunk, exaggerated CGI.
Composition: single clear subject, generous negative space, centered, square-friendly, soft even lighting, matte surfaces.
`;

const items = [
  {
    name: "feature-insurance",
    prompt: `${shared}
Subject: transit insurance for a produce truck — show a clean white Indian commercial truck loaded with wooden crates of green coconuts / citrus, parked calmly, with a simple paper insurance certificate / policy document resting on a crate in the foreground (no shield icon). Soft lavender hills and light market sheds in far distance, very quiet. Communicate protection through calm coverage of goods in transit, not through fantasy armor.`,
  },
  {
    name: "feature-tracking",
    prompt: `${shared}
Subject: live truck tracking — a modern smartphone held upright showing a simple clean map UI with one route line and a small truck pin between two city dots. Behind/beside the phone, a soft-focus Indian highway truck driving on a quiet road. Minimal UI on the phone screen (no readable brand text). Calm lavender sky. Communicate location clarity and live progress, not sci-fi GPS holograms.`,
  },
  {
    name: "feature-claims",
    prompt: `${shared}
Subject: filing a transit claim — an Indian trader's hands photographing a slightly damaged produce crate with a smartphone; next to the phone, a second soft panel showing a simple claim status card UI (status chips like Received / Reviewing, no readable brand). Soft lavender background, quiet mandi shed context. Communicate easy photo-based claim help and human support, not angry drama or glowing security badges.`,
  },
];

async function generate(item) {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1.5",
      prompt: item.prompt,
      size: "1024x1024",
      quality: "high",
      n: 1,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || JSON.stringify(json);
    throw new Error(`${item.name}: ${response.status} ${message}`);
  }
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${item.name}: response missing b64_json`);
  const file = path.join(outDir, `${item.name}.png`);
  fs.writeFileSync(file, Buffer.from(b64, "base64"));
  console.log(`saved ${file}`);
}

for (const item of items) {
  let attempt = 0;
  while (true) {
    try {
      await generate(item);
      break;
    } catch (error) {
      attempt += 1;
      console.error(`Retrying ${item.name}: ${error.message}`);
      if (attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 15000 * attempt));
    }
  }
}
