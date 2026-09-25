"use strict";

/* 편집 페이지와 게임 페이지가 함께 쓰는 설정·유틸 */

const HINT_COUNT = 10;
const DATA_URL = "data/quiz.json";
const DRAFT_KEY = "twenty-questions-draft";

const EXAMPLE_PROBLEMS = [
  {
    answer: "이순신, 이순신 장군",
    hints: [
      "저는 조선 시대 사람입니다.",
      "저는 무관(武官)이었습니다.",
      "저는 전라도 지역에서 활동했습니다.",
      "저는 일기를 꾸준히 썼습니다.",
      "저의 시호는 '충무공'입니다.",
      "저는 임진왜란 때 활약했습니다.",
      "저는 바다에서 싸웠습니다.",
      "한산도 대첩과 명량 해전이 유명합니다.",
      "거북선을 만들어 전투에 사용했습니다.",
      "광화문 광장에 제 동상이 있습니다.",
    ],
  },
  {
    answer: "기린",
    hints: [
      "저는 동물입니다.",
      "저는 포유류입니다.",
      "저는 초식 동물입니다.",
      "저는 아프리카 초원에 삽니다.",
      "저는 서서 잠을 자기도 합니다.",
      "제 혀는 50cm 가까이 됩니다.",
      "제 몸에는 무늬가 있습니다.",
      "저는 높은 나뭇가지의 잎을 먹습니다.",
      "저는 육지 동물 중 키가 가장 큽니다.",
      "제 목은 아주 깁니다.",
    ],
  },
  {
    answer: "무지개",
    hints: [
      "저는 자연 현상입니다.",
      "저는 잠깐 나타났다가 사라집니다.",
      "저를 보려면 해를 등지고 서야 합니다.",
      "저는 빛의 굴절과 반사로 생깁니다.",
      "저는 공기 중의 물방울과 관련이 있습니다.",
      "저는 비가 그친 뒤에 잘 보입니다.",
      "저는 하늘에 떠 있습니다.",
      "저는 반원 모양입니다.",
      "저는 여러 가지 색으로 되어 있습니다.",
      "'빨주노초파남보'",
    ],
  },
];

const $ = (id) => document.getElementById(id);

function newServerId() {
  return Math.random().toString(36).slice(2, 8);
}

function emptyProblem() {
  return { answer: "", hints: Array(HINT_COUNT).fill("") };
}

function acceptedAnswers(answerField) {
  return answerField.split(",").map((a) => a.trim()).filter(Boolean);
}

function displayAnswer(answerField) {
  return acceptedAnswers(answerField)[0] || "";
}

function normalize(str) {
  return str.replace(/\s+/g, "").toLowerCase();
}

function isCorrect(guess, answerField) {
  const g = normalize(guess);
  return acceptedAnswers(answerField).some((a) => normalize(a) === g);
}

function isComplete(problem) {
  return displayAnswer(problem.answer) && problem.hints.every((h) => h.trim());
}

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sanitizeProblems(data) {
  if (!Array.isArray(data)) return null;
  return data
    .filter((p) => p && typeof p.answer === "string" && Array.isArray(p.hints))
    .map((p) => ({
      answer: p.answer,
      hints: Array.from({ length: HINT_COUNT }, (_, i) => (typeof p.hints[i] === "string" ? p.hints[i] : "")),
    }));
}

/* 문제 파일(data/quiz.json) 형식:
   { servers: [{ id, name, shuffle, problems: [{ answer, hints: [10] }] }] } */
function sanitizeServer(raw, i) {
  if (!raw || typeof raw !== "object") return null;
  const problems = sanitizeProblems(raw.problems);
  if (!problems) return null;
  return {
    id: typeof raw.id === "string" && /^[\w-]+$/.test(raw.id) ? raw.id : newServerId(),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : `서버 ${i + 1}`,
    shuffle: raw.shuffle !== false,
    problems,
  };
}

function sanitizeQuiz(data) {
  if (!data || !Array.isArray(data.servers)) return null;
  const servers = data.servers.map(sanitizeServer).filter(Boolean);
  // 중복 id 방지
  const seen = new Set();
  servers.forEach((s) => {
    while (seen.has(s.id)) s.id = newServerId();
    seen.add(s.id);
  });
  return { servers };
}

async function fetchQuiz() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = sanitizeQuiz(await res.json());
  if (!data) throw new Error("형식 오류");
  return data;
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? sanitizeQuiz(JSON.parse(raw)) : null;
  } catch (e) {
    return null;
  }
}

function saveDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) { /* 저장 불가 환경은 무시 */ }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) { /* 무시 */ }
}
