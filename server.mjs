import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.DATA_DIR || join(__dirname, "data");
const STORE_PATH = process.env.STORE_PATH || join(DATA_DIR, "store.json");
const AUDIO_DIR = process.env.AUDIO_DIR || join(DATA_DIR, "audio");
const CONFIG_PATH = process.env.CONFIG_PATH || join(__dirname, "config.json");
const CONFIG_EXAMPLE_PATH = join(__dirname, "config.example.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".pcm": "audio/L16"
};

const fallbackWords = {
  english: [
    ["perspicacious", "per-spi-KAY-shus", "Capaz de perceber detalhes sutis com clareza.", "A perspicacious reader notices what the headline leaves unsaid."],
    ["equanimity", "ee-kwuh-NIM-uh-tee", "Calma mental em situações difíceis.", "She handled the breaking news with equanimity."],
    ["laconic", "luh-KON-ik", "Breve, direto, usando poucas palavras.", "His laconic update said enough without adding noise."],
    ["fastidious", "fa-STID-ee-us", "Muito atento a detalhes e padrões.", "A fastidious editor catches weak arguments early."],
    ["sagacious", "suh-GAY-shus", "Sábio, com bom julgamento prático.", "A sagacious investor waits for better evidence."]
  ],
  mandarin: [
    ["今天", "jintian", "hoje", "今天我学习中文。Hoje eu estudo mandarim."],
    ["谢谢", "xiexie", "obrigado", "谢谢你。Obrigado."],
    ["水", "shui", "água", "我要水。Eu quero água."],
    ["早上", "zaoshang", "manhã", "早上好。Bom dia."],
    ["朋友", "pengyou", "amigo", "他是我的朋友。Ele é meu amigo."]
  ]
};

let newsCache = { expiresAt: 0, items: [], online: false };

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function loadConfig() {
  const example = await readJson(CONFIG_EXAMPLE_PATH, {});
  const local = await readJson(CONFIG_PATH, {});
  const envConfig = configFromEnv();
  return {
    ...example,
    ...local,
    ...envConfig,
    calendar: {
      ...(example.calendar || {}),
      ...(local.calendar || {}),
      ...(envConfig.calendar || {})
    },
    tts: {
      ...(example.tts || {}),
      ...(local.tts || {}),
      ...(envConfig.tts || {})
    }
  };
}

function configFromEnv() {
  const config = {};

  if (process.env.OWNER_NAME) config.ownerName = process.env.OWNER_NAME;
  if (process.env.TIMEZONE) config.timezone = process.env.TIMEZONE;
  if (process.env.INTERESTS) config.interests = process.env.INTERESTS.split(",").map((item) => item.trim()).filter(Boolean);
  if (process.env.ICAL_URL) config.calendar = { icalUrl: process.env.ICAL_URL };
  if (process.env.TTS_PROVIDER || process.env.OPENAI_TTS_MODEL || process.env.OPENAI_TTS_VOICE) {
    config.tts = {
      provider: process.env.TTS_PROVIDER,
      openaiModel: process.env.OPENAI_TTS_MODEL,
      openaiVoice: process.env.OPENAI_TTS_VOICE,
      responseFormat: process.env.TTS_RESPONSE_FORMAT,
      speed: process.env.TTS_SPEED ? Number(process.env.TTS_SPEED) : undefined,
      instructions: process.env.TTS_INSTRUCTIONS
    };
    config.tts = Object.fromEntries(Object.entries(config.tts).filter(([, value]) => value !== undefined && value !== ""));
  }

  return config;
}

async function loadStore() {
  return readJson(STORE_PATH, { days: {} });
}

async function saveStore(store) {
  await writeJson(STORE_PATH, store);
}

async function ensureRuntimeDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(AUDIO_DIR, { recursive: true });
}

