# Grecha final VPS data sync — 9 November 2026

User authorised final production sync from `200.97.171.126` to `200.234.42.137`.
DNS was not changed by the sync operation. The user subsequently changed the A
record in GoDaddy; post-cutover checks below confirm the new address.

## Completed

- Paused both application services and returned maintenance responses during the sync.
- Created PostgreSQL custom-format dumps and media/uploads archives on both servers.
- Transferred source backups with SHA-256 verification.
- Restored source data to a separate candidate database before activation.
- Compared row counts and row-content hashes: all **2,585 tables matched**.
- Restored **213 uploaded files**.
- Retained the destination's previous database and media/uploads for recovery; deleted nothing.
- Activated the synced database as `cloudhrms_prod` on the new VPS.
- Preserved new VPS database credentials and runtime configuration.
- Verified 235 users and 10 companies. Attendance counts: Greater Change 660,
  Sophisticave (`smart_home_solutions`) 447, Veracity 106.
- New backend is enabled/running with zero automatic restarts at verification.
- Old backend is stopped and disabled; old Nginx securely proxies to the new VPS
  with SNI and upstream certificate verification. This prevents split writes
  while DNS still points to the old server.
- Preserved HTTP `/iclock/` biometric routing and the existing 64 MB HTTPS upload limit.
- New domain vhost trusts forwarded client addresses only from the old VPS.
- Public `https://grecha.ai` and new IP HTTPS return 200, identical homepage hashes,
  and working frontend assets. Anonymous `/api/auth/me` returns 401 as expected.
- Enabled standard domain-certificate renewal timer on the new VPS.
- After the user changed DNS, authoritative DNS plus Cloudflare/Google public
  resolvers returned `200.234.42.137`. Both domain hostnames and frontend assets
  returned 200 over HTTPS.
- `certbot renew --cert-name grecha.ai --dry-run --non-interactive` succeeded
  for both `grecha.ai` and `www.grecha.ai` (exit 0).

## Recovery material

On both servers, root-restricted backup directory:
`/opt/cloudhrms/backups/final-cutover-20261109T094124Z`

Retained pre-sync destination database:
`cloudhrms_pre_cutover_20261109t094124z`

Destination pre-sync files are under `pre-sync-media` and `pre-sync-uploads`
inside the backup directory. Configuration copies and application environment
backups are private and must not be committed or shared.

## DNS handoff

GoDaddy authoritative nameservers: `ns11.domaincontrol.com`, `ns12.domaincontrol.com`.
`www` is already a CNAME to `grecha.ai`; no separate www address change is needed.
User changed root (`@`) A record from `200.97.171.126` to `200.234.42.137`.
Retain email MX/TXT records. Keep the old VPS bridge available through DNS propagation.
Authoritative/public DNS and domain-certificate renewal tests passed. Real
web/mobile workflow acceptance testing remains with the user. Existing sessions
may require signing in again.

Do not blindly reverse DNS after accepting writes on the new database: the old
database is a retained snapshot and is no longer authoritative. Any rollback must
preserve new writes and use a deliberate reverse-sync plan.
