// Optional maintainer check; Playwright is a test tool, not an app dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const results = [];
  try {
    for (const base of [process.env.DEMO_URL || "http://127.0.0.1:5173"].concat(
      process.env.TEST_FILE === "1"
        ? [pathToFileURL(path.resolve(__dirname, "../index.html")).href]
        : [],
    )) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors = [],
        api = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("request", (r) => {
        if (/\/api\//.test(r.url())) api.push(r.url());
      });
      const go = async (view) => {
        const menu = page.locator("#menu-button");
        if (
          (await menu.isVisible()) &&
          (await menu.getAttribute("aria-expanded")) !== "true"
        )
          await menu.click();
        await page.locator('#navigation [data-nav="' + view + '"]').click();
      };
      await page.goto(base);
      await page
        .getByRole("button", { name: "Explore demo workspace" })
        .click();
      await page
        .getByRole("heading", { name: "Company overview", exact: true })
        .waitFor();
      for (const width of [320, 375, 683, 800, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of [
          "overview",
          "customers",
          "pipeline",
          "quotes",
          "delivery",
          "time",
          "invoices",
          "reports",
          "ai",
          "settings",
          "billing",
        ]) {
          await go(view);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
            base + " " + view + " overflow " + width,
          );
          assert.equal(
            await page
              .getByRole("heading", {
                name: "This record could not be displayed",
              })
              .count(),
            0,
          );
        }
        if (width <= 1024) {
          await page.locator("#menu-button").click();
          await page.keyboard.press("Escape");
          assert.equal(
            await page.locator("#menu-button").getAttribute("aria-expanded"),
            "false",
          );
          assert.equal(
            await page
              .locator("#menu-button")
              .evaluate((el) => el === document.activeElement),
            true,
          );
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await go("ai");
      await page
        .getByRole("button", { name: "Load sample meeting", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Prepare sample draft", exact: true })
        .click();
      await page
        .getByRole("heading", { name: "Review the project plan" })
        .waitFor();
      const before = await page.evaluate(() => Nova.data.projects.length);
      await page.locator("[name=name]").fill("Reviewed customer portal");
      await page
        .getByRole("button", { name: "Approve project & tasks", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => Nova.data.projects.length),
        before + 1,
      );
      assert.equal(
        await page.evaluate(
          () =>
            Nova.data.tasks.filter((t) => t.projectId === Nova.params.projectId)
              .length,
        ),
        2,
      );
      await page.reload();
      assert.equal(
        await page.evaluate(() =>
          Nova.data.projects.some((p) => p.name === "Reviewed customer portal"),
        ),
        true,
      );
      await go("reports");
      await page.getByRole("button", { name: "Sales", exact: true }).click();
      assert.ok((await page.locator("#view").innerText()).includes("PKR"));
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Export CSV", exact: true })
        .click();
      assert.equal((await download).suggestedFilename(), "novaworks-sales.csv");
      await go("settings");
      await page.locator("[data-action=switch-role][data-id=u-ali]").click();
      assert.equal(
        await page.locator("#navigation [data-nav=invoices]").count(),
        0,
      );
      await go("reports");
      assert.equal(
        await page
          .getByRole("button", { name: "Finance", exact: true })
          .count(),
        0,
      );
      await go("settings");
      await page.locator("[data-action=switch-role][data-id=u-owner]").click();
      await page.locator("[data-action=notifications]").click();
      await page.getByRole("button", { name: "Mark all read" }).click();
      assert.equal(await page.locator("#notification-count").textContent(), "");
      await go("settings");
      page.once("dialog", (d) => d.accept());
      await page
        .getByRole("button", { name: "Reset demo", exact: true })
        .click();
      assert.equal(await page.evaluate(() => Nova.data.meetings.length), 0);
      assert.equal(await page.evaluate(() => Nova.data.projects.length), 2);
      assert.deepEqual(errors, []);
      assert.deepEqual(api, []);
      results.push({
        entry: base.startsWith("file:") ? "file://" : "HTTP",
        widths: 7,
        screens: 11,
        meetingReview: "PASS",
        persistence: "PASS",
        roleScope: "PASS",
        csv: "PASS",
        notifications: "PASS",
        reset: "PASS",
        noAPI: true,
        noErrors: true,
      });
      await context.close();
    }
    console.log(JSON.stringify({ PASS: true, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
