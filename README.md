# CSE 340 Service Network

W02 Database Retrieval, following the [v2 assignment](https://byui-cse.github.io/cse340-ww-course-v2/week02/assignment.html) and its learning/team activities.

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

Run `npm run verify:w02` for PostgreSQL schema/constraint checks and a full application integration test. It creates and removes a disposable schema; application records are unaffected. It requires database connectivity and permission to create a schema.

Production runs with `npm start`. Render supplies the port and production environment variables, including the Internal Database URL in `DATABASE_URL` or `DB_URL`. Database setup is a separate operation and never runs on server startup.

## Pages

- `/`: Home and the service-network mission.
- `/organizations`: the three database-backed partners, descriptions, logos and contact addresses.
- `/projects`: 15 database-backed projects with dates, titles, sponsors, descriptions and locations.
- `/categories`: the four category names retrieved from PostgreSQL.

The organizations and public images come from the official learning activities. Project dates, locations and additional events are sample data. Every project has a sponsor and at least one category; several have two categories.

## Implementation and verification

- [W02 rubric evidence](docs/w02-assignment-review.md)
- [W02 completion summary](docs/w02-completion-summary.md)
- [W02 coaching transcript](docs/w02-coaching-transcript.txt)
- [W02 status update](docs/w02-status-update.txt)
- [W02 team activity responses](docs/w02-team-activity.md)
- [Code and request-flow guide](docs/code-guide.md)

The four EJS views are in `src/views`. All pages share the header and footer in `src/views/partials`. The stylesheet is `public/css/main.css`. JavaScript uses ESM imports/exports, arrow functions, and async/await. `<%- %>` is used only for the two trusted partial includes; template data uses `<%= %>`.

`src/setup.sql` creates and seeds `organization`, `project`, `category`, and `project_category`. Query functions live in `src/models/organizations.js`, `projects.js`, and `categories.js`; the connection pool and `testConnection` are in `src/models/db.js`. `server.js` awaits the models and passes their rows to EJS. Query errors return HTTP 500; missing routes return HTTP 404.
