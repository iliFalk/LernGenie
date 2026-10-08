/**
 * Typed per-artifact persistence with a `schema_version` per artifact.
 *
 * `package_cache` keeps one JSON blob per artifact plus a version column. A row
 * whose version is older than the code's constant is treated as absent, so a
 * shape change — like today's quiz that lost its answer — can never reach the
 * UI: the route regenerates instead.
 */

import { QUIZ_SCHEMA_VERSION, validateQuiz, type QuizQuestion } from "../contracts/quiz";
import { FLASHCARDS_SCHEMA_VERSION, validateFlashcards, type Flashcard } from "../contracts/flashcards";
import { STUDY_GUIDE_SCHEMA_VERSION, validateText, type TextArtifact } from "../contracts/text";
import type { ValidationResult } from "../contracts/util";

/** The slice of a better-sqlite3 handle this module needs (keeps the module easy to test). */
export interface CacheDatabase {
  prepare(sql: string): { get(...params: any[]): any; run(...params: any[]): any };
  exec(sql: string): any;
}

export type CacheKind = "quiz" | "flashcards" | "study-guide";

interface ColumnSpec {
  column: string;
  versionColumn: string;
  version: number;
}

const COLUMNS: Record<CacheKind, ColumnSpec> = {
  quiz: { column: "quiz_questions", versionColumn: "quiz_version", version: QUIZ_SCHEMA_VERSION },
  flashcards: { column: "flashcards", versionColumn: "flashcards_version", version: FLASHCARDS_SCHEMA_VERSION },
  "study-guide": { column: "study_guide", versionColumn: "study_guide_version", version: STUDY_GUIDE_SCHEMA_VERSION },
};

/** Adds the version columns to `package_cache` if they are missing. Safe to call on every start. */
export function ensureCacheSchema(db: CacheDatabase): void {
  for (const spec of Object.values(COLUMNS)) {
    try {
      db.exec(`ALTER TABLE package_cache ADD COLUMN ${spec.versionColumn} INTEGER`);
    } catch {
      // column already exists
    }
  }
}

function validate(kind: CacheKind, value: unknown): ValidationResult<unknown> {
  switch (kind) {
    case "quiz":
      return validateQuiz(value);
    case "flashcards":
      return validateFlashcards(value);
    case "study-guide":
      return validateText(value);
  }
}

export interface CacheReadOptions {
  /** Serve a row whose `schema_version` is older than the code. Used only to read the
   * previous question set, so a regeneration can exclude questions already asked. */
  ignoreVersion?: boolean;
}

export function readCachedArtifact(db: CacheDatabase, packageId: string, kind: "quiz", options?: CacheReadOptions): QuizQuestion[] | null;
export function readCachedArtifact(db: CacheDatabase, packageId: string, kind: "flashcards", options?: CacheReadOptions): Flashcard[] | null;
export function readCachedArtifact(db: CacheDatabase, packageId: string, kind: "study-guide", options?: CacheReadOptions): TextArtifact | null;
export function readCachedArtifact(db: CacheDatabase, packageId: string, kind: CacheKind, options: CacheReadOptions = {}): unknown {
  const spec = COLUMNS[kind];
  const row = db
    .prepare(`SELECT ${spec.column} AS data, ${spec.versionColumn} AS version FROM package_cache WHERE package_id = ?`)
    .get(packageId) as { data?: string | null; version?: number | null } | undefined;

  if (!row || !row.data) return null;
  if (!options.ignoreVersion && row.version !== spec.version) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    return null;
  }

  const result = validate(kind, parsed);
  return result.ok ? result.value : null;
}

export function writeCachedArtifact(db: CacheDatabase, packageId: string, kind: CacheKind, value: unknown): void {
  const spec = COLUMNS[kind];
  db.prepare("INSERT OR IGNORE INTO package_cache (package_id) VALUES (?)").run(packageId);
  db.prepare(`UPDATE package_cache SET ${spec.column} = ?, ${spec.versionColumn} = ? WHERE package_id = ?`).run(
    JSON.stringify(value),
    spec.version,
    packageId,
  );
}
