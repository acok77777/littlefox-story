
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

const $ = id => document.getElementById(id);

const homeScreen = $("homeScreen");
const listScreen = $("listScreen");
const studyScreen = $("studyScreen");
const pageTitle = $("pageTitle");
const backButton = $("backButton");
const closeButton = $("closeButton");
const rangeGrid = $("rangeGrid");
const storyList = $("storyList");
const listDescription = $("listDescription");
const storyContent = $("storyContent");
const storyAudio = $("storyAudio");
const playButton = $("playButton");
const audioStatus = $("audioStatus");
const seekBar = $("seekBar");
const currentTimeLabel = $("currentTime");
const durationLabel = $("duration");
const doneCheckbox = $("doneCheckbox");
const doneLabel = $("doneLabel");
const saveButton = $("saveButton");
const saveMessage = $("saveMessage");

let currentRange = ranges[0];
let currentEpisode = 1;
let currentMode = "both";
let currentSpeed = 1;

// 불러온 대본은 메모리에 보관해 반복 요청을 줄입니다.
const storyCache = new Map();
let completed = loadCompleted();

function loadCompleted() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(
      saved.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL_EPISODES)
    );
  } catch {
    return new Set();
  }
}

function saveCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
    return true;
  } catch {
    alert("저장 공간을 사용할 수 없어요. 브라우저 설정을 확인해 주세요.");
    return false;
  }
}

function padEpisode(n) {
  return String(n).padStart(2, "0");
}

function textPath(n) {
  return `data/w%20${padEpisode(n)}.txt`;
}

function audioPath(n) {
  return `audio/s%20${padEpisode(n)}.mp3`;
}

function showScreen(screen) {
  [homeScreen, listScreen, studyScreen].forEach(s => {
    s.classList.add("hidden");
  });

  screen.classList.remove("hidden");
  backButton.classList.toggle("hidden", screen === homeScreen);
  closeButton.classList.toggle("hidden", screen === homeScreen);
  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderProgress() {
  const count = completed.size;
  const percent = Math.round(count / TOTAL_EPISODES * 100);

  $("progressCount").textContent = `${count} / ${TOTAL_EPISODES}편`;
  $("progressBar").style.width = `${percent}%`;
  $("progressText").textContent =
    count === TOTAL_EPISODES
      ? "축하해요! 64편을 모두 공부했어요! 🎉"
      : count === 0
        ? "아직 공부를 시작하지 않았어요. 첫 동화부터 시작해 봐요!"
        : `전체의 ${percent}%를 공부했어요. 조금씩 계속해 봐요! 🌷`;
}

function renderRanges() {
  rangeGrid.innerHTML = "";

  ranges.forEach(range => {
    const button = document.createElement("button");
    button.className = "range-button";
    button.dataset.emoji = range.emoji;
    button.textContent = range.label;
    button.addEventListener("click", () => openRange(range));
    rangeGrid.appendChild(button);
  });
}

// 대본 형식:
// 1번
// 제목: I See 나는 봐요
//
// I see a rock.
// 나는 바위를 봐요.
function parseStoryText(raw, n) {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  let titleEn = "";
  let titleKo = "";
  const body = [];

  for (const line of lines) {
    if (/^\d+\s*번$/.test(line)) continue;
    if (/^\d+\s*편$/.test(line)) continue;

    if (line.startsWith("제목:")) {
      const titleLine = line.replace(/^제목:\s*/, "").trim();
      const hangulIndex = titleLine.search(/[가-힣]/);

      if (hangulIndex >= 0) {
        titleEn = titleLine.slice(0, hangulIndex)
          .replace(/[\s(\[（]+$/, "").trim();
        titleKo = titleLine.slice(hangulIndex)
          .replace(/^[\s)\]）]+/, "").trim();
      } else {
        titleEn = titleLine;
      }
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
        parsedLines.push({ en: line, ko: next });
        i++;
      } else {
        parsedLines.push({ en: line, ko: "" });
      }
    } else if (/[가-힣]/.test(line) && parsedLines.length) {
      const last = parsedLines[parsedLines.length - 1];
      if (!last.ko) last.ko = line;
    }
  }

  if (!titleEn && parsedLines.length) {
    titleEn = `Episode ${n}`;
  }

  return {
    episode: n,
    titleEn,
    titleKo,
    audio: audioPath(n),
    lines: parsedLines
  };
}

