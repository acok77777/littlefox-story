
const TOTAL_STORIES = 64;
const completedKey = "littlefoxCompleted";

let currentStory = 1;
let storyData = [];
let currentMode = "both";
let currentSpeed = 1;

const $ = (id) => document.getElementById(id);

function pad(num) {
  return String(num).padStart(2, "0");
}

function getCompleted() {
  try {
    return JSON.parse(localStorage.getItem(completedKey) || "[]");
  } catch {
    return [];
  }
}

function saveCompleted(list) {
  localStorage.setItem(completedKey, JSON.stringify(list));
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

function parseStory(text, number) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let titleEn = `Story ${number}`;
  let titleKo = "";
  const content = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;

    const titleMatch = trimmed.match(/^제목\s*:\s*(.+)$/);

    if (titleMatch) {
      const title = titleMatch[1].trim();
      const match = title.match(/^(.+?)\s+([가-힣].*)$/);

      if (match) {
        titleEn = match[1].trim();
        titleKo = match[2].trim();
      } else {
        titleEn = title;
      }

      continue;
    }

    if (/^\d+\s*[.)]?\s*$/.test(trimmed)) continue;
    if (/^\d+\s*[.)]\s*/.test(trimmed)) continue;

    content.push(trimmed);
  }

  if (!titleKo && titleEn.includes(" ")) {
    const match = titleEn.match(/^(.+?)\s+([가-힣].*)$/);

    if (match) {
      titleEn = match[1].trim();
      titleKo = match[2].trim();
    }
  }

  return {
    number,
    titleEn,
    titleKo,
    content
  };
}

async function loadStory(number) {
  const response = await fetch(`data/w ${pad(number)}.txt`);

  if (!response.ok) {
    throw new Error(`data/w ${pad(number)}.txt 파일을 읽을 수 없습니다.`);
  }

  const text = await response.text();
  return parseStory(text, number);
}

async function loadAllStories() {
  const list = $("storyList");
  if (!list) return;

  list.innerHTML = `<p>동화 목록을 불러오는 중이에요... 📚</p>`;

  const results = await Promise.allSettled(
    Array.from({ length: TOTAL_STORIES }, (_, i) => loadStory(i + 1))
  );

  storyData = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  renderStoryList();

  if (storyData.length === 0) {
    list.innerHTML =
      `<p>동화 파일을 불러오지 못했어요. data 폴더와 파일 이름을 확인해 주세요.</p>`;
    return;
  }

  const first = storyData.find((story) => story.number === currentStory)
    || storyData[0];

  await selectStory(first.number);
}