function dateKeyInTimeZone(timeZone = "America/Sao_Paulo", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localTimeParts(timeZone = "America/Sao_Paulo", date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

async function todayKey() {
  const config = await loadConfig();
  return dateKeyInTimeZone(config.timezone);
}

function getSeed(dateKey) {
  return dateKey.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function pick(items, seed) {
  return items[seed % items.length];
}

function wordOfDay(dateKey) {
  const seed = getSeed(dateKey);
  const english = pick(fallbackWords.english, seed);
  const mandarin = pick(fallbackWords.mandarin, seed + 1);
  return {
    english: { word: english[0], pronunciation: english[1], meaning: english[2], example: english[3] },
    mandarin: { word: mandarin[0], pinyin: mandarin[1], meaning: mandarin[2], example: mandarin[3] }
  };
}

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanStoryTitle(item) {
  return stripHtml(item.title)
    .replace(new RegExp(`\\s+-\\s+${escapeRegExp(item.source || "")}$`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanStorySummary(item) {
  const title = cleanStoryTitle(item);
  const summary = stripHtml(item.summary)
    .replace(new RegExp(`\\s+${escapeRegExp(item.source || "")}$`, "i"), "")
    .replace(title, "")
    .replace(/\s+/g, " ")
    .trim();
  return summary;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return stripHtml(match?.[1] || "");
}

function sourceFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "RSS";
  }
}

function parseFeed(xml, category) {
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entryBlocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  return blocks.slice(0, 8).map((block) => {
    const linkMatch = block.match(/<link\b[^>]*href="([^"]+)"/i);
    const url = tagValue(block, "link") || decodeEntities(linkMatch?.[1] || "");
    const title = tagValue(block, "title");
    const summary = tagValue(block, "description") || tagValue(block, "summary") || tagValue(block, "content");
    const source = tagValue(block, "source") || sourceFromUrl(url);
    const published = tagValue(block, "pubDate") || tagValue(block, "updated") || tagValue(block, "published");
    const publishedDate = published ? new Date(published) : new Date();

    return {
      id: crypto.createHash("sha1").update(`${category}:${title}:${url}`).digest("hex"),
      category,
      title,
      summary: summary || "Sem resumo no feed. Abra a fonte para ler o contexto completo.",
      url,
      source,
      publishedAt: Number.isNaN(publishedDate.valueOf()) ? new Date().toISOString() : publishedDate.toISOString()
    };
  }).filter((item) => item.title);
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    signal: AbortSignal.timeout(9000),
    headers: { "user-agent": "DailyBoard/0.2" }
  });

  if (!response.ok) throw new Error(`Feed ${feed.category} retornou ${response.status}`);
  return parseFeed(await response.text(), feed.category);
}

async function getNews(config, force = false) {
  if (!force && Date.now() < newsCache.expiresAt) return newsCache;

  const feeds = Array.isArray(config.newsFeeds) ? config.newsFeeds : [];
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const online = items.length > 0;
  const interests = (config.interests || []).map((interest) => interest.toLowerCase());

  const grouped = [];
  for (const feed of feeds) {
    grouped.push(...items
      .filter((item) => item.category === feed.category)
      .sort((a, b) => newsScore(b, interests) - newsScore(a, interests) || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 3));
  }

  newsCache = {
    expiresAt: Date.now() + 15 * 60 * 1000,
    items: grouped,
    online
  };

  return newsCache;
}

function newsScore(item, interests) {
  const text = `${item.title} ${item.summary} ${item.category}`.toLowerCase();
  return interests.reduce((score, interest) => score + (text.includes(interest) ? 10 : 0), 0);
}

function fallbackNews(config) {
  return (config.newsFeeds || []).map((feed) => ({
    id: crypto.randomUUID(),
    category: feed.category,
    title: `${feed.category}: aguardando conexão`,
    summary: "Nao consegui buscar noticias reais agora. O painel manteve o boletim salvo e tenta de novo quando voce atualizar.",
    url: "",
    source: "cache",
    publishedAt: new Date().toISOString()
  }));
}

function unfoldIcs(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseIcsDate(value) {
  if (!value) return null;
  const clean = value.replace(/Z$/, "");
  const date = clean.slice(0, 8);
  const time = clean.includes("T") ? clean.split("T")[1].slice(0, 4) : "0000";
  return {
    dateKey: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    time: `${time.slice(0, 2)}:${time.slice(2, 4)}`
  };
}

function icsField(block, name) {
  const match = block.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "im"));
  return decodeEntities(match?.[1] || "").replace(/\\,/g, ",").replace(/\\n/g, " ").trim();
}

