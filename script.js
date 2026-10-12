
"use strict";

/* ========================================
   1. 기본 설정
======================================== */

const TOTAL_EPISODES = 64;
const STORAGE_KEY = "littlefoxCompleted";

const ranges = [
  { label: "1 - 10편", start: 1, end: 10, emoji: "🐰" },
  { label: "11 - 20편", start: 11, end: 20, emoji: "🐻" },
  { label: "21 - 30편", start: 21, end: 30, emoji: "🐣" },
  { label: "31 - 40편", start: 31, end: 40, emoji: "🦊" },
  { label: "41 - 50편", start: 41, end: 50, emoji: "🐼" },
  { label: "51 - 64편", start: 51, end: 64, emoji: "🐸" }
];

/*
  실제 파일 경로:
  데이터/story-01.json
  데이터/W 01.txt
  오디오/s 01.mp3

  GitHub 파일명과 폴더명은 대소문자 및 공백까지 일치해야 합니다.
*/

const stories = {
  1: {
    title: "I See",
    audio: "오디오/s%2001.mp3",
    json: "데이터/story-01.json",
    text: "데이터/W%2001.txt",
    lines: [
      { en: "I see a rock.", ko: "나는 바위를 봐요." },
      { en: "I see an ant.", ko: "나는 개미를 봐요." }
    ]
  }
};

let completed = loadCompleted();
let currentRange = ranges[0];
let currentEpisode = 1;
let currentMode = "both";
let currentSpeed = 1;
let isSeeking = false;

/* ========================================
   2. HTML 요소
======================================== */

const homeScreen = document.getElementById("homeScreen");
const listScreen = document.getElementById("listScreen");
const studyScreen = document.getElementById("studyScreen");

const pageTitle = document.getElementById("pageTitle");
const backButton = document.getElementById("backButton");
const closeButton = document.getElementById("closeButton");

const rangeGrid = document.getElementById("rangeGrid");
const storyList = document.getElementById("storyList");
const listDescription = document.getElementById("listDescription");

const storyContent = document.getElementById("storyContent");
const storyAudio = document.getElementById("storyAudio");

const audioButton = document.getElementById("audioButton");
const audioButtonIcon = document.getElementById("audioButtonIcon");
const audioButtonText = document.getElementById("audioButtonText");
const audioSeek = document.getElementById("audioSeek");
const currentTimeDisplay = document.getElementById("currentTime");
const durationDisplay = document.getElementById("duration");
const rewindButton = document.getElementById("rewindButton");
const forwardButton = document.getElementById("forwardButton");
const audioMessage = document.getElementById("audioMessage");

const doneCheckbox = document.getElementById("doneCheckbox");
const doneLabel = document.getElementById("doneLabel");
const saveButton = document.getElementById("saveButton");
const saveMessage = document.getElementById("saveMessage");

/* ========================================
   3. 완료 기록 불러오기
======================================== */

function loadCompleted() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return new Set();

    return new Set(
      saved
        .map(Number)
        .filter(n =>
          Number.isInteger(n) &&
          n >= 1 &&
          n <= TOTAL_EPISODES
        )
    );
  } catch (error) {
    console.warn("완료 기록을 불러오지 못했습니다.", error);
    return new Set();
  }
}

function saveCompleted() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...completed])
    );
    return true;
  } catch (error) {
    console.error("완료 기록 저장 실패:", error);
    return false;
  }
}

/* ========================================
   4. 전체 학습 진도
======================================== */

function updateProgress() {
  const count = completed.size;
  const percent = Math.round(
    (count / TOTAL_EPISODES) * 100
  );

  document.getElementById("completedCount").textContent = count;
  document.getElementById("progressPercent").textContent =
    `${percent}%`;

  document.getElementById("progressFill").style.width =
    `${percent}%`;

  document.getElementById("progressBar").setAttribute(
    "aria-valuenow",
    String(count)
  );

  const message = document.getElementById("progressMessage");

  if (count >= TOTAL_EPISODES) {
    message.textContent =
      "와! 64편을 모두 공부했어요! 정말 대단해요! 🎉";
  } else if (count === 0) {
    message.textContent =
      "첫 번째 동화부터 시작해 봐요! 🐰";
  } else {
    message.textContent =
      `지금까지 ${count}편을 공부했어요. ` +
      `다음 목표까지 ${TOTAL_EPISODES - count}편 남았어요! 🌷`;
  }
}

