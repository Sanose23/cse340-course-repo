# W04 Submission and Deployment Checklist

Student: Joseph Lawal

Course source: <https://byui-cse.github.io/cse340-ww-course-v2/week04/index.html>

## Completed locally

All six learning-activity features, project editing from the team activity, category creation/editing, shared session feedback, server and browser checks, and the additive project-title migration are implemented in Joseph's repository. W04 verification passed with 349 invalid submissions and transactional/concurrent-update checks. W03 regression checks passed. Documentation, discussion responses, reflection draft, original coaching prompt, and an explicitly labeled coaching rehearsal are saved separately from Markson's deliverables.

## Week 4 deployment evidence

- Repository: <https://github.com/Sanose23/cse340-course-repo>
- Hosted application: <https://cse340-course-repo-lvip.onrender.com>
- Render deployment: `dep-dbtemds9v7es73adnkq0`, Live on November 16, 2026
- Deployment bundle: <https://github.com/Sanose23/cse340-course-repo/releases/tag/deploy-w04-20261115>
- Evidence: `docs/evidence/w04/deployment.json`

Joseph's isolated GitHub and Render accounts, the `Sanose23` remote, the service repository, and the intended production database were verified before every external operation. A generated private `SESSION_SECRET` was configured only in Joseph's service. The hosted title column was expanded from 150 to 200 characters while preserving 3 organizations, 15 projects, 4 categories, and 24 links.

Joseph's verified Week 4 source is committed and pushed to `main` through his isolated Git wrapper. Hosted verification covered all forms, invalid input, sticky values, flash lifecycle, organization/project/category creation and updates, partner selection, canonical and alias category assignment, missing records, errors, and the placeholder image. Temporary hosted test records were removed transactionally and the original seed counts were rechecked.

## Deployment maintenance

The prerelease asset records the initial archive deployment. After the authorized source commit and push, Joseph's service was restored to the normal `npm install` build command and redeployed from `main`; the release is no longer an active build dependency. Never use Markson's account or rerun the seed setup against Joseph's initialized database.

## Real student actions still required

- Attend the one-hour Teams meeting or complete the actual absence checklist and channel post.
- Complete the learning and team quizzes in Canvas; no questions or attempts are represented in these files.
- Conduct a real coaching session of at least 30 minutes with actual Joseph responses and snippets for all four topics. Save and upload the entire real conversation. The rehearsal is not an actual transcript and must not be presented as one.
- Review the reflection draft so it describes Joseph's real experience.
- Submit the repository and verified hosted URLs, actual coaching transcript, and status update through their separate Canvas assignments.
