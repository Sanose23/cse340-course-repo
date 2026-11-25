# W05 Submission and Deployment Checklist

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week05/index.html>

## Completed locally

- Roles/users schema, bcrypt registration, login/logout, session rotation, dashboard, protected routes, admin link visibility, and admin-only registered users page.
- W05 integration verification plus W04 and W03 regressions.
- Exact coaching prompt, separate rehearsal, rubric evidence, team responses, and reflection draft.

## Not yet performed

- Week 5 Git commit/push and Render deployment.
- Hosted auth migration and creation/promotion of `admin@example.com` with the official grader password through registration.
- Hosted authentication/authorization browser verification.
- Render database replacement. The current Joseph Lawal database is available through December 2026; deleting it would be destructive and is unnecessary before an explicit deployment decision.
- Canvas quizzes/submissions, Teams participation, and a real 30-minute coaching conversation.

## Authorized deployment sequence

1. Verify Joseph Lawal's GitHub/Render identities and the `Sanose23/cse340-course-repo` remote.
2. Back up or verify seeded counts, apply `src/migrations/w05-auth.sql`, and confirm roles/users constraints.
3. Deploy the reviewed commit with bcrypt installed.
4. Register the official admin through the hosted form, promote it with the documented role update, and never place its hash in source control.
5. Verify guest, regular-user, and admin access, direct forbidden POSTs, users-page privacy, session rotation, logout, and error recovery.
6. Record evidence and remove all temporary test accounts except the required grader admin.