async function loadStory(n, force = false) {
  if (!force && storyCache.has(n)) {
    return storyCache.get(n);
  }

  const response = await fetch(textPath(n), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `${n}편 대본 파일을 찾을 수 없습니다. 파일명과 data 폴더를 확인해 주세요.`
    );
  }

  const raw = await response.text();
  const story = parseStoryText(raw, n);

  if (!story.lines.length) {
    throw new Error(`${n}편 대본에서 영어 문장을 찾지 못했습니다.`);
  }

  storyCache.set(n, story);
  return story;
}

function openRange(range) {
  currentRange = range;
  pageTitle.textContent = range.label;
  listDescription.textContent =
    `${range.start}편부터 ${range.end}편까지 골라 보세요.`;

  storyList.innerHTML = "";

  for (let n = range.start; n <= range.end; n++) {
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
    name.textContent = `${n}편`;

    const subtitle = document.createElement("span");
    subtitle.className = "story-subtitle";
    subtitle.textContent = "대본 불러오는 중…";

    meta.append(name, subtitle);

    const mark = document.createElement("span");
    mark.className = "done-mark";
    mark.textContent = completed.has(n) ? "✓" : "○";

    row.append(number, meta, mark);

    row.addEventListener("click", () => openStory(n));

    storyList.appendChild(row);

    // 목록에 표시할 제목을 각 대본 파일에서 가져옵니다.
    loadStory(n).then(story => {
      name.textContent = story.titleEn || `${n}편`;
      subtitle.textContent = story.titleKo
        ? `${story.titleKo} · 영어 동화`
        : "영어 동화 · 눌러서 공부하기";
    }).catch(() => {
      name.textContent = `${n}편`;
      subtitle.textContent = "파일을 추가하면 공부할 수 있어요";
    });
  }

  showScreen(listScreen);
}

async function openStory(n) {
  pauseAudio();
  currentEpisode = n;

  pageTitle.textContent = `${n}편`;
  $("studyEpisode").textContent = `${n}편`;
  $("studyTitle").textContent = "불러오는 중…";
  $("studyTitleKo").textContent = "";
  storyContent.innerHTML = "<p>대본을 불러오고 있어요…</p>";
  doneCheckbox.checked = completed.has(n);
  updateDoneLabel();
  saveMessage.textContent = "";
  currentMode = "both";

  storyAudio.removeAttribute("src");
  storyAudio.load();
  playButton.textContent = "▶ 재생";
  audioStatus.textContent = "음성을 준비하고 있어요.";
  seekBar.value = 0;
  currentTimeLabel.textContent = "0:00";
  durationLabel.textContent = "0:00";

  showScreen(studyScreen);

  try {
    const story = await loadStory(n);

    // 다른 편을 빠르게 눌렀을 때 이전 요청이 화면을 덮지 않게 합니다.
    if (currentEpisode !== n) return;

    $("studyTitle").textContent = story.titleEn || `${n}편`;
    $("studyTitleKo").textContent = story.titleKo || "해석 제목 없음";

    renderLines(story);

    storyAudio.src = story.audio;
    storyAudio.load();
    audioStatus.textContent = "재생 버튼을 눌러 주세요.";
  } catch (error) {
    if (currentEpisode !== n) return;

    storyContent.innerHTML = "";
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = error.message;
    storyContent.appendChild(message);

    $("studyTitle").textContent = `${n}편`;
    $("studyTitleKo").textContent = "";
    audioStatus.textContent = "대본 파일을 확인해 주세요.";
  }
}

