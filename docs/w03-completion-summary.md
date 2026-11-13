# W03 Completion Summary

- Student: Joseph Lawal
- Project: CSE 340 Service Network
- Repository: <https://github.com/Sanose23/cse340-course-repo>
- Hosted site: <https://cse340-course-repo-lvip.onrender.com>

## MVC structure

The application now follows an explicit Model-View-Controller structure. Parameterized PostgreSQL functions are in `src/models`; controllers retrieve and prepare data in `src/controllers`; `src/routes.js` maps URLs to controllers; and EJS templates in `src/views` render the response. `server.js` is limited to application setup, shared middleware, routing, centralized errors, startup, and shutdown.

## Detail pages and relationships

- `/organization/:id` displays one organization and links every project sponsored by it.
- `/projects` displays the next five upcoming projects, with links to each project and partner organization.
- `/project/:id` displays one project, its partner link, and linked category tags.
- `/categories` links every category to its detail page.
- `/category/:id` displays one category and all linked projects.

All IDs from route parameters are validated. All database lookups that include route values use PostgreSQL placeholders. Missing or malformed resources return a custom 404 page, while unexpected errors and query failures return a custom 500 page without exposing production details.

## Verification

`npm run verify:w03` passed against a disposable PostgreSQL schema. It exercises all list and detail routes, next-five limiting, relationship links, category tags, output escaping, invalid and missing IDs, custom 404 and 500 pages, database failure and recovery, and MVC source organization. `npm run verify:w02` also passed as a regression suite.

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week03/assignment.html>
