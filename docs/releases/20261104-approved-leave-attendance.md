# Approved leave in attendance reports — Grecha only

Scope: grecha.ai production (200.97.171.126). Do not deploy to or change the
independent VPS (200.234.42.137).

## Confirmed live data and cause

The Greater Change company 7 / schema greater_change, Lakshmi Ravindrakumar,
employee 13, has three APPROVED Leave Without Pay requests:

| Request | Date | Duration | Units |
|---|---|---|---|
| 46 | 2026-10-02 | SECOND_HALF | 0.5 |
| 47 | 2026-10-14 | FIRST_HALF | 0.5 |
| 48 | 2026-10-22 | FULL_DAY | 1 |

Approval timestamps are 2 November 2026, and leave work records already exist.
Attendance rows also exist on all three dates: 09:00–13:06 on 2 October,
09:00–13:33 on 14 October, and empty punch fields on 22 October. Both full-view
attendance and downloads previously consulted leave only when there was no
attendance row. The empty placeholder therefore also hid full-day leave.

## Reporting-only fix

- ApprovedLeaveOverlay annotates stored/virtual report rows with approved leave,
  preserving actual punches, original quality status and worked hours.
- Labels distinguish full day, first half and second half, including 0.5 units.
- Monthly register overlays approved leave, uses HL for a half day / OL for a
  full day, and sums decimal leave units (these three dates total 2.0 days).
- Register UI supports HL; Excel status labels wrap, and the register includes a
  legend. Existing attendance-export column order remains unchanged.
- Same-company / employee / date / APPROVED / active checks guard the overlay.
- No changes to stored punches, approvals, work records, balances or payroll.

## Verification

54 targeted tests passed: overlay 6, report/Excel 4, exemptions 5, response DTO 1,
manager notifications 7, team attendance 7, team workspace 8, reviewer identity 11,
and regularisation 5. This corrects the preliminary commentary count of 55.
Integration tests reproduce all three dates and inspect both Excel workbook
formats, including first/second-half labels and the 2.0-day register total.

The isolated baseline matches the current team-approvals production artifact.
Global CSS, org-chart source, manager-approval implementation and unrelated
payroll code are preserved. No authenticated production download was performed;
tests use representative live-derived date/duration/punch fixtures, not a forged
production identity. A normal Jeya session is still required to confirm her UI.

Release SHA-256:
`9d6c7333bd8154dda2da7c82666c262786367172c0c79136b9edb2ce7c6916d4`.
Deployment helper: deploy_leave_attendance_20261104.py.

## Production activation

Deployed 4 November 2026, service startup completed 11:57:52 UTC / 17:27:52 IST,
PID 167993, startup 25.047 seconds. Live SHA-256 matches the release above.
Local/public home HTTP 200; anonymous team API HTTP 401. Public entry
index-DRT7EH0T.js, AttendanceRegisterPage-XFGHiduh.js,
AttendanceRegularisationPage-D3Am5Cdr.js and existing index-DJmVzq3N.css matched
the tested local assets. Full database/JAR rollback backups are on production
under cloudhrms-before-20261104-approved-leave-report.{dump,jar}.

Post-deployment read-only checks confirm leave requests 46,47,48 remain APPROVED,
Jeya has seven regularisation notifications, and Veracity still has seven PENDING
regularisations. No leave/punch/balance/payroll/request-status records were
modified. The independent VPS was untouched throughout this reporting fix.
