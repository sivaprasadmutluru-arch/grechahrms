# Grecha VPS migration — 4 November 2026

Source: `200.97.171.126`; destination: `200.234.42.137`.
User authorised setup and migration of the empty destination VPS.

Destination detected as Ubuntu 26.04.1 LTS, x86-64, 2 vCPU, 8 GB RAM,
96 GB usable disk. Java 21 and Nginx installed from Ubuntu packages;
PostgreSQL 16 installed from the official PGDG repository to match production.

Migration helper: `tmp/migrate_vps_20261104.py`, credentials supplied only by
transient environment variables. Do not commit runtime settings or backup data.

Staging copies the actual live JAR, private `.env`, service definition,
Nginx/TLS configuration, a fresh PostgreSQL custom dump, and media/uploads.
Database ownership and the application login are retained. File transfers are
SHA-256 checked. Sensitive archives are root-only on each server.

No DNS cutover or source shutdown has been performed. The staged database is a
point-in-time copy and is not automatically kept in sync. A final maintenance
window and refreshed database/files are required before accepting live traffic.

Never let the staging application send live mail, run external integrations,
or receive real employee writes while the old server is still the source of truth.

## Staging verification

- Fresh dump restored with `pg_restore --exit-on-error`; 10 company records and
  234 public user accounts. Destination database locale matches source C.UTF-8.
- 212 files restored under media/uploads. Transfer checksums matched, including
  the database dump, media archive, `.env`, service definition, and TLS archive.
- JAR SHA-256: `51667a5db1981c442857a1f84f390e531f3ea249760fb0ee21b298497b13a27c`.
- Isolated test boot completed in 17.743 seconds; homepage HTTP 200 and anonymous
  regularisation approval HTTP 401. Database and app listen only on loopback.
- Test unit uses systemd IPAddressDeny=any, IPAddressAllow=localhost; no public
  test traffic was enabled. No authenticated employee operation was performed.
- Copied Nginx/TLS configuration passed `nginx -t`; Certbot installed, with its
  timer disabled until cutover. Test app and Nginx stopped after checks.
- Production service is not installed/enabled on the new server yet. Source
  remains live and authoritative. Final write pause, fresh restore, activation,
  DNS switch, certificate renewal check, and end-to-end tests remain pending.
- New root password was shared in chat and should be rotated after access is
  secured. Neither supplied password is saved in the helper or this document.
