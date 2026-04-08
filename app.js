const dom = {
  todayLabel: document.querySelector("#todayLabel"),
  appStatus: document.querySelector("#appStatus"),
  briefingTitle: document.querySelector("#briefingTitle"),
  briefingTime: document.querySelector("#briefingTime"),
  briefingSummary: document.querySelector("#briefingSummary"),
  briefingScript: document.querySelector("#briefingScript"),
  playButton: document.querySelector("#playButton"),
  stopButton: document.querySelector("#stopButton"),
  generateButton: document.querySelector("#generateButton"),
  refreshButton: document.querySelector("#refreshButton"),
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
  quickAudio: document.querySelector("#quickAudio")
};

let deferredInstallPrompt;
let currentDay;
let currentData;
let speechUtterance;

function formatDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatTime(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
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
  setStatus(data.online ? "online" : "offline/cache", !data.online);
}

function render(data) {
  const { day, history } = data;
  const audioUrl = day.audio?.url;

  dom.todayLabel.textContent = formatDate(day.dateKey);
  dom.briefingTitle.textContent = day.mode === "manual" ? "Atualizacao do dia" : "O que importa agora";
  dom.briefingTime.textContent = `gerado ${formatTime(day.generatedAt)}`;
  dom.briefingSummary.textContent = day.summary;
  dom.briefingScript.textContent = day.script;
  dom.newsCount.textContent = `${day.news.length} itens`;
  dom.calendarStatus.textContent = data.calendarEnabled ? "calendario" : "manual";
  dom.quickNews.textContent = day.news.length;
  dom.quickAgenda.textContent = day.agenda.length;
  dom.quickTasks.textContent = day.tasks.filter((task) => !task.done).length;
  dom.quickAudio.textContent = audioUrl ? "MP3 IA" : "Browser";

  dom.audioPlayer.hidden = !audioUrl;
  if (audioUrl) {
    dom.audioPlayer.src = audioUrl;
    dom.audioTitle.textContent = "Podcast pronto";
    dom.audioHint.textContent = `Audio neural gerado por ${day.audio.provider}. Use fone e trate como seu briefing de radio pessoal.`;
  } else {
    dom.audioPlayer.removeAttribute("src");
    dom.audioTitle.textContent = "Gerar podcast";
    dom.audioHint.textContent = "Configure OPENAI_API_KEY para salvar MP3 com voz neural. Agora o botao usa a voz do navegador.";
  }

  dom.newsBoard.innerHTML = day.news.map((item) => `
    <article class="news-item">
      <div class="news-meta">
        <span class="category">${escapeHtml(item.category)}</span>
        <span class="meta">${escapeHtml(item.source || "RSS")}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Abrir fonte</a>` : ""}
    </article>
  `).join("");

  dom.wordsBoard.innerHTML = `
    <article class="word-card">
      <span class="category">Ingles avancado</span>
      <strong>${escapeHtml(day.words.english.word)}</strong>
      <p class="meta">${escapeHtml(day.words.english.pronunciation)}</p>
      <p>${escapeHtml(day.words.english.meaning)}</p>
      <p>${escapeHtml(day.words.english.example)}</p>
    </article>
    <article class="word-card">
      <span class="category">Mandarim basico</span>
      <strong>${escapeHtml(day.words.mandarin.word)}</strong>
      <p class="meta">${escapeHtml(day.words.mandarin.pinyin)}</p>
      <p>${escapeHtml(day.words.mandarin.meaning)}</p>
      <p>${escapeHtml(day.words.mandarin.example)}</p>
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
        <button type="button" data-task-id="${escapeHtml(task.id)}">${task.done ? "Reabrir" : "Feito"}</button>
      </li>
    `)
  ].join("");

  dom.historyList.innerHTML = history.map((item) => `
    <button class="history-item" type="button" data-day="${escapeHtml(item.dateKey)}">
      <strong>${formatDate(item.dateKey)}</strong>
      <span>${item.mode === "manual" ? "Atualizacao" : "Manha"} - ${formatTime(item.generatedAt)}</span>
    </button>
  `).join("");
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
  setStatus("Gerando boletim...");
  const data = await api("/api/briefings", {
    method: "POST",
    body: JSON.stringify({ date: currentDay, mode })
  });
  currentData = data;
  currentDay = data.day.dateKey;
  render(data);
  setStatus(data.online ? "online" : "offline/cache", !data.online);
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
  dom.briefingSummary.textContent = "Nao consegui carregar o painel. Confira se o servidor esta rodando.";
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

loadDay().catch(handleError);
