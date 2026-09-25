"use strict";

/* 게임 페이지: play.html?server=ID (올라가 있는 문제 파일) 또는 play.html?preview=ID (편집 중인 초안) */

const game = {
  set: [], // 플레이 중인 문제 목록
  shuffle: true, // 들어올 때마다 순서 섞기
  index: 0, // 현재 문제 번호
  revealed: 1, // 현재까지 공개한 힌트 수
  finished: false, // 현재 문제가 끝났는지(정답/오답 판정 완료)
  results: [], // { answer, guess, hintsUsed, correct, score }
};

function scoreFor(hintsUsed) {
  // 첫 힌트에서 맞히면 10점, 힌트를 하나 더 볼 때마다 1점씩 감소
  return HINT_COUNT + 1 - hintsUsed;
}

function showMessage(html) {
  $("play-empty").innerHTML = html;
  $("play-empty").hidden = false;
  $("play-area").hidden = true;
  $("summary").hidden = true;
}

function startGame() {
  game.set = game.shuffle ? shuffle(game.set) : game.set;
  game.index = 0;
  game.results = [];
  $("play-empty").hidden = true;
  $("summary").hidden = true;
  $("play-area").hidden = false;
  loadProblem();
}

function loadProblem() {
  game.revealed = 1;
  game.finished = false;
  $("answer-input").value = "";
  $("answer-row").hidden = false;
  $("result-box").hidden = true;
  $("play-status").textContent = "";
  renderPlay();
  $("answer-input").focus();
}

function currentScore() {
  return game.results.reduce((sum, r) => sum + r.score, 0);
}

function renderPlay() {
  const problem = game.set[game.index];
  $("problem-counter").textContent = `문제 ${game.index + 1} / ${game.set.length}`;
  $("score-display").textContent = `현재 점수 ${currentScore()}점`;

  const list = $("hint-list");
  list.innerHTML = "";
  const shown = game.finished ? HINT_COUNT : game.revealed;
  for (let i = 0; i < shown; i++) {
    const li = document.createElement("li");
    const seen = i < game.revealed;
    if (!seen) li.classList.add("unseen");
    else if (!game.finished && i === game.revealed - 1) li.classList.add("latest");
    li.innerHTML =
      `<span class="hint-no">힌트 ${i + 1}</span><span>${escapeHTML(problem.hints[i])}</span>` +
      (seen ? "" : `<span class="unseen-tag">못 본 힌트</span>`);
    list.appendChild(li);
  }

  const nextBtn = $("next-hint-btn");
  nextBtn.textContent = game.revealed >= HINT_COUNT ? "포기" : "다음";
  nextBtn.disabled = game.finished;
}

function submitAnswer() {
  if (game.finished) return;
  const guess = $("answer-input").value.trim();
  if (!guess) {
    $("play-status").textContent = "정답을 입력한 뒤 '정답' 버튼을 눌러주세요.";
    $("answer-input").focus();
    return;
  }
  finishProblem(guess, isCorrect(guess, game.set[game.index].answer));
}

function nextHint() {
  if (game.finished) return;
  if (game.revealed >= HINT_COUNT) {
    // 마지막 힌트에서 '포기' → 오답 처리
    finishProblem("", false);
    return;
  }
  game.revealed++;
  $("play-status").textContent = "";
  renderPlay();
  $("answer-input").focus();
}

function finishProblem(guess, correct) {
  const problem = game.set[game.index];
  const score = correct ? scoreFor(game.revealed) : 0;
  game.results.push({ answer: displayAnswer(problem.answer), guess, hintsUsed: game.revealed, correct, score });
  game.finished = true;

  $("answer-row").hidden = true;
  $("play-status").textContent = "";
  renderPlay(); // 남은 힌트까지 모두 공개

  const box = $("result-box");
  box.hidden = false;
  box.className = `result-box ${correct ? "correct" : "incorrect"}`;
  const answerText = escapeHTML(displayAnswer(problem.answer));
  if (correct) {
    $("result-title").textContent = `정답입니다! (+${score}점)`;
    $("result-detail").innerHTML = `힌트 ${game.revealed}개 만에 <strong>${answerText}</strong>을(를) 맞혔습니다.`;
  } else {
    $("result-title").textContent = guess ? "틀렸습니다" : "포기했습니다";
    $("result-detail").innerHTML =
      (guess ? `내 답: <strong>${escapeHTML(guess)}</strong><br>` : "") +
      `정답은 <strong>${answerText}</strong>입니다. 위에서 나머지 힌트도 확인해 보세요.`;
  }

  const isLastProblem = game.index >= game.set.length - 1;
  $("next-problem-btn").textContent = isLastProblem ? "결과 보기" : "다음 문제";
  $("next-problem-btn").focus();
}

function nextProblem() {
  if (game.index >= game.set.length - 1) {
    showSummary();
    return;
  }
  game.index++;
  loadProblem();
}

function showSummary() {
  $("play-area").hidden = true;
  $("summary").hidden = false;

  const correctCount = game.results.filter((r) => r.correct).length;
  const maxScore = game.results.length * HINT_COUNT;
  $("summary-score").textContent =
    `${game.results.length}문제 중 ${correctCount}문제 정답 · 총점 ${currentScore()} / ${maxScore}점`;

  const tbody = $("summary-tbody");
  tbody.innerHTML = "";
  game.results.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.className = r.correct ? "correct" : "incorrect";
    const guessText = r.guess ? escapeHTML(r.guess) : "(포기)";
    tr.innerHTML =
      `<td>${i + 1}</td><td>${escapeHTML(r.answer)}</td><td>${guessText} ${r.correct ? "○" : "✕"}</td>` +
      `<td>${r.hintsUsed}개</td><td>${r.score}점</td>`;
    tbody.appendChild(tr);
  });
}

async function loadGameData() {
  const params = new URLSearchParams(location.search);
  const previewId = params.get("preview");
  const serverId = params.get("server");

  if (previewId) {
    const draft = loadDraft();
    const server = draft && draft.servers.find((s) => s.id === previewId);
    return server ? { ...server, name: `${server.name} (미리보기)` } : null;
  }
  if (!serverId) return null;
  const quiz = await fetchQuiz();
  return quiz.servers.find((s) => s.id === serverId) || null;
}

async function init() {
  $("submit-btn").addEventListener("click", submitAnswer);
  $("next-hint-btn").addEventListener("click", nextHint);

  // 한글 입력(IME) 조합 중 Enter 가 무시되지 않도록 keydown→keyup 쌍으로 처리
  let enterPressed = false;
  $("answer-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") enterPressed = true;
  });
  $("answer-input").addEventListener("keyup", (e) => {
    if (e.key === "Enter" && enterPressed) {
      enterPressed = false;
      submitAnswer();
    }
  });
  $("next-problem-btn").addEventListener("click", nextProblem);
  $("restart-btn").addEventListener("click", startGame);

  let data;
  try {
    data = await loadGameData();
  } catch (e) {
    showMessage("문제를 불러오지 못했습니다. 잠시 후 새로고침하거나 선생님께 알려주세요.");
    return;
  }
  if (!data) {
    showMessage('서버를 찾을 수 없습니다. <a href="index.html">시작 페이지</a>에서 다시 골라주세요.');
    return;
  }

  document.title = `스무고개 · ${data.name}`;
  $("class-title").textContent = data.name;

  game.set = data.problems.filter(isComplete);
  game.shuffle = data.shuffle;
  if (game.set.length === 0) {
    showMessage("아직 이 서버에 등록된 문제가 없습니다.");
    return;
  }
  startGame();
}

init();
