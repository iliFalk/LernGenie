import { test } from "node:test";
import assert from "node:assert/strict";

import { quizModules, gradeStyle } from "../src/ai/prompts";

const sum = (m: { begriffe: number; schluesse: number; fangfragen: number }) => m.begriffe + m.schluesse + m.fangfragen;

test("a young class gets more term questions than traps", () => {
  const young = quizModules(10, 5);
  assert.deepEqual(young, { begriffe: 5, schluesse: 3, fangfragen: 2 });
  const older = quizModules(10, 10);
  assert.deepEqual(older, { begriffe: 3, schluesse: 4, fangfragen: 3 });
});

test("every count keeps one trap and adds up to the requested length", () => {
  for (const count of [5, 10, 15]) {
    for (const grade of [5, 8, 11]) {
      const mix = quizModules(count, grade);
      assert.equal(sum(mix), count, `${count} questions at grade ${grade}`);
      assert.ok(mix.fangfragen >= 1);
      assert.ok(mix.begriffe >= 1 && mix.schluesse >= 1);
    }
  }
});

test("the band limits grow with the grade", () => {
  assert.ok(gradeStyle(5).stem < gradeStyle(8).stem);
  assert.ok(gradeStyle(8).stem < gradeStyle(11).stem);
  assert.equal(gradeStyle(6).stem, 10);
});

test("a hard set shifts the questions towards inference and traps", () => {
  assert.deepEqual(quizModules(10, 6, true), { begriffe: 2, schluesse: 5, fangfragen: 3 });
  assert.deepEqual(quizModules(10, 6, false), { begriffe: 5, schluesse: 3, fangfragen: 2 });
});
