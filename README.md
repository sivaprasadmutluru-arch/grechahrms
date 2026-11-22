# Grecha HRMS backend

Java 21 / Spring Boot backend with tests and database migration source.

Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` and `UPLOAD_DIR` externally. SMTP credentials use `SMTP_USERNAME` and `SMTP_PASSWORD`. No production credentials are included.

Backend-only build: `./mvnw -Dfrontend.skip=true package`. The default frontend build expects the web project as sibling `../hrms-web`.

Review migrations in `src/main/resources/db/migration/` and `docs/migrations/` against the actual database before applying; do not blindly rerun historical SQL. Back up first. Apply `R__carr_company_settings.sql` before activating the associated entity with schema validation.
