import { parseQuestionBank, type Chapter, type QuestionBank, type UserAnswer } from './questionBank';
import {
  createQuizSession,
  getChapterCounts,
  getMaxCountForSelection,
  ROMANS_CHAPTERS,
  scoreQuiz,
  validateQuizSelection,
  validateStoredSession,
  type ChapterCounts,
  type QuizSession
} from './quiz';

const STORAGE_KEY = 'romanos-quiz-session-v1';

type View = 'welcome' | 'quiz' | 'results';

type AppState = {
  bank: QuestionBank;
  session: QuizSession | null;
  view: View;
};

export function getStartFormControlState(
  counts: ChapterCounts,
  selectedChapters: Chapter[],
  countPerChapter: number,
  hasQuestions: boolean
): { max: number; canStart: boolean; helpText: string } {
  const max = getMaxCountForSelection(counts, selectedChapters);
  const validationErrors = validateQuizSelection(counts, selectedChapters, countPerChapter);

  return {
    max,
    canStart: hasQuestions && max >= 1 && validationErrors.length === 0,
    helpText: selectedChapters.length === 0
      ? 'Seleccioná capítulos para ver el máximo disponible.'
      : `Máximo ${max} por capítulo seleccionado (${selectedChapters.length * max} en total).`
  };
}

export function initRomanosQuiz(input: unknown): void {
  const root = document.querySelector<HTMLElement>('[data-quiz-root]');
  if (!root) {
    return;
  }

  let bank: QuestionBank;

  try {
    bank = parseQuestionBank(input);
  } catch (error) {
    root.innerHTML = renderError(error instanceof Error ? error.message : 'Banco de preguntas inválido.');
    return;
  }

  const storedSession = loadSession(bank);
  const state: AppState = {
    bank,
    session: storedSession,
    view: storedSession ? 'quiz' : 'welcome'
  };

  render(root, state);
}

function render(root: HTMLElement, state: AppState): void {
  if (state.view === 'welcome') {
    renderWelcome(root, state);
  } else if (state.view === 'quiz') {
    renderQuiz(root, state);
  } else {
    renderResults(root, state);
  }
}

function renderWelcome(root: HTMLElement, state: AppState): void {
  const counts = getChapterCounts(state.bank);
  const hasQuestions = state.bank.questions.length > 0;

  root.innerHTML = `
    <section class="mx-auto flex w-full max-w-3xl flex-col gap-6 rounded-3xl bg-white/95 p-5 text-slate-950 shadow-2xl sm:p-8" aria-labelledby="welcome-heading">
      <div class="space-y-3">
        <p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Quiz bíblico de Romanos</p>
        <h1 id="welcome-heading" class="text-3xl font-bold tracking-tight sm:text-4xl">Practicá por capítulo</h1>
        <p class="text-base text-slate-700">Elegí uno o más capítulos de Romanos. La cantidad de preguntas se limita por el capítulo seleccionado con menos preguntas disponibles.</p>
      </div>

      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
        ${hasQuestions ? `${state.bank.questions.length} preguntas cargadas.` : 'Todavía no hay preguntas cargadas. Reemplazá src/data/romanos.json con contenido externo para iniciar un quiz.'}
      </div>

      <form data-start-form class="space-y-6">
        <fieldset class="space-y-3">
          <legend class="text-lg font-semibold">Seleccioná capítulos</legend>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${ROMANS_CHAPTERS.map((chapter) => `
              <label class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium">
                <span>Capítulo ${chapter}</span>
                <span class="text-xs text-slate-500">${counts[chapter]}</span>
                <input class="h-5 w-5 accent-amber-600" type="checkbox" name="chapter" value="${chapter}" ${counts[chapter] === 0 ? 'disabled' : ''} />
              </label>
            `).join('')}
          </div>
        </fieldset>

        <div class="space-y-2">
          <label for="count" class="block text-lg font-semibold">Preguntas por capítulo seleccionado</label>
          <input id="count" name="count" type="number" min="1" value="1" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" ${hasQuestions ? '' : 'disabled'} />
          <p data-count-help class="text-sm text-slate-600">Seleccioná capítulos para ver el máximo disponible.</p>
        </div>

        <div data-form-errors class="hidden rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert"></div>

        <button data-start-button type="submit" class="w-full rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-300" ${hasQuestions ? '' : 'disabled'}>
          Empezar quiz
        </button>
      </form>
    </section>
  `;

  const form = root.querySelector<HTMLFormElement>('[data-start-form]');
  const countInput = root.querySelector<HTMLInputElement>('#count');
  const help = root.querySelector<HTMLElement>('[data-count-help]');
  const errors = root.querySelector<HTMLElement>('[data-form-errors]');
  const startButton = root.querySelector<HTMLButtonElement>('[data-start-button]');

  const hideErrors = (): void => {
    if (!errors) return;
    errors.classList.add('hidden');
    errors.textContent = '';
  };

  const refreshControls = (): void => {
    const selectedChapters = getSelectedChapters(form);
    const count = parseCountValue(countInput);
    const controlState = getStartFormControlState(counts, selectedChapters, count, hasQuestions);
    const validationErrors = validateQuizSelection(counts, selectedChapters, count);

    if (help) {
      help.textContent = controlState.helpText;
    }

    if (countInput) {
      countInput.min = '1';
      countInput.max = String(controlState.max);
      countInput.disabled = !hasQuestions;
    }

    if (startButton) {
      startButton.disabled = !controlState.canStart;
    }

    if (validationErrors.length === 0) {
      hideErrors();
    }
  };

  form?.addEventListener('change', refreshControls);
  countInput?.addEventListener('input', refreshControls);
  refreshControls();

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedChapters = getSelectedChapters(form);
    const count = parseCountValue(countInput);

    try {
      const session = createQuizSession(state.bank, selectedChapters, count);
      saveSession(session);
      state.session = session;
      state.view = 'quiz';
      render(root, state);
    } catch (error) {
      if (errors) {
        errors.classList.remove('hidden');
        errors.textContent = error instanceof Error ? error.message : 'No se pudo iniciar el quiz.';
      }
      refreshControls();
    }
  });
}

