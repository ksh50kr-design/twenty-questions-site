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
    del.textContent = "삭제";
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

/* ---------- GitHub 연결: 편집 화면에서 data/quiz.json 을 바로 저장 ---------- */

const TOKEN_KEY = "twenty-questions-gh-token";
const DEFAULT_REPO = { owner: "ksh50kr-design", name: "twenty-questions-site", branch: "main" };
const QUIZ_PATH = "data/quiz.json";

// <사용자>.github.io/<저장소>/ 에서 열렸으면 그 저장소를, 아니면(로컬 등) 기본 저장소를 쓴다
function detectRepo() {
  const m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  const first = location.pathname.split("/").filter(Boolean)[0];
  if (m && first && !first.endsWith(".html")) return { owner: m[1], name: first, branch: "main" };
  return DEFAULT_REPO;
}

const repo = detectRepo();

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (e) {
    return "";
  }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* 무시 */ }
}

async function githubApi(path, options = {}) {
  const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}${path}`, {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

function githubErrorMessage(e) {
  if (e.status === 401) return "토큰이 올바르지 않거나 만료되었습니다. GitHub 연결에서 토큰을 다시 넣어주세요.";
  if (e.status === 403 || e.status === 404) {
    return `토큰에 ${repo.owner}/${repo.name} 저장소의 Contents 쓰기(Read and write) 권한이 없습니다.`;
  }
  if (e instanceof TypeError) return "인터넷 연결을 확인해 주세요.";
  return `GitHub 오류: ${e.message}`;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function fetchQuizFromGithub() {
  const file = await githubApi(`/contents/${QUIZ_PATH}?ref=${repo.branch}`);
  return { sha: file.sha, quiz: sanitizeQuiz(JSON.parse(fromBase64(file.content))) };
}

function renderGithubState() {
  const connected = !!getToken();
  const state = $("gh-state");
  state.textContent = connected ? "● 연결됨" : "● 연결 안 됨 (반영하려면 먼저 연결하세요)";
  state.className = `gh-state ${connected ? "on" : "off"}`;
  $("gh-forget-btn").disabled = !connected;
  $("gh-token-input").value = "";
  $("gh-token-input").placeholder = connected ? "새 토큰으로 바꾸려면 여기에 붙여 넣기" : "github_pat_...";
}

async function connectGithub() {
  const token = $("gh-token-input").value.trim();
  if (!token) {
    setStatus("토큰을 붙여 넣어 주세요.");
    return;
  }
  const prev = getToken();
  setToken(token);
  $("gh-save-btn").disabled = true;
  setStatus("연결 확인 중…", true);
  try {
    const info = await githubApi("");
    if (!info.permissions || !info.permissions.push) {
      const err = new Error("no push");
      err.status = 403;
      throw err;
    }
    renderGithubState();
    $("gh-box").open = false;
    setStatus("GitHub에 연결되었습니다. 이제 '사이트에 반영'을 누르면 바로 적용됩니다.", true);
  } catch (e) {
    setToken(prev);
    renderGithubState();
    setStatus(githubErrorMessage(e));
  } finally {
    $("gh-save-btn").disabled = false;
  }
}

function forgetGithub() {
  if (!confirm("이 브라우저에서 GitHub 토큰을 지울까요?")) return;
  setToken("");
  renderGithubState();
  setStatus("연결을 해제했습니다.", true);
}

function validateBeforePublish() {
  if (quiz.servers.some((s) => !s.name.trim())) return "이름이 비어 있는 서버가 있습니다. 이름을 입력해 주세요.";
  return "";
}

async function publish() {
  if (!getToken()) {
    $("gh-box").open = true;
    $("gh-box").scrollIntoView({ behavior: "smooth" });
    setStatus("먼저 GitHub에 연결해 주세요. (처음 한 번만)");
    return;
  }
  const problem = validateBeforePublish();
  if (problem) {
    setStatus(problem);
    return;
  }
  const empty = quiz.servers.filter((s) => !s.problems.some(isComplete)).map((s) => s.name);
  if (empty.length && !confirm(`완성된 문제가 없는 서버가 있습니다: ${empty.join(", ")}\n그래도 반영할까요?`)) return;

  const btn = $("publish-btn");
  btn.disabled = true;
  setStatus("반영하는 중…", true);
  const content = toBase64(JSON.stringify(quiz, null, 2) + "\n");
  try {
    // 다른 곳에서 파일이 바뀌어 sha 가 어긋나면(409) 한 번 더 시도
    for (let attempt = 0; ; attempt++) {
      let sha;
      try {
        sha = (await githubApi(`/contents/${QUIZ_PATH}?ref=${repo.branch}`)).sha;
      } catch (e) {
        if (e.status !== 404) throw e; // 파일이 없으면 새로 만든다
      }
      try {
        await githubApi(`/contents/${QUIZ_PATH}`, {
          method: "PUT",
          body: JSON.stringify({ message: "Update quiz from editor", content, sha, branch: repo.branch }),
        });
        break;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt === 0) continue;
        throw e;
      }
    }
    const time = new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    setStatus(`반영했습니다 (${time}). 1~2분 뒤 학생 화면에 적용됩니다. 학생들은 새로고침하면 바뀐 문제를 볼 수 있어요.`, true);
  } catch (e) {
    setStatus(githubErrorMessage(e));
  } finally {
    btn.disabled = false;
  }
}

/* ---------- 파일 ---------- */

function downloadJSON() {
  const problem = validateBeforePublish();
  if (problem) {
    setStatus(problem);
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
    "quiz.json 을 백업용으로 내려받았습니다." +
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
    const q = getToken() ? (await fetchQuizFromGithub()).quiz : await fetchQuiz();
    if (q && q.servers.length) {
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
  $("publish-btn").addEventListener("click", publish);
  $("gh-save-btn").addEventListener("click", connectGithub);
  $("gh-forget-btn").addEventListener("click", forgetGithub);
  $("gh-repo-name").textContent = `${repo.owner}/${repo.name}`;
  renderGithubState();
  if (!getToken()) $("gh-box").open = true;
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
    if (!confirm("이 브라우저에서 편집한 내용을 모두 버리고, 지금 사이트에 반영되어 있는 내용으로 되돌릴까요?")) return;
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