/* ========================================
   5. 화면 전환
======================================== */

function showScreen(screen) {
  [homeScreen, listScreen, studyScreen].forEach(item => {
    item.classList.add("hidden");
  });

  screen.classList.remove("hidden");

  backButton.classList.toggle("hidden", screen === homeScreen);
  closeButton.classList.toggle("hidden", screen === homeScreen);
}

function stopAudio() {
  storyAudio.pause();
  storyAudio.currentTime = 0;
  updateAudioDisplay();
}

function goHome() {
  stopAudio();
  pageTitle.textContent = "리틀팍스 영어 동화";
  showScreen(homeScreen);
}

/* ========================================
   6. 메인 화면 편수 범위
======================================== */

function renderRanges() {
  rangeGrid.innerHTML = "";

  ranges.forEach(range => {
    const button = document.createElement("button");
    button.className = "range-button";
    button.textContent = range.label;
    button.dataset.emoji = range.emoji;
    button.type = "button";

    button.addEventListener("click", () => {
      openRange(range);
    });

    rangeGrid.appendChild(button);
  });
}

/* ========================================
   7. 동화 목록
======================================== */

function openRange(range) {
  currentRange = range;
  pageTitle.textContent = range.label;

  listDescription.textContent =
    `${range.start}편부터 ${range.end}편까지 골라 보세요.`;

  storyList.innerHTML = "";

  for (let n = range.start; n <= range.end; n++) {
    const story = stories[n];
    const isDone = completed.has(n);

    const row = document.createElement("button");
    row.className = "story-row";
    row.type = "button";

    const number = document.createElement("span");
    number.className = "story-number";
    number.textContent = n;

    const meta = document.createElement("span");
    meta.className = "story-meta";

    const name = document.createElement("span");
    name.className = "story-name";
    name.textContent = story ? story.title : `${n}편`;

    const subtitle = document.createElement("span");
    subtitle.className = "story-subtitle";
    subtitle.textContent = story
      ? "영어 동화 · 눌러서 공부하기"
      : "동화 데이터 추가 예정";

    meta.append(name, subtitle);

    const mark = document.createElement("span");
    mark.className = "done-mark";
    mark.textContent = isDone ? "✓" : "○";
    mark.setAttribute(
      "aria-label",
      isDone ? "공부 완료" : "미완료"
    );

    row.append(number, meta, mark);

    row.addEventListener("click", () => {
      if (stories[n]) {
        openStory(n);
      } else {
        alert(
          `${n}편은 아직 데이터가 등록되지 않았어요.\n` +
          "해당 편의 JSON 또는 텍스트 파일과 음성 파일을 추가해야 합니다."
        );
      }
    });

    storyList.appendChild(row);
  }

  showScreen(listScreen);
}

/* ========================================
   8. 동화 데이터 불러오기
======================================== */

async function fetchTextFile(path) {
  const response = await fetch(path, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`파일을 불러오지 못했습니다: ${path}`);
  }

  return response.text();
}

async function loadStoryData(n) {
  const story = stories[n];
  if (!story) return;

  // JSON 데이터 먼저 불러오기
  try {
    const response = await fetch(story.json, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("JSON 파일을 찾을 수 없습니다.");
    }

    const data = await response.json();

    if (data.title) story.title = data.title;
    if (Array.isArray(data.lines) && data.lines.length) {
      story.lines = data.lines;
    }

    if (data.audio) {
      story.audio = data.audio;
    }
  } catch (error) {
    console.warn("JSON 파일을 불러오지 못했습니다.", error);
  }

  // TXT가 있으면 영어와 해석 문장으로 갱신
  try {
    const raw = await fetchTextFile(story.text);
    const parsed = parseStoryText(raw);

    if (parsed.title) story.title = parsed.title;
    if (parsed.lines.length) story.lines = parsed.lines;
  } catch (error) {
    console.warn(
      "TXT 파일을 불러오지 못해 현재 저장된 문장을 사용합니다.",
      error
    );
  }
}

