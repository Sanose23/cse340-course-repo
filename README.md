# CSE 340 Service Network

W03 Model-View-Controller Implementation, following the [v2 assignment](https://byui-cse.github.io/cse340-ww-course-v2/week03/assignment.html) and its learning/team activities.

Live site: <https://cse340-course-repo-lvip.onrender.com>

Repository: <https://github.com/Sanose23/cse340-course-repo>

## Run locally

Use Node 22. On a fresh checkout, copy `.env.sample` to `.env` and set `DB_URL` to your Render External Database URL. The existing `DATABASE_URL` name also works. Keep `.env` out of Git.

```bash
npm install
# Run this only when creating a new, empty application database:
npm run db:setup
npm run dev
```

Open <http://127.0.0.1:3000>. In another terminal, run `npm run verify`. The existing course database has already been initialized; do not run setup again against it.

Run `npm run verify:w03` for the current MVC, detail-page, relationship, escaping, and error-handling integration suite. `npm run verify:w02` remains available for database and regression coverage. Both create and remove a disposable schema, so application records are unaffected. They require database connectivity and permission to create a schema.

Production runs with `npm start`. Render supplies the port and production environment variables, including the Internal Database URL in `DATABASE_URL` or `DB_URL`. Database setup is a separate operation and never runs on server startup.

## Pages

- `/`: Home and the service-network mission.
- `/organizations`: database-backed partners linked to `/organization/:id` detail pages.
- `/projects`: the next five upcoming projects linked to `/project/:id` detail pages.
- `/categories`: database-backed categories linked to `/category/:id` detail pages.
- Detail pages connect organizations, projects, and categories through parameterized model queries.
- Custom 404 and 500 pages provide centralized error handling.

The organizations and public images come from the official learning activities. Project dates, locations and additional events are sample data. Every project has a sponsor and at least one category; several have two categories.

## Implementation and verification

- [W03 rubric evidence](docs/w03-assignment-review.md)
- [W03 completion summary](docs/w03-completion-summary.md)
- [W03 coaching transcript](docs/w03-coaching-transcript.txt)
- [W03 status update](docs/w03-status-update.txt)
- [W03 team activity responses](docs/w03-team-activity.md)
- [W02 completion summary](docs/w02-completion-summary.md)
- [Code and request-flow guide](docs/code-guide.md)

EJS views are in `src/views`, with shared partials and dedicated error templates. The stylesheet is `public/css/main.css`. JavaScript uses ESM imports/exports, arrow functions, and async/await. `<%- %>` is used only for trusted partial includes; template data uses `<%= %>`.

`src/setup.sql` creates and seeds `organization`, `project`, `category`, and `project_category`. Parameterized query functions live in `src/models`; request coordination lives in `src/controllers`; route declarations live in `src/routes.js`; and `server.js` handles application setup and middleware. Async controllers forward failures to centralized error middleware. Missing routes and resources return HTTP 404, while unexpected failures return HTTP 500.
