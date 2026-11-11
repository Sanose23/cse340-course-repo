# W02 code and request flow

Student: Joseph Lawal

Course sources: [Database Retrieval Assignment](https://byui-cse.github.io/cse340-ww-course-v2/week02/assignment.html), [Node and PostgreSQL](https://byui-cse.github.io/cse340-ww-course-v2/week02/prepare-node-connect-db.html), [EJS Results](https://byui-cse.github.io/cse340-ww-course-v2/week02/prepare-ejs-display-results.html).

## Server

`package.json` sets `type: module`, enabling `import` and `export`. `server.js` imports Express, Node path utilities, the event helper and the course content.

`fileURLToPath(new URL('.', import.meta.url))` finds the project directory independently of the terminal's working directory. The camelCase name `projectDirectory` serves the same purpose as the lesson's `__dirname`.

`nodeEnvironment`, `port` and `host` read configuration from the environment. `nodemon.json` runs Node with `--env-file=.env` in development, while Render supplies its own environment. The `.env` file is ignored by Git.

`express.static(...)` serves `public` at the URL root. `/css/main.css` maps to `public/css/main.css`, and `/images/brightfuture-logo.png` maps to its public image file.

`app.set(...)` configures EJS and the `src/views` location before routes run. `app.locals.navigation` makes the four links available to every rendered partial.

Each route uses an async arrow function, awaits its model query, creates a `title` variable, and calls `res.render` with a template name and database rows. The templates contain no database queries. Query failures are forwarded to shared Express error middleware.

`await once(server, 'listening')` waits for startup before printing the confirmation. This uses async/await instead of a startup callback.

## Models, views, and data

`src/data/site.js` exports only shared navigation. `src/models/organizations.js`, `projects.js`, and `categories.js` query PostgreSQL and return `result.rows`. `projects.js` joins each project to its sponsoring organization. `src/setup.sql` recreates the four related tables and all required seed data.

Every view begins with `include('partials/header')` and ends with `include('partials/footer')`. The header owns the document start, HTML title, stylesheet link, skip link and navigation. The footer owns the copyright, shared links and document closing tags.

`<%= title %>` escapes the page title. All other dynamic text, URLs and attributes also use escaped output. `<%- %>` appears only on the two trusted partial includes so their HTML can render normally.

The active navigation link receives `aria-current="page"`. Anchor targets connect the home-page cards to the actual organization, project and category entries. The skip link focuses the main content for keyboard users.

## Request trace

Browser requests `/categories` → Express matches the asynchronous route → the route awaits `getAllCategories()` → PostgreSQL returns rows through the model → the route passes `title` and `categories` to `categories.ejs` → EJS combines the page and shared partials → the server returns HTML → the browser requests CSS and images through static middleware.

## Styles and verification

`main.css` uses shared color variables, CSS Grid and Flexbox. Media queries change grids and navigation at smaller widths. Visible focus outlines, a skip link, readable colors and active-page semantics support accessibility.

`npm run verify` checks actual page responses, required database content, titles, navigation and anchor destinations, asset delivery, source-file exclusion and escaped title output. `npm run verify:w02` creates a disposable PostgreSQL schema, executes `src/setup.sql`, verifies relationships and constraints, tests live model-to-EJS flow, failure recovery, empty results, and removes the schema afterward.
