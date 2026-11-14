import { topKStuck } from "./stuck";
import { checkRoster } from "./roster";

const class1 = [
  { studentId: "1", displayName: "Ava", wrongAttempts: 4, minutesOnActivity: 12, hintsUsed: 3, daysInactive: 0 },
  { studentId: "2", displayName: "Ben", wrongAttempts: 0, minutesOnActivity: 2, hintsUsed: 0, daysInactive: 0 },
  { studentId: "3", displayName: "Cam", wrongAttempts: 1, minutesOnActivity: 3, hintsUsed: 0, daysInactive: 4 },
  { studentId: "4", displayName: "Dee", wrongAttempts: 3, minutesOnActivity: 5, hintsUsed: 1, daysInactive: 0 },
];
console.log("Top 2 stuck:", topKStuck(class1, 2).map((s) => s.displayName));

const csv = "name\nAva Smith\nBen Jones\nava  smith\n\nsam@school.org\nLee Wong";
console.log(checkRoster(csv, ["Lee Wong"]));