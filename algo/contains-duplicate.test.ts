import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containsDuplicate } from "./contains-duplicate.ts";

describe("containsDuplicate", () => {
  it("returns true when a value repeats", () => {
    assert.equal(containsDuplicate([1, 2, 3, 1]), true);
  });

  it("returns false when all values are distinct", () => {
    assert.equal(containsDuplicate([1, 2, 3, 4]), false);
  });

  it("returns true for many repeats", () => {
    assert.equal(containsDuplicate([1, 1, 1, 3, 3, 4, 3, 2, 4, 2]), true);
  });

  it("returns false for an empty array", () => {
    assert.equal(containsDuplicate([]), false);
  });

  it("returns false for a single element", () => {
    assert.equal(containsDuplicate([42]), false);
  });

  it("treats 0 and -0 as the same value", () => {
    assert.equal(containsDuplicate([0, -0]), true);
  });
});
