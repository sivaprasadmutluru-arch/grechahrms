# Grecha HRMS

Source snapshot published on 22 November 2026. Includes backend, web, Android/iOS mobile code, tests and database migration scripts.

## Repository layout

- `hrms/`: Spring Boot backend. Migrations are in `hrms/src/main/resources/db/migration/`; historical SQL is also documented in `hrms/docs/migrations/`.
- `hrms-web/`: React/Vite web application, including CARR improvements.
- `hrms-mobile/`: React Native Android and iOS application (latest local `hrms-mobile` checkout, source commit `b13281e`).
- `docs/`: CARR implementation notes.

`main` contains the combined source. Component branches `hrms-backend`, `hrms-web` and `hrms-mobile` contain their respective projects at the branch root.

## Backend and web

Use Java 21, Maven, Node.js and PostgreSQL. Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` and `UPLOAD_DIR` in the environment. Email additionally needs `SMTP_USERNAME` and `SMTP_PASSWORD`. Keep credentials outside Git.

For a backend-only build: `cd hrms` then `./mvnw -Dfrontend.skip=true package`. For the combined checkout, the default Maven frontend build expects sibling `hrms-web`. For separate component branches, clone the web branch as that sibling, or use `-Dfrontend.skip=true`.

For web development: `cd hrms-web`, `npm ci`, then `npm run dev`. The default API proxy is `http://127.0.0.1:8080`; override with `VITE_API_TARGET` when needed.

## Database migrations

Migration SQL is source code, not a database backup. Existing migrations include historical and manually applied scripts: review the target schema, prerequisites and prior application status before executing. Back up the database before changes. Do not blindly rerun every SQL file. `R__carr_company_settings.sql` must be applied before activating the backend entity with schema validation.

## Mobile

Use the versions specified in `hrms-mobile/package.json`. Run `npm ci`; set up Android SDK/Java or Xcode/CocoaPods as appropriate. Release signing uses private local `android/keystore.properties` and a signing keystore; these are deliberately not included. Configure them separately to produce signed releases.

## Excluded intentionally

Production credentials, environment files, private signing keys, real database dumps, employee uploads, node_modules, local tooling, runtime logs and compiled JAR/APK/AAB files. Pushing this repository does not deploy any service.
