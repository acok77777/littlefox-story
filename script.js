
const TOTAL_STORIES = 64;

const stories = Array.from({ length: TOTAL_STORIES }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");

  return {
    episode: index + 1,
    title: `Story ${number}`,
    audio: `audio/s%20${number}.mp3`,
    json: `data/story-${number}.json`,
    text: `data/W%20${number}.txt`
  };
});

let currentStory = 1;
let currentLines = [];
let completedStories = JSON.parse(
  localStorage.getItem("completedStories") || "[]"
);

const $ = (selectors) => {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
};

const elements = {
  title: ["#storyTitle", "#title", "[data-story-title]"],
  number: ["#storyNumber", "#episodeNumber", "[data-story-number]"],
  select: ["#storySelect", "#episodeSelect", "#storyList"],
  lines: ["#storyLines", "#storyContent", "#lines", "#content"],
  audio: ["#audioPlayer", "#audio", "audio"],
  completed: ["#completeCheck", "#completed", "#studyComplete"],
  progressText: ["#progressText", "#completionText", "#studyProgress"],
  progressBar: ["#progressBar", "#completionBar"],
  previous: ["#prevBtn", "#previousBtn", "#prevStory"],
  next: ["#nextBtn", "#nextStory"],
  back: ["#back10Btn", "#rewind10", "#backwardBtn"],
  forward: ["#forward10Btn", "#forward10", "#forwardBtn"],
  speed: ["#speedSelect", "#playbackSpeed", "#speed"],
  play: ["#playBtn", "#playAudio"],
  pause: ["#pauseBtn", "#pauseAudio"]
};

function find(key) {
  return $(elements[key] || []);
}

function saveCompleted() {
  localStorage.setItem(
    "completedStories",
    JSON.stringify(completedStories)
  );
}

function updateProgress() {
  const count = completedStories.length;
  const percent = Math.round((count / TOTAL_STORIES) * 100);

  const text = find("progressText");
  if (text) {
    text.textContent = `${count} / ${TOTAL_STORIES}개 학습 완료 (${percent}%)`;
  }

  const bar = find("progressBar");
  if (bar) {
    if ("value" in bar) {
      bar.max = TOTAL_STORIES;
      bar.value = count;
    }
    bar.style.width = `${percent}%`;
    bar.setAttribute("aria-valuenow", String(count));
  }

  const check = find("completed");
  if (check) {
    check.checked = completedStories.includes(currentStory);
  }

  const select = find("select");
  if (select) {
    Array.from(select.options).forEach((option) => {
      const episode = Number(option.value);
      if (episode) {
        const story = stories[episode - 1];
        option.textContent =
          `${String(episode).padStart(2, "0")}. ` +
          (story?.title || `Story ${episode}`) +
          (completedStories.includes(episode) ? " ✓" : "");
      }
    });
  }
}

function renderStoryList() {
  const select = find("select");
  if (!select) return;

  select.innerHTML = "";

  stories.forEach((story) => {
    const option = document.createElement("option");
    option.value = String(story.episode);
    option.textContent =
      `${String(story.episode).padStart(2, "0")}. ${story.title}`;
    select.appendChild(option);
  });

  select.value = String(currentStory);
}

function renderLines(lines) {
  const container = find("lines");
  if (!container) return;

  container.replaceChildren();

  if (!Array.isArray(lines) || lines.length === 0) {
    container.textContent = "이 에피소드의 문장이 아직 등록되지 않았어요.";
    return;
  }

  lines.forEach((line, index) => {
    const item = document.createElement("div");
    item.className = "story-line";

    const english = document.createElement("p");
    english.className = "english-line";
    english.textContent = line.en || "";

    const korean = document.createElement("p");
    korean.className = "korean-line";
    korean.textContent = line.ko || "";

    item.append(english, korean);
    container.appendChild(item);
  });
}

async function loadStory(episode) {
  if (episode < 1 || episode > TOTAL_STORIES) return;

  currentStory = episode;

  const story = stories[episode - 1];
  let data = null;

  try {
    const response = await fetch(story.json, { cache: "no-store" });

    if (response.ok) {
      data = await response.json();
    }
  } catch (error) {
    console.warn("JSON 파일을 불러오지 못했습니다:", story.json, error);
  }

  const title = data?.title || story.title;
  const titleElement = find("title");
  if (titleElement) titleElement.textContent = title;

  const numberElement = find("number");
  if (numberElement) numberElement.textContent = `${episode} / ${TOTAL_STORIES}`;

  currentLines = data?.lines || [];
  renderLines(currentLines);

  const audio = find("audio");
  if (audio) {
    audio.pause();
    audio.src = data?.audio || story.audio;
    audio.load();
    audio.playbackRate = 1;
  }

  const select = find("select");
  if (select) select.value = String(episode);

  updateProgress();
}

function changeStory(amount) {
  const next = Math.min(
    TOTAL_STORIES,
    Math.max(1, currentStory + amount)
  );
  loadStory(next);
}

function seekAudio(seconds) {
  const audio = find("audio");
  if (!audio) return;

  audio.currentTime = Math.max(
    0,
    Math.min(audio.duration || Infinity, audio.currentTime + seconds)
  );
}

function setSpeed(speed) {
  const audio = find("audio");
  if (audio) audio.playbackRate = Number(speed);
}

function connectEvents() {
  const select = find("select");
  if (select) {
    select.addEventListener("change", () => {
      loadStory(Number(select.value));
    });
  }

  const check = find("completed");
  if (check) {
    check.addEventListener("change", () => {
      if (check.checked) {
        if (!completedStories.includes(currentStory)) {
          completedStories.push(currentStory);
        }
      } else {
        completedStories = completedStories.filter(
          (episode) => episode !== currentStory
        );
      }

      saveCompleted();
      updateProgress();
    });
  }

  find("previous")?.addEventListener("click", () => changeStory(-1));
  find("next")?.addEventListener("click", () => changeStory(1));
  find("back")?.addEventListener("click", () => seekAudio(-10));
  find("forward")?.addEventListener("click", () => seekAudio(10));

  const speed = find("speed");
  if (speed) {
    speed.addEventListener("change", () => setSpeed(speed.value));
  }

  find("play")?.addEventListener("click", () => {
    find("audio")?.play();
  });

  find("pause")?.addEventListener("click", () => {
    find("audio")?.pause();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderStoryList();
  connectEvents();
  loadStory(1);
  updateProgress();
});
