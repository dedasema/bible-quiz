import type { Chapter, Question, QuestionBank, UserAnswer } from './questionBank';

export const ROMANS_CHAPTERS = Array.from({ length: 16 }, (_, index) => (index + 1) as Chapter);

export type ChapterCounts = Record<Chapter, number>;
export type QuizQuestion = Question;
export type QuizSession = {
  id: string;
  selectedChapters: Chapter[];
  countPerChapter: number;
  questions: QuizQuestion[];
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  createdAt: string;
};

export type ScoredQuestion = {
  question: QuizQuestion;
  answer?: UserAnswer;
  status: 'correct' | 'incorrect' | 'unanswered';
};

export type QuizResults = {
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  details: ScoredQuestion[];
};

export function getChapterCounts(bank: QuestionBank): ChapterCounts {
  const counts = Object.fromEntries(ROMANS_CHAPTERS.map((chapter) => [chapter, 0])) as ChapterCounts;

  for (const question of bank.questions) {
    counts[question.chapter] = (counts[question.chapter] ?? 0) + 1;
  }

  return counts;
}

export function getMaxCountForSelection(counts: ChapterCounts, selectedChapters: Chapter[]): number {
  if (selectedChapters.length === 0) {
    return 0;
  }

  return Math.min(...selectedChapters.map((chapter) => counts[chapter] ?? 0));
}

export function validateQuizSelection(
  counts: ChapterCounts,
  selectedChapters: Chapter[],
  countPerChapter: number
): string[] {
  const errors: string[] = [];
  const uniqueChapters = new Set(selectedChapters);

  if (selectedChapters.length === 0) {
    errors.push('Seleccioná al menos un capítulo.');
  }

  if (uniqueChapters.size !== selectedChapters.length) {
    errors.push('Cada capítulo seleccionado debe ser único.');
  }

  for (const chapter of selectedChapters) {
    if (!ROMANS_CHAPTERS.includes(chapter)) {
      errors.push(`El capítulo ${chapter} está fuera de Romanos 1-16.`);
    }
  }

  if (!Number.isFinite(countPerChapter) || !Number.isInteger(countPerChapter) || countPerChapter < 1) {
    errors.push('La cantidad de preguntas debe ser un número entero mayor o igual a 1.');
  }

  const maxCount = getMaxCountForSelection(counts, selectedChapters);
  if (selectedChapters.length > 0 && countPerChapter > maxCount) {
    errors.push(`La cantidad no puede superar ${maxCount}, el banco más chico entre los capítulos seleccionados.`);
  }

  return errors;
}

export function sampleQuestions(
  questions: Question[],
  count: number,
  random: () => number = Math.random
): Question[] {
  if (count < 0 || count > questions.length) {
    throw new Error(`Cannot sample ${count} questions from a pool of ${questions.length}.`);
  }

  const pool = [...questions];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = pool[index];
    const swap = pool[swapIndex];

    if (current === undefined || swap === undefined) {
      throw new Error('Unexpected empty question pool slot while sampling.');
    }

    pool[index] = swap;
    pool[swapIndex] = current;
  }

  return pool.slice(0, count);
}

export function createQuizSession(
  bank: QuestionBank,
  selectedChapters: Chapter[],
  countPerChapter: number,
  random: () => number = Math.random
): QuizSession {
  const counts = getChapterCounts(bank);
  const errors = validateQuizSelection(counts, selectedChapters, countPerChapter);

  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }

  const selected = selectedChapters.flatMap((chapter) => {
    const chapterQuestions = bank.questions.filter((question) => question.chapter === chapter);
    return sampleQuestions(chapterQuestions, countPerChapter, random);
  });

  return {
    id: cryptoSafeId(),
    selectedChapters: [...selectedChapters],
    countPerChapter,
    questions: sampleQuestions(selected, selected.length, random),
    currentIndex: 0,
    answers: {},
    createdAt: new Date().toISOString()
  };
}

