const dom = {
  greetingTitle: document.querySelector("#greetingTitle"),
  heroDate: document.querySelector("#heroDate"),
  briefingTitle: document.querySelector("#briefingTitle"),
  briefingTime: document.querySelector("#briefingTime"),
  briefingSummary: document.querySelector("#briefingSummary"),
  briefingScript: document.querySelector("#briefingScript"),
  playButton: document.querySelector("#playButton"),
  stopButton: document.querySelector("#stopButton"),
  generateButton: document.querySelector("#generateButton"),
  refreshButton: document.querySelector("#refreshButton"),
  settingsButton: document.querySelector("#settingsButton"),
  audioPlayer: document.querySelector("#audioPlayer"),
  playerPlayButton: document.querySelector("#playerPlayButton"),
  playerSeek: document.querySelector("#playerSeek"),
  playerCurrent: document.querySelector("#playerCurrent"),
  playerDuration: document.querySelector("#playerDuration"),
  audioHint: document.querySelector("#audioHint"),
  audioTitle: document.querySelector("#audioTitle"),
  installButton: document.querySelector("#installButton"),
  agendaList: document.querySelector("#agendaList"),
  taskForm: document.querySelector("#taskForm"),
  taskInput: document.querySelector("#taskInput"),
  newsBoard: document.querySelector("#newsBoard"),
  newsViewLink: document.querySelector("#newsViewLink"),
  newsViewLabel: document.querySelector("#newsViewLabel"),
  wordsBoard: document.querySelector("#wordsBoard"),
  historyList: document.querySelector("#historyList"),
  newsCount: document.querySelector("#newsCount"),
  calendarStatus: document.querySelector("#calendarStatus"),
  quickNews: document.querySelector("#quickNews"),
  quickAgenda: document.querySelector("#quickAgenda"),
  quickTasks: document.querySelector("#quickTasks"),
  quickAudio: document.querySelector("#quickAudio"),
  settingsPanel: document.querySelector("#settingsPanel"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsStatus: document.querySelector("#settingsStatus"),
  settingOwnerName: document.querySelector("#settingOwnerName"),
  settingTimezone: document.querySelector("#settingTimezone"),
  settingIcalUrl: document.querySelector("#settingIcalUrl"),
  settingInterests: document.querySelector("#settingInterests"),
  settingFeeds: document.querySelector("#settingFeeds"),
  settingMorningHour: document.querySelector("#settingMorningHour"),
  settingMorningMinute: document.querySelector("#settingMorningMinute"),
  settingProvider: document.querySelector("#settingProvider"),
  settingElevenVoiceId: document.querySelector("#settingElevenVoiceId"),
  settingElevenApiKey: document.querySelector("#settingElevenApiKey"),
  settingVoice: document.querySelector("#settingVoice"),
  settingMacosVoice: document.querySelector("#settingMacosVoice")
};

let deferredInstallPrompt;
let currentDay;
let currentData;
let currentSettings;
let speechUtterance;
let wordUtterance;
let wordAudioPlayer = new Audio();

function currentView() {
  return new URLSearchParams(window.location.search).get("view") === "news" ? "news" : "daily";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function displayDate(dateKey, timeZone = "America/Sao_Paulo") {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function displayTime(isoDate, timeZone = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

function displayLongDate(dateKey, timeZone = "America/Sao_Paulo") {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function timeGreeting(timeZone = "America/Sao_Paulo") {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false
  }).format(new Date()));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function groupNews(items) {
  const preferred = ["Brasil", "Mundo", "China", "Tech"];
  const grouped = new Map();
  for (const item of items) {
    const category = item.category === "Tecnologia" ? "Tech" : item.category;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push({ ...item, category });
  }
  const ordered = [
    ...preferred.filter((category) => grouped.has(category)),
    ...[...grouped.keys()].filter((category) => !preferred.includes(category))
  ];
  return ordered.map((category) => ({ category, items: grouped.get(category) }));
}

function categoryIcon(category) {
  return {
    Brasil: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 4 8l8 5 8-5-8-5Z"/><path d="m4 16 8 5 8-5"/><path d="m4 12 8 5 8-5"/></svg>',
    Mundo: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18"/><path d="M12 3a15 15 0 0 0 0 18"/></svg>',
    China: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 3 1.8 3.9L18 7.3l-3 2.9.8 4.1-3.8-2-3.8 2 .8-4.1-3-2.9 4.2-.4L12 3Z"/></svg>',
    Tech: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M4 10h3M4 14h3M17 10h3M17 14h3M10 4v3M14 4v3M10 17v3M14 17v3"/></svg>',
    Cultura: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="16" r="2"/></svg>',
    Esportes: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 4h9l-1 5 4 2-4 2 1 7H6Z"/></svg>'
  }[category] || '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';
}

function shortSummary(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 110) return text;
  return `${text.slice(0, 107).trim()}...`;
}

function normalizedText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function overlapRatio(left, right) {
  const leftWords = new Set(normalizedText(left).split(" ").filter((word) => word.length > 2));
  const rightWords = normalizedText(right).split(" ").filter((word) => word.length > 2);
  if (!leftWords.size || !rightWords.length) return 0;
  return rightWords.filter((word) => leftWords.has(word)).length / Math.max(1, rightWords.length);
}

function looksWeakSummary(summary) {
  const text = String(summary || "").trim();
  return !text || text.length < 28 || /^["“'][^"”']+["”']$/.test(text);
}

function fallbackCardSummary(item) {
  const title = String(item.title || "")
    .replace(/\s+-\s+[^-]+$/, "")
    .replace(/^["“][^"”]+["”]\s*:\s*/u, "")
    .replace(/^["“][^"”]+["”]\s*/u, "")
    .replace(/[“”"]/g, "")
    .trim();

  if (title.includes(":")) {
    const [lead, tail] = title.split(/:\s+/, 2);
    if (tail && tail.length > 24) return shortSummary(tail);
    if (lead) return shortSummary(`A matéria explica ${lead.toLowerCase()}.`);
  }

  if (/\bfutebol\b|\batleta\b|\bpontas\b|\bcontratado\b/i.test(title)) {
    return shortSummary(`Mercado esportivo em foco: ${title}.`);
  }

  if (/\bgoverno\b|\banatel\b|\bleilão\b|\bgasolina\b|\betanol\b/i.test(title)) {
    return shortSummary(`Movimento de política pública: ${title.replace(/\bavalia aumentar\b/i, "estuda elevar")}.`);
  }

  if (/\bchina\b|\bbyd\b|\btrump\b|\birã\b|\bcessar-fogo\b/i.test(title)) {
    return shortSummary(`No exterior, o destaque é que ${title.charAt(0).toLowerCase() + title.slice(1)}.`);
  }

  if (/\bmuseus?\b|\bcultura\b|\bpicanha\b|\branking\b/i.test(title)) {
    return shortSummary(`O destaque cultural de agora: ${title.replace(/\btem\b/i, "registra").replace(/\bentra em ranking\b/i, "ganha destaque em ranking")}.`);
  }

  return shortSummary(`O ponto central é que ${title.charAt(0).toLowerCase() + title.slice(1)}.`);
}

function newsSummaryForCard(item) {
  const summary = String(item.summary || "").trim();
  if (looksWeakSummary(summary) || overlapRatio(item.title, summary) > 0.8) {
    return fallbackCardSummary(item);
  }
  return shortSummary(summary);
}

function heroDigest(day) {
  const grouped = groupNews(day.news);
  const highlights = grouped
    .map((group) => {
      const first = group.items[0];
      if (!first) return "";
      return `${group.category}: ${newsSummaryForCard(first)}`;
    })
    .filter(Boolean)
    .slice(0, 3);
  return highlights.join(" ");
}

function formatDuration(value) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...options.headers },
    ...options
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Erro ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function setStatus(text, isError = false) {
  document.body.dataset.status = isError ? "error" : text.toLowerCase();
}

async function loadDay(dateKey = currentDay) {
  setStatus("Atualizando...");
  const path = dateKey ? `/api/day?date=${encodeURIComponent(dateKey)}` : "/api/day";
  const data = await api(path);
  currentData = data;
  currentDay = data.day.dateKey;
  render(data);
  setStatus(data.online ? "online" : "cache", !data.online);
}

async function loadSettings() {
  currentSettings = await api("/api/settings");
  populateSettings(currentSettings);
}

function render(data) {
  const { day, history } = data;
  const timeZone = data.timezone || currentSettings?.timezone || "America/Sao_Paulo";
  const audioUrl = day.audio?.url;

  const greeting = timeGreeting(timeZone);
  const ownerName = data.ownerName || "Bayer";
  const view = currentView();

  dom.greetingTitle.textContent = `${greeting}, ${ownerName}`;
  dom.heroDate.textContent = displayDate(day.dateKey, timeZone);
  dom.briefingTitle.textContent = "Seu radar essencial";
  dom.briefingTime.textContent = `último ${displayTime(day.generatedAt, timeZone)}`;
  dom.briefingSummary.textContent = heroDigest(day) || `Resumo do dia atualizado às ${displayTime(day.generatedAt, timeZone)}.`;
  dom.briefingScript.textContent = day.script;
  dom.newsCount.textContent = `${day.news.length}`;
  dom.calendarStatus.textContent = data.calendarEnabled ? "iCal" : "manual";
  dom.quickNews.textContent = String(day.news.length);
  dom.quickAgenda.textContent = String(day.agenda.length);
  dom.quickTasks.textContent = String(day.tasks.filter((task) => !task.done).length);
  dom.quickAudio.textContent = audioUrl ? "pronto" : "web";
  dom.newsViewLink.href = view === "news" ? "./" : "?view=news";
  dom.newsViewLabel.textContent = view === "news" ? "voltar ao daily" : "somente notícias";
  document.body.dataset.view = view;

  dom.audioPlayer.hidden = !audioUrl;
  if (audioUrl) {
    dom.audioPlayer.src = audioUrl;
    dom.audioTitle.textContent = "Podcast pronto";
    dom.audioHint.textContent = `Arquivo gerado por ${day.audio.provider}. Use o player para pausar, avançar e retomar.`;
  } else {
    dom.audioPlayer.removeAttribute("src");
    dom.audioTitle.textContent = "Podcast";
    dom.audioHint.textContent = "Sem MP3 ainda. Configure a chave de TTS no ambiente ou use a voz do navegador.";
  }

  dom.newsBoard.innerHTML = groupNews(day.news).map((group) => `
    <section class="news-group">
      <div class="news-group-heading">
        <h3>${escapeHtml(group.category)}</h3>
        <span>${group.items.length}</span>
      </div>
      <div class="news-group-list">
        ${group.items.map((item, index) => `
          <article class="news-item ${index === 0 ? "is-featured" : ""}">
            <div class="news-icon news-${escapeHtml(group.category.toLowerCase())}" aria-hidden="true">${categoryIcon(group.category)}</div>
            <div class="news-copy">
              <div class="news-meta">
                <span class="category">${escapeHtml(item.source || "RSS")}</span>
                <span class="meta">${displayTime(item.publishedAt, timeZone)}</span>
              </div>
              <h4>${escapeHtml(item.title)}</h4>
              <p>${escapeHtml(newsSummaryForCard(item))}</p>
            </div>
            ${item.url ? `<a class="news-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer" aria-label="Abrir notícia">↗</a>` : ""}
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  dom.wordsBoard.innerHTML = `
    <article class="word-card">
      <div class="word-card-top">
        <span class="category">English</span>
        <button class="word-audio-button" type="button" data-word-text="${escapeHtml(day.words.english.word)}" data-word-lang="en-US" aria-label="Ouvir palavra em inglês">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 10v4h4l5 4V6l-5 4Z"/><path d="M17 9.5a4 4 0 0 1 0 5"/></svg>
        </button>
      </div>
      <strong>${escapeHtml(day.words.english.word)}</strong>
      <p>${escapeHtml(day.words.english.pronunciation || "")}</p>
      <p>${escapeHtml(day.words.english.meaning)}</p>
    </article>
    <article class="word-card">
      <div class="word-card-top">
        <span class="category">Mandarin</span>
        <button class="word-audio-button" type="button" data-word-text="${escapeHtml(day.words.mandarin.word)}" data-word-lang="zh-CN" aria-label="Ouvir palavra em mandarim">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 10v4h4l5 4V6l-5 4Z"/><path d="M17 9.5a4 4 0 0 1 0 5"/></svg>
        </button>
      </div>
      <strong>${escapeHtml(day.words.mandarin.word)}</strong>
      <p>${escapeHtml(day.words.mandarin.pinyin)} · ${escapeHtml(day.words.mandarin.meaning)}</p>
    </article>
  `;

  dom.agendaList.innerHTML = [
    ...day.agenda.map((item) => `
      <li class="agenda-item">
        <time>${escapeHtml(item.time)}</time>
        <span>${escapeHtml(item.title)}</span>
      </li>
    `),
    ...day.tasks.map((task) => `
      <li class="task-item ${task.done ? "is-done" : ""}">
        <span>${escapeHtml(task.title)}</span>
        <button type="button" data-task-id="${escapeHtml(task.id)}">${task.done ? "Reabrir" : "Ok"}</button>
      </li>
    `)
  ].join("");

  dom.historyList.innerHTML = history.map((item) => `
    <button class="history-item" type="button" data-day="${escapeHtml(item.dateKey)}">
      <strong>${displayDate(item.dateKey, timeZone)}</strong>
      <span>${item.mode === "manual" ? "Update" : "Morning"} · ${displayTime(item.generatedAt, timeZone)}</span>
    </button>
  `).join("");
}

function populateSettings(settings) {
  dom.settingOwnerName.value = settings.ownerName || "";
  dom.settingTimezone.value = settings.timezone || "America/Sao_Paulo";
  dom.settingIcalUrl.value = settings.calendar?.icalUrl || "";
  dom.settingInterests.value = (settings.interests || []).join(", ");
  dom.settingFeeds.value = (settings.newsFeeds || [])
    .map((feed) => `${feed.category} | ${feed.url}`)
    .join("\n");
  dom.settingMorningHour.value = settings.morningBriefing?.hour ?? 7;
  dom.settingMorningMinute.value = settings.morningBriefing?.minute ?? 0;
  dom.settingProvider.value = settings.tts?.provider || "elevenlabs";
  dom.settingElevenVoiceId.value = settings.tts?.elevenLabsVoiceId || "JBFqnCBsd6RMkjVDRZzb";
  dom.settingElevenApiKey.value = "";
  dom.settingElevenApiKey.placeholder = settings.tts?.hasElevenLabsApiKey ? "Chave salva" : "Cole para ativar áudio premium";
  dom.settingVoice.value = settings.tts?.openaiVoice || "marin";
  dom.settingMacosVoice.value = settings.tts?.macosVoice || "Luciana";
}

function settingsPayload() {
  return {
    ownerName: dom.settingOwnerName.value.trim(),
    timezone: dom.settingTimezone.value.trim(),
    interests: dom.settingInterests.value.split(",").map((item) => item.trim()).filter(Boolean),
    calendar: {
      icalUrl: dom.settingIcalUrl.value.trim()
    },
    morningBriefing: {
      enabled: true,
      hour: Number(dom.settingMorningHour.value || 7),
      minute: Number(dom.settingMorningMinute.value || 0)
    },
    newsFeeds: dom.settingFeeds.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [category, ...urlParts] = line.split("|");
        return { category: category?.trim(), url: urlParts.join("|").trim() };
      })
      .filter((feed) => feed.category && feed.url),
    tts: {
      provider: dom.settingProvider.value || "elevenlabs",
      openaiModel: currentSettings?.tts?.openaiModel || "gpt-4o-mini-tts",
      openaiVoice: dom.settingVoice.value.trim() || "marin",
      elevenLabsModel: currentSettings?.tts?.elevenLabsModel || "eleven_multilingual_v2",
      elevenLabsVoiceId: dom.settingElevenVoiceId.value.trim() || "JBFqnCBsd6RMkjVDRZzb",
      elevenLabsApiKey: dom.settingElevenApiKey.value.trim(),
      macosVoice: dom.settingMacosVoice.value.trim() || "Luciana",
      responseFormat: dom.settingProvider.value === "elevenlabs" ? "mp3_44100_128" : "mp3",
      speed: currentSettings?.tts?.speed || 0.92,
      stability: currentSettings?.tts?.stability ?? 0.44,
      similarityBoost: currentSettings?.tts?.similarityBoost ?? 0.78,
      style: currentSettings?.tts?.style ?? 0.35,
      useSpeakerBoost: currentSettings?.tts?.useSpeakerBoost !== false,
      instructions: currentSettings?.tts?.instructions || ""
    }
  };
}

function openSettings() {
  dom.settingsPanel.hidden = false;
  loadSettings().catch(handleError);
}

function closeSettings() {
  dom.settingsPanel.hidden = true;
}

async function saveSettings(event) {
  event.preventDefault();
  dom.settingsStatus.textContent = "Salvando...";
  currentSettings = await api("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settingsPayload())
  });
  populateSettings(currentSettings);
  dom.settingsStatus.textContent = "Configurações salvas.";
  await generateBriefing("manual");
}

async function speakBriefing() {
  const day = currentData?.day;
  if (!day) return;

  if (day.audio?.url) {
    dom.audioPlayer.hidden = false;
    await dom.audioPlayer.play();
    return;
  }

  await generateBriefing("manual");
  if (currentData?.day?.audio?.url) {
    await dom.audioPlayer.play();
    return;
  }

  if (!("speechSynthesis" in window)) {
    alert("Seu navegador nao encontrou suporte de audio por voz.");
    return;
  }

  window.speechSynthesis.cancel();
  speechUtterance = new SpeechSynthesisUtterance(day.script);
  speechUtterance.lang = "pt-BR";
  speechUtterance.rate = 0.95;
  window.speechSynthesis.speak(speechUtterance);
}

async function speakWord(text, lang) {
  if (!text) return;

  try {
    const audio = await api(`/api/word-audio?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(lang)}`);
    if (audio?.url) {
      wordAudioPlayer.pause();
      wordAudioPlayer.src = audio.url;
      await wordAudioPlayer.play();
      return;
    }
  } catch (error) {
    console.warn("Falha no audio da palavra:", error.message);
  }

  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  wordUtterance = new SpeechSynthesisUtterance(text);
  wordUtterance.lang = lang;
  wordUtterance.rate = lang === "zh-CN" ? 0.8 : 0.9;
  window.speechSynthesis.speak(wordUtterance);
}

function stopAudio() {
  window.speechSynthesis?.cancel();
  dom.audioPlayer.pause();
  dom.audioPlayer.currentTime = 0;
}

async function generateBriefing(mode) {
  setStatus("Gerando...");
  const data = await api("/api/briefings", {
    method: "POST",
    body: JSON.stringify({ date: currentDay, mode })
  });
  currentData = data;
  currentDay = data.day.dateKey;
  render(data);
  setStatus(data.online ? "online" : "cache", !data.online);
}

async function addTask(event) {
  event.preventDefault();
  const title = dom.taskInput.value.trim();
  if (!title) return;

  await api("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ date: currentDay, title })
  });
  dom.taskInput.value = "";
  await loadDay(currentDay);
}

async function handleListClick(event) {
  const taskButton = event.target.closest("[data-task-id]");
  const historyButton = event.target.closest("[data-day]");
  const wordButton = event.target.closest("[data-word-text]");

  if (taskButton) {
    await api(`/api/tasks/${encodeURIComponent(taskButton.dataset.taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ date: currentDay })
    });
    await loadDay(currentDay);
  }

  if (historyButton) {
    await loadDay(historyButton.dataset.day);
  }

  if (wordButton) {
    await speakWord(wordButton.dataset.wordText, wordButton.dataset.wordLang || "en-US");
  }
}

function handleError(error) {
  console.error(error);
  setStatus("erro", true);
  dom.briefingSummary.textContent = "Não consegui carregar o painel.";
  dom.briefingScript.textContent = String(error.message || error);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dom.installButton.hidden = false;
});

dom.installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.installButton.hidden = true;
});

function updatePlayerIcon(isPlaying) {
  dom.playerPlayButton.innerHTML = isPlaying
    ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5h3v14H8ZM13 5h3v14h-3Z"/></svg>'
    : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14l11-7Z"/></svg>';
}

function syncPlayerProgress() {
  const duration = dom.audioPlayer.duration || 0;
  const current = dom.audioPlayer.currentTime || 0;
  dom.playerSeek.value = duration ? String((current / duration) * 100) : "0";
  dom.playerCurrent.textContent = formatDuration(current);
  dom.playerDuration.textContent = formatDuration(duration);
}

async function togglePlayer() {
  if (!currentData?.day?.audio?.url) {
    await speakBriefing();
    return;
  }

  if (dom.audioPlayer.paused) {
    await dom.audioPlayer.play();
  } else {
    dom.audioPlayer.pause();
  }
}

dom.playButton.addEventListener("click", () => speakBriefing().catch(handleError));
dom.playerPlayButton.addEventListener("click", () => togglePlayer().catch(handleError));
dom.playerSeek.addEventListener("input", () => {
  const duration = dom.audioPlayer.duration || 0;
  if (duration) dom.audioPlayer.currentTime = (Number(dom.playerSeek.value) / 100) * duration;
});
dom.audioPlayer.addEventListener("timeupdate", syncPlayerProgress);
dom.audioPlayer.addEventListener("loadedmetadata", syncPlayerProgress);
dom.audioPlayer.addEventListener("play", () => updatePlayerIcon(true));
dom.audioPlayer.addEventListener("pause", () => updatePlayerIcon(false));
dom.audioPlayer.addEventListener("ended", () => updatePlayerIcon(false));
dom.stopButton.addEventListener("click", stopAudio);
dom.generateButton.addEventListener("click", () => generateBriefing("manual").catch(handleError));
dom.refreshButton.addEventListener("click", () => loadDay(currentDay).catch(handleError));
dom.settingsButton.addEventListener("click", openSettings);
dom.settingsForm.addEventListener("submit", (event) => saveSettings(event).catch(handleError));
dom.settingsPanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-settings-close]")) closeSettings();
});
dom.wordsBoard.addEventListener("click", (event) => handleListClick(event).catch(handleError));
dom.taskForm.addEventListener("submit", (event) => addTask(event).catch(handleError));
dom.agendaList.addEventListener("click", (event) => handleListClick(event).catch(handleError));
dom.historyList.addEventListener("click", (event) => handleListClick(event).catch(handleError));

window.setInterval(() => {
  if (document.visibilityState === "visible" && currentDay) {
    loadDay(currentDay).catch(handleError);
  }
}, 30 * 60 * 1000);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

Promise.all([loadSettings(), loadDay()]).catch(handleError);
