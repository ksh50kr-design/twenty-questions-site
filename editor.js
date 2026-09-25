"use strict";

/* 선생님용 편집 페이지: 서버(반) 목록과 서버별 문제를 편집하고 data/quiz.json 파일로 내려받는다 */

let quiz = null; // { servers: [{ id, name, shuffle, problems }] }
let current = 0; // 선택된 서버 번호

function server() {
  return quiz.servers[current];
}

function setStatus(msg, ok = false) {
  const el = $("editor-status");
  el.textContent = msg;
  el.classList.toggle("ok", ok);
}

function persist() {
  saveDraft(quiz);
}

function newServer() {
  return { id: newServerId(), name: `서버 ${quiz.servers.length + 1}`, shuffle: true, problems: [emptyProblem()] };
}

/* ---------- 서버 목록 ---------- */

function renderServerTabs() {
  const nav = $("server-tabs");
  nav.innerHTML = "";
  quiz.servers.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `tab-btn${i === current ? " active" : ""}`;
    btn.textContent = s.name.trim() || "(이름 없음)";
    btn.addEventListener("click", () => {
      current = i;
      render();
    });
    nav.appendChild(btn);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "tab-btn add-tab";
  add.textContent = "+ 서버 추가";
  add.addEventListener("click", addServer);
  nav.appendChild(add);
}

function addServer() {
  quiz.servers.push(newServer());
  current = quiz.servers.length - 1;
  persist();
  render();
  $("name-input").select();
  setStatus("새 서버를 추가했습니다. 이름과 문제를 입력하세요.", true);
}

function deleteServer() {
  if (quiz.servers.length <= 1) {
    setStatus("서버는 최소 1개가 있어야 합니다.");
    return;
  }
  const name = server().name.trim() || "(이름 없음)";
  if (!confirm(`'${name}' 서버와 그 안의 문제를 모두 삭제할까요?`)) return;
  quiz.servers.splice(current, 1);
  current = Math.min(current, quiz.servers.length - 1);
  persist();
  render();
  setStatus(`'${name}' 서버를 삭제했습니다.`, true);
}

function moveServer(step) {
  const to = current + step;
  if (to < 0 || to >= quiz.servers.length) return;
  const list = quiz.servers;
  [list[current], list[to]] = [list[to], list[current]];
  current = to;
  persist();
  render();
}

function renderMeta() {
  const s = server();
  $("name-input").value = s.name;
  $("shuffle-check").checked = s.shuffle;
  $("move-left-btn").disabled = current === 0;
  $("move-right-btn").disabled = current === quiz.servers.length - 1;
  $("delete-server-btn").disabled = quiz.servers.length <= 1;
}

/* ---------- 문제 목록 ---------- */

function renderProblemList() {
  const list = $("problem-list");
  list.innerHTML = "";
  const problems = server().problems;

  problems.forEach((p, pi) => {
    const card = document.createElement("div");
    card.className = "problem-card";

    const head = document.createElement("div");
    head.className = "problem-head";
    head.innerHTML = `<span class="problem-no">문제 ${pi + 1}</span>`;

    const answerInput = document.createElement("input");
    answerInput.type = "text";
    answerInput.placeholder = "정답 (여러 개면 쉼표로 구분)";
    answerInput.value = p.answer;
    answerInput.addEventListener("input", () => { p.answer = answerInput.value; persist(); });
    head.appendChild(answerInput);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del-btn";
    del.textContent = "✕ 삭제";
    del.addEventListener("click", () => {
      problems.splice(pi, 1);
      persist();
      renderProblemList();
    });
    head.appendChild(del);
    card.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "hint-inputs";
    p.hints.forEach((h, hi) => {
      const row = document.createElement("div");
      row.className = "hint-input-row";
      row.innerHTML = `<span>${hi + 1}</span>`;
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = `힌트 ${hi + 1}`;
      input.value = h;
      input.addEventListener("input", () => { p.hints[hi] = input.value; persist(); });
      row.appendChild(input);
      grid.appendChild(row);
    });
    card.appendChild(grid);

    list.appendChild(card);
  });
}

