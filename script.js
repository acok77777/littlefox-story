
"use strict";

const TOTAL_STORIES = 64;
const COMPLETED_KEY = "littlefoxCompleted";

const RANGES = [
  { start: 1, end: 10, label: "1-10편" },
  { start: 11, end: 20, label: "11-20편" },
  { start: 21, end: 30, label: "21-30편" },
  { start: 31, end: 40, label: "31-40편" },
  { start: 41, end: 50, label: "41-50편" },
  { start: 51, end: 64, label: "51-64편" }
];

const COLORS = [
  "story-color-pink",
  "story-color-blue",
  "story-color-green",
  "story-color-yellow",
  "story-color-purple",
  "story-color-orange"
];

const $ = (id) => document.getElementById(id);

let stories = [];
let currentStory = null;
let currentRange = RANGES[0];
let currentScreen = "home";
let currentMode = "both";
let pendingCompleted = false;

function pad(number) {
  return String(number).padStart(2, "0");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* 오디오 경로: 편수에 맞는 폴더 자동 선택 */
function getAudioPath(number) {
  const folder = Math.ceil(number / 10);
  return `audio ${folder}/s ${pad(number)}.mp3`;
}

/* 완료 기록 */
function getCompleted() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(COMPLETED_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return [...new Set(
      saved.map(Number).filter((number) =>
        Number.isInteger(number) &&
        number >= 1 &&
        number <= TOTAL_STORIES
      )
    )];
  } catch {
    return [];
  }
}

function setCompleted(numbers) {
  localStorage.setItem(
    COMPLETED_KEY,
    JSON.stringify(
      [...new Set(numbers)].sort((a, b) => a - b)
    )
  );
}

/* 동화 텍스트 분석 */
function parseStory(text, number) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n");

  let titleEn = `Story ${number}`;
  let titleKo = "";
  const content = [];

  for (const originalLine of lines) {
    const line = originalLine.trim();

    if (!line) continue;

    const titleMatch = line.match(/^제목\s*:\s*(.+)$/);

    if (titleMatch) {
      const title = titleMatch[1].trim();
      const koreanIndex = title.search(/[가-힣]/);

      if (koreanIndex >= 0) {
        titleEn = title.slice(0, koreanIndex).trim();
        titleKo = title.slice(koreanIndex).trim();
      } else {
        titleEn = title;
      }

      continue;
    }

    if (/^\d+\s*[.)]?\s*$/.test(line)) continue;

    content.push(line);
  }

  return {
    number,
    titleEn: titleEn || `Story ${number}`,
    titleKo,
    content
  };
}

/* 메인 화면 구간 버튼 */
function renderRangeButtons() {
  const grid = $("rangeGrid");

  if (!grid) {
    console.error("rangeGrid 요소를 찾을 수 없습니다.");
    return;
  }

  grid.innerHTML = RANGES.map((range, index) => `
    <button
      type="button"
      class="range-button"
      data-range="${index}"
    >${range.label}</button>
  `).join("");

  grid.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      const range = RANGES[Number(button.dataset.range)];
      if (range) openRange(range);
    });
  });
}

/* 동화 파일 하나 불러오기 */
async function loadStory(number) {
  const response = await fetch(`data/w ${pad(number)}.txt`);

  if (!response.ok) {
    throw new Error(
      `data/w ${pad(number)}.txt 파일을 읽을 수 없습니다.`
    );
  }

  return parseStory(await response.text(), number);
}

/* 전체 동화 불러오기 */
async function loadAllStories() {
  const list = $("storyList");

  renderRangeButtons();
  updateProgress();

  if (list) {
    list.innerHTML = "<p>📚 동화 목록을 불러오는 중이에요...</p>";
  }

  const results = await Promise.allSettled(
    Array.from(
      { length: TOTAL_STORIES },
      (_, index) => loadStory(index + 1)
    )
  );

  stories = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => a.number - b.number);

  updateProgress();

  if (stories.length === 0) {
    if (list) {
      list.innerHTML =
        "<p>🐰 동화를 불러오지 못했어요. data 폴더와 파일 이름을 확인해 주세요.</p>";
    }
    return;
  }

  if (stories.length < TOTAL_STORIES) {
    console.warn(
      `64편 중 ${stories.length}편을 불러왔습니다. 누락된 파일을 확인해 주세요.`
    );
  }
}

/* 구간 선택 */
function openRange(range) {
  currentRange = range;

  const description = $("listDescription");

  if (description) {
    description.textContent = `${range.label} 동화 목록`;
  }

  renderStoryList();
  showScreen("list");
}

