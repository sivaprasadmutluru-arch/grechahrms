# Company-scoped payslip access

The payslip page must not decide self-service mode merely because a user has an
EMPLOYEE role. Employees can also hold valid payroll administration assignments.

`GET /api/payroll/access` is a read-only capability response derived from the
**current request's scoped Authentication** and AccessScopeContext. It never
reads the principal's global authority collection, grants roles, or changes
permissions. Existing AccessScopeInterceptor handling remains authoritative for
company assignment validity, role expiry/revocation and partial Account Manager
payroll exclusions. An inaccessible company fails closed.

The response distinguishes company payslip viewing, own published payslips,
generation, submission, approval, export and import. Generation/submission follow
the existing endpoint role guards; approval requires payroll:approve. Preparation
does not imply approval. Accountant approval does not imply generation access to
an endpoint that excludes accountants. Backend actions still enforce their
existing guards independently of button visibility.

Company management is the default when permitted, even for an EMPLOYEE +
COMPANY_ADMIN account. A My payslips switch retains personal access using the
employee ID resolved in the active tenant, not a stale home-company profile ID.
Employee-only accounts stay in personal mode. Missing/failed capability checks
do not fall back to an administration view. Company switches unmount dialogs,
abort stale requests and clear/ignore earlier company responses.

Bulk generation now targets the explicitly selected company only. Accessible
branches are authorization boundaries, not an implicit generation selection.
There is no schema migration or role-assignment/password modification.

Deployment order: deploy the capability endpoint/backend first, then the web
changes. A new web build against an old backend will deliberately show an access
verification error rather than guessing permissions. This change does not
standardize every legacy payroll endpoint or the loan/reimbursement screens;
those remain separate follow-up audit scope.

Verification on 29 October 2026: 24 focused backend tests (capabilities,
tenant-local profile resolution, selected-company generation and existing
UserPrincipal behavior), 23 frontend workflow tests, changed-file lint, and the
GRECHA production build passed. No production deployment, role assignment,
database update, or GitHub push was performed for this fix.
