# Screen alignment with the source application

Source: Aizaz-Noor/Nova-Works, `dfcb2938bf7b07eead7fc1de4a79f137edc3a58b`. The source was run using its documented local-demo command at port 3048. Each of the 11 module screens and entry page was inspected at 1440px with rendered markup, text and screenshots. The source checkout and hosted application were not modified.

The earlier vanilla UI followed the business flow but substantially redesigned the screens. This update replaces that interpretation with the source screen hierarchy and visual system. Source stylesheets are retained under `css/reference/`; the source workflow poster and optional video are local assets. `css/source-parity.css` bridges the plain HTML renderer to those styles.

| Screen | Alignment work |
|---|---|
| Entry | Source headline and sign-in card, demo access, actual workflow poster/video, header and footer. Added a small demo-role selector/disclosure to avoid implying real authentication. |
| Company shell | Source company command bar/picker, utility disclosures, grouped rounded sidebar, Company menu on small screens, original labels and typography. Local-only disclosure remains visible. |
| Overview | Source three attention cards, delivery KPIs/task snapshot, sales records, currency-separated invoice balances and continue-work links. Removed the invented marketing hero and workflow ribbon. |
| Customers | Source saved-view/search toolbar, inline add/edit disclosures, table columns, owner/website/notes, contacts, activity timeline and project linking. |
| Pipeline | Leads default, source tabs and tables, optional deal board, company/contact lead fields, qualification/conversion, deal editing/lost reason, quote and delivery handover. |
| Quotes/orders | Source headings/tabs, full-width rows, status/search controls, inline quote creation, item totals, saved terms, revisions and issued-document locking. |
| Projects/tasks | Company projects table and inline creation, search/status/saved views, separate company tasks, inline assignment, detail facts, deadline/status controls, discussion and milestones. |
| Timesheets | Source My time/Team review tabs, date/query/status filters, duration summaries, entry rows and inline minutes-based creation/detail/review. |
| Invoices | Source table columns, status/settlement filters, saved views, inline order preparation, billing details, totals, snapshot fields, payment/credit history and printing. |
| Reports | Source report-type/currency selectors, refresh/JSON export, project bars/task ring, exact-value toggles, approved-time panel and currency-separated financial evidence. |
| Meeting AI | Source queue → process → review → approve structure, saved meetings and inline transcript. Processing is explicitly a prepared local sample, not AI. |
| Settings | Source legal name/default currency/locale/timezone form, settings version/save timestamp, member controls/list/invitation disclosure. Demo-role tools are kept in a separate local-tools disclosure. |
| Subscription | Source current access, inclusions, provider/event-history sections. Provider controls are unavailable and explained, rather than pretending to perform checkout. |

## Changes beyond appearance

- Saved search/status views are stored per local company and demo role.
- Local company creation and switching keep separate browser datasets, preserving the previous workspace. This is not server tenant isolation.
- New issued invoices snapshot issuer, customer, terms and billing instructions. Later settings/customer/source changes cannot alter the saved issued content. Old stored invoices that never had an issuer snapshot explicitly disclose the missing legacy data.
- Forms retain validation, idempotent conversions, duplicate-billing guards, independent approval and approved-time locking.
- Select controls have explicit accessible names. Menu Escape/focus behavior and reduced-motion media handling remain supported.

## Honest remaining differences

This is a closer visual and local-workflow reproduction, not a pixel-identical or backend-equivalent application. Existing local sample records, counts and names can differ. Some acceptance/payment/time-selection forms still use dialogs rather than source inline details. Real signup, passwords/MFA, invitations, provider lookup, subscriptions, email, attachments, live AI, server pagination and optimistic concurrency are not implemented. Worker-based effective rates simplify the upstream customer/project rate model. Browser print replaces the source server PDF endpoint.

The interface disables/explains unavailable external controls. It never sends passwords, meeting text, files or payment data to a server. Resetting the demo refreshes the fictional fixtures; updating the code does not silently overwrite existing browser records.
