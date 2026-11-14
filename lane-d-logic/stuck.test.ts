import { describe, expect, it } from "vitest";
import { MinHeap, isStuck, topKStuck, type StudentSignal } from "./stuck";

function student(over: Partial<StudentSignal>): StudentSignal {
  return {
    studentId: "x",
    displayName: "X",
    wrongAttempts: 0,
    minutesOnActivity: 0,
    hintsUsed: 0,
    daysInactive: 0,
    ...over,
  };
}

describe("isStuck (defaults from the design plan)", () => {
  it("is stuck at 3 wrong attempts, not at 2", () => {
    expect(isStuck(student({ wrongAttempts: 3 }))).toBe(true);
    expect(isStuck(student({ wrongAttempts: 2 }))).toBe(false);
  });

  it("is stuck only when open MORE than 10 minutes", () => {
    expect(isStuck(student({ minutesOnActivity: 10 }))).toBe(false);
    expect(isStuck(student({ minutesOnActivity: 11 }))).toBe(true);
  });

  it("is stuck after 3 inactive school days, not 2", () => {
    expect(isStuck(student({ daysInactive: 3 }))).toBe(true);
    expect(isStuck(student({ daysInactive: 2 }))).toBe(false);
  });
});

describe("topKStuck", () => {
  const ava = student({ studentId: "1", displayName: "Ava", wrongAttempts: 4, minutesOnActivity: 12, hintsUsed: 3 });
  const ben = student({ studentId: "2", displayName: "Ben" }); // not stuck
  const cam = student({ studentId: "3", displayName: "Cam", wrongAttempts: 1, minutesOnActivity: 3, daysInactive: 4 });
  const dee = student({ studentId: "4", displayName: "Dee", wrongAttempts: 3, minutesOnActivity: 5, hintsUsed: 1 });

  it("returns the most stuck first and skips students who are not stuck", () => {
    const names = topKStuck([ava, ben, cam, dee], 3).map((s) => s.displayName);
    expect(names).toEqual(["Ava", "Dee", "Cam"]);
  });

  it("keeps only the top k", () => {
    const names = topKStuck([cam, dee, ava, ben], 2).map((s) => s.displayName);
    expect(names).toEqual(["Ava", "Dee"]);
  });

  it("returns fewer than k when fewer students are stuck", () => {
    expect(topKStuck([ben, ava], 5).map((s) => s.displayName)).toEqual(["Ava"]);
  });

  it("handles an empty class", () => {
    expect(topKStuck([], 3)).toEqual([]);
  });
});

describe("MinHeap", () => {
  it("pops values smallest first", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    [5, 1, 4, 2, 3].forEach((n) => heap.push(n));
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop() as number);
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns undefined when empty", () => {
    expect(new MinHeap<number>((a, b) => a - b).pop()).toBeUndefined();
  });
});
