const ranges = [
  { label: "1 - 10편", start: 1, end: 10, emoji: "🐰" },
  { label: "11 - 20편", start: 11, end: 20, emoji: "🐻" },
  { label: "21 - 30편", start: 21, end: 30, emoji: "🐣" },
  { label: "31 - 40편", start: 31, end: 40, emoji: "🦊" },
  { label: "41 - 50편", start: 41, end: 50, emoji: "🐼" },
  { label: "51 - 64편", start: 51, end: 64, emoji: "🐸" }
];

// w 01.txt를 data/w-01.txt 이름으로 업로드하면 자동으로 읽어옵니다.
// 원본 파일 형식: "1번", "제목: I See 나는 봐요", 영어 문장, 해석 문장 순서
const stories = {
  1: {
    title: "I See",
    audio: "audio/s-01.mp3",
    lines: [
      { en: "I see a rock.", ko: "나는 바위를 봐요." },
      { en: "I see an ant.", ko: "나는 개미를 봐요." },
      { en: "I see a flower.", ko: "나는 꽃을 봐요." },
      { en: "I see a butterfly.", ko: "나는 나비를 봐요." },
      { en: "I see a bee.", ko: "나는 벌을 봐요." },
      { en: "I see a tree.", ko: "나는 나무를 봐요." },
      { en: "I see a cat.", ko: "나는 고양이를 봐요." },
      { en: "Oh, run!", ko: "앗, 뛰어!" }
    ]
  }
};

const STORAGE_KEY = "littlefoxCompleted";
function loadCompleted() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}
let completed = loadCompleted();
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
const doneCheckbox = document.getElementById("doneCheckbox");
const doneLabel = document.getElementById("doneLabel");
const saveButton = document.getElementById("saveButton");
const saveMessage = document.getElementById("saveMessage");
let currentRange = ranges[0];
let currentEpisode = 1;
let currentMode = "both";
let textFileLoaded = false;

