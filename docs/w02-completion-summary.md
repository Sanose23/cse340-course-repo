# W02 Completion Summary

- Student: Joseph Lawal
- Project: CSE 340 Service Network
- Repository: <https://github.com/Sanose23/cse340-course-repo>
- Hosted site: <https://cse340-course-repo-lvip.onrender.com>

## Database

The Render PostgreSQL database is in Ohio, matching the existing web service. `src/setup.sql` is a complete recreation script for an empty schema. It creates:

- `organization`, with the three course organizations and all required fields;
- `project`, with a required sponsor foreign key and five projects per organization;
- `category`, with four unique category names;
- `project_category`, with a composite primary key and cascading foreign keys for the many-to-many relationship.

Every project has at least one category, several have two, and every category is used. Database initialization is separate from application startup and credentials remain in ignored local configuration and Render environment settings.

## Application flow

The request flow is:

`browser → Express route → model → PostgreSQL → model rows → EJS view → HTML response`

`src/models/organizations.js`, `projects.js`, and `categories.js` explicitly select the required columns and return `result.rows`. Project retrieval joins the sponsoring organization. The `/organizations`, `/projects`, and `/categories` handlers await their model functions and pass the results to EJS. The home page also previews database-backed records.

The organization page renders names, descriptions, emails, and logos. The project page renders all 15 records in the required `Date: Project Title (Organization Name)` format plus descriptions and locations. The category page renders category names without project lists, as required for Week 2. Database values use escaped EJS output.

## Verification

The full `npm run verify:w02` integration suite passed on November 11, 2026. It created a disposable schema, ran the actual setup SQL, tested constraints and relationships, launched the actual application, verified all four routes and assets, inserted new records to prove live database-to-EJS flow, checked output escaping, exercised database failure recovery and empty states, then removed the disposable schema.

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week02/assignment.html>
