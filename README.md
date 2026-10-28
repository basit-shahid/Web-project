# NovaWorks — plain HTML, CSS & JavaScript ERP/CRM

Branch **frontend/vanilla-erp** contains a new standalone version of the latest inspected [Aizaz-Noor/Nova-Works](https://github.com/Aizaz-Noor/Nova-Works) ERP/CRM flow (source revision `dfcb293`, 28 October 2026).

**The vanilla screens now follow the source layout and styling.** See [`vanilla/SOURCE_ALIGNMENT.md`](vanilla/SOURCE_ALIGNMENT.md) for the screen-by-screen comparison and [`vanilla/README.md`](vanilla/README.md) for the editing guide.

## Run

With Node.js installed, from the repository root:

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. No `npm install`, React, build step, database or `.env` is required. The optional server uses Node's standard library to serve static files only.

Alternatively open `vanilla/index.html` with VS Code Live Server, or use `python -m http.server 5173 --directory vanilla`.

## Main flow

**Customer → lead/deal → quote → sales order → project/tasks → time approval → invoice → recorded payment → reports.**

Choose a demo role and explore the connected fictional company. All records are local to your browser. Meeting review is a disclosed editable sample; authentication, live AI, payments and shared server persistence are not simulated as real services.

## Code

- `vanilla/index.html`: structural HTML and application shell.
- `vanilla/css/styles.css`: styles, responsive layout and printing.
- `vanilla/js/`: ordinary JavaScript for records, screens, events and storage.
- `vanilla/tests/`: optional browser acceptance checks.
- `npm run build`: dependency-free syntax/asset verification; host `vanilla/` directly.

The `basitbranch` React frontend and `frontend/momentum-redesign` full-stack branch are unchanged. Previous React files remain in `app/client` on this branch for comparison; the new app never loads them. Historical documents in `docs` describe earlier versions, not the new standalone runtime.

The upstream source repository and its live deployment were read-only references and were not modified.