function parseIcs(text, dateKey) {
  const unfolded = unfoldIcs(text);
  return [...unfolded.matchAll(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/g)]
    .map((match) => match[1])
    .map((block) => {
      const start = parseIcsDate(icsField(block, "DTSTART"));
      if (!start) return null;
      return {
        dateKey: start.dateKey,
        time: start.time,
        title: icsField(block, "SUMMARY") || "Evento sem titulo"
      };
    })
    .filter((event) => event?.dateKey === dateKey)
    .map((event) => ({ time: event.time, title: event.title }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

async function getAgenda(config, dateKey) {
  const icalUrl = config.calendar?.icalUrl || process.env.ICAL_URL || "";

  if (icalUrl) {
    try {
      const response = await fetch(icalUrl, { signal: AbortSignal.timeout(9000) });
      if (response.ok) {
        const events = parseIcs(await response.text(), dateKey);
        if (events.length) return { agenda: events, enabled: true };
      }
    } catch {
      return { agenda: config.manualAgenda || [], enabled: false };
    }
  }

  return { agenda: config.manualAgenda || [], enabled: Boolean(icalUrl) };
}

function buildScript({ config, dateKey, mode, news, words, agenda }) {
  const byCategory = new Map();
  for (const item of news) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, item);
  }

  const greeting = mode === "manual"
    ? `Aqui vai sua atualizacao de agora, ${config.ownerName || "Oto"}.`
    : `Bom dia, ${config.ownerName || "Oto"}. Este e o Daily Board de ${dateKey}.`;

  const newsLines = [...byCategory.values()].map((item) => {
    const title = cleanStoryTitle(item);
    const summary = cleanStorySummary(item);
    return `Em ${item.category}: ${title}.${summary ? ` ${summary}` : ""}`;
  });
  const agendaLines = agenda.length
    ? [`Na agenda, os proximos pontos sao: ${agenda.slice(0, 3).map((event) => `${event.time}, ${event.title}`).join("; ")}.`]
    : ["Agenda limpa por enquanto."];

  return [
    greeting,
    "Vamos direto ao que merece sua atencao.",
    ...newsLines,
    ...agendaLines,
    `Para o estudo de hoje: em ingles avancado, ${words.english.word}, que significa ${words.english.meaning}`,
    `Em mandarim basico, ${words.mandarin.word}, pinyin ${words.mandarin.pinyin}, significa ${words.mandarin.meaning}.`,
    "Fechamento: escolha uma acao importante, uma leitura para salvar, e siga o dia sem virar refem do feed."
  ].join(" ");
}

function audioInputFor(briefing) {
  return briefing.script.length > 4096
    ? `${briefing.script.slice(0, 4000)} Encerrando por aqui para manter o audio objetivo.`
    : briefing.script;
}

async function maybeCreateAudio(config, briefing) {
  const tts = config.tts || {};
  const shouldUseOpenAi = tts.provider === "openai" && process.env.OPENAI_API_KEY && tts.openaiModel;

  if (!shouldUseOpenAi) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: tts.openaiModel,
        voice: tts.openaiVoice || "alloy",
        input: audioInputFor(briefing),
        instructions: tts.instructions,
        response_format: tts.responseFormat || "mp3",
        speed: Number(tts.speed || 1)
      })
    });

    if (!response.ok) throw new Error(`TTS retornou ${response.status}`);
    await mkdir(AUDIO_DIR, { recursive: true });
    const responseFormat = tts.responseFormat || "mp3";
    const fileName = `${briefing.dateKey}-${briefing.id}.${responseFormat}`;
    const filePath = join(AUDIO_DIR, fileName);
    const bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, bytes);
    return { url: `/audio/${fileName}`, provider: "openai" };
  } catch (error) {
    console.warn("Falha ao gerar audio TTS:", error.message);
    return null;
  }
}

async function createBriefing({ dateKey, mode, store, config, forceNews }) {
  const newsResult = await getNews(config, forceNews);
  const news = newsResult.items.length ? newsResult.items : fallbackNews(config);
  const words = wordOfDay(dateKey);
  const { agenda, enabled: calendarEnabled } = await getAgenda(config, dateKey);
  const previousTasks = store.days[dateKey]?.tasks || [
    { id: crypto.randomUUID(), title: "Ler boletim do dia", done: false },
    { id: crypto.randomUUID(), title: "Separar 20 minutos para estudo", done: false }
  ];
  const generatedAt = new Date().toISOString();
  const briefing = {
    id: crypto.randomUUID(),
    dateKey,
    generatedAt,
    mode,
    summary: mode === "manual"
      ? "Atualizacao com as noticias mais recentes, sua agenda e as palavras do dia."
      : "Boletim da manha com noticias, agenda e estudo de idiomas.",
    news,
    words,
    agenda,
    tasks: previousTasks,
    audio: null,
    script: ""
  };

  briefing.script = buildScript({ config, dateKey, mode, news, words, agenda });
  briefing.audio = await maybeCreateAudio(config, briefing);
  store.days[dateKey] = briefing;

  return { briefing, online: newsResult.online, calendarEnabled };
}

