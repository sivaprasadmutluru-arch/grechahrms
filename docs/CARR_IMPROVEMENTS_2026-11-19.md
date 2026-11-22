# CARR improvements — 19 November 2026

## Status

Implemented and verified locally, then deployed on 19 November 2026 to the new production VPS (`200.234.42.137`, `grecha.ai`). No Git push or production data reset was performed as part of this release.

The live JAR SHA-256 is `9d87dead429ebefd8e980c276b8ea2677b3ca5d9d6178cf92ef1aec37ed8c813`. The previous JAR and a full database backup are retained at `/opt/cloudhrms/backups/carr-workflow-20261119T111102Z`. Revision-column coverage is 10/10 schemas. Public HTTP checks return 200 and the new CARR bundle contains the regenerate label, revision action and approval queues. Anonymous CARR API requests remain protected (401).

The active frontend comparison matched 168 unrelated chunks after normalizing hashed filenames. Only CARR, notification routing and generated CSS changed functionally. The release was built over the exact deployed JAR, preserving unrelated backend classes and existing hashed assets.

A recurring biometric `Unknown device tenant; retry after device registration` error was observed both before and after deployment in the ADMS controller. It predates this CARR release and was not modified here.

## Functionality

- Opening final review does not submit a CAR. Employee and future-hire flows require explicit final confirmation.
- HR has a Job Descriptions navigation entry, separate from employee performance agreements. Existing internal/external JD and assignment functionality is retained.
- Published CARs are not editable. HR can create a separate numbered draft revision with cleared results and acknowledgement/review state. The old version stays published until the new version is approved and acknowledged; it is then archived. Archived agreements cannot bypass acknowledgement by being restored directly to Published.
- Administrators cannot approve their own CARs. Assigned reporting managers can approve using their Employee role; no artificial Manager role is required.
- Editable KPI starters differ by designation. They define units, measurement rules, deadlines and weights. Saved company role targets take precedence. Suggestions never invent employee results. A rating without an actual is not silently saved as zero.
- CAR queues cover personal agreements, team agreements, approvals, acknowledgements, reviews due and requested changes. Manager queues display employee names. Employee preview does not grant administrative access.
- Status-change notifications and daily pending-action reminders go to the relevant manager, employee or HR fallback. Reminders are in-app only, not email or background push. Database locks and an audit deduplication key prevent repeated reminders to the same recipient/stage/day.
- Internal reward details are withheld from an ordinary employee's API response when employee visibility is disabled.

## Verification

- 77 backend tests: zero failures/errors/skips, including a real PostgreSQL/MVC/method-security/company-interceptor lifecycle test.
- HTTP/database assertions cover cross-company and unrelated-user access rejection, revoked assignments, administrator self-approval rejection, reporting-manager approval, employee-only acknowledgement, revision isolation, old-version archival and daily reminder deduplication.
- 11 headless-Chrome journeys using actual React components and synthetic API data: all passed, no browser JavaScript errors.
- Four frontend creation-helper tests passed.
- Web release build passed.
- Revision SQL applied twice successfully in a rolled-back transaction in a disposable local PostgreSQL database.

The HTTP test uses actual repositories and PostgreSQL, but supplies an authenticated principal through Spring Security test support; it does not exercise the live JWT login endpoint. Browser fixtures never connect to production.

## Deployment prerequisite

Apply `hrms/src/main/resources/db/migration/R__carr_document_revisions.sql` to public and existing tenant schemas before activating the updated JAR, because production uses Hibernate schema validation. The script is idempotent and preserves CAR/HR data. Deploy the backend and web changes together after checking the current live baseline; preserve unrelated Antigravity changes. The only permitted production target is the new VPS `200.234.42.137` (`grecha.ai`).

The opt-in database test uses only `127.0.0.1:55439/carr_qa`, requires `CARR_POSTGRES_QA=true`, and creates/drops its disposable test schema. Never point it at an application database.
