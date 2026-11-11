# W02 Database Retrieval

Student: Joseph Lawal

Course source: [W02 assignment](https://byui-cse.github.io/cse340-ww-course-v2/week02/assignment.html)

| Rubric criterion | Implementation evidence |
| --- | --- |
| Database Design | `src/setup.sql` creates and seeds `organization`, `project`, `category`, and `project_category`. It defines primary keys, sponsor and junction foreign keys, a composite junction key, required columns, uniqueness, and relationship indexes. The seed contains three organizations, five projects per organization, four categories, and category links for every project. |
| End-to-End Data Flow | The models query PostgreSQL, asynchronous Express handlers pass rows to EJS, and the pages render escaped database values. Organizations show names, descriptions, emails, and logos. Projects show formatted dates, titles, joined sponsor names, descriptions, and locations. Categories show database names. |
| Code Organization and Standards | `src/models/db.js` owns the pool and connection test. `organizations.js`, `projects.js`, and `categories.js` export the required `getAll...` async arrow functions. The project uses ESM, explicit query columns, `async`/`await`, and escaped EJS output. |

## Verification

`npm run verify:w02` passed against a disposable PostgreSQL schema on November 11, 2026. It executes the actual setup script and verifies counts, required fields, primary and foreign keys, duplicate prevention, every project's category relationship, many-to-many support, dynamic model-to-EJS flow, output escaping, query failure recovery, empty results, static assets, navigation, and HTTP status codes. The temporary schema is removed after the test.

The initialized Joseph Lawal course database contains three organizations, 15 projects, four categories, and 24 project-category links. Hosted verification is recorded after the matching GitHub commit is deployed.
