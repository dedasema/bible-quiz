# Romans Bible Quiz

Mobile-first Astro foundation for a Romans quiz using an externally authored JSON question bank. The app ships with an empty valid placeholder and does not include authored Bible questions.

## Commands

```bash
npm run dev
npm run test
npm run build
```

## Question bank contract

Replace `src/data/romanos.json` with externally authored content. The bank is validated at build time and in the browser.

```json
{
  "metadata": {
    "book": "Romans",
    "translation": "Reina-Valera 1960",
    "version": 1,
    "source": "External source description"
  },
  "questions": [
    {
      "id": "romans-1-example-1",
      "chapter": 1,
      "type": "multiple-choice",
      "prompt": "Externally authored prompt",
      "verseText": "Optional externally supplied verse text",
      "options": [
        { "id": "a", "text": "Option A" },
        { "id": "b", "text": "Option B" },
        { "id": "c", "text": "Option C" }
      ],
      "correctOption": "a",
      "reference": "Romans 1:1"
    },
    {
      "id": "romans-1-example-2",
      "chapter": 1,
      "type": "true-false",
      "prompt": "Externally authored prompt",
      "correctAnswer": true,
      "reference": "Romans 1:2"
    }
  ]
}
```

Rules:

- `chapter` must be an integer from 1 to 16.
- `id` values must be unique.
- `verseText` is optional and must be externally supplied when present; the app does not invent Bible text.
- Multiple-choice questions require an `options` array of exactly three objects with ids `a`, `b`, and `c`, plus `correctOption` set to `a`, `b`, or `c`.
- True/false questions use a boolean `correctAnswer`.
- `questions` may be empty; there is no fixed per-chapter or 20-question requirement.

## Quiz behavior

- Users select one or more chapters.
- The per-chapter question count is limited by the smallest selected chapter pool.
- Questions are randomly sampled without repetition per chapter, then mixed into one final quiz.
- Users may leave questions unanswered.
- Results separate correct, incorrect, and unanswered answers, display each question reference, and display optional `verseText` when provided.
- In-progress sessions are saved in `localStorage`; stale or malformed saved sessions are ignored and can be reset from the UI.

## Deployment

The project is static-compatible and includes `netlify.toml` with `npm run build` publishing `dist`.
