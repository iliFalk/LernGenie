import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

import { ensureCacheSchema, readCachedArtifact, writeCachedArtifact } from "../src/ai/store";
import { QUIZ_SCHEMA_VERSION } from "../src/contracts/quiz";

const setup = (): Database.Database => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE package_cache (
    package_id TEXT PRIMARY KEY,
    quiz_questions TEXT,
    flashcards TEXT,
    study_guide TEXT
  )`);
  ensureCacheSchema(db);
  return db;
};

const goodQuiz = [
  { id: "q1", text: "Wie teilt sich eine Körperzelle?", options: ["Mitose", "Meiose"], correctIndex: 0, hint: "", explanation: "", topic: "" },
];

test("a fresh write is served from the cache", () => {
  const db = setup();
  writeCachedArtifact(db, "p1", "quiz", goodQuiz);
  assert.deepEqual(readCachedArtifact(db, "p1", "quiz"), goodQuiz);
});

test("a stale schema_version is not served", () => {
  const db = setup();
  writeCachedArtifact(db, "p1", "quiz", goodQuiz);
  db.prepare("UPDATE package_cache SET quiz_version = ? WHERE package_id = ?").run(QUIZ_SCHEMA_VERSION - 1, "p1");
  assert.equal(readCachedArtifact(db, "p1", "quiz"), null);
});

test("a row with no version at all is not served", () => {
  const db = setup();
  db.prepare("INSERT INTO package_cache (package_id, quiz_questions, quiz_version) VALUES (?, ?, NULL)").run("p1", JSON.stringify(goodQuiz));
  assert.equal(readCachedArtifact(db, "p1", "quiz"), null);
});

test("an absent row is not served", () => {
  assert.equal(readCachedArtifact(setup(), "missing", "quiz"), null);
});

test("a row holding invalid JSON is not served", () => {
  const db = setup();
  db.prepare("INSERT INTO package_cache (package_id, quiz_questions, quiz_version) VALUES (?, ?, ?)").run("p1", "{not json", QUIZ_SCHEMA_VERSION);
  assert.equal(readCachedArtifact(db, "p1", "quiz"), null);
});

test("a row failing its contract is not served", () => {
  const db = setup();
  const broken = [{ id: "q1", text: "x", options: ["a", "b"], correctIndex: -1, hint: "", explanation: "", topic: "" }];
  db.prepare("INSERT INTO package_cache (package_id, quiz_questions, quiz_version) VALUES (?, ?, ?)").run("p1", JSON.stringify(broken), QUIZ_SCHEMA_VERSION);
  assert.equal(readCachedArtifact(db, "p1", "quiz"), null);
});

test("flashcards round-trip through the store", () => {
  const db = setup();
  const cards = [{ front: "f", back: "b" }];
  writeCachedArtifact(db, "p1", "flashcards", cards);
  assert.deepEqual(readCachedArtifact(db, "p1", "flashcards"), cards);
  db.prepare("UPDATE package_cache SET flashcards_version = 0 WHERE package_id = ?").run("p1");
  assert.equal(readCachedArtifact(db, "p1", "flashcards"), null);
});

test("study-guide stores and returns the {text} contract", () => {
  const db = setup();
  writeCachedArtifact(db, "p1", "study-guide", { text: "## Guide" });
  assert.deepEqual(readCachedArtifact(db, "p1", "study-guide"), { text: "## Guide" });
});

test("writing the same artifact twice updates it", () => {
  const db = setup();
  writeCachedArtifact(db, "p1", "quiz", goodQuiz);
  const other = [{ ...goodQuiz[0], id: "q2" }];
  writeCachedArtifact(db, "p1", "quiz", other);
  assert.deepEqual(readCachedArtifact(db, "p1", "quiz"), other);
});
