
"use strict";

/* =========================
   설정
========================= */
const TOTAL_STORIES = 64;
const COMPLETED_KEY = "littlefoxCompleted";

const RANGES = [
  { start: 1, end: 10, label: "🌸 1~10편", subtitle: "첫걸음 동화" },
  { start: 11, end: 20, label: "🩵 11~20편", subtitle: "쑥쑥 성장 동화" },
  { start: 21, end: 30, label: "🌿 21~30편", subtitle: "즐거운 영어 동화" },
  { start: 31, end: 40, label: "🌼 31~40편", subtitle: "재미있는 이야기" },
  { start: 41, end: 50, label: "💜 41~50편", subtitle: "신나는 영어 여행" },
  { start: 51, end: 64, label: "🍊 51~64편", subtitle: "마지막 동화까지" }
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

/* =========================
   공통 함수
========================= */
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

function getCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");

    if (!Array.isArray(saved)) return [];

    return saved
      .map(Number)
      .filter((number) =>
        Number.isInteger(number) &&
        number >= 1 &&
        number <= TOTAL_STORIES
      );
  } catch {
    return [];
  }
}

function setCompleted(completed) {
  localStorage.setItem(
    COMPLETED_KEY,
    JSON.stringify([...new Set(completed)].sort((a, b) => a - b))
  );
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/* =========================
   텍스트 파일 읽기
========================= */
function parseStory(text, number) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .split("\n");

  let titleEn = `Story ${number}`;
  let titleKo = "";
  let titleFound = false;
  const content = [];

  for (const originalLine of lines) {
    const line = originalLine.trim();

    if (!line) continue;

    const titleMatch = line.match(/^제목\s*:\s*(.+)$/i);

    if (titleMatch) {
      const title = titleMatch[1].trim();

      /*
       * 제목 예시:
       * I See 나는 봐요
       */
      const koreanIndex = title.search(/[가-힣]/);

      if (koreanIndex >= 0) {
        titleEn = title.slice(0, koreanIndex).trim();
        titleKo = title.slice(koreanIndex).trim();
      } else {
        titleEn = title;
      }

      titleFound = true;
      continue;
    }

    /*
     * 본문에 들어간 단독 번호 제거
     */
    if (/^\d+\s*[.)]?$/.test(line)) continue;

    content.push(line);
  }

  /*
   * 제목 줄이 없더라도 첫 문장으로
   * 제목을 추측하지 않고 기본 제목을 사용
   */
  if (!titleFound) {
    titleEn = `Story ${number}`;
  }

  return {
    number,
    titleEn: titleEn || `Story ${number}`,
    titleKo,
    content
  };
}

async function fetchStory(number) {
  const response = await fetch(`data/w ${pad(number)}.txt`);

  if (!response.ok) {
    throw new Error(`w ${pad(number)}.txt 파일을 읽을 수 없습니다.`);
  }

  const text = await response.text();
  return parseStory(text, number);
}

async function loadAllStories() {
  const results = await Promise.allSettled(
    Array.from(
      { length: TOTAL_STORIES },
      (_, index) => fetchStory(index + 1)
    )
  );

  stories = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => a.number - b.number);

  renderRangeButtons();
  updateProgress();

  if (stories.length === 0) {
    const grid = $("rangeGrid");

    if (grid) {
      grid.innerHTML = `
        <p class="load-error">
          동화 파일을 읽지 못했어요.<br>
          data 폴더와 파일 이름을 확인해 주세요.
        </p>
      `;
    }

    return;
  }

  if (stories.length < TOTAL_STORIES) {
    console.warn(
      `${TOTAL_STORIES}편 중 ${stories.length}편을 불러왔습니다.`
    );
  }
}

/* =========================
   화면 이동
========================= */
function showScreen(screenName) {
  currentScreen = screenName;

  $("homeScreen")?.classList.toggle(
    "hidden",
    screenName !== "home"
  );

  $("listScreen")?.classList.toggle(
    "hidden",
    screenName !== "list"
  );

  $("studyScreen")?.classList.toggle(
    "hidden",
    screenName !== "study"
  );

  $("backButton")?.classList.toggle(
    "hidden",
    screenName === "home"
  );

  $("closeButton")?.classList.toggle(
    "hidden",
    screenName === "home"
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function goBack() {
  if (currentScreen === "study") {
    const audio = $("storyAudio");
    audio?.pause();
    showScreen("list");
  } else if (currentScreen === "list") {
    showScreen("home");
  }
}

function goHome() {
  const audio = $("storyAudio");
  audio?.pause();
  showScreen("home");
}

/* =========================
   메인 구간 버튼
========================= */
function renderRangeButtons() {
  const grid = $("rangeGrid");
  if (!grid) return;

  grid.innerHTML = RANGES.map((range, index) => {
    const count = stories.filter(
      (story) =>
        story.number >= range.start &&
        story.number <= range.end
    ).length;

    return `
      <button
        type="button"
        class="range-button range-color-${index + 1}"
        data-range="${index}"
      >
        <span class="range-label">${escapeHTML(range.label)}</span>
        <span class="range-subtitle">
          ${escapeHTML(range.subtitle)}
        </span>
        <span class="range-count">${count}편의 동화</span>
      </button>
    `;
  }).join("");

  grid.querySelectorAll("[data-range]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.range);
      openRange(RANGES[index]);
    });
  });
}

function openRange(range) {
  currentRange = range;

  const description = $("listDescription");

  if (description) {
    description.textContent =
      `${range.start}편부터 ${range.end}편까지 골라 보세요.`;
  }

  renderStoryList();
  showScreen("list");
}

