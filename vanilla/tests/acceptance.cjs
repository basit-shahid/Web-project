// Source-screen and responsive acceptance. Playwright is not an app dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
    headless: true,
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [],
      api = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("request", (r) => {
      if (/\/api\//.test(r.url())) api.push(r.url());
    });
    page.setDefaultTimeout(10000);
    const go = async (v) => {
      const menu = page.locator("#menu-button");
      if (
        (await menu.isVisible()) &&
        (await menu.getAttribute("aria-expanded")) !== "true"
      )
        await menu.click();
      await page.locator("#navigation [data-nav=" + v + "]").click();
    };
    await page.goto(process.env.DEMO_URL || "http://127.0.0.1:5173");
    await page
      .getByRole("heading", { name: "Company work, clearly connected." })
      .waitFor();
    assert.equal(await page.locator("#email").count(), 1);
    assert.equal(await page.locator("#password").count(), 1);
    assert.ok(
      await page
        .locator(".source-entry-visual img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
    );
    await page
      .getByRole("button", { name: "Explore demo workspace", exact: true })
      .click();
    assert.equal(await page.locator(".erp-commandbar").count(), 1);
    assert.equal(
      await page.locator(".overview-attention .attention-card").count(),
      3,
    );
    assert.equal(await page.locator(".overview-headline").count(), 0);
    for (const width of [320, 375, 683, 800, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const v of [
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
        await go(v);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
          v + " overflow " + width,
        );
        assert.equal(
          await page
            .getByRole("heading", {
              name: "This record could not be displayed",
            })
            .count(),
          0,
        );
        assert.equal(
          await page.locator("#navigation button[aria-current=page]").count(),
          1,
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
            .evaluate((e) => e === document.activeElement),
          true,
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go("reports");
    await page.getByLabel("Report type").selectOption("sales");
    await page.getByLabel("Currency", { exact: true }).selectOption("PKR");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export report JSON" }).click();
    const d = await downloadPromise;
    assert.equal(d.suggestedFilename(), "novaworks-sales-report.json");
    await page.getByLabel("Report type").selectOption("delivery");
    await page
      .getByRole("button", { name: "Show values", exact: true })
      .first()
      .click();
    assert.equal(await page.locator(".insight-data").count(), 1);
    await go("customers");
    await page
      .locator("form[data-form=crm-customer-filter] [name=query]")
      .fill("UrbanCart");
    await page
      .locator("form[data-form=crm-customer-filter]")
      .getByRole("button", { name: "Search", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save current view", exact: true })
      .click();
    await page.locator("#modal [name=name]").fill("UrbanCart only");
    await page
      .locator("#modal")
      .getByRole("button", { name: "Save view", exact: true })
      .click();
    assert.equal(
      await page.locator("[data-saved-module=customers] option").count(),
      2,
    );
    await page.reload();
    await go("customers");
    await page
      .locator("[data-saved-module=customers]")
      .selectOption({ label: "UrbanCart only" });
    assert.equal(
      await page
        .locator("form[data-form=crm-customer-filter] [name=query]")
        .inputValue(),
      "UrbanCart",
    );
    await page.getByRole("button", { name: "Remove saved view" }).click();
    await go("settings");
    const settings = page.locator("[data-form=source-settings]");
    await settings
      .locator("[name=legalName]")
      .fill("Source-aligned Company Ltd");
    await settings.locator("[name=locale]").fill("en-PK");
    await settings.locator("[name=timezone]").fill("Asia/Karachi");
    await settings
      .getByRole("button", { name: "Save company settings" })
      .click();
    assert.equal(
      await page.evaluate(() => Nova.data.company.settingsVersion),
      1,
    );
    await go("ai");
    await page
      .getByRole("button", { name: "Load sample meeting", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Queue meeting", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => Nova.data.meetings.at(-1).status),
      "QUEUED",
    );
    await page
      .getByRole("button", { name: "Process meeting", exact: true })
      .click();
    await page
      .locator("form[data-form=meeting-approve] [name=name]")
      .fill("Source-screen project");
    await page
      .getByRole("button", { name: "Approve project & tasks", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          Nova.data.projects.filter((p) => p.name === "Source-screen project")
            .length,
      ),
      1,
    );
    await page.reload();
    assert.equal(
      await page.evaluate(
        () =>
          Nova.data.projects.filter((p) => p.name === "Source-screen project")
            .length,
      ),
      1,
    );
    await go("settings");
    await page.getByText("Local presentation tools", { exact: true }).click();
    await page
      .locator("[data-action=switch-role][data-id=u-ali]")
      .last()
      .click();
    assert.equal(
      await page.locator("#navigation [data-nav=invoices]").count(),
      0,
    );
    await go("reports");
    assert.equal(
      await page
        .getByLabel("Report type")
        .locator("option[value=financial]")
        .count(),
      0,
    );
    await go("settings");
    await page.getByText("Local presentation tools", { exact: true }).click();
    await page
      .locator("[data-action=switch-role][data-id=u-owner]")
      .last()
      .click();
    await page.getByText("Company tools", { exact: true }).click();
    await page.getByText("Create a company", { exact: true }).click();
    await page
      .locator("form[data-form=local-company] [name=name]")
      .fill("Separate local company");
    await page
      .locator("form[data-form=local-company]")
      .getByRole("button", { name: "Create company", exact: true })
      .click();
    assert.equal(await page.evaluate(() => Nova.data.projects.length), 0);
    assert.equal(
      await page.evaluate(() => Nova.data.company.name),
      "Separate local company",
    );
    await page.locator("#company-picker").selectOption("company-original");
    assert.equal(
      await page.evaluate(() =>
        Nova.data.projects.some((p) => p.name === "Source-screen project"),
      ),
      true,
    );
    await page.locator("[data-action=notifications]").click();
    await page.getByRole("button", { name: "Mark all read" }).click();
    assert.equal(await page.locator("#notification-count").textContent(), "");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Reset sample workspace" }).click();
    assert.equal(await page.evaluate(() => Nova.data.meetings.length), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(api, []);
    console.log(
      "PASS: source shell and 11 screen structures, 7 responsive widths, report JSON/currency/chart controls, saved views, settings, queued sample review, role scopes, separate local companies, persistence, notifications, reset; no API or browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
