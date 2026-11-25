# W05 Completion Summary

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week05/index.html>

The local Service Network now has role-based accounts. The database setup and additive migration create `roles` and `users`, seed `user` and `admin` roles, and retain password hashes only. Registration validates name, normalized email, and bcrypt-safe password length before hashing. Login compares the submitted password with the stored hash, regenerates the session, and stores only user ID, name, email, and role. Logout destroys authentication.

A protected dashboard shows the current account. Admins additionally see a link to `/users`, where all accounts are listed without hashes. Server middleware protects the dashboard, registered-users page, and every Week 4 management route. EJS hides restricted links for guests and regular users, but route authorization remains the security boundary.

## Verification

- `npm run verify:w05` passed against a disposable local PostgreSQL schema, covering schema constraints, registration, hashing, duplicate emails, generic login failures, session rotation and isolation, logout, regular/admin access, direct POST protection, link visibility, admin account behavior, user listing, and database-failure recovery.
- `npm run verify:w04` passed through its test-only admin bypass; production cannot enable that bypass because it requires `NODE_ENV=test`.
- `npm run verify:w03` passed as an MVC/error regression.
- JavaScript syntax and representative EJS renders passed throughout implementation.
- Real headless Chrome on a 375-pixel viewport verified Joseph's registration, login, dashboard persistence, regular-user denial, logout, labeled required controls, and no horizontal overflow. Evidence is in `docs/evidence/w05`.

## External status

Week 5 has not been deployed, committed, pushed, or submitted. The two existing free Render databases are currently available beyond the course end, so the destructive database-recreation activity was documented rather than performed without deployment authorization. The official grader admin exists only in disposable local verification; deployment must create and promote it in each learner's own hosted database.

The coaching transcript is an explicitly labeled AI-authored rehearsal, not Joseph Lawal's actual responses or evidence of the required 30-minute discussion. Team and reflection documents are drafts grounded in real code, not participation claims. AI assistance is disclosed; the learner must understand submitted work and follow the course policy.
