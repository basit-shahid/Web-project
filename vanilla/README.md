# NovaWorks — traditional HTML, CSS & JavaScript

A standalone browser-local ERP/CRM demonstration, based on the **latest inspected** `Aizaz-Noor/Nova-Works` source revision **dfcb2938bf7b07eead7fc1de4a79f137edc3a58b** (28 October 2026). The upstream repository was inspected read-only. This is a new implementation of its main business flow, not a claim of full server-feature parity or a modification of the upstream deployment.

## Start

No React, Vite, bundler, npm package, API key or database is required by the application.

**VS Code:** open this `vanilla` folder, then use Live Server on `index.html`.

**Node.js standard library:** from the repository root, run `npm run dev` or `node vanilla/tools/serve.cjs`. Open http://127.0.0.1:5173. This serves static files only; it is not an application backend. `npm install` is unnecessary.

**Python alternative:** from the repository root, run `python -m http.server 5173 --directory vanilla` (Windows may use `py` instead of `python`). Open http://127.0.0.1:5173.

The page uses ordinary script tags and relative CSS/assets, with no fetch calls. Directly opening `index.html` may also work in ordinary browsers, but local-file navigation/storage depends on browser policy. The managed test browser blocks file:// navigation, so direct-file behavior is NOT verified. A local static server is the tested and recommended option.

## Source-screen alignment

The entry, shell and all 11 module screens now use the source visual system and screen hierarchy. See [SOURCE_ALIGNMENT.md](SOURCE_ALIGNMENT.md) for the exact screen-by-screen changes and remaining local-only differences. Existing browser data is preserved; use Reset sample workspace if you want fresh source-style fixture names.

## The same main flow

**Customer → lead/deal → quote → accepted sales order → delivery project/tasks → time entry → independent approval → order/time invoice → external receipt → reports.**

1. Select **Owner** and **Explore demo workspace**. Open **Customers** and create a fictional customer, contact and activity note.
2. Open **Pipeline → Leads**, create a lead, qualify it and convert it to a deal. A lead can start from a company name; conversion creates or links its customer and contact. Conversion is duplicate-safe.
3. Open the deal. Move it to **Won**, then **Create delivery project**. Choose a manager and deadline. Reopening the handover reuses the linked project.
4. From the deal choose **Create quote**. Add line items, price, currency, tax and terms. Issue the quote, record acceptance evidence, then create one sales order. Issued terms are locked; create a revision when needed rather than changing an issued snapshot.
5. Open the project in **Projects & tasks**. Assign tasks, deadlines and estimated hours; add comments and milestones. Change task states and see derived completion.
6. In **Settings → Local presentation tools**, switch to a member. In **Timesheets**, log actual time against an assigned task and submit it. Switch to a different owner/manager and open **Team review** to approve or reject with a reason. Self-approval, future work dates, over-24-hour days and edits to approved entries are blocked.
7. As Owner, open **Invoices**. Create an invoice from a confirmed order or independently approved billable time. Time pricing uses worker-level effective-date rates from Settings. Previously reserved/billed sources cannot be billed twice.
8. Issue the invoice, record external receipt references (partial/full), print it, or record a full credit with a reason. Receipt history remains; no payment or refund is processed.
9. **Reports** derives delivery, sales and finance summaries from the actual local records. USD, GBP and PKR remain separate. **Export report JSON** follows the selected report and currency.
10. **Meeting AI** lets the Owner load one prepared meeting, queue/process it locally, edit the project/task draft, and approve it into delivery. It explicitly performs no AI analysis of arbitrary text.

Sample records are already connected, so an examiner can explore the whole flow immediately. Dates are generated relative to the browser's current UTC date when the demo is first created/reset. Use **Reset sample workspace** for a repeatable presentation; it replaces this demo's data only.

## Files and screens