function render() {
  renderServerTabs();
  renderMeta();
  renderProblemList();
}

/* ---------- 파일 ---------- */

function downloadJSON() {
  const unnamed = quiz.servers.filter((s) => !s.name.trim()).length;
  if (unnamed) {
    setStatus("이름이 비어 있는 서버가 있습니다. 이름을 입력해 주세요.");
    return;
  }
  const empty = quiz.servers.filter((s) => !s.problems.some(isComplete)).map((s) => s.name);
  const blob = new Blob([JSON.stringify(quiz, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "quiz.json";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(
    "quiz.json 을 내려받았습니다. GitHub 저장소의 data 폴더에 올리면 모든 서버에 적용됩니다." +
      (empty.length ? ` (완성된 문제가 없는 서버: ${empty.join(", ")})` : ""),
    true
  );
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = sanitizeQuiz(JSON.parse(reader.result));
      if (!imported || imported.servers.length === 0) throw new Error();
      imported.servers.forEach((s) => { if (s.problems.length === 0) s.problems.push(emptyProblem()); });
      quiz = imported;
      current = 0;
      persist();
      render();
      setStatus(`서버 ${imported.servers.length}개를 불러왔습니다.`, true);
    } catch (e) {
      setStatus("quiz.json 형식이 올바르지 않습니다.");
    }
  };
  reader.readAsText(file);
}

function preview() {
  if (!server().problems.some(isComplete)) {
    setStatus("정답과 힌트 10개를 모두 채운 문제가 하나 이상 있어야 합니다.");
    return;
  }
  persist();
  window.open(`play.html?preview=${encodeURIComponent(server().id)}`, "_blank");
}

async function loadQuiz() {
  const draft = loadDraft();
  if (draft && draft.servers.length) {
    setStatus("이 브라우저에 저장된 편집 내용을 불러왔습니다.", true);
    return draft;
  }
  try {
    const q = await fetchQuiz();
    if (q.servers.length) {
      setStatus("사이트에 올라가 있는 문제를 불러왔습니다.", true);
      return q;
    }
  } catch (e) { /* 파일이 없으면 새로 시작 */ }
  setStatus("문제 파일이 없어 빈 서버로 시작합니다.");
  return { servers: [{ id: newServerId(), name: "1반", shuffle: true, problems: [emptyProblem()] }] };
}

async function init() {
  $("name-input").addEventListener("input", () => {
    server().name = $("name-input").value;
    persist();
    renderServerTabs();
  });
  $("shuffle-check").addEventListener("change", () => { server().shuffle = $("shuffle-check").checked; persist(); });
  $("move-left-btn").addEventListener("click", () => moveServer(-1));
  $("move-right-btn").addEventListener("click", () => moveServer(1));
  $("delete-server-btn").addEventListener("click", deleteServer);

  $("add-problem-btn").addEventListener("click", () => {
    server().problems.push(emptyProblem());
    persist();
    renderProblemList();
  });
  $("preview-btn").addEventListener("click", preview);
  $("download-btn").addEventListener("click", downloadJSON);
  $("import-input").addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  $("load-example-btn").addEventListener("click", () => {
    server().problems = sanitizeProblems(EXAMPLE_PROBLEMS);
    persist();
    renderProblemList();
    setStatus("예시 문제를 불러왔습니다.", true);
  });
  $("reset-btn").addEventListener("click", () => {
    if (!confirm(`'${server().name}' 서버의 문제를 모두 삭제할까요?`)) return;
    server().problems = [emptyProblem()];
    persist();
    renderProblemList();
    setStatus("");
  });
  $("reload-btn").addEventListener("click", async () => {
    if (!confirm("이 브라우저에서 편집한 내용을 모두 버리고, 사이트에 올라가 있는 파일로 되돌릴까요?")) return;
    clearDraft();
    quiz = await loadQuiz();
    current = 0;
    render();
  });

  quiz = await loadQuiz();
  quiz.servers.forEach((s) => { if (s.problems.length === 0) s.problems.push(emptyProblem()); });
  render();
}

init();
