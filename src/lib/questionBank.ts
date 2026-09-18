import { z } from 'zod';

const chapterSchema = z.number().int().min(1).max(16);
const optionKeySchema = z.enum(['a', 'b', 'c']);

const baseQuestionSchema = z.object({
  id: z.string().trim().min(1, 'El id de la pregunta es obligatorio.'),
  chapter: chapterSchema,
  prompt: z.string().trim().min(1, 'La consigna es obligatoria.'),
  verseText: z.string().trim().min(1, 'El texto del versículo no puede estar vacío.').optional(),
  reference: z.string().trim().min(1, 'La referencia bíblica es obligatoria.')
});

const optionSchema = z.object({
  id: optionKeySchema,
  text: z.string().trim().min(1, 'El texto de la opción es obligatorio.')
});

const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('multiple-choice'),
  options: z.tuple([
    optionSchema.extend({ id: z.literal('a') }),
    optionSchema.extend({ id: z.literal('b') }),
    optionSchema.extend({ id: z.literal('c') })
  ]),
  correctOption: optionKeySchema
});

const trueFalseQuestionSchema = baseQuestionSchema.extend({
  type: z.literal('true-false'),
  correctAnswer: z.boolean()
});

export const questionSchema = z.discriminatedUnion('type', [
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema
]);

export const questionBankSchema = z
  .object({
    metadata: z.object({
      book: z.string().trim().min(1, 'El libro es obligatorio en la metadata.'),
      translation: z.string().trim().min(1, 'La traducción es obligatoria en la metadata.'),
      version: z.number().int().positive('La versión de metadata debe ser un entero positivo.'),
      source: z.string().trim().min(1, 'La fuente es obligatoria en la metadata.')
    }),
    questions: z.array(questionSchema)
  })
  .superRefine((bank, ctx) => {
    const seen = new Set<string>();

    for (const [index, question] of bank.questions.entries()) {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['questions', index, 'id'],
          message: `Id de pregunta duplicado: ${question.id}`
        });
      }

      seen.add(question.id);
    }
  });

export type OptionId = z.infer<typeof optionKeySchema>;
export type MultipleChoiceOption = z.infer<typeof optionSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type TrueFalseQuestion = z.infer<typeof trueFalseQuestionSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionBank = z.infer<typeof questionBankSchema>;
export type Chapter = Question['chapter'];
export type UserAnswer = OptionId | 'true' | 'false';

export function parseQuestionBank(input: unknown): QuestionBank {
  const result = questionBankSchema.safeParse(input);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'bank'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Banco de preguntas de Romanos inválido:\n${message}`);
  }

  return result.data;
}
