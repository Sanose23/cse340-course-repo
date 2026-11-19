# CSE 340 Service Network

Joseph Lawal's W04 Inserting and Updating Data implementation, following the [Service Network v2 assignment](https://byui-cse.github.io/cse340-ww-course-v2/week04/assignment.html) and all six learning activities. Week 4 is verified locally and deployed through Joseph's isolated accounts.

Live site: <https://cse340-course-repo-lvip.onrender.com>

Repository: <https://github.com/Sanose23/cse340-course-repo>

## Run locally

Use Node 22. Copy `.env.sample` to `.env` and set `DB_URL` to the intended application database. `DATABASE_URL` is also supported. Keep `.env` private. Production requires a random `SESSION_SECRET` of at least 32 characters; development and tests generate an ephemeral secret if it is absent.

```bash
npm install
# Run this only when creating a new, empty application database:
npm run db:setup
npm run dev
```

Open <http://127.0.0.1:3000>. In another terminal, run `npm run verify`. The existing course database has already been initialized; do not run setup again against it.

Run `npm run verify:w04` with `DB_URL` pointing to disposable local PostgreSQL. It refuses nonlocal hosts and checks all create/edit forms, 349 rejected submissions, escaped sticky values, session isolation, one-time feedback, targeted writes, and atomic category assignment. `npm run verify:w03` checks the earlier MVC behavior. Test schemas are created and removed automatically; never run database verification against the hosted course database. The older `verify:w02` suite has a stale expectation that the November 14, 2026 Park Cleanup remains upcoming.

Production runs with `npm start` and requires the database URL and private `SESSION_SECRET`. HTTPS cookies and the hosting proxy are configured for production. `src/migrations/w04-project-title.sql` expanded Joseph's hosted title column to 200 characters on November 16, 2026 without replacing records. Setup and migrations never run on startup. Future publishing must continue to verify Joseph's isolated GitHub and Render identities through `cse340-joseph status`; never use another student's account.

## Pages

- `/`: Home and the service-network mission.
- `/organizations`: database-backed partners linked to `/organization/:id` detail pages.
- `/projects`: the next five upcoming projects linked to `/project/:id` detail pages.
- `/categories`: database-backed categories linked to `/category/:id` detail pages.
- Detail pages connect organizations, projects, and categories through parameterized model queries.
- Custom 404 and 500 pages provide centralized error handling.
- `/new-organization`, `/new-project`, and `/new-category` display validated create forms linked from the directory pages.
- `/edit-organization/:id`, `/edit-project/:id`, and `/edit-category/:id` display prepopulated update forms linked from the detail pages.
- `/assign-categories/:projectId` edits checkbox assignments. `/project/:projectId/assign-categories` supports the alternate route named in the lesson.

The organizations and public images come from the official learning activities. Project dates, locations and additional events are sample data. Every seeded project has a sponsor and at least one category. Newly created projects can receive categories afterward; selecting none intentionally clears a project's category assignments.

## Implementation and verification

- [W04 completion summary](docs/w04-completion-summary.md)
- [W04 rubric evidence and lesson discrepancies](docs/w04-assignment-review.md)
- [W04 team activity discussion responses](docs/w04-team-activity.md)
- [W04 coaching rehearsal, not an actual session](docs/w04-coaching-transcript.txt)
- [W04 original coaching prompt](docs/w04-coaching-prompt.txt)
- [W04 status update draft](docs/w04-status-update.txt)
- [W04 deployment and submission checklist](docs/w04-submission-checklist.md)
- [W04 hosted deployment evidence](docs/evidence/w04/deployment.json)
- [W03 rubric evidence](docs/w03-assignment-review.md)
- [W03 completion summary](docs/w03-completion-summary.md)
- [W03 coaching transcript](docs/w03-coaching-transcript.txt)
- [W03 status update](docs/w03-status-update.txt)
- [W03 team activity responses](docs/w03-team-activity.md)
- [W02 completion summary](docs/w02-completion-summary.md)
- [Code and request-flow guide](docs/code-guide.md)

EJS views are in `src/views`, with shared partials and dedicated error templates. The stylesheet is `public/css/main.css`. JavaScript uses ESM imports/exports, arrow functions, and async/await. `<%- %>` is used only for trusted partial includes; template data uses `<%= %>`.

`src/setup.sql` creates and seeds `organization`, `project`, `category`, and `project_category`. Parameterized query functions live in `src/models`; request coordination lives in `src/controllers`; route declarations live in `src/routes.js`; and `server.js` handles application setup and middleware. Async controllers forward failures to centralized error middleware. Missing routes and resources return HTTP 404, while unexpected failures return HTTP 500.