```text
vanilla/
  index.html              # Entry page, header, sidebar, page container, modal
  css/styles.css          # All visual styles, responsive rules and print layout
  assets/favicon.svg      # Local icon; no CDN or remote asset dependency
  js/
    data.js               # Fictional users and linked sample business records
    core.js               # DOM helpers, storage, modal, routing, shared controls
    app.js                # Business handlers and event dispatch
    source-parity.js      # Source-aligned shell, overview, reports, settings, meeting queue
    source-helpers.js     # Per-role/company saved views
    crm.js                # Customers, contacts, activities, leads, deals, handover
    delivery.js           # Projects, tasks, milestones, comments and timesheets
    finance.js            # Quotes, orders, rates-based invoices, receipts, credit
  tests/                  # Optional browser checks; not needed to run the app
  tools/                  # Optional dependency-free static server/check command
```

There is no JSX. Each `N.views.screenName` function returns an ordinary HTML template string. `index.html` owns the fixed shell; the selected screen is inserted into `#view`. CSS supplies appearance; named functions handle events.

- Change login/entry wording: `index.html`.
- Change source-aligned colors/spacing: `css/source-parity.css`. The exact reference styles are under `css/reference/`; keep shared overrides in source-parity.css.
- Change record screens in `crm.js`, `delivery.js` and `finance.js`. Change the source-aligned overview/reports/settings/shell in `source-parity.js`; `app.js` retains shared handlers and event dispatch.
- Change fictional records: `createDemoData()` in `js/data.js`, then reset the browser demo so saved data does not override the new fixtures.
- Find a button's behavior: its `data-action` value maps to `N.actions['that-value']`.
- Find form behavior: its `data-form` value maps to `N.forms['that-value']`.
- Browser persistence: `N.save()` in `core.js` saves to localStorage; the selected demo role is in sessionStorage.

Example: a button `data-action="crm-customer-new"` runs `N.actions['crm-customer-new']`, which opens a normal HTML form. Submitting `data-form="crm-customer-save"` validates fields, adds an object to `N.data.customers`, calls `N.save()`, and redraws the view. `N.esc()` safely renders user-entered text.

## Boundaries and simplifications

- Role selection, permissions and company data are demonstrative browser views, not secure authentication, server authorization or tenant isolation. Browser data is inspectable/editable. Do not use private company information.
- Local storage persists only on the same browser and origin. Switching port, hostname or device creates a separate workspace. No sync, password recovery, MFA or durable hosted storage is provided.
- Quote issue/send records a local status, not an email. Acceptance is entered evidence, not a customer portal. `SENT` corresponds to the reference issued quote state.
- Rates are worker/currency/effective-date based rather than the upstream customer/project-specific rate system. No partial time allocation, server concurrency engine, replacement invoice chain, partial credit/refund, real PDF generation or accounting ledger is claimed. Quote revisions preserve prior terms locally. Print uses the browser print/save-as-PDF facility.
- Attachments, background workers, real signup/member lifecycle, authenticated security history, account recovery and subscription checkout are not reproduced. Matching account/invitation/provider controls are disabled and explained. The subscription screen explains this boundary.
- Meeting review uses a disclosed prepared sample. No provider credential, live AI call or arbitrary transcript extraction is included.
- Existing `app/client` React files are retained only for comparison on this branch. The standalone deliverable is `vanilla/`; its runtime does not import those files.

## Deployment

Host the contents of `vanilla/` as a static site. No server functions or secrets are required. The root `vercel.json` on this branch points to `vanilla`. For Render use **Static Site**, publish directory `vanilla`; build command can be `npm run build`. All navigation uses URL hashes, so no SPA rewrite is needed.

## Verification

`npm run build` / `npm run check` validates local asset references and classic JavaScript syntax without creating a bundle. Optional Playwright scripts under `tests` require an existing Playwright/Chromium installation; they are not product dependencies. Configure `DEMO_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` as needed.

See `VERIFICATION.md` for executed checks, observed results and unverified capabilities.
