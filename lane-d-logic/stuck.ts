// stuck.ts: ranks the students who most need help.
// Why a heap: we only want the top K students out of a whole class.
// A min-heap of size K keeps only the K worst, so we never sort everyone.
// Cost is O(n log K) instead of O(n log n).

export interface StudentSignal {
  studentId: string;
  displayName: string;
  wrongAttempts: number;      // wrong tries on their current activity
  minutesOnActivity: number;  // minutes open without finishing
  hintsUsed: number;
  daysInactive: number;       // school days with no activity
}

// Defaults from the design plan. Easy to change once CIC answers.
export function isStuck(s: StudentSignal): boolean {
  return s.wrongAttempts >= 3 || s.minutesOnActivity > 10 || s.daysInactive >= 3;
}

// Higher score = needs help sooner. Weights are a starting guess.
export function stuckScore(s: StudentSignal): number {
  return (
    s.wrongAttempts * 3 +
    s.hintsUsed * 2 +
    Math.min(s.minutesOnActivity, 60) / 10 +
    s.daysInactive * 2
  );
}

export class MinHeap<T> {
  private items: T[] = [];
  constructor(private compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.items[i], this.items[parent]) >= 0) break;
      [this.items[i], this.items[parent]] = [this.items[parent], this.items[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop() as T;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      while (true) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.compare(this.items[l], this.items[smallest]) < 0) smallest = l;
        if (r < n && this.compare(this.items[r], this.items[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [this.items[i], this.items[smallest]] = [this.items[smallest], this.items[i]];
        i = smallest;
      }
    }
    return top;
  }
}

// Returns up to k stuck students, most stuck first.
export function topKStuck(signals: StudentSignal[], k: number): StudentSignal[] {
  const heap = new MinHeap<StudentSignal>((a, b) => stuckScore(a) - stuckScore(b));
  for (const s of signals) {
    if (!isStuck(s)) continue;
    heap.push(s);
    if (heap.size > k) heap.pop(); // drop the least stuck of the k+1
  }
  const result: StudentSignal[] = [];
  while (heap.size > 0) result.push(heap.pop() as StudentSignal);
  return result.reverse(); // heap pops smallest first, we want largest first
}