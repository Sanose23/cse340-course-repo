# W03 Model-View-Controller Implementation

Course source: [W03 assignment](https://byui-cse.github.io/cse340-ww-course-v2/week03/assignment.html).

| Rubric criterion | Implementation evidence |
| --- | --- |
| Learning and Team Activity Features | `/organizations` links all partners to detail pages. Each organization detail shows its information and linked projects. `/projects` retrieves the next five upcoming projects through `getUpcomingProjects(5)`. Each project has a detail page and links to its partner. Custom 404 and 500 responses are centralized. |
| Categories Pages | `/categories` links every category to `/category/:id`. The category detail controller retrieves one category and all linked projects through parameterized model functions, then renders linked project names. |
| Category Tags | `/project/:id` retrieves the project and its categories. Each category is rendered as a tag linking to `/category/:id`. |
| MVC Organization | SQL remains in `src/models`; request coordination remains in `src/controllers`; route declarations remain in `src/routes.js`; EJS presentation remains in `src/views`; and `server.js` configures middleware and error handling. |
| Deployment and Professional Style | Existing responsive, accessible visual design extends to all detail and error pages. Navigation state, breadcrumbs, semantic headings, escaped output, focus styles, and mobile layouts remain consistent. |

`npm run verify:w03` passed against a disposable PostgreSQL schema. It verifies all list and detail pages, result limits, relationship links, parameterized lookups, category tags, escaped database content, invalid and missing IDs, custom 404/500 responses, database-failure recovery, and MVC file boundaries.

The local implementation and verification are complete. Deployment evidence should be verified against the hosted revision before submission. The instructor assigns the final score.
