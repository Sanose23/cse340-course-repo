# W02 Team Activity Responses

Student: Joseph Lawal

## Discussion responses

### 1. What happens without the foreign key?

PostgreSQL could accept an organization ID that does not exist. That would create an orphaned project and make the sponsor join unreliable. The foreign key enforces referential integrity so every project points to a real organization.

### 2. Why place project queries in the model?

The model keeps database access separate from routing and presentation. This makes the query easier to reuse, test, and maintain while allowing the route to focus on HTTP behavior and the view to focus on HTML.

### 3. What is the difference between the EJS output tags?

`<%= ... %>` escapes output and is appropriate for database or user-controlled values. `<%- ... %>` renders unescaped HTML and is used here only for trusted header and footer partials.

## Individual activity summary

I modeled the organization-to-project relationship with a required foreign key and the project-to-category relationship with a junction table. I added five projects for each of the three organizations, joined projects to their sponsor names in the model, and displayed user-friendly dates in EJS. The most important lesson was that table relationships and constraints protect the data before it reaches Node.js, while models, routes, and EJS each have separate responsibilities in delivering it safely.

My remaining question is how the next week will use category relationships to retrieve and display only the projects in a selected category.

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week02/team-activity.html>