/* 동화 목록 표시 */
function renderStoryList() {
  const list = $("storyList");
  if (!list) return;

  const completed = getCompleted();

  const filteredStories = stories.filter((story) =>
    story.number >= currentRange.start &&
    story.number <= currentRange.end
  );

  if (filteredStories.length === 0) {
    list.innerHTML =
      "<p>📚 이 구간에 표시할 동화가 없어요. 파일 이름을 확인해 주세요.</p>";
    return;
  }

  list.innerHTML = filteredStories.map((story, index) => {
    const isDone = completed.includes(story.number);
    const color = COLORS[index % COLORS.length];
    const isActive = currentStory?.number === story.number;

    return `
      <button
        type="button"
        class="story-item ${color} ${isActive ? "active" : ""}"
        data-story="${story.number}"
        aria-pressed="${isActive}"
      >
        <span class="story-number">${pad(story.number)}</span>
        <span class="story-title-area">
          <span class="story-title-en">${escapeHTML(story.titleEn)}</span>
          <span class="story-subtitle">${escapeHTML(story.titleKo)}</span>
        </span>
        <span class="story-done">${isDone ? "⭐" : "📖"}</span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => {
      openStory(Number(button.dataset.story));
    });
  });
}

/* 화면 전환 */
function showScreen(screenName) {
  currentScreen = screenName;

  $("homeScreen")?.classList.toggle("hidden", screenName !== "home");
  $("listScreen")?.classList.toggle("hidden", screenName !== "list");
  $("studyScreen")?.classList.toggle("hidden", screenName !== "study");

  $("backButton")?.classList.toggle("hidden", screenName === "home");
  $("closeButton")?.classList.toggle("hidden", screenName === "home");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goBack() {
  if (currentScreen === "study") {
    $("storyAudio")?.pause();
    showScreen("list");
    renderStoryList();
  } else if (currentScreen === "list") {
    showScreen("home");
  }
}

function goHome() {
  $("storyAudio")?.pause();
  showScreen("home");
}

/* 동화 학습 화면 */
function openStory(number) {
  const story = stories.find((item) => item.number === number);
  if (!story) return;

  currentStory = story;
  currentMode = "both";
  pendingCompleted = getCompleted().includes(number);

  $("studyEpisode").textContent = `${number}편`;
  $("studyTitle").textContent = story.titleEn;
  $("studyTitleKo").textContent = story.titleKo;

  renderStoryContent(story);
  updateModeButtons();
  updateCompletionUI();

  const audio = $("storyAudio");

  if (audio) {
    audio.pause();

    /* 7개 폴더에서 해당 MP3 불러오기 */
    audio.src = getAudioPath(number);

    audio.playbackRate = 1;
    audio.load();
  }

  document.querySelectorAll(".speed-button").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.speed) === 1
    );
  });

  setAudioStatus("");
  updateAudioTime();
  renderStoryList();
  showScreen("study");
}

/* 본문 표시 */
function renderStoryContent(story) {
  const contentElement = $("storyContent");
  if (!contentElement) return;

  contentElement.innerHTML = story.content.map((line) => {
    const isKorean = /[가-힣]/.test(line);
    const type = isKorean ? "korean" : "english";

    return `
      <p class="story-line ${type}">${escapeHTML(line)}</p>
    `;
  }).join("");

  applyLanguageMode();
}

/* 영어만 / 해석만 / 모두 */
function applyLanguageMode() {
  const content = $("storyContent");
  if (!content) return;

  content.querySelectorAll(".story-line").forEach((line) => {
    if (currentMode === "both") {
      line.style.display = "";
    } else if (currentMode === "english") {
      line.style.display =
        line.classList.contains("english") ? "" : "none";
    } else {
      line.style.display =
        line.classList.contains("korean") ? "" : "none";
    }
  });
}

function updateModeButtons() {
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.mode === currentMode
    );
  });
}

/* 완료 상태 */
function updateCompletionUI() {
  const checkbox = $("doneCheckbox");
  const label = $("doneLabel");
  const message = $("saveMessage");

  if (checkbox) checkbox.checked = pendingCompleted;

  if (label) {
    label.textContent = pendingCompleted ? "완료했어요! ⭐" : "완료 전";
  }

  if (message) message.textContent = "";
}

/* 완료 기록 저장 */
function saveCurrentCompletion() {
  if (!currentStory) return;

  let completed = getCompleted();

  if (pendingCompleted) {
    if (!completed.includes(currentStory.number)) {
      completed.push(currentStory.number);
    }
  } else {
    completed = completed.filter(
      (number) => number !== currentStory.number
    );
  }

  try {
    setCompleted(completed);
  } catch (error) {
    console.error("완료 기록 저장 오류:", error);

    const message = $("saveMessage");
    if (message) {
      message.textContent =
        "저장하지 못했어요. 브라우저 설정을 확인해 주세요.";
    }
    return;
  }

  updateCompletionUI();
  updateProgress();
  renderStoryList();

  const message = $("saveMessage");

  if (message) {
    message.textContent = pendingCompleted
      ? "🎉 공부 완료를 저장했어요!"
      : "완료 체크를 해제했어요.";
  }
}

/* 학습 진도 */
function updateProgress() {
  const count = getCompleted().length;
  const countElement = $("progressCount");
  const progressBar = $("progressBar");
  const progressText = $("progressText");

  if (countElement) {
    countElement.textContent = `${count} / ${TOTAL_STORIES}편`;
  }

  if (progressBar) {
    progressBar.style.width = `${(count / TOTAL_STORIES) * 100}%`;
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", String(TOTAL_STORIES));
    progressBar.setAttribute("aria-valuenow", String(count));
  }

  if (progressText) {
    if (count === 0) {
      progressText.textContent =
        "아직 공부를 시작하지 않았어요. 첫 동화부터 시작해 봐요! 🐣";
    } else if (count === TOTAL_STORIES) {
      progressText.textContent =
        "🎉 축하해요! 64편을 모두 공부했어요!";
    } else {
      progressText.textContent =
        `정말 잘하고 있어요! ${count}편을 완료했어요. 🌷`;
    }
  }
}

/* 시간 표시 */
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

/* 오디오 상태 안내 숨김 */
function setAudioStatus(message) {
  const status = $("audioStatus");
  if (status) status.textContent = "";
}

/* 오디오 시간 및 진행 막대 */
function updateAudioTime() {
  const audio = $("storyAudio");
  if (!audio) return;

  const currentTime = $("currentTime");
  const duration = $("duration");
  const seekBar = $("seekBar");

  if (currentTime) {
    currentTime.textContent = formatTime(audio.currentTime);
  }

  if (duration) {
    duration.textContent = formatTime(audio.duration);
  }

  if (seekBar) {
    const hasDuration =
      Number.isFinite(audio.duration) && audio.duration > 0;

    seekBar.max = hasDuration ? audio.duration : 100;

    if (!seekBar.matches(":active")) {
      seekBar.value = hasDuration ? audio.currentTime : 0;
    }
  }
}

/* 재생 / 일시정지 */
async function togglePlayback() {
  const audio = $("storyAudio");
  if (!audio || !currentStory) return;

  if (audio.paused) {
    try {
      await audio.play();
      setAudioStatus("");
    } catch (error) {
      console.error("오디오 재생 오류:", error);
      setAudioStatus("");
    }
  } else {
    audio.pause();
  }
}

/* 5초 이동 */
function skipAudio(seconds) {
  const audio = $("storyAudio");
  if (!audio) return;

  const duration = Number.isFinite(audio.duration)
    ? audio.duration
    : Infinity;

  audio.currentTime = Math.max(
    0,
    Math.min(audio.currentTime + seconds, duration)
  );

  updateAudioTime();
}

/* 재생 속도 */
function setPlaybackSpeed(speed) {
  const audio = $("storyAudio");
  if (audio) audio.playbackRate = speed;

  document.querySelectorAll(".speed-button").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.speed) === speed
    );
  });
}

/* 오디오 이벤트 */
function setupAudio() {
  const audio = $("storyAudio");
  if (!audio) return;

  $("playButton")?.addEventListener("click", togglePlayback);

  $("back5Button")?.addEventListener("click", () => {
    skipAudio(-5);
  });

  $("forward5Button")?.addEventListener("click", () => {
    skipAudio(5);
  });

  $("seekBar")?.addEventListener("input", (event) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = Number(event.target.value);
      updateAudioTime();
    }
  });

  document.querySelectorAll(".speed-button").forEach((button) => {
    button.addEventListener("click", () => {
      setPlaybackSpeed(Number(button.dataset.speed));
    });
  });

  audio.addEventListener("loadedmetadata", updateAudioTime);
  audio.addEventListener("timeupdate", updateAudioTime);

  audio.addEventListener("play", () => {
    const button = $("playButton");
    if (button) {
      button.textContent = "Ⅱ";
      button.setAttribute("aria-label", "일시정지");
    }
    setAudioStatus("");
  });

  audio.addEventListener("pause", () => {
    const button = $("playButton");
    if (button) {
      button.textContent = "▶";
      button.setAttribute("aria-label", "재생");
    }
  });

  audio.addEventListener("ended", () => {
    setAudioStatus("");
  });

  audio.addEventListener("error", () => {
    setAudioStatus("");
    console.warn("오디오 파일을 불러오지 못했습니다.");
  });
}

/* 버튼 이벤트 */
function setupEvents() {
  $("backButton")?.addEventListener("click", goBack);
  $("closeButton")?.addEventListener("click", goHome);

  $("doneCheckbox")?.addEventListener("change", (event) => {
    pendingCompleted = event.target.checked;

    const label = $("doneLabel");
    if (label) {
      label.textContent = pendingCompleted
        ? "완료했어요! ⭐"
        : "완료 전";
    }

    const message = $("saveMessage");
    if (message) {
      message.textContent =
        "변경 사항을 저장하려면 저장하기를 눌러 주세요.";
    }
  });

  $("saveButton")?.addEventListener("click", saveCurrentCompletion);

  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      currentMode = button.dataset.mode;
      applyLanguageMode();
      updateModeButtons();
    });
  });
}

/* 사이트 시작 */
document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();
  setupAudio();
  showScreen("home");

  renderRangeButtons();

  try {
    await loadAllStories();
  } catch (error) {
    console.error("동화 초기화 오류:", error);

    const list = $("storyList");
    if (list) {
      list.innerHTML =
        "<p>🐰 동화 목록을 불러오지 못했어요. 파일 경로를 확인해 주세요.</p>";
    }
  }
});
