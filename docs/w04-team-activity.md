# W04 Team Activity: Updating Service Projects

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week04/team-activity.html>

## Implemented in Joseph's project

The project update model binds every value separately from its SQL and checks that the requested project was actually updated. The GET controller retrieves current project details and all organizations. The form renders existing title, description, location, date, and selected organization with escaped EJS output. The POST controller obtains the resource ID from the route, validates the submitted body, checks the referenced partner, and redirects to the updated detail page with one-time feedback.

`npm run verify:w04` exercised the actual repository, including successful partner reassignment, invalid dates and partners, missing IDs, unchanged unrelated rows, and unexpected database failures.

## Discussion responses

1. **What organization-table data changes when a project moves to another partner?** None. The update changes `project.organization_id` to another existing organization ID. The organization records are not being edited.
2. **What if the GET controller does not retrieve the existing project?** The edit form cannot show current values reliably and could render undefined data. It must first validate the route ID and return 404 if there is no project.
3. **Why retrieve all organizations?** Their names and IDs populate the partner dropdown. The current ID marks the selected option; the remaining options allow reassignment.
4. **How can display and processing share the same URL?** Express selects a route using method and path together. GET `/edit-project/:id` displays the form; POST at the same path validates and processes the body.

## Participation status

The public activity requires a one-hour synchronous Teams meeting, rotating leadership, prayer, and a ten-minute code review. This technical document does not claim Joseph attended a meeting, shared a screen, received teammate feedback, or submitted a quiz. Those facts cannot be inferred from implemented code.

The [absence checklist](https://byui-cse.github.io/cse340-ww-course-v2/week04/team-absent.html) requires a real notification and one or two paragraphs posted to the team channel if the learner was absent. This file does not assume an absence or claim any post.

## Optional technical channel-post draft

The service-project update follows the existing MVC pattern. A GET request loads the requested project and the organization list; EJS renders a form with current values and the correct selected partner. A POST request reads the named fields, validates them, and delegates the targeted update to a parameterized model function. Reassigning the partner changes only the foreign key on the project.

Local verification checks valid updates and unsuccessful requests rather than relying only on a page looking correct. It confirms that invalid inputs and missing records do not modify data, that error feedback survives a redirect, and that refresh does not repeat a write. A useful discussion question is how to distinguish an invalid organization ID from an unavailable database, since those situations need different responses.

This is an AI-assisted draft based on Joseph's actual code, not a submitted Teams message or evidence of personal experience.
