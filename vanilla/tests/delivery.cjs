// Optional source-aligned browser workflow check.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  let errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.DEMO_URL || "http://127.0.0.1:5173");
  await p.locator('form[data-form="enter"] button').click();
  await p.evaluate(() => Nova.go("delivery"));
  let create = p
    .locator("details")
    .filter({ has: p.locator("summary", { hasText: "Create a project" }) })
    .first();
  await create.locator("summary").click();
  await create.locator("[name=name]").fill("Source hierarchy project");
  await create
    .locator("[name=description]")
    .fill("Plain JavaScript inline creation.");
  await create
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  assert.ok(
    await p.getByText("Source hierarchy project", { exact: true }).count(),
  );
  assert.equal(
    await p.evaluate(() => Nova.data.projects.at(-1).status),
    "PLANNED",
  );
  let assign = p
    .locator("details")
    .filter({ has: p.locator("summary", { hasText: "Assign a task" }) })
    .first();
  await assign.locator("summary").click();
  await assign.locator("[name=projectId]").selectOption("project-1");
  await assign.locator("[name=title]").fill("Source assignment");
  await assign
    .locator("[name=description]")
    .fill("Preserve scope and time safeguards.");
  await assign.locator("[name=assigneeId]").selectOption("u-ali");
  await assign
    .locator("[name=deadline]")
    .fill(await p.evaluate(() => Nova.data.projects[0].deadline));
  await assign.getByRole("button", { name: "Save assignment" }).click();
  assert.equal(
    await p
      .getByRole("heading", { name: "Source assignment", exact: true })
      .count(),
    1,
  );
  await p
    .locator('[data-action="del-project-open"][data-id="project-1"]')
    .click();
  await p.locator("details.project-milestones summary").click();
  await p.getByRole("button", { name: "Add milestone", exact: true }).click();
  let d = p.locator("#modal");
  await d.locator("[name=title]").fill("Source milestone");
  await d.getByRole("button", { name: "Save milestone", exact: true }).click();
  await p.evaluate(() => {
    Nova.actions["switch-role"]({ dataset: { id: "u-ali" } });
    Nova.go("time");
  });
  await p.getByRole("button", { name: "Log time", exact: true }).click();
  let f = p.locator('form[data-form="del-time-save"]');
  await f.locator("[name=projectId]").selectOption("project-1");
  await f.locator("[name=taskId]").selectOption("task-1");
  await f.locator("[name=minutes]").fill("120");
  await f.locator("[name=note]").fill("Source layout time entry");
  await f.getByRole("button", { name: "Save time draft", exact: true }).click();
  let id = await p.evaluate(() => Nova.data.times.at(-1).id);
  assert.equal(
    await p.getByRole("heading", { name: "Time entry", exact: true }).count(),
    1,
  );
  await p
    .getByRole("button", { name: "Submit saved time", exact: true })
    .click();
  assert.equal(
    await p.evaluate(
      (id) => Nova.data.times.find((t) => t.id === id).status,
      id,
    ),
    "SUBMITTED",
  );
  await p.evaluate(() => {
    Nova.actions["switch-role"]({ dataset: { id: "u-owner" } });
    Nova.go("time");
  });
  await p.getByRole("button", { name: "Team review", exact: true }).click();
  await p
    .locator('[data-action="del-time-open"][data-id="' + id + '"]')
    .click();
  await p.locator("[name=reason]").fill("Independently checked");
  await p.getByRole("button", { name: "Approve time", exact: true }).click();
  assert.equal(
    await p.evaluate(
      (id) => Nova.data.times.find((t) => t.id === id).status,
      id,
    ),
    "APPROVED",
  );
  await p.evaluate(() => {
    Nova.actions["switch-role"]({ dataset: { id: "u-ali" } });
    Nova.go("time");
  });
  await p.getByRole("button", { name: "My time", exact: true }).click();
  await p
    .locator('form[data-form="del-time-filter"] [name=query]')
    .fill("Source layout");
  await p.getByRole("button", { name: "Apply filters", exact: true }).click();
  assert.equal(await p.locator('[data-action="del-time-open"]').count(), 1);
  await p.getByRole("button", { name: "Log time", exact: true }).click();
  f = p.locator('form[data-form="del-time-save"]');
  await f.locator("[name=projectId]").selectOption("project-1");
  await f.locator("[name=taskId]").selectOption("task-1");
  await f.locator("[name=minutes]").fill("1380");
  await f.locator("[name=note]").fill("Too many minutes");
  await f.getByRole("button", { name: "Save time draft", exact: true }).click();
  assert.match(await f.locator(".form-error").textContent(), /exceed 24/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS source-aligned browser: inline project and task creation, project detail milestone, inline minutes time draft→submit→independent approval, search filter, daily hours guard, no JS errors.",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
