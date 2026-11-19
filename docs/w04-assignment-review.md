# W04 Assignment Review

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week04/assignment.html>

Evidence below comes from Joseph's local repository and its own disposable-schema verification, not another learner's deployment.

| Published requirement | Joseph repository evidence | Result |
| --- | --- | --- |
| Learning and team activity features | Organization and project create/edit forms are backed by named model/controller functions and GET/POST routes. Update forms show current values and partner selection. The same server rules validate create and edit requests. | Local prepopulation, writes, reassignment, required fields, types, dates, limits, and failed-write tests passed. |
| Create categories | `/new-category` displays a labeled name field with required and a 100-character maximum. Its POST controller validates trimmed length 3 to 100, uses the parameterized insert model, and redirects with feedback. | Valid creation, boundary names, invalid inputs, duplicates, and escaped values passed. |
| Edit categories | `/edit-category/:id` retrieves the existing category and renders its name. The POST handler uses the URL ID, validates input, updates only that row, and preserves invalid submitted data. | Prepopulation, targeted updates, missing IDs, duplicates, sticky values, and unchanged unrelated records passed. |
| MVC organization and naming | Database access remains in models. Controllers prepare data and coordinate validation. Feature routes are in `src/routes.js`. EJS handles presentation and Express 4 wrappers forward rejected promises. | Source-layer checks, EJS compilation, 404/500 behavior, and database-failure recovery passed. |
| Deployment and professional style | Existing responsive styling now includes labeled forms, focus outlines, category checkboxes, and accessible feedback. | Real Chrome checks passed for all seven forms at desktop and mobile widths with no horizontal overflow; screenshots and results are in `docs/evidence/w04`. Week 4 publication, hosted functionality, and live accessibility verification were not performed, so this criterion is not claimed complete. |

## Additional learning activity

Category-assignment routes support the lesson's two patterns. The model uses a single client, transaction, and target-project row lock. Tests confirmed zero, scalar, repeated, multiple, invalid, and concurrent selections; a forced mid-replacement failure restored the old category set.

## Resolved lesson inconsistencies

- The official project server rules allow 200-character titles while the previous schema allowed 150. The setup and reviewed migration now support 200.
- The description browser example uses 500 while the server example uses 1000. Both demonstrated limits are retained. Location uses 200 consistently instead of the sample browser's 255.
- Maximum lengths follow the inclusive express-validator examples despite prose saying "less than".
- Creation redirects to the newly created detail page, matching the lesson's working sample rather than its conflicting list-page prose.
- `/assign-categories/:projectId` and `/project/:projectId/assign-categories` both work; checkbox fields consistently use `categoryIds`.
- `edit-project.ejs` follows the activity's repeated naming, not the isolated `update-project.ejs` typo.
- Text is trimmed and stored as plain text; EJS escapes it once at output. Bound SQL values protect query syntax. Escaping before storage as well would double-encode content.
- Sessions use the introductory in-memory store with a one-hour cookie. Unused sessions are not saved; production cookies add HTTP-only, SameSite Lax, and HTTPS protection.
- Existing resource/form helpers and Joseph's identity configuration were preserved. Local SSL handling was adjusted only to make safe loopback test databases usable.

## Verification and limitations

Joseph's W04 suite passed with 349 rejected submissions, and W03 regression verification passed. The known stale W02 upcoming-project assertion was not fixed. No numerical grade is assigned. No hosted migration, commit, push, deployment, quiz, Teams participation, real coaching session, or Canvas submission is evidenced. AI assistance and the course's learner-understanding and generation restrictions are disclosed in the completion summary.
