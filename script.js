
/* 전체 동화 불러오기 */
async function loadAllStories() {
  const list = $("storyList");

  // ★ 동화 파일을 불러오기 전에 구간 버튼부터 표시
  renderRangeButtons();
  updateProgress();

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

  // 동화 파일을 불러온 뒤 진도 갱신
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
