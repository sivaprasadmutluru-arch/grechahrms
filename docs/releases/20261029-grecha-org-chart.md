# GRECHA org-chart-only web release — 29 October 2026

- Release: `cloudhrms-20261029-grecha-org-chart.jar`
- SHA-256: `b38cb36289388248224a66f98d22d85b40e2e3125c355622f1e4111ff926f32f`
- Previous production SHA-256: `011e95b0fede5e85fee4c7e700a1812659941a924abf2f488f1486f568a7b9a6`
- Rollback copy: `/opt/cloudhrms/backups/cloudhrms-before-20261029-grecha-org-chart.jar`

The unmodified GRECHA source build matched every current production web file
byte-for-byte. The release uses that baseline, not the Accrue-customized branch.
An isolated source override replaces only OrgChartPage and adds its grouping
and company-scoped loading helpers. Existing main source files are untouched.

The selected company's department configuration determines department-first
grouping. If no departments exist or are assigned, grouping uses job position.
Missing values appear as Unassigned. Visual groups organize siblings; actual
manager relationships, cross-department reports, and orphan roots are preserved.
No CEO/COO hierarchy or fixed Pioneer department names are fabricated.

Validation: 16 grouping/data-isolation unit tests, 25 total web workflow tests,
and a successful GRECHA production build. The global stylesheet remains exactly
`index-DJmVzq3N.css`. All 1,329 non-static JAR entries are byte-identical to the
baseline. No database migration or data update is part of this release.

The unchanged live PayrollController already contains the statement
“This is a system-generated payslip and does not require a signature.” and
contains none of the Employee Signature, Company Stamp, or Authorized Signatory
labels. No payroll backend change is necessary for that request.

Build: `tmp/vite.grecha-org-chart.config.mjs`, using isolated source under
`hrms/target/org-chart-grecha-source/` and output `hrms/target/org-chart-grecha-web/`.
Deploy/verify/rollback: `deploy_grecha_org_chart_20261029.py`.

## Production verification

Activated on 29 October 2026. Service PID 114465 started successfully in 23.214
seconds. Local and public homepage returned HTTP 200. The anonymous org-chart API
returned HTTP 401. Public SHA-256 checks matched `index-BU_Cv8hU.js`,
`OrgChartPage-DeNH76A-.js`, and the unchanged `index-DJmVzq3N.css`.
No authenticated company UI session or new payslip PDF was generated in this check.
