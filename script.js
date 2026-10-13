
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

/* 파일 번호 */
function pad(number) {
  return String(number).padStart(2, "0");
}

/* HTML 특수문자 처리 */
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

/* 완료 기록 불러오기 */
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

/* 완료 기록 저장 */
function setCompleted(numbers) {
  localStorage.setItem(
    COMPLETED_KEY,
    JSON.stringify([...new Set(numbers)].sort((a, b) => a - b))
  );
}

/* 텍스트 파일 분석 */
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

    // 본문에 단독으로 적힌 번호는 표시하지 않음
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

/* 동화 파일 하나 불러오기 */
async function loadStory(number) {
  const response = await fetch(`data/w ${pad(number)}.txt`);

  if (!response.ok) {
    throw new Error(`data/w ${pad(number)}.txt 파일을 읽을 수 없습니다.`);
  }

  return parseStory(await response.text(), number);
}

/* 전체 동화 불러오기 */
async function loadAllStories() {
  const list = $("storyList");

  if (list) {
    list.innerHTML = "<p>동화 목록을 불러오는 중이에요... 📚</p>";
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

  renderRangeButtons();
  updateProgress();

  if (stories.length === 0) {
    if (list) {
      list.innerHTML =
        "<p>동화를 불러오지 못했어요. data 폴더와 파일 이름을 확인해 주세요.</p>";
    }
    return;
  }

  if (stories.length < TOTAL_STORIES) {
    console.warn(
      `64편 중 ${stories.length}편을 불러왔습니다. 누락된 파일을 확인해 주세요.`
    );
  }
}

/* 메인 화면의 6개 구간 버튼 */
function renderRangeButtons() {
  const grid = $("rangeGrid");
  if (!grid) return;

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
    list.innerHTML = "<p>이 구간에 표시할 동화가 없어요.</p>";
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

/* 뒤로 가기 */
function goBack() {
  if (currentScreen === "study") {
    $("storyAudio")?.pause();
    showScreen("list");
    renderStoryList();
  } else if (currentScreen === "list") {
    showScreen("home");
  }
}

/* 홈으로 가기 */
function goHome() {
  $("storyAudio")?.pause();
  showScreen("home");
}

/* 동화 학습 화면 열기 */
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
    audio.src = `audio/s ${pad(number)}.mp3`;
    audio.playbackRate = 1;
    audio.load();
  }

  document.querySelectorAll(".speed-button").forEach((button) => {
    button.classList.toggle(
      "active",
      Number(button.dataset.speed) === 1
    );
  });

  setAudioStatus("음성을 준비하고 있어요.");
  updateAudioTime();
  renderStoryList();
  showScreen("study");
}

/* 동화 본문 */
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

/* 완료 체크 표시 */
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

/* 완료 저장 버튼 */
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

/* 진도 표시 */
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
        "아직 공부를 시작하지 않았어요. 첫 동화부터 시작해 봐요!";
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

function setAudioStatus(message) {
  const status = $("audioStatus");
  if (status) status.textContent = message;
}

/* 재생 시간과 이동 막대 갱신 */
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

/* 배속 변경 */
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

/* 오디오 이벤트 연결 */
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
    setAudioStatus("🎧 동화를 듣고 있어요.");
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

/* 전체 버튼 이벤트 */
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

/* 시작 */
document.addEventListener("DOMContentLoaded", async () => {
  setupEvents();
  setupAudio();
  showScreen("home");

  try {
    await loadAllStories();
  } catch (error) {
    console.error("동화 초기화 오류:", error);

    const list = $("storyList");
    if (list) {
      list.innerHTML =
        "<p>동화 목록을 불러오지 못했어요. 파일 경로를 확인해 주세요.</p>";
    }
  }
});
