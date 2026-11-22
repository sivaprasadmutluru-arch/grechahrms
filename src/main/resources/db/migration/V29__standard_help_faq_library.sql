-- Add the standard help library to active companies without changing existing questions or answers.
-- Content is product guidance, not a replacement for an organisation's employment policies.
DO $install_faqs$
DECLARE
    company record;
    topic jsonb;
    item jsonb;
    category_id bigint;
    pack jsonb := $faq_pack$
[
  {"title":"Getting started & access","description":"Signing in, passwords and company access","faqs":[
    {"question":"How do I sign in to Grecha?","answer":"Use the username or email enabled for your account and your current password. Enter details supplied by your organisation. If you cannot sign in, contact your organisation’s administrator; do not share your password in a support ticket."},
    {"question":"What should I do if I forget my password?","answer":"Use Forgot password on the sign-in page and follow the reset instructions. If the reset message does not arrive, check your spam folder and ask your organisation’s administrator to verify your account email."},
    {"question":"Why can I not see a company or menu?","answer":"Company access depends on your active role assignments. Menu availability can also depend on your organisation’s module visibility settings. Ask your administrator to review access; a missing menu does not mean you should create a second account."},
    {"question":"How do I change the company I am managing?","answer":"If you have access to multiple companies, use the company selector in the header. Check the selected company before creating employees, changing settings or processing approvals. Employees without multi-company access should use their own company."}
  ]},
  {"title":"Employee profiles & onboarding","description":"Profile details, reporting managers and employment changes","faqs":[
    {"question":"Where can I view my employee information?","answer":"Open My Profile to review your personal and work information. Some fields can only be updated by an authorised administrator. Report incorrect joining dates, reporting managers or employment details to your HR team."},
    {"question":"How is my reporting manager assigned?","answer":"An authorised administrator sets your reporting manager in your employee work information. If team requests are not reaching the expected manager, ask HR to check the reporting relationship and the manager’s active account."},
    {"question":"How does probation confirmation work?","answer":"Your joining date, probation details and the organisation’s confirmation process determine when confirmation is due. Check your profile and contact HR if the expected confirmation status is incorrect. Leave entitlement depends on the applicable policy, not on a single universal probation rule."},
    {"question":"What happens after offboarding is completed?","answer":"Completed offboarding should remove the employee from active operational lists. Historical records can remain for authorised review. If a former employee still appears in an active selection list, report the company, employee and affected screen to HR."}
  ]},
  {"title":"Attendance & regularisation","description":"Punches, grace periods and correcting attendance","faqs":[
    {"question":"How do I check in and check out?","answer":"Use Check In and Check Out on the dashboard or the attendance self-service screen. Allow location access if your company requires it. Verify the saved punch and status. Checking in and checking out are separate actions."},
    {"question":"Why is an early check-in blocked?","answer":"Check-in becomes available when your scheduled shift starts. An early attempt displays the shift start time and a countdown. Wait until that time and check in again. The schedule is evaluated in the business timezone displayed by the app."},
    {"question":"What does Irregular attendance mean?","answer":"The system has detected an attendance exception, such as lateness beyond grace, early departure or insufficient recorded hours. Review the assigned shift, punches and required hours before raising a correction. A late checkout reason prompt alone does not mean the day is irregular."},
    {"question":"What is a grace period?","answer":"A grace period is the allowance configured by your company for timing checks. It does not change the scheduled start time or automatically remove a working-hours shortage. Ask HR which grace rules apply to your company."},
    {"question":"How can I regularise missing or incorrect attendance?","answer":"Open Attendance, find the affected date and use the regularisation action. Explain the issue and provide the missing or corrected times when requested. Submit it for review. Do not enter hours you did not work."},
    {"question":"What happens when a late-punch regularisation request is approved?","answer":"Approval of a late check-in or late checkout reason marks the day Regularised and clears its attendance deductions. It does not change the original punch times or approve overtime. Other correction requests may update punches based on the approved details."},
    {"question":"Can I provide a late-punch reason later?","answer":"Yes. The late-punch dialog can be closed without submitting a reason; the punch itself remains saved. You can submit a reason later through Attendance. A request that has already been submitted may need review before another request of the same type can be raised."},
    {"question":"What is attendance exemption?","answer":"An authorised administrator can set Attendance exempt for an employee from a specified effective date in Work Info, under Attendance requirement. Exemption removes the daily punching requirement; it does not create artificial working hours or change the employee’s leave policy."}
  ]},
  {"title":"Shifts & working hours","description":"Daily schedules, week offs and overnight shifts","faqs":[
    {"question":"Where can I see my shift timings?","answer":"The dashboard shows today’s shift times. Click the shift name to open your weekly schedule, including custom day timings, required hours and week offs. Ask HR to correct an inaccurate assignment."},
    {"question":"What do Standard, Custom and Week off mean?","answer":"Standard uses the schedule’s main start and end times. Custom uses different times for that weekday. Week off marks a non-working day. The weekly pattern applies to employees assigned to that schedule."},
    {"question":"How are required hours calculated when I change shift times?","answer":"The shift editor recalculates hours when start or end times change. For example, 9:30 AM to 6:00 PM is 8 hours 30 minutes. Overnight times are supported. Break time is not automatically deducted from that duration."},
    {"question":"How are overnight shifts displayed?","answer":"A shift such as 11:00 PM to 8:00 AM ends the next day. The schedule view labels it Ends next day. If an overnight punch is attached to an unexpected date or cannot be checked out, report the dates and times to HR rather than creating another punch."},
    {"question":"Does staying late automatically approve overtime?","answer":"No. Overtime eligibility, thresholds and review depend on the company’s configuration. Approval of an attendance explanation is not overtime approval. Review eligible overtime separately and follow your organisation’s process."}
  ]},
  {"title":"Leave applications & balances","description":"Applying for leave, documents and entitlements","faqs":[
    {"question":"How do I apply for leave?","answer":"Open Leave, choose an available leave type, select the start and end dates and duration, and enter a reason. Attach any required supporting document before submitting. Review your company’s working days and leave policy."},
    {"question":"In what order are leave types shown?","answer":"The standard order is Annual Leave, Sick Leave, Compassionate Leave, Paternity and Maternity Leave, followed by other types. Availability and eligibility depend on the types and policies configured for your organisation."},
    {"question":"When do I need a sick leave certificate?","answer":"For the configured single-day exemption, one day of sick leave does not require a certificate; more than one day requires an attachment. Select dates before checking document requirements. Follow the validation shown in the form and ask HR if your organisation’s rule differs."},
    {"question":"Why does my leave balance differ from another employee’s?","answer":"Balances can depend on the leave policy, joining or confirmation date, allocations, imported opening balances, accrual settings and approved leave. Monthly accrual is company-specific; it is not the same number for every client."},
    {"question":"Why does the application say the date is not a working day?","answer":"The selected date may be configured as a week off or holiday. Check your assigned shift and working week. If it should be a working day, ask HR to review the schedule; do not change dates only to bypass the message."}
  ]},
  {"title":"Managers & approvals","description":"Team requests and approval responsibilities","faqs":[
    {"question":"Where do reporting managers review their team’s attendance?","answer":"Use My Team or the team attendance screen available to your account to view assigned team members and daily attendance. Visibility depends on the reporting relationship and active company access."},
    {"question":"Where do I approve leave or regularisation requests?","answer":"Use the relevant team or approval queue, open the request, review the employee, company, dates, reason and any attachment, then approve or reject if authorised. If buttons are missing, ask an administrator to check reporting relationships and permissions."},
    {"question":"Where can I view a leave attachment?","answer":"Open the leave request’s details and look for Attachments or the document icon. Use the view or download action where available. If an uploaded file cannot be opened, report the request and filename without sharing confidential medical details in a public message."}
  ]},
  {"title":"Payslips & available modules","description":"Documents and module availability","faqs":[
    {"question":"Where can I view or download a payslip?","answer":"If your company enables payslips, open Payslips and select an available period to view or download the document. If a period is missing, ask payroll whether that payslip has been generated and published."},
    {"question":"Why are Payslips, Loans or Reimbursements missing?","answer":"Your company may have hidden those modules, or your account may not have permission to use them. Contact your organisation’s administrator. Module visibility is company-specific."}
  ]},
  {"title":"Help & support","description":"Finding answers and contacting the right support team","faqs":[
    {"question":"Who should employees contact for help?","answer":"Use the header question-mark icon to open Help. For workplace questions about leave, attendance or payroll, use your organisation’s Helpdesk. Include the affected screen, date and a clear description, but never a password."},
    {"question":"How can an organisation contact platform support?","answer":"Authorised organisation administrators can select Contact Support from Help to send an organisation-level issue to the platform management team. They can track the request and read responses in the support screen. Ordinary employees should first contact their own organisation’s Helpdesk."},
    {"question":"Who can add or change FAQs and categories?","answer":"Only eligible Platform Admins and Super Admins who are active employees of The Greater Change can manage FAQs and categories for companies they can access. Other users can read the published content."}
  ]}
]
    $faq_pack$::jsonb;
