# Executed verification

Reference source: Aizaz-Noor/Nova-Works, revision dfcb2938bf7b07eead7fc1de4a79f137edc3a58b. The source was built and run with its documented local demo command on port 3048. Entry and all 11 source module screens were captured and compared against the plain frontend. The source checkout's tracked files remain unchanged.

## Current source-screen update — passed

- Source shell: company command bar/picker, grouped navigation, utilities, single module heading and original-style entry image.
- Entry and all 11 modules render without document overflow at widths 320, 375, 683, 800, 1024, 1440 and 1920.
- Mobile Company menu: disclosure, navigation close, Escape and focus restoration. Company tools and Account security disclosures fit at mobile width.
- Source overview attention/KPI/finance sections and report-type/currency controls; exact-value chart toggle; JSON report export.
- Saved customer views: save/apply/remove, scoped per local company and demo role, restored after reload.
- Company legal name/default currency/locale/timezone validation, settings version/save timestamp; local company creation/switching preserves separate browser records.
- Source CRM inline forms: customer website/notes/status, contact phone/job, activity, Leads default, company-name lead creation, qualified conversion to customer/contact/deal, won-deal project handover and reload persistence.
- Source quote/order/invoice workflow: multi-line totals/tax, issue, recorded acceptance, order conversion, invoice, partial/full receipt, credit with retained evidence. Effective-rate time invoice and duplicate-billing protection.
- Invoice billing-field save/issue locking and immutable issuer/customer/terms snapshots. Company-setting edits do not change issued printable content. Invoice print layout isolates the invoice.
- Source project/task inline creation, milestones/comments, minutes-based time draft/submission, independent approval, date/query filters, daily-hour guard and approved-entry locking.
- Meeting queue → prepared-sample processing → editable review → approval creates one project and two tasks. Refresh preserves it; reset restores fixtures.
- Local role scopes, notifications/read state, successful persistence/reset.
- Zero application API requests and zero browser JavaScript errors in the broad acceptance run.
- Static asset references, JavaScript syntax and Git whitespace checks.

Maintainer scripts: tests/acceptance.cjs, tests/crm.cjs, tests/finance.cjs and tests/delivery.cjs. They use fresh browser contexts and fictional records. They require an existing Playwright/Chromium installation only for testing; the app has no runtime package dependencies. The default test URL is the same as npm run dev: http://127.0.0.1:5173; DEMO_URL can select another static server.

## Limitations / not claimed

- The interface is closer to the source, not pixel-identical: existing browser records/counts, some dialog-based secondary forms and explicit local-only disclosures differ. See SOURCE_ALIGNMENT.md.
- Direct file:// entry was blocked by the managed browser's policy in the initial conversion and is not verified. HTTP static serving is the tested path.
- Firefox/WebKit, full accessibility certification and production deployment are unverified.
- Real authentication/MFA/signup/invitations, account recovery, server authorization, shared multiuser storage, live AI/email/provider processing, attachments, server PDF generation, subscriptions, refunds and remote concurrency are not implemented. Disabled source-style controls explain their backend requirement.
- Worker-level effective rates simplify the upstream customer/project rate model. These are not accounting or revenue-recognition reports.
