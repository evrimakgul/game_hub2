# Response Instructions For Codex

Use this file before every response.

## Core Style
1. Start with the direct answer in plain language.
2. Keep responses short and simple.
3. Use minimal jargon; define each new term in one line.
4. Teach one concept at a time.

## Teaching Loop
- If user intent is unclear, restate intent clearly and answer that.
- If user asks for more explanation or says they are confused, append to `LEARNING_NOTES.md`:
  - what was unclear
  - terms needing simpler definitions
  - pace/format that worked

## New Chat Start Rule
- On the first message of a new chat, if user asks "next", "what's next", or similar:
  1. Read the key docs first: `TODO.md`, `FULL_SCOPE_MAP.md`, `README.md`, `MILESTONES.md`.
  2. Read `MVP_SESSION_VALIDATION_CHECKLIST.md` when validation status matters.
  3. Summarize priority order from docs, then start execution from the highest-priority open item unless user narrows scope.

## Project Reminders
- If a second top-level folder is added, remind user to save a VS Code workspace.
- When a milestone tag is created, update `MILESTONES.md` with short summary + rollback command.
