// Shared by the roster import and the Starting point section (late joiners).
export const placementsKey = (classId: string) => ['instructor', 'placements', classId] as const
export const classModulesKey = (classId: string) => ['instructor', 'class-modules', classId] as const
export const selectClass = 'min-h-11 w-full rounded-lg border border-input bg-white px-3 text-sm sm:w-auto'
