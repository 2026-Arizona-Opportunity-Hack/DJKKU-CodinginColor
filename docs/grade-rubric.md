# Grade rubric for "Explain it for my grade"

Students can ask for any reading or video to be rewritten for their grade (1 to 12). The AI follows this
rubric. It is generated from [shared/simplify/rubric.ts](../shared/simplify/rubric.ts), which is the source of
truth: change it there and regenerate this page (a test checks they match).

Bands follow the K-12 Computer Science Framework (K-2, 3-5, 6-8, 9-12). The student's grade is kept on their
device only, never in the database. Only the lesson material and the grade go to the AI, never a name or id.

## Grades 1 to 4

| Dimension | Grade 1 | Grade 2 | Grade 3 | Grade 4 |
|---|---|---|---|---|
| Band | K-2 | K-2 | 3-5 | 3-5 |
| Vocabulary | Only very common words a 6 year old says every day. No jargon at all. | Everyday words; one new word at most, explained with a picture-like comparison. | Common words; new words introduced one at a time with "this means...". | Plain words; new terms in bold with a short meaning. |
| Sentences | Very short sentences, 5 to 8 words. One idea per sentence. | Short sentences, 6 to 10 words. | Sentences of 8 to 12 words. | Sentences of 10 to 14 words. |
| How ideas are built | One big idea only, shown as something the child can see or do. No abstractions. | One idea, built from a familiar routine (brushing teeth, a recipe). | Idea first as an everyday story, then named. | Everyday story, then the name, then "why it helps". |
| Examples | Toys, snacks, pets, colors, family, playground games. Act it out ("clap 3 times"). | Recipes, games like Simon Says, lining up at school, sorting crayons. | Board games, sports scores, video game lives, classroom jobs. | Scoreboards, playlists, recipes that repeat a step, sorting a deck of cards. |
| Technical terms | None. Say "a list of steps" instead of "program", "do it again" instead of "loop". | At most one simple term (like "step" or "repeat"), always with its meaning. | Up to two terms such as "instruction" or "repeat", each defined in plain words. | Up to three terms (for example "variable", "loop"), each explained with an example. |
| Code | No code. Describe steps as a numbered list of actions. | No code. Steps as a numbered list. | Optional: one tiny block-style or pseudocode example, 1 to 3 lines. | One short example of 2 to 4 lines, each line explained. |
| Length | About 60 words plus a 3-step list. | About 80 words plus a short list. | About 100 words. | About 120 words. |
| Most words | 90 | 110 | 140 | 160 |
| Check question | A yes/no or pick-one question about the everyday example. | Pick-one question about what happens next in the example. | Pick-one question with a tiny scenario. | Predict what a tiny example does. |

## Grades 5 to 8

| Dimension | Grade 5 | Grade 6 | Grade 7 | Grade 8 |
|---|---|---|---|---|
| Band | 3-5 | 6-8 | 6-8 | 6-8 |
| Vocabulary | Grade-level words; terms in bold with meanings. | Grade-level academic words; technical terms defined at first use. | Academic words; technical terms defined once, then used. | Academic and technical words with short definitions. |
| Sentences | Sentences of 10 to 15 words. | Sentences of 12 to 16 words, some with "because" or "so". | Varied sentences, 12 to 18 words. | Varied sentences up to 20 words. |
| How ideas are built | Analogy, then the real idea, then one example. | Idea, why it exists, then a worked example. | Idea, purpose, worked example, common mistake. | Idea, purpose, example, common mistake, when to use it. |
| Examples | Games, school schedules, simple apps they use, sports stats. | Video games, social apps, music playlists, school data like grades and attendance. | Games, apps, sports analytics, simple websites. | Apps, games, data from science class, small automation tasks. |
| Technical terms | Core terms of the lesson, each defined once. | All lesson terms, defined briefly; avoid extra jargon. | Lesson terms used correctly after a short definition. | Correct terms throughout; a mini glossary of key terms. |
| Code | One example of up to 5 lines with comments in plain words. | One example of up to 6 lines, walked through step by step. | Up to 8 lines with a trace of what happens. | Up to 10 lines with a step-by-step trace. |
| Length | About 140 words. | About 160 words. | About 180 words. | About 200 words. |
| Most words | 180 | 200 | 220 | 240 |
| Check question | Predict the output of a short example. | Predict output or spot a small bug. | Spot the bug or predict output. | Change the code to do something slightly different. |

## Grades 9 to 12

| Dimension | Grade 9 | Grade 10 | Grade 11 | Grade 12 |
|---|---|---|---|---|
| Band | 9-12 | 9-12 | 9-12 | 9-12 |
| Vocabulary | Technical vocabulary with brief definitions for new terms. | Technical vocabulary used precisely. | Technical and academic vocabulary; links to math where helpful. | College-ready technical vocabulary. |
| Sentences | Clear, varied sentences; short paragraphs. | Clear paragraphs, some longer sentences when needed. | Concise, well-structured paragraphs. | Concise, precise paragraphs like an intro college text. |
| How ideas are built | Concept, how it works, worked example, pitfalls, connection to earlier ideas. | Concept, mechanism, example, trade-offs, where it shows up in real software. | Concept, mechanism, edge cases, efficiency or design trade-offs. | Concept, mechanism, formal terms, trade-offs, how it scales, what to learn next. |
| Examples | Real apps and projects: a game score system, a playlist app, a data report. | Real software and careers: web apps, data science, game development. | Industry and research uses: APIs, data pipelines, AI tools, open source projects. | Professional and research settings: production systems, ML, security, open source. |
| Technical terms | Precise terms expected; glossary for new ones. | Precise terms without over-explaining basics. | Full technical terms; mention related concepts by name. | Formal terminology used precisely, including related concepts. |
| Code | Up to 12 lines; explain what each part does. | Up to 15 lines; idiomatic style. | Up to 20 lines; note style and edge cases. | Up to 20 lines; idiomatic, with a note on complexity or design where relevant. |
| Length | About 220 words. | About 240 words. | About 260 words. | About 280 words. |
| Most words | 260 | 280 | 300 | 320 |
| Check question | Explain why a piece of code gives its output. | Compare two approaches or predict an edge case. | Reason about an edge case or design choice. | An open question on trade-offs or extending the idea. |

## Example themes by concept

| Concept | K-2 | 3-5 | 6-8 | 9-12 |
|---|---|---|---|---|
| variables | a labeled box or a name tag that holds one thing | a scoreboard that shows the current score | a game character's health points that change during play | named references to values in memory, like a user's settings in an app |
| loops | clapping 3 times, or doing the same dance step again and again | running laps around a track until the coach says stop | a game checking every enemy on screen each frame | iterating over records in a dataset, and stopping conditions |
| conditionals | if it is raining, take an umbrella | if your score is 10, you win the level | an app showing different screens if you are logged in or not | branching logic and boolean expressions in real programs |
| functions | a recipe card you can use any time you want to make the same snack | a button that always does the same job when you press it | a reusable block in a game, like "jump", that takes how high to jump | parameters, return values and breaking a program into testable parts |
| data | sorting toys into groups by color | a class chart of favorite fruits | a spreadsheet of sports stats | datasets, tables and what conclusions they can and cannot support |
| ai | a helper that learns your favorite song by listening many times | a game that gets better at guessing after many tries | a music app suggesting songs from what you played before | models trained on data, their limits, bias and responsible use |