function parseStoryText(raw) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  let title = "";
  const body = [];

  for (const line of lines) {
    if (/^\d+\s*번$/.test(line)) continue;
    if (/^\d+\s*편$/.test(line)) continue;

    if (line.startsWith("제목:")) {
      const titleLine = line.replace(/^제목:\s*/, "").trim();
      const hangulIndex = titleLine.search(/[가-힣]/);

      title = (
        hangulIndex >= 0
          ? titleLine.slice(0, hangulIndex)
          : titleLine
      ).trim();

      continue;
    }

    body.push(line);
  }

  const parsedLines = [];

  for (let i = 0; i < body.length; i++) {
    const line = body[i];

    if (/[A-Za-z]/.test(line)) {
      const next = body[i + 1] || "";

      if (/[가-힣]/.test(next)) {
        parsedLines.push({
          en: line,
          ko: next
        });
        i++;
      } else {
        parsedLines.push({
          en: line,
          ko: ""
        });
      }
    } else if (/[가-힣]/.test(line) && parsedLines.length) {
      const last = parsedLines[parsedLines.length - 1];
      if (!last.ko) last.ko = line;
    }
  }

  return { title, lines: parsedLines };
}

/* ========================================
   9. 동화 공부 화면
======================================== */

async function openStory(n) {
  const story = stories[n];
  if (!story) return;

  currentEpisode = n;
  currentMode = "both";

  stopAudio();
  audioMessage.textContent = "동화 내용을 불러오고 있어요.";

  await loadStoryData(n);

  pageTitle.textContent = `${n}편`;
  document.getElementById("studyEpisode").textContent = `${n}편`;
  document.getElementById("studyTitle").textContent = story.title;

  storyAudio.pause();
  storyAudio.src = story.audio;
  storyAudio.playbackRate = currentSpeed;
  storyAudio.load();

  doneCheckbox.checked = completed.has(n);
  updateDoneLabel();

  saveMessage.textContent =
    "체크를 변경한 뒤 저장하기를 눌러 주세요.";

  renderLines();
  updateAudioDisplay();

  audioMessage.textContent =
    "원하는 위치로 막대를 움직여 보세요.";

  showScreen(studyScreen);
}

function renderLines() {
  const story = stories[currentEpisode];
  storyContent.innerHTML = "";

  story.lines.forEach(line => {
    const item = document.createElement("div");
    item.className = "sentence";

    if (currentMode !== "korean" && line.en) {
      const en = document.createElement("p");
      en.className = "english";
      en.textContent = line.en;
      item.appendChild(en);
    }

    if (currentMode !== "english" && line.ko) {
      const ko = document.createElement("p");
      ko.className = "korean";
      ko.textContent = line.ko;
      item.appendChild(ko);
    }

    storyContent.appendChild(item);
  });

  document.querySelectorAll(".mode-button").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.mode === currentMode
    );
  });
}

/* ========================================
   10. 영어/해석 표시 버튼
======================================== */

document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    renderLines();
  });
});

/* ========================================
   11. 오디오 플레이어
======================================== */

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function updateAudioDisplay() {
  const duration = storyAudio.duration;
  const current = storyAudio.currentTime;

  currentTimeDisplay.textContent = formatTime(current);

  durationDisplay.textContent = Number.isFinite(duration)
    ? formatTime(duration)
    : "0:00";

  if (!isSeeking) {
    audioSeek.value =
      Number.isFinite(duration) && duration > 0
        ? (current / duration) * 100
        : 0;
  }

  if (storyAudio.ended) {
    audioButtonIcon.textContent = "🔁";
    audioButtonText.textContent = "다시 듣기";
  } else if (storyAudio.paused) {
    audioButtonIcon.textContent = "▶️";
    audioButtonText.textContent = "영어 듣기";
  } else {
    audioButtonIcon.textContent = "⏸️";
    audioButtonText.textContent = "일시정지";
  }
}

storyAudio.addEventListener("loadedmetadata", updateAudioDisplay);
storyAudio.addEventListener("durationchange", updateAudioDisplay);
storyAudio.addEventListener("timeupdate", updateAudioDisplay);
storyAudio.addEventListener("play", updateAudioDisplay);
storyAudio.addEventListener("pause", updateAudioDisplay);
storyAudio.addEventListener("ended", updateAudioDisplay);

