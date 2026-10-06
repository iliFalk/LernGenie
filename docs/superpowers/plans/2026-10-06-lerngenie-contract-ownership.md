# LernGenie: Contract Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server wrapper own the contract for every AI artifact — the model returns data only; the wrapper builds the prompt, extracts JSON, normalises, validates, stores with a version, and returns the exact shape the React client already reads.

**Architecture:** Four layers, one owner each. `src/contracts/*` owns type + normaliser + validator per artifact (`quiz`, `flashcards`, `analysis`, `text`). `src/ai/prompts.ts` owns prompt text; `src/ai/gateway.ts` owns the single entry point `generateArtifact(kind, input, config, deps)`: build → call → extract JSON → normalise → validate → one repair retry → typed result or typed error. `src/ai/store.ts` owns typed persistence plus a per-artifact `schema_version` (a bump invalidates old rows). `server.ts` stays thin: it calls the gateway/store and returns the contract only, every failure as `{error, code}`.

**Tech Stack:** Node 22, Express 4, TypeScript via `tsx`, better-sqlite3, React 19 + Vite 6. Tests: `node --test` driven through the existing `tsx` loader — no new dependency.

**Spec:** the kanban task body `t_b1be270f` (Ilja's rule, 2026-10-06) — this plan implements it verbatim.

## Global Constraints

- **No new dependency.** Validators and tests use the platform (`node --test`). `tsx` is already a devDependency.
- **Text artifacts stay prose.** `study-guide`, the topic Lernskript and OCR have the contract `{text: string}`; only `quiz`, `flashcards`, `analysis` are JSON.
- **Options carry no letter prefix** in the payload. The UI renders the `A)`, `B)` … badge itself (`QuizView.tsx:158`); the normaliser strips a prefix if a model still sends one.
- **`schema_version` per artifact** in `package_cache`. A row whose version is older than the code's is regenerated on read.
- **One repair retry, then a typed error.** A model answer that still fails its validator yields `{error, code}` with HTTP 500 — a 200 with a broken shape must be impossible.
- **Prompts: data + output contract only.** Keep the didactic German text; drop presentation and wording rules.
- **The client is unchanged.** Same routes, same keys, same types; compare against `src/types.ts`.
- **Do not push.** Do not touch the homelab host `falknest`, its clone, container or env.

## Review Focus

Most likely to bite a user, most likely first:

1. A question whose `correctIndex` cannot be resolved (`-1`) must never reach the client — it scored every answer wrong before. → pinned by `validateQuiz` rejecting out-of-range `correctIndex` (Task 1) and by the gateway repair/typed-error test (Task 5).
2. A model answer where the top-level JSON is an object with the list under `Quiz`/`quiz`/`Fragen` — `activeQuiz.length` on an object is `undefined`, the empty quiz screen. → pinned by `normaliseQuiz` returning a real array for every captured key style (Task 1) and the shape test (Task 2).
3. JSON wrapped in prose or a ```json fence, and trailing commas. → pinned by `extractJson` tests (Task 3).
4. A cached row with an old or absent `schema_version` (today's broken package). → pinned by the store test "stale version regenerates" (Task 6).
5. A provider/network failure must surface as a typed error, not an empty 200. → pinned by the gateway provider-error test (Task 5).

---

### Task 1: Contracts — quiz

**Files:**
- Create: `src/contracts/quiz.ts`
- Test: `test/quiz.contract.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export interface QuizQuestion { id: string; text: string; options: string[]; correctIndex: number; hint: string; explanation: string; topic: string }` (structurally equal to `Question` in `src/types.ts`)
  - `export const QUIZ_SCHEMA_VERSION = 1`
  - `export function resolveCorrectIndex(value: unknown, options: string[]): number`
  - `export function normaliseQuiz(raw: unknown): QuizQuestion[]`
  - `export function validateQuiz(value: unknown): { ok: true; value: QuizQuestion[] } | { ok: false; error: string }`

- [ ] **Step 1: Write failing tests** — `test/quiz.contract.test.ts`

Captured real key styles, all must normalise to the contract array:
`{"Quiz":[{"Question":"…","CorrectAnswer":"C) Zellkern"}]}` (PascalCase), `{"quiz":[{"question":"…","options":["A) …","B) …"],"correct_answer":"B"}]}` (lowercase), German keys `{"quiz":[{"Frage":"…","Optionen":["…","…"],"RichtigeAntwort":"B"}]}`, a question with no answer key (→ `correctIndex -1`), JSON wrapped in prose + ```json fence, options with and without `A)` prefixes (→ bare texts).

`resolveCorrectIndex` cases: `"B"` → 1; `"B) Meiose"` → 1; `1` → 0 (1-based); `0` → 0 (0-based); `"0"` → 0; the exact option text → its index; unresolvable → -1.

`validateQuiz`: rejects `-1` `correctIndex`, rejects an object without a list, rejects a question with fewer than 2 options, accepts a well-formed array.

- [ ] **Step 2: Run and watch it fail** — `npx tsx --test test/quiz.contract.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/contracts/quiz.ts`** — port `pickKey`/`asStringArray`/`resolveCorrectIndex` from `normalise.ts`, add `stripOptionPrefix` (remove a leading `A)`/`A.`/`A:` only when a remainder remains), add the strict validator.

- [ ] **Step 4: Run and watch it pass.**

- [ ] **Step 5: Commit** — `git add src/contracts/quiz.ts test/quiz.contract.test.ts && git commit -m "feat(contracts): quiz type, normaliser and validator"`

### Task 2: Contracts — flashcards, analysis, text

**Files:** Create `src/contracts/flashcards.ts`, `src/contracts/analysis.ts`, `src/contracts/text.ts`; Test `test/other-contracts.test.ts`

**Interfaces — Produces:**
- `Flashcard { front: string; back: string }`, `FLASHCARDS_SCHEMA_VERSION`, `normaliseFlashcards`, `validateFlashcards`
- `AnalysisData { strengths: string[]; growthAreas: string[]; topicPerformance: { topic: string; score: number; total: number }[] }`, `ANALYSIS_SCHEMA_VERSION`, `normaliseAnalysis`, `validateAnalysis`
- `TextArtifact { text: string }`, `STUDY_GUIDE_SCHEMA_VERSION`, `normaliseText`, `validateText`

- [ ] **Step 1: Failing tests** for each: flashcards from `{"flashcards":[{"front","back"}]}` and German variants; analysis from PascalCase and German keys, arrays coerced, `topicPerformance` mapped; text is `{text}` with a non-empty string required. Include the captured fences/prose for flashcards.
- [ ] **Step 2: Watch fail.** `npx tsx --test test/other-contracts.test.ts`
- [ ] **Step 3: Implement the three files** (port the matching functions from `normalise.ts`; strict validators).
- [ ] **Step 4: Watch pass.**
- [ ] **Step 5: Commit** — `feat(contracts): flashcards, analysis and text contracts`

### Task 3: Route shape equals client shape

**Files:** Test `test/shape.contract.test.ts`

**Interfaces:** consumes the four contracts and `src/types.ts`.

- [ ] **Step 1: Failing test** — runtime: the key set of a normalised quiz item equals `["id","text","options","correctIndex","hint","explanation","topic"]`; a flashcard equals `["front","back"]`; analysis equals `["strengths","growthAreas","topicPerformance"]` with entry keys `["topic","score","total"]`. Static: `const q: Question = normaliseQuiz(sample)[0]` compiles (checked by `tsc --noEmit`).
- [ ] **Step 2: Watch fail** (import errors), **Step 3:** no production change needed if Tasks 1–2 are correct — adjust normalisers if a key differs. **Step 4: Watch pass.**
- [ ] **Step 5: Commit** — `test(contracts): pin route shape to src/types.ts`

### Task 4: Tolerant JSON extraction

**Files:** Create `src/ai/extract.ts`; Test `test/extract.test.ts`

**Interfaces — Produces:** `extractJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string }`

- [ ] **Step 1: Failing tests** — plain JSON; JSON inside a ```json fence; JSON with prose before and after; trailing commas in an object and an array; an array top level; input with no JSON → `ok:false`.
- [ ] **Step 2: Watch fail.** **Step 3: Implement** — strip fences, find the first `{`/`[`, scan to its balanced close (string- and escape-aware), drop trailing commas, `JSON.parse`.
- [ ] **Step 4: Watch pass.** **Step 5: Commit** — `feat(ai): tolerant JSON extraction`

### Task 5: AI gateway

**Files:** Create `src/ai/prompts.ts`, `src/ai/gateway.ts`; Test `test/gateway.test.ts`

**Interfaces — Produces:**
- `buildPrompt(kind, input): { prompt: string; isJson?: boolean; useFlashModel?: boolean; imageData?: { data: string; mimeType: string } }`
- `type ArtifactKind = "quiz" | "flashcards" | "analysis" | "text"`
- `generateArtifact<T>(kind, input, config, deps?): Promise<{ ok: true; value: T; repaired: boolean } | { ok: false; error: { code: string; message: string } }>` where `deps.callModel` defaults to `callLLM`.

- [ ] **Step 1: Failing tests** with a stub provider (no network): a good answer passes with one call; a broken answer then a good one passes with exactly two calls and `repaired:true`; a broken answer twice yields `ok:false` with a code and exactly two calls; a provider throw yields `ok:false` code `AI_PROVIDER`. Also: a quiz answer whose `correctIndex` is missing triggers the repair.
- [ ] **Step 2: Watch fail.** **Step 3: Implement** `prompts.ts` (data + output contract; didactic text kept) and `gateway.ts` (build → call → extract → normalise → validate → one repair with the validation error → typed result/error).
- [ ] **Step 4: Watch pass.** **Step 5: Commit** — `feat(ai): single gateway with validate + one repair retry`

### Task 6: Versioned store

**Files:** Create `src/ai/store.ts`; Test `test/store.test.ts`

**Interfaces — Produces:**
- `ensureCacheSchema(db): void` — adds `quiz_version`, `flashcards_version`, `study_guide_version` if absent.
- `readCachedArtifact(db, packageId, kind): QuizQuestion[] | Flashcard[] | TextArtifact | null` — `null` when missing, stale version, unparsable or failing its validator.
- `writeCachedArtifact(db, packageId, kind, value): void` — upsert data + current version.

- [ ] **Step 1: Failing test** on `new Database(":memory:")`: after write+read a current row is served; after `UPDATE … SET quiz_version = 0` the read returns `null` (stale → regenerate); a row holding invalid JSON returns `null`.
- [ ] **Step 2: Watch fail.** **Step 3: Implement.** **Step 4: Watch pass.** **Step 5: Commit** — `feat(ai): versioned artifact store + migration`

### Task 7: Thin surface

**Files:** Modify `server.ts`; delete `normalise.ts`, `src/prompts/index.ts`; modify `package.json` (add `"test": "tsx --test test/*.test.ts"`)

- [ ] **Step 1:** Replace the five JSON routes and the three cached routes with `generateArtifact` / `readCachedArtifact` / `writeCachedArtifact`; every failure returns `{error, code}` with 500 (400 for "no materials", 403 for unauthorized). Route OCR, topic and study-guide through the gateway too.
- [ ] **Step 2: Verify by grep** — `JSON.parse(response)` absent from route bodies; `Prompts`/`prompt` construction absent from `server.ts`.
- [ ] **Step 3: Commit** — `refactor(server): routes return the contract only`

### Task 8: Full gate

- [ ] **Step 1:** `npm ci` (clean) — already run.
- [ ] **Step 2:** `npx tsc --noEmit` — green.
- [ ] **Step 3:** `npm run build` — green.
- [ ] **Step 4:** `npm test` (`tsx --test test/*.test.ts`) — green, raw output captured for the report.
- [ ] `git diff --stat main`, `git log --oneline main..HEAD`.

## Self-Review

- **Spec coverage:** quiz/ flashcards/ analysis/ text contracts → Tasks 1–3; gateway entry with extract + one repair → Tasks 4–5; versioned store + migration → Task 6; thin routes + `{error, code}` → Task 7; no new dependency → `tsx` only; client unchanged → Task 3.
- **Type consistency:** contract types are structurally identical to `src/types.ts` (`Question`, `AnalysisData`, flashcards); the store and routes use the same names.
- **Review Focus:** each of the five items has a named test in its owning task.
- **Proportion:** the plan names files, signatures and tests; bodies stay in the code.
