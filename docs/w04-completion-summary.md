# W04 Completion Summary

Student: Joseph Lawal
Workspace: `/home/hate-uchiha/joseph-cse340`

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week04/index.html>

## Local implementation

Joseph's actual Service Network repository now supports creating and editing organizations, service projects, and categories. Its existing ESM models, controllers, routes, templates, and visual style were checked before implementing each feature. The organization create form uses the official placeholder logo; its edit form also validates an existing local logo filename. Project forms provide an organization dropdown, a correctly formatted date input, and escaped existing or retained values.

The server parses URL-encoded and JSON request bodies before routing. Express sessions retain form values by destination URL and store custom one-time flash messages. The repository's existing form-data and identifier helpers remain in use. Validation failures redirect without changing application records; successful inserts and updates return HTTP 303 to a database-backed detail page.

Category names are required, trimmed, and limited to 3 to 100 characters on the server. The browser deliberately has no minimum-length rule. Duplicate names produce friendly feedback. Category assignment normalizes missing, scalar, and repeated checkbox values, rejects nonexistent categories, and replaces links on one checked-out database client inside a transaction. Target-row locking prevents concurrent replacements from producing mixed category sets.

## Database and configuration

`src/setup.sql` supports 200-character project titles. `src/migrations/w04-project-title.sql` expands the existing title column without replacing records. Local database connection handling now permits a non-TLS loopback PostgreSQL test server while preserving the existing external SSL behavior. No hosted database was changed.

Production requires a private random `SESSION_SECRET` of at least 32 characters. Development and test runs can use an ephemeral generated secret. Session cookies are HTTP-only, SameSite Lax, and HTTPS-only in production.

## Verified in this repository

- `npm run verify:w04` passed against a unique disposable local PostgreSQL schema, including 349 invalid submissions, accepted length boundaries, real persistence, update targeting, partner reassignment, category duplicates, escaped form/detail output, session isolation, one-time feedback, invalid record IDs, concurrent assignment serialization, rollback, hidden database failures, and recovery.
- `npm run verify:w03` passed against local PostgreSQL.
- All 22 JavaScript files passed syntax checks and all 22 EJS templates compiled. Every README document link resolves locally.
- Real headless Chrome checked all seven forms at desktop and mobile widths, including no horizontal overflow, control labels, required fields, email validation, the server-only category minimum, actual submission, persistence, and one-time feedback. Four screenshots and 14 page-check results are saved in `docs/evidence/w04`.
- The official placeholder PNG was verified locally, and `npm audit --omit=dev` reported no production dependency vulnerabilities.

The earlier W02 smoke verification is known to expect a November 14, 2026 project to remain in the upcoming list after that date. That unrelated date-sensitive assertion was not changed.

## Deployment and remaining requirements

Week 4 is live at <https://cse340-course-repo-lvip.onrender.com> through Render deployment `dep-dbtemds9v7es73adnkq0`. Joseph's isolated accounts were verified, the production schema migration and private session secret were applied, every write flow passed hosted verification, and temporary test records were removed. Evidence is in `docs/evidence/w04/deployment.json`.

Joseph's verified Week 4 source was committed and pushed to `main` through the isolated wrapper; the deployment evidence records that publication. Canvas submission, Teams meeting/post, quiz attempt, and an actual 30-minute coaching session were not performed. The coaching deliverable remains a separate, clearly labeled AI-authored rehearsal grounded in Joseph's current code. It is not a record of Joseph speaking.

AI assistance is disclosed. The published course requires the learner to understand every submitted line and restricts bulk AI generation and AI quiz answers. Review the implementation and instructor policy before submitting. Private configuration values were not copied into deliverables or another learner's account.