function showScreen(screen) {
  [homeScreen, listScreen, studyScreen].forEach(s => s.classList.add("hidden"));
  screen.classList.remove("hidden");
  backButton.classList.toggle("hidden", screen === homeScreen);
  closeButton.classList.toggle("hidden", screen === homeScreen);
}
function renderRanges() {
  rangeGrid.innerHTML = "";
  ranges.forEach(range => {
    const button = document.createElement("button");
    button.className = "range-button";
    button.textContent = range.label;
    button.dataset.emoji = range.emoji;
    button.addEventListener("click", () => openRange(range));
    rangeGrid.appendChild(button);
  });
}
function openRange(range) {
  currentRange = range;
  pageTitle.textContent = range.label;
  listDescription.textContent = `${range.start}편부터 ${range.end}편까지 골라 보세요.`;
  storyList.innerHTML = "";
  for (let n = range.start; n <= range.end; n++) {
    const story = stories[n];
    const row = document.createElement("button");
    row.className = "story-row";
    const isDone = completed.has(n);
    row.innerHTML = `
      <span class="story-number">${n}</span>
      <span class="story-meta">
        <span class="story-name">${escapeHtml(story ? story.title : `${n}편`)}</span>
        <span class="story-subtitle">${story ? "영어 동화 · 눌러서 공부하기" : "동화 데이터 추가 예정"}</span>
      </span>
      <span class="done-mark" aria-label="${isDone ? "공부 완료" : "미완료"}">${isDone ? "✓" : "○"}</span>`;
    row.addEventListener("click", () => {
      if (stories[n]) openStory(n);
      else alert(`${n}편은 아직 데이터가 없어요. 해당 편의 텍스트 파일과 음성 파일을 추가하면 됩니다.`);
    });
    storyList.appendChild(row);
  }
  showScreen(listScreen);
}
async function loadStoryTextFile(n) {
  // 1편은 data/w-01.txt 파일에서 실제 내용을 읽어옵니다.
  // GitHub Pages는 파일 경로/대소문자를 구분하므로 이름을 정확히 맞춰 주세요.
  if (n !== 1) return;
  try {
    const response = await fetch("data/w-01.txt", { cache: "no-store" });
    if (!response.ok) throw new Error("텍스트 파일을 찾을 수 없습니다.");
    const raw = await response.text();
    const parsed = parseStoryText(raw);
    if (parsed.lines.length) {
      stories[1].lines = parsed.lines;
      if (parsed.title) stories[1].title = parsed.title;
      textFileLoaded = true;
    }
  } catch (error) {
    // 텍스트 파일을 아직 올리지 않았으면 코드 안의 시범 문장으로 표시합니다.
    console.warn("data/w-01.txt를 읽지 못해 시범 데이터를 표시합니다.", error);
  }
}
function parseStoryText(raw) {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let title = "";
  const body = [];
  for (const line of lines) {
    if (/^\d+\s*번$/.test(line)) continue;
    if (line.startsWith("제목:")) {
      const titleLine = line.replace(/^제목:\s*/, "").trim();
      // "제목: I See 나는 봐요"처럼 제목 옆에 번역이 붙어 있으면 영문 제목만 추출합니다.
      const hangulIndex = titleLine.search(/[가-힣]/);
      title = (hangulIndex >= 0 ? titleLine.slice(0, hangulIndex) : titleLine).trim();
      continue;
    }
    if (/^\d+편$/.test(line)) continue;
    body.push(line);
  }

  const parsedLines = [];
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    // 영어 문장 다음 줄을 한국어 해석으로 짝지어 읽습니다.
    if (/[A-Za-z]/.test(line)) {
      const next = body[i + 1] || "";
      if (/[가-힣]/.test(next)) {
        parsedLines.push({ en: line, ko: next });
        i++;
      } else {
        parsedLines.push({ en: line, ko: "" });
      }
    } else if (/[가-힣]/.test(line) && parsedLines.length) {
      // 영어/해석 줄 사이에 예상치 못한 줄이 있는 경우 직전 문장의 해석으로 보완
      const last = parsedLines[parsedLines.length - 1];
      if (!last.ko) last.ko = line;
    }
  }
  return { title, lines: parsedLines };
}
async function openStory(n) {
  currentEpisode = n;
  if (n === 1) await loadStoryTextFile(n);
  const story = stories[n];
  pageTitle.textContent = `${n}편`;
  document.getElementById("studyEpisode").textContent = `${n}편`;
  document.getElementById("studyTitle").textContent = story.title;
  storyAudio.pause();
  storyAudio.src = story.audio;
  doneCheckbox.checked = completed.has(n);
  updateDoneLabel();
  saveMessage.textContent = "체크를 변경한 뒤 저장하기를 눌러 주세요.";
  currentMode = "both";
  renderLines();
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
    button.classList.toggle("active", button.dataset.mode === currentMode);
  });
}
function updateDoneLabel() {
  doneLabel.textContent = doneCheckbox.checked ? "공부 완료 ✓" : "완료 전";
}
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    renderLines();
  });
});
doneCheckbox.addEventListener("change", () => {
  updateDoneLabel();
  saveMessage.textContent = "아직 저장되지 않았어요. 저장하기를 눌러 주세요.";
});
saveButton.addEventListener("click", () => {
  if (doneCheckbox.checked) completed.add(currentEpisode);
  else completed.delete(currentEpisode);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  saveMessage.textContent = doneCheckbox.checked ? "저장했어요! 참 잘했어요 🌷" : "완료 체크를 해제하고 저장했어요.";
});
audioButton.addEventListener("click", async () => {
  try {
    if (storyAudio.paused) await storyAudio.play();
    else storyAudio.pause();
  } catch (error) {
    alert("음성을 재생할 수 없어요. audio 폴더에 s-01.mp3 파일이 있는지, 파일명이 맞는지 확인해 주세요.");
  }
});
backButton.addEventListener("click", () => {
  storyAudio.pause();
  if (!studyScreen.classList.contains("hidden")) openRange(currentRange);
  else {
    pageTitle.textContent = "리틀팍스 동화 1편";
    showScreen(homeScreen);
  }
});
closeButton.addEventListener("click", () => {
  storyAudio.pause();
  pageTitle.textContent = "리틀팍스 동화 1편";
  showScreen(homeScreen);
});
renderRanges();
showScreen(homeScreen);
