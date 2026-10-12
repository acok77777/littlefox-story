
const TOTAL_STORIES = 64;

const stories = Array.from({ length: TOTAL_STORIES }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    episode: index + 1,
    title: `Story ${number}`,
    json: `data/story-${number}.json`,
    text: `data/W%20${number}.txt`,
    audio: `audio/s%20${number}.mp3`
  };
});

let currentStory = 1;
let completedStories = JSON.parse(
  localStorage.getItem("completedStories") || "[]"
);

function getElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function getAudio() {
  return getElement("#audioPlayer", "#audio", "audio");
}

function updateProgress() {
  const count = completedStories.length;
  const percent = Math.round(count / TOTAL_STORIES * 100);

  const text = getElement("#progressText", "#completionText", "#studyProgress");
  if (text) {
    text.textContent = `${count} / ${TOTAL_STORIES}개 학습 완료 (${percent}%)`;
  }

  const bar = getElement("#progressBar", "#completionBar");
  if (bar) {
    if ("value" in bar) {
      bar.max = TOTAL_STORIES;
      bar.value = count;
    }
    bar.style.width = `${percent}%`;
  }

  const check = getElement("#completeCheck", "#completed", "#studyComplete");
  if (check) {
    check.checked = completedStories.includes(currentStory);
  }
}

function parseTextFile(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map(line => line.trim());

  let title = "";
  const pairs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("제목:")) {
      title = line.replace(/^제목:\s*/, "");
      continue;
    }

    if (!line || /^\d+번$/.test(line)) continue;

    // 영어 문장 다음에 오는 한국어 해석을 한 쌍으로 처리
    if (/[A-Za-z]/.test(line)) {
      let korean = "";

      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j]) continue;

        if (/[가-힣]/.test(lines[j]) && !/[A-Za-z]/.test(lines[j])) {
          korean = lines[j];
          i = j;
        }
        break;
      }

      pairs.push({ en: line, ko: korean });
    }
  }

  return { title, pairs };
}

function renderTextFile(text) {
  const container = getElement(
    "#storyLines",
    "#storyContent",
    "#lines",
    "#content"
  );

  if (!container) {
    console.error("문장을 표시할 HTML 요소를 찾지 못했습니다.");
    return;
  }

  const parsed = parseTextFile(text);
  const titleElement = getElement(
    "#storyTitle",
    "#title",
    "[data-story-title]"
  );

  if (titleElement && parsed.title) {
    titleElement.textContent = parsed.title;
  }

  container.replaceChildren();

  parsed.pairs.forEach(pair => {
    const item = document.createElement("div");
    item.className = "story-line";

    const english = document.createElement("p");
    english.className = "english-line";
    english.textContent = pair.en;

    const korean = document.createElement("p");
    korean.className = "korean-line";
    korean.textContent = pair.ko;

    item.append(english, korean);
    container.appendChild(item);
  });

  if (parsed.pairs.length === 0) {
    container.textContent =
      "문장을 불러오지 못했어요. W 파일의 내용과 경로를 확인해 주세요.";
  }
}

async function loadStory(episode) {
  if (episode < 1 || episode > TOTAL_STORIES) return;

  currentStory = episode;
  const story = stories[episode - 1];

  const numberElement = getElement(
    "#storyNumber",
    "#episodeNumber",
    "[data-story-number]"
  );
  if (numberElement) {
    numberElement.textContent = `${episode} / ${TOTAL_STORIES}`;
  }

  const select = getElement("#storySelect", "#episodeSelect", "#storyList");
  if (select) select.value = String(episode);

  // 문장과 해석은 W 파일에서만 읽습니다.
  try {
    const response = await fetch(story.text, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`W 파일 요청 실패: ${response.status}`);
    }

    const text = await response.text();
    renderTextFile(text);
  } catch (error) {
    console.error(error);
    const container = getElement(
      "#storyLines",
      "#storyContent",
      "#lines",
      "#content"
    );
    if (container) {
      container.textContent =
        `문장을 불러오지 못했어요: ${story.text}`;
    }
  }

  // JSON 파일은 제목과 오디오 경로를 읽는 용도로만 사용합니다.
  let audioPath = story.audio;

  try {
    const response = await fetch(story.json, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (data.audio) audioPath = data.audio;
    }
  } catch (error) {
    console.warn("JSON 메타데이터를 읽지 못했습니다.", error);
  }

  const audio = getAudio();
  if (audio) {
    audio.pause();
    audio.src = audioPath;
    audio.load();
    audio.playbackRate = 1;
  }

  const speed = getElement("#speedSelect", "#playbackSpeed", "#speed");
  if (speed) speed.value = "1";

  updateProgress();
}

function seekAudio(seconds) {
  const audio = getAudio();
  if (!audio) return;

  audio.currentTime = Math.max(
    0,
    Math.min(audio.duration || Infinity, audio.currentTime + seconds)
  );
}

function connectEvents() {
  const select = getElement("#storySelect", "#episodeSelect", "#storyList");
  if (select) {
    select.addEventListener("change", () => {
      loadStory(Number(select.value));
    });
  }

  const check = getElement("#completeCheck", "#completed", "#studyComplete");
  if (check) {
    check.addEventListener("change", () => {
      if (check.checked) {
        if (!completedStories.includes(currentStory)) {
          completedStories.push(currentStory);
        }
      } else {
        completedStories = completedStories.filter(
          episode => episode !== currentStory
        );
      }

      localStorage.setItem(
        "completedStories",
        JSON.stringify(completedStories)
      );
      updateProgress();
    });
  }

  getElement("#prevBtn", "#previousBtn", "#prevStory")
    ?.addEventListener("click", () => loadStory(currentStory - 1));

  getElement("#nextBtn", "#nextStory")
    ?.addEventListener("click", () => loadStory(currentStory + 1));

  getElement("#back10Btn", "#rewind10", "#backwardBtn")
    ?.addEventListener("click", () => seekAudio(-10));

  getElement("#forward10Btn", "#forward10", "#forwardBtn")
    ?.addEventListener("click", () => seekAudio(10));

  const speed = getElement("#speedSelect", "#playbackSpeed", "#speed");
  if (speed) {
    speed.addEventListener("change", () => {
      const audio = getAudio();
      if (audio) audio.playbackRate = Number(speed.value);
    });
  }

  getElement("#playBtn", "#playAudio")
    ?.addEventListener("click", () => getAudio()?.play());

  getElement("#pauseBtn", "#pauseAudio")
    ?.addEventListener("click", () => getAudio()?.pause());
}

function buildStorySelect() {
  const select = getElement("#storySelect", "#episodeSelect", "#storyList");
  if (!select) return;

  select.replaceChildren();

  stories.forEach(story => {
    const option = document.createElement("option");
    option.value = String(story.episode);
    option.textContent =
      `${String(story.episode).padStart(2, "0")}. ${story.title}`;
    select.appendChild(option);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  buildStorySelect();
  connectEvents();
  loadStory(1);
  updateProgress();
});