function renderQuiz(root: HTMLElement, state: AppState): void {
  const session = state.session;

  if (!session) {
    state.view = 'welcome';
    render(root, state);
    return;
  }

  const question = session.questions[session.currentIndex];
  if (!question) {
    state.view = 'results';
    render(root, state);
    return;
  }

  const selectedAnswer = session.answers[question.id];
  const progress = `${session.currentIndex + 1} de ${session.questions.length}`;

  root.innerHTML = `
    <section class="mx-auto flex w-full max-w-3xl flex-col gap-5 rounded-3xl bg-white/95 p-5 text-slate-950 shadow-2xl sm:p-8" aria-labelledby="question-heading">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="font-semibold text-amber-700">Pregunta ${progress}</p>
        <button data-reset class="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Reiniciar</button>
      </div>
      <div class="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div class="h-full bg-amber-500" style="width: ${((session.currentIndex + 1) / session.questions.length) * 100}%"></div>
      </div>
      <article class="space-y-4">
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">Romanos ${question.chapter}</p>
        <h2 id="question-heading" class="text-2xl font-bold leading-tight">${escapeHtml(question.prompt)}</h2>
        <form data-answer-form class="space-y-3">
          ${renderAnswerOptions(question, selectedAnswer)}
        </form>
      </article>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button data-prev class="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-100" ${session.currentIndex === 0 ? 'disabled' : ''}>Anterior</button>
        <button data-clear class="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-100">Borrar</button>
        <button data-next class="rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700">${session.currentIndex === session.questions.length - 1 ? 'Ver resultados' : 'Siguiente'}</button>
        <button data-results class="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950 hover:bg-amber-400">Terminar ahora</button>
      </div>
    </section>
  `;

  root.querySelector('[data-answer-form]')?.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input) return;
    session.answers[question.id] = input.value as UserAnswer;
    saveSession(session);
  });

  root.querySelector('[data-prev]')?.addEventListener('click', () => {
    session.currentIndex = Math.max(0, session.currentIndex - 1);
    saveSession(session);
    render(root, state);
  });

  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    delete session.answers[question.id];
    saveSession(session);
    render(root, state);
  });

  root.querySelector('[data-next]')?.addEventListener('click', () => {
    if (session.currentIndex === session.questions.length - 1) {
      state.view = 'results';
    } else {
      session.currentIndex += 1;
    }
    saveSession(session);
    render(root, state);
  });

  root.querySelector('[data-results]')?.addEventListener('click', () => {
    state.view = 'results';
    saveSession(session);
    render(root, state);
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    resetSession();
    state.session = null;
    state.view = 'welcome';
    render(root, state);
  });
}