export function validateStoredSession(bank: QuestionBank, input: unknown): QuizSession | null {
  if (!isRecord(input)) return null;

  const { id, selectedChapters, countPerChapter, questions, currentIndex, answers, createdAt } = input;

  if (typeof id !== 'string' || id.trim() === '') return null;
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) return null;
  if (!Array.isArray(selectedChapters) || !selectedChapters.every(isChapter)) return null;
  if (new Set(selectedChapters).size !== selectedChapters.length) return null;
  if (typeof countPerChapter !== 'number' || !Number.isInteger(countPerChapter) || countPerChapter < 1) return null;
  if (!Array.isArray(questions)) return null;
  if (typeof currentIndex !== 'number' || !Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= questions.length) return null;
  if (!isRecord(answers)) return null;

  const validSelectedChapters = selectedChapters;
  const validCountPerChapter = countPerChapter as number;
  const validQuestions = questions;
  const validCurrentIndex = currentIndex as number;

  const errors = validateQuizSelection(getChapterCounts(bank), validSelectedChapters, validCountPerChapter);
  if (errors.length > 0) return null;

  if (validQuestions.length !== validSelectedChapters.length * validCountPerChapter) return null;

  const bankQuestionsById = new Map(bank.questions.map((question) => [question.id, question]));
  const seenQuestionIds = new Set<string>();
  const selectedChapterSet = new Set<Chapter>(validSelectedChapters);
  const perChapterCounts = new Map<Chapter, number>(validSelectedChapters.map((chapter) => [chapter, 0]));

  for (const question of validQuestions) {
    if (!isRecord(question) || typeof question.id !== 'string') return null;

    const bankQuestion = bankQuestionsById.get(question.id);
    if (!bankQuestion) return null;
    if (seenQuestionIds.has(question.id)) return null;
    if (!selectedChapterSet.has(bankQuestion.chapter)) return null;
    if (JSON.stringify(question) !== JSON.stringify(bankQuestion)) return null;

    seenQuestionIds.add(question.id);
    perChapterCounts.set(bankQuestion.chapter, (perChapterCounts.get(bankQuestion.chapter) ?? 0) + 1);
  }

  for (const chapter of validSelectedChapters) {
    if (perChapterCounts.get(chapter) !== validCountPerChapter) return null;
  }

  const validQuestionIds = new Set(validQuestions.map((question) => (question as Question).id));
  for (const [questionId, answer] of Object.entries(answers)) {
    if (!validQuestionIds.has(questionId)) return null;

    const question = bankQuestionsById.get(questionId);
    if (!question || !isValidAnswerForQuestion(question, answer)) return null;
  }

  return {
    id,
    selectedChapters: validSelectedChapters,
    countPerChapter: validCountPerChapter,
    questions: validQuestions as Question[],
    currentIndex: validCurrentIndex,
    answers: answers as Record<string, UserAnswer>,
    createdAt
  };
}

export function scoreQuiz(session: QuizSession): QuizResults {
  const details = session.questions.map((question): ScoredQuestion => {
    const answer = session.answers[question.id];

    if (answer === undefined) {
      return { question, status: 'unanswered' };
    }

    const expected = question.type === 'true-false' ? String(question.correctAnswer) : question.correctOption;

    return {
      question,
      answer,
      status: answer === expected ? 'correct' : 'incorrect'
    };
  });

  return {
    total: details.length,
    correct: details.filter((detail) => detail.status === 'correct').length,
    incorrect: details.filter((detail) => detail.status === 'incorrect').length,
    unanswered: details.filter((detail) => detail.status === 'unanswered').length,
    details
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChapter(value: unknown): value is Chapter {
  return typeof value === 'number' && Number.isInteger(value) && ROMANS_CHAPTERS.includes(value as Chapter);
}

function isValidAnswerForQuestion(question: Question, answer: unknown): answer is UserAnswer {
  if (question.type === 'true-false') {
    return answer === 'true' || answer === 'false';
  }

  return answer === 'a' || answer === 'b' || answer === 'c';
}

function cryptoSafeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
