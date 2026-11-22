# Regularisation reviewer identity — 29 October 2026

The old Approve and Reject implementations required an employee profile for the
reviewing user in the selected tenant. Goods Collective user 126 has active admin
roles but no local employee profile, so both actions failed before review.

New decisions record the authenticated public user ID and a name snapshot.
The historical employee link remains optional and is kept only when an active
employee belongs to the request's company. Legacy records still display their
existing employee reviewer information. No dummy employee profile is created.

User identity must match AccessScopeContext. Company access and selected-company
filter are validated before recording a decision. Existing endpoint approval
authority and My Team direct-report checks remain unchanged. Existing status,
exemption and rejection-reason validations remain in effect.

## Deployment

- Baseline SHA-256: `b38cb36289388248224a66f98d22d85b40e2e3125c355622f1e4111ff926f32f`
- Release SHA-256: `51667a5db1981c442857a1f84f390e531f3ea249760fb0ee21b298497b13a27c`
- Release: `/opt/cloudhrms/releases/cloudhrms-20261029-regularisation-reviewer.jar`
- JAR rollback: `/opt/cloudhrms/backups/cloudhrms-before-20261029-regularisation-reviewer.jar`
- Database backup: `/opt/cloudhrms/backups/cloudhrms-before-20261029-regularisation-reviewer.dump`

Only AttendanceRegularisationRequest (and enums), RegularisationRequestDto,
AttendanceRegularisationService, the additive migration and its startup runner
are packaged. All web assets, GRECHA org-chart changes and payroll classes remain
byte-identical. The separate, pending payroll-capabilities fix is excluded.

The migration adds four nullable audit fields and public.users foreign keys in
each existing regularisation table. Dry-run passed with ROLLBACK, then migration
committed before JAR activation so Hibernate validation sees the new columns.
All 10 schemas have the 40 audit columns. Historical reviewer data and request
statuses are not rewritten. Existing employee-only audit fields are not removed.

Validation: 31 focused tests passed: reviewer identity 11, regularisation 5,
reporting-team attendance 7 and team workspace 8. Goods Collective counts remained
5 PENDING and 6 APPROVED after migration. No real requests were approved/rejected
as a deployment test.

Production verification on 30 October 2026: the live JAR matches the release
SHA-256 above; cloudhrms is active (PID 115547), with activation recorded as
29 October 2026 at 12:11:50 UTC. Local and public home pages return HTTP 200.
Anonymous approval returns HTTP 401. Public main, org-chart and CSS asset checks
passed. Goods Collective still has 5 PENDING and 6 APPROVED requests, with zero
new user-audited decisions. No additional restart was needed when deployment
resumed, because the requested artifact was already active. An authenticated
end-to-end approval was not performed against real requests.
