import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getStartFormControlState, sanitizeCountInputValue, shouldBlockCountInputKey } from '../src/lib/client';
import type { Question, QuestionBank } from '../src/lib/questionBank';
import {
  createQuizSession,
  getChapterCounts,
  getMaxCountForSelection,
  scoreQuiz,
  validateQuizSelection,
  validateStoredSession
} from '../src/lib/quiz';

const bank: QuestionBank = {
  metadata: {
    book: 'Romans',
    translation: 'Reina-Valera 1960',
    version: 1,
    source: 'test fixture'
  },
  questions: [
    makeQuestion('c1-q1', 1, 'a'),
    makeQuestion('c1-q2', 1, 'b'),
    makeQuestion('c2-q1', 2, true),
    makeQuestion('c2-q2', 2, false),
    makeQuestion('c2-q3', 2, true)
  ]
};

describe('quiz selection and scoring', () => {
  it('requires at least one selected chapter', () => {
    const counts = getChapterCounts(bank);

    expect(getMaxCountForSelection(counts, [])).toBe(0);
    expect(validateQuizSelection(counts, [], 1)).toContain('Seleccioná al menos un capítulo.');
    expect(() => createQuizSession(bank, [], 1)).toThrow(/Seleccioná al menos un capítulo/);
  });

  it('rejects non-positive, decimal, NaN, and infinite question counts', () => {
    const counts = getChapterCounts(bank);
    const invalidCounts = [-1, 0, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (const count of invalidCounts) {
      expect(validateQuizSelection(counts, [1], count)).toContain('La cantidad de preguntas debe ser un número entero mayor o igual a 1.');
      expect(() => createQuizSession(bank, [1], count)).toThrow(/La cantidad de preguntas debe ser un número entero mayor o igual a 1/);
    }
  });

  it('rejects the empty-input count equivalent', () => {
    const counts = getChapterCounts(bank);
    const emptyInputCount = Number('');

    expect(emptyInputCount).toBe(0);
    expect(validateQuizSelection(counts, [1], emptyInputCount)).toContain('La cantidad de preguntas debe ser un número entero mayor o igual a 1.');
  });

  it('keeps start controls disabled until the selected chapters and count are valid', () => {
    const counts = getChapterCounts(bank);

    expect(getStartFormControlState(counts, [], Number.NaN, true)).toMatchObject({ max: 0, canStart: false });
    expect(getStartFormControlState(counts, [1], Number.NaN, true)).toMatchObject({ max: 2, canStart: false });
    expect(getStartFormControlState(counts, [1], 0, true)).toMatchObject({ max: 2, canStart: false });
    expect(getStartFormControlState(counts, [], 1, true)).toMatchObject({ max: 0, canStart: false });
    expect(getStartFormControlState(counts, [1, 2], 3, true)).toMatchObject({ max: 2, canStart: false });
    expect(getStartFormControlState(counts, [1, 2], 2, true)).toMatchObject({ max: 2, canStart: true });
    expect(getStartFormControlState(counts, [1], 1, false)).toMatchObject({ max: 2, canStart: false });
  });

  it('sanitizes count input values and blocks non-digit keys before validation', () => {
    expect(sanitizeCountInputValue('-2')).toBe('2');
    expect(sanitizeCountInputValue('1e3')).toBe('13');
    expect(sanitizeCountInputValue(' 04 preguntas')).toBe('4');
    expect(sanitizeCountInputValue('abc')).toBe('');
    expect(sanitizeCountInputValue('0')).toBe('0');

    expect(shouldBlockCountInputKey('-')).toBe(true);
    expect(shouldBlockCountInputKey('e')).toBe(true);
    expect(shouldBlockCountInputKey('.')).toBe(true);
    expect(shouldBlockCountInputKey('5')).toBe(false);
    expect(shouldBlockCountInputKey('Backspace')).toBe(false);
  });

  it('does not render a separate always-visible finish button in the quiz view', () => {
    const clientSource = readFileSync(new URL('../src/lib/client.ts', import.meta.url), 'utf8');

    expect(clientSource).not.toContain('data-results');
    expect(clientSource).not.toContain('Terminar ahora');
    expect(clientSource).not.toContain('Finish now');
  });

  it('bounds count by the smallest selected chapter pool', () => {
    const counts = getChapterCounts(bank);

    expect(getMaxCountForSelection(counts, [1, 2])).toBe(2);
    expect(validateQuizSelection(counts, [1, 2], 3)).toContain('La cantidad no puede superar 2, el banco más chico entre los capítulos seleccionados.');
    expect(() => createQuizSession(bank, [1, 2], 3)).toThrow(/La cantidad no puede superar 2/);
  });

  it('creates mixed final questions without duplicate ids', () => {
    const session = createQuizSession(bank, [1, 2], 2, () => 0.25);
    const ids = session.questions.map((question) => question.id);

    expect(session.questions).toHaveLength(4);
    expect(new Set(ids).size).toBe(ids.length);
    expect(session.selectedChapters).toEqual([1, 2]);
  });

  it('scores correct, incorrect, and unanswered answers separately', () => {
    const session = createQuizSession(bank, [1], 2, () => 0);
    const [first, second] = session.questions;

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    if (!first || !second) return;

    session.answers[first.id] = first.type === 'true-false' ? String(first.correctAnswer) as 'true' | 'false' : first.correctOption;
    session.answers[second.id] = first.type === 'multiple-choice' ? 'c' : 'false';

    const results = scoreQuiz(session);

    expect(results.correct).toBe(1);
    expect(results.incorrect).toBe(1);
    expect(results.unanswered).toBe(0);

    delete session.answers[second.id];
    expect(scoreQuiz(session).unanswered).toBe(1);
  });
});

describe('stored session validation', () => {
  it('accepts a current session whose chapters, question ids, and count match the bank', () => {
    const session = createQuizSession(bank, [1, 2], 2, () => 0.25);

    expect(validateStoredSession(bank, session)).toEqual(session);
  });

  it('rejects stale or malformed sessions', () => {
    const session = createQuizSession(bank, [1, 2], 2, () => 0.25);

    expect(validateStoredSession(bank, { ...session, questions: [{ ...session.questions[0], id: 'missing' }] })).toBeNull();
    expect(validateStoredSession(bank, { ...session, selectedChapters: [1], countPerChapter: 2 })).toBeNull();
    expect(validateStoredSession(bank, { ...session, countPerChapter: 3 })).toBeNull();
    expect(validateStoredSession(bank, { ...session, answers: { [session.questions[0]?.id ?? '']: 'not-valid' } })).toBeNull();
    expect(validateStoredSession(bank, 'not a session')).toBeNull();
  });
});

function makeQuestion(id: string, chapter: 1 | 2, answer: 'a' | 'b' | true | false): Question {
  if (typeof answer === 'boolean') {
    return {
      id,
      chapter,
      type: 'true-false' as const,
      prompt: `${id} prompt placeholder`,
      correctAnswer: answer,
      reference: `${id} reference placeholder`
    };
  }

  return {
    id,
    chapter,
    type: 'multiple-choice' as const,
    prompt: `${id} prompt placeholder`,
    options: [
      { id: 'a' as const, text: 'Option A' },
      { id: 'b' as const, text: 'Option B' },
      { id: 'c' as const, text: 'Option C' }
    ],
    correctOption: answer,
    reference: `${id} reference placeholder`
  };
}