storyAudio.addEventListener("error", () => {
  audioMessage.textContent =
    "음성을 불러오지 못했어요. 오디오 폴더와 파일명을 확인해 주세요.";
});

audioButton.addEventListener("click", async () => {
  if (!storyAudio.src) {
    audioMessage.textContent = "재생할 음성 파일이 없습니다.";
    return;
  }

  try {
    if (storyAudio.paused) {
      if (storyAudio.ended) storyAudio.currentTime = 0;

      await storyAudio.play();
      audioMessage.textContent =
        `${currentSpeed}배속으로 영어 음성을 재생합니다. 🔊`;
    } else {
      storyAudio.pause();
      audioMessage.textContent = "일시정지했어요.";
    }
  } catch (error) {
    console.error("오디오 재생 오류:", error);
    audioMessage.textContent =
      "음성 재생에 실패했어요. 실제 파일 경로를 확인해 주세요.";
  }
});

// 재생 막대 드래그
audioSeek.addEventListener("input", () => {
  isSeeking = true;

  const duration = storyAudio.duration;

  if (Number.isFinite(duration) && duration > 0) {
    const targetTime =
      duration * Number(audioSeek.value) / 100;

    currentTimeDisplay.textContent = formatTime(targetTime);
  }
});

audioSeek.addEventListener("change", () => {
  const duration = storyAudio.duration;

  if (Number.isFinite(duration) && duration > 0) {
    storyAudio.currentTime =
      duration * Number(audioSeek.value) / 100;
  }

  isSeeking = false;
  updateAudioDisplay();
});

audioSeek.addEventListener("pointerup", () => {
  isSeeking = false;
});

// 10초 뒤로
rewindButton.addEventListener("click", () => {
  if (!Number.isFinite(storyAudio.duration)) return;

  storyAudio.currentTime = Math.max(
    0,
    storyAudio.currentTime - 10
  );

  updateAudioDisplay();
});

// 10초 앞으로
forwardButton.addEventListener("click", () => {
  if (!Number.isFinite(storyAudio.duration)) return;

  storyAudio.currentTime = Math.min(
    storyAudio.duration,
    storyAudio.currentTime + 10
  );

  updateAudioDisplay();
});

// 1배속 / 2배속 / 3배속
document.querySelectorAll(".speed-button").forEach(button => {
  button.addEventListener("click", () => {
    currentSpeed = Number(button.dataset.speed);
    storyAudio.playbackRate = currentSpeed;

    document.querySelectorAll(".speed-button").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    audioMessage.textContent =
      `${currentSpeed}배속으로 재생합니다.`;
  });
});

/* ========================================
   12. 공부 완료 체크 및 저장
======================================== */

function updateDoneLabel() {
  doneLabel.textContent = doneCheckbox.checked
    ? "공부 완료 ✓"
    : "완료 전";
}

doneCheckbox.addEventListener("change", () => {
  updateDoneLabel();

  saveMessage.textContent =
    "아직 저장되지 않았어요. 저장하기를 눌러 주세요.";
});

saveButton.addEventListener("click", () => {
  if (doneCheckbox.checked) {
    completed.add(currentEpisode);
  } else {
    completed.delete(currentEpisode);
  }

  const saved = saveCompleted();

  if (saved) {
    updateProgress();

    saveMessage.textContent = doneCheckbox.checked
      ? "저장했어요! 참 잘했어요 🌷"
      : "완료 체크를 해제하고 저장했어요.";

    // 목록 화면의 완료 표시도 갱신
    if (!listScreen.classList.contains("hidden")) {
      openRange(currentRange);
    }
  } else {
    saveMessage.textContent =
      "저장하지 못했어요. 브라우저 저장 설정을 확인해 주세요.";
  }
});

/* ========================================
   13. 뒤로 가기 및 메인으로
======================================== */

backButton.addEventListener("click", () => {
  stopAudio();

  if (!studyScreen.classList.contains("hidden")) {
    openRange(currentRange);
  } else {
    goHome();
  }
});

closeButton.addEventListener("click", goHome);

/* ========================================
   14. 시작
======================================== */

renderRanges();
updateProgress();
showScreen(homeScreen);
