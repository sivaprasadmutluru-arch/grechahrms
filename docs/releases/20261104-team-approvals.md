# Reporting-manager attendance approvals — Grecha only

Scope: production `grecha.ai` at 200.97.171.126. The independent instance at
200.234.42.137 is explicitly excluded from this change.

## Confirmed cause

Veracity company 80, schema `veracity_world_general_trading_llc`: Jeya Theebam,
employee 2 / public user 260, is active and has an active EMPLOYEE / SELF
assignment. Ten active employees reference her in both employee and work-profile
reporting-manager fields. Seven PENDING requests from Rabin Katwal (employee 6)
exist, but zero REGULARISATION_SUBMITTED notifications were delivered to Jeya.

Submission notifications previously targeted only a hard-coded admin/HR role
list. The web regularisation screen also exposed approval queues only to admin
roles, despite existing relationship-scoped `/api/team/regularisation` review
endpoints. No manager reassignment or admin promotion is necessary.

## Fix

- Notify the active, same-company reporting manager with an active user account.
  Use the existing authoritative ReportingManagerService resolver, exclude self,
  deduplicate managers who are also admins, preserve the existing admin audience.
- Web Team Approvals tab and pending badge, driven by actual direct reports from
  `/api/team/employees`; review requests use only `/api/team/regularisation`.
- Reuse existing server-side direct-report and company checks on every decision.
  No company-wide approval authority is granted to Jeya or other employees.
- Abort stale team requests and remount the workspace on company/user changes.
- Backfill only missing in-app notifications for Jeya's still-pending direct-report
  requests. No status changes, approvals/rejections, email blasts or role edits.

## Release validation

38 targeted backend tests passed (7 notification, 5 regularisation, 11 reviewer
identity, 7 team attendance, 8 team workspace). Web build passed; changed-file
lint has zero errors and one existing React Hook Form compiler warning.

The isolated baseline rebuilt 170 live web files byte-for-byte. Build overrides
preserve live payroll sources from f28335f and the deployed GRECHA org-chart
source, excluding pending payroll changes. Global CSS and all backend classes
except AttendanceRegularisationService and its switch helper are preserved.

Deployment helper: `deploy_team_approvals_20261104.py`. Includes checksum guards,
full database/JAR backups and JAR rollback. No schema migration is needed.

## Production verification

Deployed 4 November 2026; service started at 09:51:42 UTC (15:21:42 IST),
PID 166726, startup 26.072 seconds. Live JAR SHA-256:
`2bd9504e3e1d45550b8ea93b3d54190fc981ba84723ac7f13bfbd0c6e5e5c0f6`.

Backup artifacts on production:
`/opt/cloudhrms/backups/cloudhrms-before-20261104-team-approvals.jar` and
`/opt/cloudhrms/backups/cloudhrms-before-20261104-team-approvals.dump`.
The database backup archive catalog was validated before activation.

Local/public homepage HTTP 200; anonymous team endpoint HTTP 401. Public entry
`index-BaTrGrFE.js`, screen `AttendanceRegularisationPage-EjLrCYkp.js` and existing
`index-DJmVzq3N.css` matched local build checksums. Seven missing notifications
were inserted into the Veracity tenant for Jeya; request counts remain seven
PENDING, with no decisions made. No role or reporting relationship was changed.

Authenticated testing as Jeya was not performed; her password was not changed.
User should refresh/sign in and open Attendance > Regularisation > Team Approvals.
No write or deployment was made to the independent VPS during this fix.
