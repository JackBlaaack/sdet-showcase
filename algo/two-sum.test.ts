import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { twoSum } from "./two-sum.ts";

const sorted = (pair: [number, number]): [number, number] =>
  pair[0] <= pair[1] ? pair : [pair[1], pair[0]];

describe("twoSum", () => {
  it("finds the pair at the start", () => {
    assert.deepEqual(sorted(twoSum([2, 7, 11, 15], 9)), [0, 1]);
  });

  it("finds the pair in the middle", () => {
    assert.deepEqual(sorted(twoSum([3, 2, 4], 6)), [1, 2]);
  });

  it("allows two equal values at different indices", () => {
    assert.deepEqual(sorted(twoSum([3, 3], 6)), [0, 1]);
  });

  it("handles negative numbers", () => {
    assert.deepEqual(sorted(twoSum([-1, -2, -3, -4, -5], -8)), [2, 4]);
  });

  it("handles zeros", () => {
    assert.deepEqual(sorted(twoSum([0, 4, 3, 0], 0)), [0, 3]);
  });

  it("does not use the same element twice", () => {
    // 5 + 5 would give 10, but index 0 cannot be reused: the answer is 3 + 7.
    assert.deepEqual(sorted(twoSum([5, 3, 7], 10)), [1, 2]);
  });
});
