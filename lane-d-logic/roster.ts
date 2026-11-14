// roster.ts: checks an uploaded class list before anything is saved.
// Why a Map: finding duplicates by comparing every pair is O(n^2).
// A Map lets us check "have I seen this name?" in one step, O(n) total.
// Data minimization: students are minors, so we accept NAMES ONLY.

export interface RosterProblem {
  line: number;
  name: string;
  reason: string;
}

export interface RosterPreview {
  valid: string[];            // clean names, ready to import
  problems: RosterProblem[];  // rows the instructor must fix
}

const MAX_NAME_LENGTH = 80;

function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function checkRoster(
  csvText: string,
  existingNames: string[] = []
): RosterPreview {
  const seen = new Map<string, number>(); // lowercase name -> first line seen
  for (const existing of existingNames) {
    seen.set(normalize(existing).toLowerCase(), 0); // line 0 = already in class
  }

  const valid: string[] = [];
  const problems: RosterProblem[] = [];
  const lines = csvText.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (rawLine.trim() === "") return;

    // Take the first column and strip quotes
    const firstColumn = rawLine.split(",")[0].replace(/^"|"$/g, "");
    const name = normalize(firstColumn);

    if (lineNumber === 1 && name.toLowerCase() === "name") return; // header row

    if (name === "") {
      problems.push({ line: lineNumber, name, reason: "Name is empty" });
      return;
    }
    if (name.length > MAX_NAME_LENGTH) {
      problems.push({ line: lineNumber, name, reason: "Name is too long" });
      return;
    }
    if (name.includes("@")) {
      problems.push({ line: lineNumber, name, reason: "Looks like an email. Names only, please" });
      return;
    }

    const key = name.toLowerCase();
    const firstSeenOn = seen.get(key);
    if (firstSeenOn !== undefined) {
      const where = firstSeenOn === 0 ? "already in this class" : `already on line ${firstSeenOn}`;
      problems.push({ line: lineNumber, name, reason: `Duplicate: ${where}` });
      return;
    }

    seen.set(key, lineNumber);
    valid.push(name);
  });

  return { valid, problems };
}