function renderStoryList() {
  const list = $("storyList");
  if (!list) return;

  const completed = getCompleted();

  list.innerHTML = storyData.map((story, index) => {
    const isDone = completed.includes(story.number);
    const colors = ["pink", "blue", "green", "yellow", "purple", "orange"];
    const color = colors[index % colors.length];

    return `
      <button
        type="button"
        class="story-item story-color-${color} ${story.number === currentStory ? "active" : ""}"
        data-story="${story.number}"
        aria-pressed="${story.number === currentStory}"
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
      selectStory(Number(button.dataset.story));
    });
  });

  updateProgress();
}

async function selectStory(number) {
  const story = storyData.find((item) => item.number === number);
  if (!story) return;

  currentStory = number;

  const titleElement = $("storyTitle");
  if (titleElement) {
    titleElement.textContent = `${story.titleEn} ${story.titleKo}`.trim();
  }

  const contentElement = $("storyContent");
  if (contentElement) {
    contentElement.innerHTML = story.content.map((line) => {
      const isKorean = /[가-힣]/.test(line);
      const type = isKorean ? "korean" : "english";

      return `<p class="story-line ${type}">${escapeHTML(line)}</p>`;
    }).join("");
  }

  const audio = $("storyAudio");

  if (audio) {
    audio.pause();
    audio.src = `audio/s ${pad(number)}.mp3`;
    audio.load();
    audio.playbackRate = currentSpeed;
  }

  const checkbox = $("doneCheckbox");
  if (checkbox) {
    checkbox.checked = getCompleted().includes(number);
  }

  renderStoryList();
  applyLanguageMode();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyLanguageMode() {
  const content = $("storyContent");
  if (!content) return;

  content.querySelectorAll(".story-line").forEach((line) => {
    if (currentMode === "both") {
      line.style.display = "";
    } else if (currentMode === "english") {
      line.style.display = line.classList.contains("english") ? "" : "none";
    } else if (currentMode === "korean") {
      line.style.display = line.classList.contains("korean") ? "" : "none";
    }
  });

  const modeButton = $("mode-button");
  if (modeButton) {
    modeButton.textContent =
      currentMode === "both" ? "영어 + 해석" :
      currentMode === "english" ? "영어만" : "해석만";
  }
}

function updateProgress() {
  const completed = getCompleted();
  const count = completed.length;
  const progress = $("progressText");

  if (progress) {
    progress.textContent = `${count} / ${TOTAL_STORIES}편 완료`;
  }

  const bar = $("progressBar");
  if (bar) {
    bar.max = TOTAL_STORIES;
    bar.value = count;
  }
}

function setupCompletion() {
  const checkbox = $("doneCheckbox");
  if (!checkbox) return;

  checkbox.addEventListener("change", () => {
    let completed = getCompleted();

    if (checkbox.checked) {
      if (!completed.includes(currentStory)) {
        completed.push(currentStory);
      }
    } else {
      completed = completed.filter((number) => number !== currentStory);
    }

    saveCompleted(completed);
    renderStoryList();
    checkbox.checked = completed.includes(currentStory);
  });

  const saveButton = $("saveButton");
  if (saveButton) {
    saveButton.addEventListener("click", () => {
      const completed = getCompleted();

      if (!completed.includes(currentStory)) {
        completed.push(currentStory);
        saveCompleted(completed);
      }

      checkbox.checked = true;
      renderStoryList();
    });
  }
}

function setupAudio() {
  const audio = $("storyAudio");
  if (!audio) return;

  const playButton = $("playButton");
  if (playButton) {
    playButton.addEventListener("click", async () => {
      try {
        if (audio.paused) {
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (error) {
        alert("오디오 파일을 재생할 수 없어요. audio 폴더의 파일 이름을 확인해 주세요.");
      }
    });
  }

  audio.addEventListener("play", () => {
    if (playButton) playButton.textContent = "⏸️ 일시정지";
  });

  audio.addEventListener("pause", () => {
    if (playButton) playButton.textContent = "▶️ 재생";
  });

  const seekBar = $("seekBar");
  if (seekBar) {
    audio.addEventListener("loadedmetadata", () => {
      seekBar.max = audio.duration || 0;
      seekBar.value = 0;
    });

    audio.addEventListener("timeupdate", () => {
      seekBar.max = audio.duration || 0;
      seekBar.value = audio.currentTime || 0;
    });

    seekBar.addEventListener("input", () => {
      audio.currentTime = Number(seekBar.value);
    });
  }

  const speedButton = $("speed-button");
  if (speedButton) {
    speedButton.addEventListener("click", () => {
      const speeds = [0.75, 1, 1.25, 1.5];
      const index = speeds.indexOf(currentSpeed);
      currentSpeed = speeds[(index + 1) % speeds.length];

      audio.playbackRate = currentSpeed;
      speedButton.textContent = `${currentSpeed}배속`;
    });
  }

  const modeButton = $("mode-button");
  if (modeButton) {
    modeButton.addEventListener("click", () => {
      const modes = ["both", "english", "korean"];
      const index = modes.indexOf(currentMode);
      currentMode = modes[(index + 1) % modes.length];
      applyLanguageMode();
    });
  }
}

function setupSearch() {
  const searchInput = $("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    document.querySelectorAll("#storyList [data-story]").forEach((button) => {
      const story = storyData.find(
        (item) => item.number === Number(button.dataset.story)
      );

      if (!story) return;

      const text = `${story.titleEn} ${story.titleKo}`.toLowerCase();
      button.style.display = text.includes(query) ? "" : "none";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupCompletion();
  setupAudio();
  setupSearch();
  loadAllStories().catch((error) => {
    console.error(error);
    const list = $("storyList");
    if (list) {
      list.innerHTML =
        `<p>동화 목록을 불러오지 못했어요. 파일 이름과 경로를 확인해 주세요.</p>`;
    }
  });
});
