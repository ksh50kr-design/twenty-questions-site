"use strict";

/* 시작 페이지: data/quiz.json 의 서버 목록으로 버튼을 만든다 */

async function init() {
  const status = $("start-status");
  let quiz;
  try {
    quiz = await fetchQuiz();
  } catch (e) {
    status.textContent = "목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
    return;
  }
  if (quiz.servers.length === 0) {
    status.textContent = "아직 열린 서버가 없습니다.";
    return;
  }
  status.hidden = true;

  const grid = $("server-grid");
  quiz.servers.forEach((s, i) => {
    const a = document.createElement("a");
    a.className = "class-card";
    a.href = `play.html?server=${encodeURIComponent(s.id)}`;
    const num = document.createElement("span");
    num.className = "card-num";
    num.textContent = String(i + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.textContent = s.name;
    a.append(num, name);
    grid.appendChild(a);
  });
}

init();
