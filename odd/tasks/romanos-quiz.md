# Feature: Romanos Bible Quiz

## Goal
Build a mobile-first Astro quiz for the book of Romans (Reina-Valera 1960) that consumes an externally authored question bank.

## Constraints
- The question bank is authored outside this implementation; do not invent Bible questions.
- Supported MVP question types: multiple-choice with options a/b/c and true/false.
- User selects one or more chapters (1–16).
- User selects a question count per selected chapter.
- The count must not exceed the available questions in any selected chapter.
- Questions are sampled randomly without repetition, then mixed.
- Correction is shown at the end, including correctness and biblical reference.
- Unanswered questions are allowed and reported separately.
- Resume state is stored locally in the browser.
- Static deployment target: Netlify; source target: GitHub.
- No remote database or AI evaluation in the MVP.

## Tasks
1. Scaffold Astro, TypeScript strict mode, Tailwind, lint/format/test tooling, and static deployment configuration.
2. Define the external JSON question-bank contract and build-time validation without authoring question content.
3. Implement chapter selection, dynamic per-chapter count validation, randomized question selection, and quiz navigation.
4. Implement localStorage resume/reset and final result review with references.
5. Verify the user flow, validation edge cases, accessibility basics, and production build.

## Acceptance Criteria
- The app builds without a question bank containing invented content.
- The supplied bank can contain any positive number of questions per chapter.
- Invalid bank records fail validation with actionable errors.
- A selected count is valid only when every selected chapter has at least that many questions.
- A quiz contains exactly count × selected-chapters questions, with no duplicate IDs.
- Refreshing or reopening the page can resume an in-progress session.
- Final results distinguish correct, incorrect, and unanswered responses and show references.
- The app remains static-compatible with Netlify.

## Evidence
- Status: planned; implementation not started.
