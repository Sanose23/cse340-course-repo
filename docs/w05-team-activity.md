# W05 Team Activity: Admin Role

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week05/team-activity.html>

## Completed technical work

The user lookup joins `roles` so authenticated session data includes `role_name`. `requireRole(role)` is a middleware factory that redirects unauthenticated requests to login and redirects authenticated users with the wrong role to the dashboard. Every organization, project, category, and category-assignment management route uses `requireRole('admin')` for both GET and POST. EJS shows those links only to admins.

The dedicated grader account is exercised in the local W05 verifier by registering `admin@example.com` with the course-provided test password and promoting that row to the admin role in a disposable schema. The setup SQL does not publish a reusable password hash. Hosted creation and promotion remain part of an authorized deployment.

## Discussion responses

1. **Authentication versus authorization:** Authentication verifies the identity represented by valid credentials. Authorization runs after identity is known and determines whether that user role may perform a requested action.
2. **Why `requireRole` is a factory:** The outer call captures the required role when routes are defined. It returns the normal `(req, res, next)` middleware that compares each request's authenticated role with that captured value.
3. **Why hiding links is insufficient:** A user can type a URL or send a direct POST without using the displayed navigation. Server middleware must reject the request before validation or mutation code executes.

## Participation status

The official activity calls for a one-hour synchronous Teams meeting, prayer, rotating leadership, and a ten-minute code review. This document records implemented code and prepared responses only; it does not claim attendance, teammate feedback, or a quiz attempt.

If absent, the official checklist requires real team notification and a one-to-two paragraph Teams post. No message was posted by this assistant.
