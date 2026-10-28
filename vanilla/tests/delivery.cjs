// Optional browser workflow acceptance, not a runtime dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const go = async (view) => {
    await p.locator('#navigation [data-nav="' + view + '"]').click();
  };
  const role = async (id) => {
    await go("settings");
    await p
      .locator('[data-action="switch-role"][data-id="' + id + '"]')
      .click();
  };
  await p.goto(process.env.DEMO_URL || "http://127.0.0.1:5173");
  await p.getByRole("button", { name: /Explore demo workspace/ }).click();
  await go("delivery");
  await p
    .locator('[data-action="del-project-open"][data-id="project-1"]')
    .click();
  await p.getByRole("button", { name: "Assign task", exact: true }).click();
  let d = p.locator("#modal");
  await d.locator("[name=title]").fill("Acceptance task");
  await d.locator("[name=assigneeId]").selectOption("u-ali");
  await d
    .locator("[name=description]")
    .fill("Test the plain JavaScript delivery flow.");
  await d.locator("[name=hours]").fill("2");
  await d.getByRole("button", { name: "Save task", exact: true }).click();
  assert.equal(
    await p
      .getByRole("heading", { name: "Acceptance task", exact: true })
      .count(),
    1,
  );
  await p.getByRole("button", { name: "Add milestone", exact: true }).click();
  await d.locator("[name=title]").fill("Acceptance milestone");
  await d.getByRole("button", { name: "Save milestone", exact: true }).click();
  assert.equal(
    await p.getByText("Acceptance milestone", { exact: true }).count(),
    1,
  );
  await p.locator('[data-action="del-milestone-done"]').last().click();
  assert.equal(
    await p.evaluate(() => Nova.data.milestones.at(-1).status),
    "DONE",
  );
  await p.locator("details").first().locator("summary").click();
  await p
    .locator('form[data-form="del-comment"]')
    .first()
    .locator("[name=comment]")
    .fill("Acceptance comment");
  await p
    .locator('form[data-form="del-comment"]')
    .first()
    .getByRole("button", { name: "Post comment" })
    .click();
  assert.equal(
    await p.evaluate(() => Nova.data.tasks[0].comments.at(-1).text),
    "Acceptance comment",
  );
  await role("u-ali");
  await go("time");
  await p.getByRole("button", { name: "Log time", exact: true }).click();
  await d.locator("[name=projectId]").selectOption("project-1");
  await d.locator("[name=taskId]").selectOption("task-1");
  await d.locator("[name=hours]").fill("2");
  await d.locator("[name=note]").fill("Acceptance actual work");
  await d.getByRole("button", { name: "Save draft", exact: true }).click();
  const entryId = await p.evaluate(() => Nova.data.times.at(-1).id);
  await p
    .locator('[data-action="del-time-submit"][data-id="' + entryId + '"]')
    .click();
  assert.equal(
    await p.evaluate(
      (id) => Nova.data.times.find((t) => t.id === id).status,
      entryId,
    ),
    "SUBMITTED",
  );
  await p.evaluate((id) => {
    const f = document.createElement("form");
    f.dataset.id = id;
    f.innerHTML = '<p class="form-error"></p>';
    document.body.append(f);
    Nova.forms["del-time-decision"](
      f,
      new Map([
        ["decision", "APPROVED"],
        ["reason", "I approve myself"],
      ]),
    );
    window.acceptanceSelf = f.querySelector(".form-error").textContent;
    f.remove();
  }, entryId);
  assert.match(await p.evaluate(() => window.acceptanceSelf), /Only another/);
  await p.getByRole("button", { name: "Log time", exact: true }).click();
  await d.locator("[name=projectId]").selectOption("project-1");
  await d.locator("[name=taskId]").selectOption("task-1");
  await d.locator("[name=hours]").fill("23");
  await d.locator("[name=note]").fill("Too much time");
  await d.getByRole("button", { name: "Save draft", exact: true }).click();
  assert.match(await d.locator(".form-error").textContent(), /exceed 24/);
  await d.locator('[data-action="close-modal"]').click();
  await role("u-owner");
  await go("time");
  await p.getByRole("button", { name: "Team review", exact: true }).click();
  await p
    .locator('[data-action="del-time-review"][data-id="' + entryId + '"]')
    .click();
  await d.locator("[name=reason]").fill("Verified the work");
  await d.getByRole("button", { name: "Record review", exact: true }).click();
  assert.equal(
    await p.evaluate(
      (id) => Nova.data.times.find((t) => t.id === id).status,
      entryId,
    ),
    "APPROVED",
  );
  await role("u-ali");
  await go("time");
  assert.equal(
    await p
      .locator('[data-action="del-time-edit"][data-id="' + entryId + '"]')
      .count(),
    0,
  );
  await p.evaluate((id) => {
    const f = document.createElement("form");
    f.dataset.id = id;
    f.innerHTML = '<p class="form-error"></p>';
    document.body.append(f);
    Nova.forms["del-time-save"](f, new Map());
    window.acceptanceLock = f.querySelector(".form-error").textContent;
    f.remove();
  }, entryId);
  assert.match(
    await p.evaluate(() => window.acceptanceLock),
    /Only your draft/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: project task creation, comments, milestone completion, member draft submit, self-review rejected, >24h rejected, owner approval, approved lock, no JS errors.",
  );
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
