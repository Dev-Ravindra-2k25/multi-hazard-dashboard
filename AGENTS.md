# Agent Rules

- Read `SPEC.md` and `PROGRESS.md` first. Do not read `docs/PRD.pdf` unless the spec is unclear.
- Stack and folder structure in `SPEC.md` are fixed. Do not add frameworks or restructure folders.
- Work on one slice at a time. Only modify files needed for that slice.
- Do not scan the whole repo; open only the files named in the task.
- No explanations unless asked. Finish with a 3-line summary of what changed.
- Keep functions small. Python: type hints, snake_case. JS: functional components, camelCase.
- Secrets go in `.env` (never committed). Provide `.env.example`.
- Every backend feature gets at least one pytest test.
- Do not open the browser agent or take screenshots unless the task says so.
- After finishing a slice, update `PROGRESS.md` (done / next / known issues, max 5 lines).