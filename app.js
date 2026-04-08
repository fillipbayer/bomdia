const dom = {
  todayLabel: document.querySelector("#todayLabel"),
  appStatus: document.querySelector("#appStatus"),
  greetingTitle: document.querySelector("#greetingTitle"),
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
  audioHint: document.querySelector("#audioHint"),
  audioTitle: document.querySelector("#audioTitle"),
  installButton: document.querySelector("#installButton"),
  agendaList: document.querySelector("#agendaList"),
  taskForm: document.querySelector("#taskForm"),
  taskInput: document.querySelector("#taskInput"),
  newsBoard: document.querySelector("#newsBoard"),
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
  settingVoice: document.querySelector("#settingVoice")
};

let deferredInstallPrompt;
let currentDay;
let currentData;
let currentSettings;
let speechUtterance;

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
  dom.appStatus.textContent = text;
  dom.appStatus.classList.toggle("is-error", isError);
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

  dom.greetingTitle.textContent = data.ownerName ? `Bom dia, ${data.ownerName}` : "Exploring Minds";
  dom.todayLabel.textContent = displayDate(day.dateKey, timeZone);
  dom.briefingTitle.textContent = day.mode === "manual" ? "Update" : "Becoming";
  dom.briefingTime.textContent = displayTime(day.generatedAt, timeZone);
  dom.briefingSummary.textContent = day.summary;
  dom.briefingScript.textContent = day.script;
  dom.newsCount.textContent = `${day.news.length}`;
  dom.calendarStatus.textContent = data.calendarEnabled ? "iCal" : "manual";
  dom.quickNews.textContent = day.news.length;
  dom.quickAgenda.textContent = day.agenda.length;
  dom.quickTasks.textContent = day.tasks.filter((task) => !task.done).length;
  dom.quickAudio.textContent = audioUrl ? "IA" : "Web";

  dom.audioPlayer.hidden = !audioUrl;
  if (audioUrl) {
    dom.audioPlayer.src = audioUrl;
    dom.audioTitle.textContent = "Podcast pronto";
    dom.audioHint.textContent = `MP3 neural gerado por ${day.audio.provider}.`;
  } else {
    dom.audioPlayer.removeAttribute("src");
    dom.audioTitle.textContent = "Podcast";
    dom.audioHint.textContent = "Sem MP3 ainda. Configure a chave de TTS no ambiente ou use a voz do navegador.";
  }

  dom.newsBoard.innerHTML = day.news.map((item) => `
    <article class="news-item">
      <div class="news-meta">
        <span class="category">${escapeHtml(item.category)}</span>
        <span class="meta">${escapeHtml(item.source || "RSS")}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Abrir</a>` : ""}
    </article>
  `).join("");

  dom.wordsBoard.innerHTML = `
    <article class="word-card">
      <span class="category">English</span>
      <strong>${escapeHtml(day.words.english.word)}</strong>
      <p>${escapeHtml(day.words.english.meaning)}</p>
    </article>
    <article class="word-card">
      <span class="category">Mandarin</span>
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
  dom.settingVoice.value = settings.tts?.openaiVoice || "marin";
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
      provider: currentSettings?.tts?.provider || "openai",
      openaiModel: currentSettings?.tts?.openaiModel || "gpt-4o-mini-tts",
      openaiVoice: dom.settingVoice.value.trim() || "marin",
      responseFormat: currentSettings?.tts?.responseFormat || "mp3",
      speed: currentSettings?.tts?.speed || 1,
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

function speakBriefing() {
  const day = currentData?.day;
  if (!day) return;

  if (day.audio?.url) {
    dom.audioPlayer.hidden = false;
    dom.audioPlayer.play();
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

dom.playButton.addEventListener("click", speakBriefing);
dom.stopButton.addEventListener("click", stopAudio);
dom.generateButton.addEventListener("click", () => generateBriefing("manual").catch(handleError));
dom.refreshButton.addEventListener("click", () => loadDay(currentDay).catch(handleError));
dom.settingsButton.addEventListener("click", openSettings);
dom.settingsForm.addEventListener("submit", (event) => saveSettings(event).catch(handleError));
dom.settingsPanel.addEventListener("click", (event) => {
  if (event.target.closest("[data-settings-close]")) closeSettings();
});
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