/* =========================
   동화 목록
========================= */
function renderStoryList() {
  const list = $("storyList");
  if (!list) return;

  const completed = getCompleted();

  const filteredStories = stories.filter(
    (story) =>
      story.number >= currentRange.start &&
      story.number <= currentRange.end
  );

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
          <span class="story-title-en">
            ${escapeHTML(story.titleEn)}
          </span>
          <span class="story-subtitle">
            ${escapeHTML(story.titleKo)}
          </span>
        </span>

        <span class="story-done" aria-label="${isDone ? "학습 완료" : "미완료"}">
          ${isDone ? "⭐" : "📖"}
        </span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => {
      const number = Number(button.dataset.story);
      openStory(number);
    });
  });
}

/* =========================
   동화 학습 화면
========================= */
function openStory(number) {
  const story = stories.find((item) => item.number === number);
  if (!story) return;

  currentStory = story;
  pendingCompleted = getCompleted().includes(number);
  currentMode = "both";

  const episode = $("studyEpisode");
  const title = $("studyTitle");
  const titleKo = $("studyTitleKo");

  if (episode) episode.textContent = `${number}편`;
  if (title) title.textContent = story.titleEn;
  if (titleKo) titleKo.textContent = story.titleKo;

  renderStoryContent(story);
  updateCompletionUI();
  updateModeButtons();

  const audio = $("storyAudio");

  if (audio) {
    audio.pause();
    audio.src = `audio/s ${pad(number)}.mp3`;
    audio.playbackRate = 1;
    audio.load();
  }

  document.querySelectorAll(".speed-button").forEach((button) => {
    button.classList.toggle(button.dataset.speed === "1", "active");
  });

  setAudioStatus("음성을 준비하고 있어요.");
  updateAudioTime();

  renderStoryList();
  showScreen("study");
}

function renderStoryContent(story) {
  const contentElement = $("storyContent");
  if (!contentElement) return;

  contentElement.innerHTML = story.content.map((line) => {
    const isKorean = /[가-힣]/.test(line);
    const type = isKorean ? "korean" : "english";

    return `
      <p class="story-line ${type}">
        ${escapeHTML(line)}
      </p>
    `;
  }).join("");

  applyLanguageMode();
}

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

/* =========================
   학습 완료 저장
========================= */
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

  setCompleted(completed);

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

function updateProgress() {
  const completed = getCompleted();
  const count = completed.length;

  const countElement = $("progressCount");
  if (countElement) {
    countElement.textContent = `${count} / ${TOTAL_STORIES}편`;
  }

  const progressBar = $("progressBar");
  if (progressBar) {
    progressBar.style.width = `${(count / TOTAL_STORIES) * 100}%`;
    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", String(TOTAL_STORIES));
    progressBar.setAttribute("aria-valuenow", String(count));
  }

  const text = $("progressText");

  if (text) {
    if (count === 0) {
      text.textContent =
        "아직 공부를 시작하지 않았어요. 첫 동화부터 시작해 봐요!";
    } else if (count === TOTAL_STORIES) {
      text.textContent =
        "🎉 축하해요! 64편을 모두 공부했어요!";
    } else {
      text.textContent =
        `정말 잘하고 있어요! ${count}편을 완료했어요. 🌷`;
    }
  }
}

/* =========================
   오디오 제어
========================= */
function setAudioStatus(message) {
  const status = $("audioStatus");
  if (status) status.textContent = message;
}

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
    seekBar.max = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : 100;

    if (!seekBar.matches(":active")) {
      seekBar.value = Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.currentTime
        : 0;
    }
  }
}

async function togglePlayback() {
  const audio = $("storyAudio");
  if (!audio || !currentStory) return;

  if (audio.paused) {
    try {
      await audio.play();
      setAudioStatus("🎧 동화를 듣고 있어요.");
    } catch (error) {
      setAudioStatus(
        "음성을 재생할 수 없어요. audio 폴더와 파일 이름을 확인해 주세요."
      );
    }
  } else {
    audio.pause();
  }
}

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
    const value = Number(event.target.value);

    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = value;
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
  });

  audio.addEventListener("pause", () => {
    const button = $("playButton");
    if (button) {
      button.textContent = "▶";
      button.setAttribute("aria-label", "재생");
    }
  });

  audio.addEventListener("ended", () => {
    setAudioStatus("🌷 잘 들었어요! 한 번 더 들어도 좋아요.");
  });

  audio.addEventListener("error", () => {
    setAudioStatus(
      "음성 파일을 찾을 수 없어요. audio/s 번호.mp3 파일을 확인해 주세요."
    );
  });
}

/* =========================
   이벤트 연결
========================= */
function setupEvents() {
  $("backButton")?.addEventListener("click", goBack);
  $("closeButton")?.addEventListener("click", goHome);

  $("doneCheckbox")?.addEventListener("change", (event) => {
    pendingCompleted = event.target.checked;

    const label = $("doneLabel");
    if (label) {
      label.textContent = pendingCompleted ? "완료했어요! ⭐" : "완료 전";
    }

    const message = $("saveMessage");
    if (message) {
      message.textContent = "변경 사항을 저장하려면 저장하기를 눌러 주세요.";
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

/* =========================
   시작
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();
  setupAudio();
  showScreen("home");

  try {
    await loadAllStories();
  } catch (error) {
    console.error("동화 초기화 오류:", error);

    const grid = $("rangeGrid");
    if (grid) {
      grid.innerHTML = `
        <p class="load-error">
          동화 목록을 불러오지 못했어요.<br>
          GitHub 저장소의 파일 경로를 확인해 주세요.
        </p>
      `;
    }
  }
});
