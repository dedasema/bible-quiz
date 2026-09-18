import { describe, expect, it } from 'vitest';
import { parseQuestionBank } from '../src/lib/questionBank';

describe('question bank validation', () => {
  it('accepts an empty externally authored bank placeholder', () => {
    expect(() => parseQuestionBank({
      metadata: {
        book: 'Romans',
        translation: 'Reina-Valera 1960',
        version: 1,
        source: 'external'
      },
      questions: []
    })).not.toThrow();
  });

  it('accepts the approved multiple-choice and true-false fields', () => {
    const bank = parseQuestionBank({
      metadata: {
        book: 'Romans',
        translation: 'Reina-Valera 1960',
        version: 1,
        source: 'external'
      },
      questions: [
        { ...makeMultipleChoiceQuestion('q1', 1), verseText: 'Externally supplied verse text' },
        makeTrueFalseQuestion('q2', 1)
      ]
    });

    expect(bank.questions[0]).toMatchObject({
      type: 'multiple-choice',
      correctOption: 'a',
      options: [
        { id: 'a', text: 'Option A' },
        { id: 'b', text: 'Option B' },
        { id: 'c', text: 'Option C' }
      ],
      verseText: 'Externally supplied verse text'
    });
    expect(bank.questions[1]).toMatchObject({ type: 'true-false', correctAnswer: true });
  });

  it('rejects the legacy options object and answer field', () => {
    expect(() => parseQuestionBank({
      metadata: {
        book: 'Romans',
        translation: 'Reina-Valera 1960',
        version: 1,
        source: 'external'
      },
      questions: [{
        id: 'q1',
        chapter: 1,
        type: 'multiple-choice',
        prompt: 'Externally authored prompt placeholder',
        options: {
          a: 'Option A',
          b: 'Option B',
          c: 'Option C'
        },
        answer: 'a',
        reference: 'Romans placeholder reference'
      }]
    })).toThrow(/options/);
  });

  it('rejects duplicate question ids with an actionable path', () => {
    expect(() => parseQuestionBank({
      metadata: {
        book: 'Romans',
        translation: 'Reina-Valera 1960',
        version: 1,
        source: 'external'
      },
      questions: [
        makeMultipleChoiceQuestion('q1', 1),
        makeTrueFalseQuestion('q1', 2)
      ]
    })).toThrow(/questions\.1\.id: Id de pregunta duplicado: q1/);
  });

  it('rejects chapters outside Romans 1-16', () => {
    expect(() => parseQuestionBank({
      metadata: {
        book: 'Romans',
        translation: 'Reina-Valera 1960',
        version: 1,
        source: 'external'
      },
      questions: [makeMultipleChoiceQuestion('q1', 17)]
    })).toThrow(/chapter/);
  });
});

function makeMultipleChoiceQuestion(id: string, chapter: number): Record<string, unknown> {
  return {
    id,
    chapter,
    type: 'multiple-choice',
    prompt: 'Externally authored prompt placeholder',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
      { id: 'c', text: 'Option C' }
    ],
    correctOption: 'a',
    reference: 'Romans placeholder reference'
  };
}

function makeTrueFalseQuestion(id: string, chapter: number): Record<string, unknown> {
  return {
    id,
    chapter,
    type: 'true-false',
    prompt: 'Externally authored true-false prompt placeholder',
    correctAnswer: true,
    reference: 'Romans placeholder reference'
  };
}