function historyFromStore(store) {
  return Object.values(store.days)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .map((day) => ({ dateKey: day.dateKey, generatedAt: day.generatedAt, mode: day.mode }));
}

async function runMorningSchedule() {
  const config = await loadConfig();
  const schedule = config.morningBriefing || { enabled: true, hour: 7, minute: 0 };

  if (schedule.enabled === false) return;

  const timeZone = config.timezone || "America/Sao_Paulo";
  const now = localTimeParts(timeZone);
  const scheduledHour = Number(schedule.hour ?? 7);
  const scheduledMinute = Number(schedule.minute ?? 0);
  const shouldRun = now.hour > scheduledHour || (now.hour === scheduledHour && now.minute >= scheduledMinute);

  if (!shouldRun) return;

  const dateKey = dateKeyInTimeZone(timeZone);
  const store = await loadStore();
  if (store.days[dateKey]) return;

  const result = await createBriefing({ dateKey, mode: "morning", store, config, forceNews: true });
  await saveStore(store);
  console.log(`Boletim da manha preparado para ${dateKey}. Noticias online: ${result.online ? "sim" : "nao"}`);
}

async function dayResponse(dateKey, forceNews = false, mode = "morning") {
  const config = await loadConfig();
  const store = await loadStore();
  let calendarEnabled = Boolean(config.calendar?.icalUrl || process.env.ICAL_URL);
  let online = newsCache.online;

  if (!store.days[dateKey] || forceNews) {
    const result = await createBriefing({ dateKey, mode, store, config, forceNews });
    online = result.online;
    calendarEnabled = result.calendarEnabled;
    await saveStore(store);
  }

  return {
    day: store.days[dateKey],
    history: historyFromStore(store),
    online,
    calendarEnabled
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, text, status = 200) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}

async function serveStatic(request, response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = normalize(join(__dirname, relativePath));

  if (!filePath.startsWith(__dirname)) {
    sendText(response, "Forbidden", 403);
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not file");
    response.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, "Not found", 404);
  }
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, {
      ok: true,
      now: new Date().toISOString(),
      dataDir: DATA_DIR,
      hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY)
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime") {
    const config = await loadConfig();
    sendJson(response, {
      ownerName: config.ownerName,
      timezone: config.timezone,
      ttsProvider: config.tts?.provider || "browser",
      ttsModel: config.tts?.openaiModel || null,
      ttsVoice: config.tts?.openaiVoice || null,
      calendarEnabled: Boolean(config.calendar?.icalUrl),
      dataDir: DATA_DIR
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/day") {
    const date = url.searchParams.get("date") || await todayKey();
    sendJson(response, await dayResponse(date));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/briefings") {
    const body = await readBody(request);
    const date = body.date || await todayKey();
    sendJson(response, await dayResponse(date, true, body.mode === "manual" ? "manual" : "morning"));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tasks") {
    const body = await readBody(request);
    const date = body.date || await todayKey();
    const title = String(body.title || "").trim();
    if (!title) {
      sendText(response, "Task title is required", 400);
      return;
    }
    const store = await loadStore();
    if (!store.days[date]) await dayResponse(date);
    const refreshedStore = await loadStore();
    refreshedStore.days[date].tasks.push({ id: crypto.randomUUID(), title, done: false });
    await saveStore(refreshedStore);
    sendJson(response, { ok: true }, 201);
    return;
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const body = await readBody(request);
    const store = await loadStore();
    const day = store.days[body.date || await todayKey()];
    const task = day?.tasks.find((item) => item.id === id);
    if (!task) {
      sendText(response, "Task not found", 404);
      return;
    }
    task.done = !task.done;
    await saveStore(store);
    sendJson(response, { ok: true });
    return;
  }

  sendText(response, "Not found", 404);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (url.pathname.startsWith("/audio/")) {
      await serveStatic(request, response, `/data/audio/${url.pathname.replace("/audio/", "")}`);
      return;
    }

    await serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    sendText(response, error.message || "Internal error", 500);
  }
});

await ensureRuntimeDirs();

server.listen(PORT, HOST, () => {
  console.log(`Daily Board rodando em http://localhost:${PORT}`);
  console.log(`Dados persistentes em ${DATA_DIR}`);
  console.log("Na rede local, use o IP do computador com a mesma porta.");
});

setInterval(() => {
  runMorningSchedule().catch((error) => console.warn("Falha no agendador da manha:", error.message));
}, 60 * 1000);

setTimeout(() => {
  runMorningSchedule().catch((error) => console.warn("Falha no agendador da manha:", error.message));
}, 3000);
