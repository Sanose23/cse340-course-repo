# W03 Team Activity: Displaying Service Projects

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week03/team-activity.html>

## Completed implementation

The project model now has `getUpcomingProjects(numberOfProjects)` and `getProjectDetails(projectId)`. Both queries join `organization` because project rows store only the sponsor ID while the pages also need the sponsor name. Both user-controlled or controller-supplied values use PostgreSQL placeholders rather than interpolation.

The projects controller defines `NUMBER_OF_UPCOMING_PROJECTS = 5`, asks the model for that number of future projects, and renders the project detail view for `/project/:id`. The route parameter is appropriate because the ID identifies the resource being requested. The EJS list does not limit records itself; it renders the already-limited array provided by the controller.

## Discussion responses

A `JOIN` is required to combine each project with the readable organization name. Placeholders keep data separate from SQL syntax and protect the query from injection. A route such as `/project/1` clearly identifies one resource, while query parameters are better suited to optional filtering or display choices.

The view uses escaped `<%= ... %>` output because database values can still contain unsafe text, whether inserted through a future form, migration, import, or compromised process. Each list item becomes ordinary HTML containing links to `/project/:id` and `/organization/:id` after EJS renders on the server.

`npm run verify:w03` confirms the next-five limit, project details, partner links, and failure paths.