function renderLines(story) {
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

function updateDoneLabel() {
  doneLabel.textContent = doneCheckbox.checked ? "공부 완료 ✓" : "완료 전";
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function pauseAudio() {
  storyAudio.pause();
  playButton.textContent = "▶ 재생";
}

async function toggleAudio() {
  if (!storyAudio.getAttribute("src")) {
    audioStatus.textContent = "먼저 대본과 음성 파일을 확인해 주세요.";
    return;
  }

  if (!storyAudio.paused) {
    pauseAudio();
    audioStatus.textContent = "일시정지했어요.";
    return;
  }

  try {
    await storyAudio.play();
  } catch {
    audioStatus.textContent = "재생할 수 없어요. MP3 파일 경로를 확인해 주세요.";
  }
}

function skipAudio(seconds) {
  if (!Number.isFinite(storyAudio.duration)) return;

  storyAudio.currentTime = Math.max(
    0,
    Math.min(storyAudio.duration, storyAudio.currentTime + seconds)
  );
}

function setSpeed(speed) {
  currentSpeed = Number(speed);
  storyAudio.playbackRate = currentSpeed;

  document.querySelectorAll(".speed-button").forEach(button => {
    button.classList.toggle(
      "active",
      Number(button.dataset.speed) === currentSpeed
    );
  });
}

document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    const story = storyCache.get(currentEpisode);
    if (story) renderLines(story);
  });
});

document.querySelectorAll(".speed-button").forEach(button => {
  button.addEventListener("click", () => {
    setSpeed(button.dataset.speed);
  });
});

playButton.addEventListener("click", toggleAudio);
$("back10Button").addEventListener("click", () => skipAudio(-10));
$("forward10Button").addEventListener("click", () => skipAudio(10));

seekBar.addEventListener("input", () => {
  if (Number.isFinite(storyAudio.duration)) {
    storyAudio.currentTime =
      Number(seekBar.value) / 100 * storyAudio.duration;
  }
});

storyAudio.addEventListener("loadedmetadata", () => {
  durationLabel.textContent = formatTime(storyAudio.duration);
  audioStatus.textContent = "재생 준비 완료!";
});

storyAudio.addEventListener("timeupdate", () => {
  if (!Number.isFinite(storyAudio.duration) || storyAudio.duration <= 0) {
    return;
  }

  seekBar.value = storyAudio.currentTime / storyAudio.duration * 100;
  currentTimeLabel.textContent = formatTime(storyAudio.currentTime);
  durationLabel.textContent = formatTime(storyAudio.duration);
});

storyAudio.addEventListener("play", () => {
  playButton.textContent = "⏸ 일시정지";
  audioStatus.textContent = `${currentSpeed}배속 재생 중`;
});

storyAudio.addEventListener("pause", () => {
  playButton.textContent = "▶ 재생";
});

storyAudio.addEventListener("ended", () => {
  playButton.textContent = "▶ 다시 듣기";
  audioStatus.textContent = "음성 재생이 끝났어요.";
  seekBar.value = 100;
});

storyAudio.addEventListener("error", () => {
  audioStatus.textContent = "음성 파일을 찾을 수 없어요. 파일명과 경로를 확인해 주세요.";
});

doneCheckbox.addEventListener("change", () => {
  updateDoneLabel();
  saveMessage.textContent = "아직 저장되지 않았어요. 저장하기를 눌러 주세요.";
});

saveButton.addEventListener("click", () => {
  if (doneCheckbox.checked) {
    completed.add(currentEpisode);
  } else {
    completed.delete(currentEpisode);
  }

  if (saveCompleted()) {
    renderProgress();
    saveMessage.textContent = doneCheckbox.checked
      ? "저장했어요! 참 잘했어요 🌷"
      : "완료 체크를 해제하고 저장했어요.";

    // 목록이 열릴 때 저장된 체크가 반영됩니다.
  }
});

backButton.addEventListener("click", () => {
  pauseAudio();

  if (!studyScreen.classList.contains("hidden")) {
    openRange(currentRange);
  } else {
    pageTitle.textContent = "영어 동화 공부방";
    showScreen(homeScreen);
  }
});

closeButton.addEventListener("click", () => {
  pauseAudio();
  pageTitle.textContent = "영어 동화 공부방";
  showScreen(homeScreen);
});

renderRanges();
renderProgress();
showScreen(homeScreen);