BEGIN
    FOR company IN SELECT id, schema_name FROM public.companies
      WHERE is_active AND schema_name IS NOT NULL
        AND to_regclass(format('%I.helpdesk_faq_categories', schema_name)) IS NOT NULL
        AND to_regclass(format('%I.helpdesk_faqs', schema_name)) IS NOT NULL
    LOOP
        FOR topic IN SELECT value FROM jsonb_array_elements(pack) LOOP
            category_id := NULL;
            EXECUTE format('SELECT id FROM %I.helpdesk_faq_categories
                WHERE company_id = $1 AND lower(title) = lower($2) AND is_active ORDER BY id LIMIT 1', company.schema_name)
              INTO category_id USING company.id, topic->>'title';
            IF category_id IS NULL THEN
                EXECUTE format('INSERT INTO %I.helpdesk_faq_categories
                    (company_id, title, description, is_active, created_at, updated_at)
                    VALUES ($1,$2,$3,true,now(),now()) RETURNING id', company.schema_name)
                  INTO category_id USING company.id, topic->>'title', topic->>'description';
            END IF;
            FOR item IN SELECT value FROM jsonb_array_elements(topic->'faqs') LOOP
                EXECUTE format('INSERT INTO %I.helpdesk_faqs
                    (company_id, category_id, question, answer, is_active, created_at, updated_at)
                    SELECT $1,$2,$3,$4,true,now(),now() WHERE NOT EXISTS
                    (SELECT 1 FROM %I.helpdesk_faqs WHERE company_id = $1 AND lower(question) = lower($3))',
                    company.schema_name, company.schema_name)
                  USING company.id, category_id, item->>'question', item->>'answer';
            END LOOP;
        END LOOP;
    END LOOP;
END $install_faqs$;
