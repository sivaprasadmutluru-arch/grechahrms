# Smart HR Performance

The HRMS dashboard links to Performance. The Talent menu provides the overview, JD library and HR settings. Employees open their own record, while reporting managers can also open their direct reports. Onboarding links to the existing employee records for new joiners.

## Records and access

- The additive migration creates company-scoped performance documents and reminder claims. It reuses existing employee, manager, role and company identifiers. Saves require the last-read revision.
- Master JDs and employee JDs retain separate published versions. Copying a master creates an employee draft. Published versions are acknowledged individually.
- Initial KPI approval requires someone acting in the other role. A manager can amend approved KPIs. Progress entries retain the KPI version and formal reviews retain the original measures, scale and manager ratings.
- The archive reads existing CARR agreements, responsibilities and measures in the caller's scope. Older CAR links redirect to the archive or the overview. No legacy tables are dropped, and legacy records are not copied into the new module.
- Daily reminders use the HRMS notification service. Claims are scoped by company, employee and deadline to avoid repeat reminders.

## Deployment prerequisites

- Validate review dates, approval ownership and rating labels with HR before production rollout.
- Optional draft generation uses a compatible HTTPS chat-completions endpoint configured with `PERFORMANCE_AI_ENDPOINT`, `PERFORMANCE_AI_TOKEN` and `PERFORMANCE_AI_MODEL`. The module sends authorised role context and accepts only editable drafts. A missing or unavailable provider leaves manual entry available.
- JD import supports TXT and DOCX up to 2 MB. Set `PERFORMANCE_UPLOAD_SCANNER` to a ClamAV-compatible executable supporting `--no-summary`. Files remain temporary and the server rejects imports when scanning is unavailable.
- Review the company’s legacy inventory from **Performance overview → Previous records** before any decisions about migrating legacy agreements. The archive does not turn historical measures into current KPI commitments.
