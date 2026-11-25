# W05 Authentication and Authorization Review

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week05/assignment.html>

| Published requirement | Local implementation evidence |
| --- | --- |
| Users and login functionality | Registration hashes passwords with bcrypt cost 10, assigns the default `user` role, handles duplicate emails, authenticates with generic failures, regenerates the session, and supports logout. The admin-only `/users` page displays name, email, and role without password hashes. |
| Protected access | `/dashboard` uses `requireLogin`. `/users` and every create/edit/category-assignment GET and POST route use `requireRole('admin')` before processing. Public lists and details remain public. |
| Link visibility | Guests see Register/Login; authenticated users see Dashboard/Logout. Management links and the registered-users link appear only for admins. Server middleware still enforces every restricted route. |
| Code organization | User SQL and bcrypt comparison are in `src/models/users.js`; request coordination and middleware factories are in `src/controllers/users.js`; routes stay in `src/routes.js`; EJS handles presentation. |
| Deployment and style | Account forms, dashboard, and user table extend the responsive shared design. Week 5 is locally verified but not yet deployed or submitted. |

## Security and implementation decisions

- Passwords are limited to 7 through 72 UTF-8 bytes, hashed before persistence, never retained in sticky form data, and never returned in the user list or session.
- Login errors do not reveal whether an email exists. Successful login regenerates the session ID before storing an allowlisted user object.
- Logout destroys the authenticated session and clears the session cookie.
- The `users.role_id` foreign key is required. `src/setup.sql` seeds only `user` and `admin` roles, never a plaintext or hashed user account.
- The dedicated `admin@example.com` account with official test password must be created through registration and promoted in the intended database when deployment is authorized. The local integration suite does this only in a disposable schema.
- The official database refresh activity asks learners to replace a free Render database. Both existing databases are still available through December 2026, so no destructive hosted replacement was performed without an explicit deployment request.

No grade is claimed without instructor assessment. No Teams attendance, quiz, Canvas submission, real coaching session, or Week 5 deployment is represented by this review.
