# NovaWorks — frontend demonstration

`basitbranch` contains a standalone React + Vite frontend for presenting a meeting-to-execution CRM workflow. It retains the navy, ivory and vermilion redesign. There is no backend, database server, real login or live AI in this branch.

The complete full-stack project remains on `frontend/momentum-redesign`. Other branches are not changed by the frontend conversion.

## Run locally

Use Node.js 24. From the repository root:

```sh
npm ci --prefix app/client
npm run dev
```

Open the address printed by Vite (normally http://127.0.0.1:5173). No `.env`, credentials, database initialization, or port 3001 service is needed.

For a production build:

```sh
npm run build
npm run preview
```

Open the Vite preview address (normally http://127.0.0.1:4173). `app/client/dist` is the static deployable output. Opening index.html directly using file:// is not supported.

## Three-minute examiner walkthrough

1. Select **Administrator**, then **Sign in**. This is explicitly simulated role selection, not secure authentication. Demo password: `Demo123!`.
2. Select **Import sample plan → Load sample meeting → Import sample projects and tasks**. The application maps only that exact prepared transcript to three predefined projects and twelve tasks. It does not analyze arbitrary text or call AI.
3. Search **UrbanCart**, open its project card, and explain the scope, client, manager, deadline, owner and estimated effort.
4. Search/filter/order tasks, then explore the searchable, role-filtered team directory.
5. Sign out and select **Ayesha · Manager** or **Ali · Developer** to demonstrate their filtered views. Browser filtering is not a security boundary.
6. Refresh: projects remain in this browser's localStorage; the selected role remains in this tab's sessionStorage. Reimporting the sample reuses its records.
7. Use **Reset demo** and confirm to remove only this demo's stored projects/tasks. It leaves unrelated browser data alone.

Only fictional data should be used. Data is not shared between devices. Browser storage can be cleared or blocked; unreadable data displays a recovery message. `/?preview=1` is now an ordinary entry point into the same browser demo, not a separate data source.

## Deploy the static frontend

Vercel: select `basitbranch`, leave Root Directory at the repository root and use the checked-in vercel.json. It installs client dependencies, runs `npm run build`, and publishes `app/client/dist`. No server functions or environment secrets are required.

Render: create a **Static Site**, branch `basitbranch`, build command `npm ci --prefix app/client && npm run build`, publish directory `app/client/dist`.

## Suggested next features (not implemented)

1. **Editable plan review:** review projects, owners and dates before saving, with required-field validation. This is the strongest addition for explaining how decisions become structured work.
2. **Task Kanban and progress:** move tasks through To do / In progress / Done and calculate project completion from actual local task states.
3. **Deadline timeline and workload:** visualize upcoming deadlines and total estimated hours per person to explain planning tradeoffs.
4. **Export plan:** download a project/task report as CSV or a printable summary to give the workflow a clear final deliverable.

Keep one presentation story: **meeting → review plan → assign work → track delivery → export summary**. Avoid unrelated billing, chat, or AI claims that distract from the demonstrated flow.

## Repository notes

`app/client` contains the product frontend and local demo adapter. `docs/history`, existing audit/media/proposal documents are historical full-stack portfolio evidence; they do not describe this branch's runtime. See [frontend demo notes](docs/FRONTEND_DEMO.md) for the conversion scope and verification.