function renderResults(root: HTMLElement, state: AppState): void {
  const session = state.session;

  if (!session) {
    state.view = 'welcome';
    render(root, state);
    return;
  }

  const results = scoreQuiz(session);

  root.innerHTML = `
    <section class="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl bg-white/95 p-5 text-slate-950 shadow-2xl sm:p-8" aria-labelledby="results-heading">
      <div class="space-y-2">
        <p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Resultados finales</p>
        <h1 id="results-heading" class="text-3xl font-bold">${results.correct}/${results.total} correctas</h1>
      </div>
      <dl class="grid grid-cols-3 gap-3 text-center">
        <div class="rounded-2xl bg-emerald-50 p-4"><dt class="text-sm text-emerald-800">Correctas</dt><dd class="text-2xl font-bold">${results.correct}</dd></div>
        <div class="rounded-2xl bg-red-50 p-4"><dt class="text-sm text-red-800">Incorrectas</dt><dd class="text-2xl font-bold">${results.incorrect}</dd></div>
        <div class="rounded-2xl bg-slate-100 p-4"><dt class="text-sm text-slate-700">Sin responder</dt><dd class="text-2xl font-bold">${results.unanswered}</dd></div>
      </dl>
      <ol class="space-y-4">
        ${results.details.map((detail, index) => `
          <li class="rounded-2xl border border-slate-200 p-4">
            <p class="text-sm font-semibold ${statusClass(detail.status)}">${index + 1}. ${formatStatus(detail.status)}</p>
            <h2 class="mt-2 font-bold">${escapeHtml(detail.question.prompt)}</h2>
            ${detail.question.verseText ? `<blockquote class="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-slate-800">${escapeHtml(detail.question.verseText)}</blockquote>` : ''}
            <p class="mt-2 text-sm text-slate-700">Tu respuesta: ${formatUserAnswer(detail.answer)}</p>
            <p class="text-sm text-slate-700">Respuesta correcta: ${formatCorrectAnswer(detail.question)}</p>
            <p class="mt-2 text-sm font-semibold text-slate-800">Referencia: ${escapeHtml(detail.question.reference)}</p>
          </li>
        `).join('')}
      </ol>
      <div class="grid gap-3 sm:grid-cols-2">
        <button data-back class="rounded-xl border border-slate-300 px-4 py-3 font-semibold hover:bg-slate-100">Volver al quiz</button>
        <button data-reset class="rounded-xl bg-amber-500 px-4 py-3 font-bold text-slate-950 hover:bg-amber-400">Empezar de nuevo</button>
      </div>
    </section>
  `;

  root.querySelector('[data-back]')?.addEventListener('click', () => {
    state.view = 'quiz';
    render(root, state);
  });

  root.querySelector('[data-reset]')?.addEventListener('click', () => {
    resetSession();
    state.session = null;
    state.view = 'welcome';
    render(root, state);
  });
}

function getSelectedChapters(form: HTMLFormElement | null): Chapter[] {
  if (!form) {
    return [];
  }

  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="chapter"]:checked'))
    .map((input) => Number(input.value) as Chapter);
}

function parseCountValue(input: HTMLInputElement | null): number {
  const rawValue = input?.value.trim() ?? '';
  return rawValue === '' ? Number.NaN : Number(rawValue);
}

function renderAnswerOptions(question: QuizSession['questions'][number], selectedAnswer: UserAnswer | undefined): string {
  if (question.type === 'multiple-choice') {
    return question.options.map((option) => renderRadio(option.id, option.text, selectedAnswer === option.id)).join('');
  }

  return [
    renderRadio('true', 'Verdadero', selectedAnswer === 'true'),
    renderRadio('false', 'Falso', selectedAnswer === 'false')
  ].join('');
}

function renderRadio(value: UserAnswer, label: string, checked: boolean): string {
  return `
    <label class="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base font-medium hover:bg-amber-50">
      <input class="mt-1 h-5 w-5 accent-amber-600" type="radio" name="answer" value="${value}" ${checked ? 'checked' : ''} />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function saveSession(session: QuizSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function loadSession(bank: QuestionBank): QuizSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = validateStoredSession(bank, JSON.parse(raw));
    if (!session) resetSession();
    return session;
  } catch {
    resetSession();
    return null;
  }
}

function resetSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function formatUserAnswer(answer: UserAnswer | undefined): string {
  if (answer === undefined) return 'Sin responder';
  if (answer === 'true') return 'Verdadero';
  if (answer === 'false') return 'Falso';
  return answer.toUpperCase();
}

function formatCorrectAnswer(question: QuizSession['questions'][number]): string {
  if (question.type === 'true-false') {
    return question.correctAnswer ? 'Verdadero' : 'Falso';
  }

  const correctOption = question.options.find((option) => option.id === question.correctOption);
  return `${question.correctOption.toUpperCase()}: ${escapeHtml(correctOption?.text ?? '')}`;
}

function formatStatus(status: 'correct' | 'incorrect' | 'unanswered'): string {
  if (status === 'correct') return 'Correcta';
  if (status === 'incorrect') return 'Incorrecta';
  return 'Sin responder';
}

function statusClass(status: 'correct' | 'incorrect' | 'unanswered'): string {
  if (status === 'correct') return 'text-emerald-700';
  if (status === 'incorrect') return 'text-red-700';
  return 'text-slate-600';
}

function renderError(message: string): string {
  return `
    <section class="mx-auto max-w-2xl rounded-3xl bg-red-50 p-6 text-red-950" role="alert">
      <h1 class="text-2xl font-bold">Falló la validación del banco de preguntas</h1>
      <pre class="mt-4 whitespace-pre-wrap text-sm">${escapeHtml(message)}</pre>
    </section>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
