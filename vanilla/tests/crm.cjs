// Optional source-aligned browser workflow check.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1100 },
    });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(process.env.DEMO_URL || "http://127.0.0.1:5173/");
    await page.locator("#entry-role").selectOption("u-owner");
    await page
      .getByRole("button", { name: "Explore demo workspace", exact: true })
      .click();
    await page.locator('#navigation [data-nav="customers"]').click();
    assert.equal(
      await page.locator("#view h2").first().innerText(),
      "Customers",
    );
    await page.getByText("Add a customer", { exact: true }).click();
    let form = page.locator('form[data-form="crm-customer-create"]');
    await form.locator("[name=name]").fill("Source parity customer");
    await form.locator("[name=email]").fill("parity@example.test");
    await form
      .getByRole("button", { name: "Create customer", exact: true })
      .click();
    await page.getByText("Edit customer", { exact: true }).click();
    form = page.locator('form[data-form="crm-customer-save"]');
    await form.locator("[name=website]").fill("https://example.test");
    await form
      .locator("[name=notes]")
      .fill("Website and notes persisted through source inline editing.");
    await form.locator("[name=status]").selectOption("ACTIVE");
    await form
      .getByRole("button", { name: "Save customer changes", exact: true })
      .click();
    await page
      .getByText("Website: https://example.test", { exact: true })
      .waitFor();
    await page.getByText("Add a contact", { exact: true }).click();
    form = page.locator('form[data-form="crm-contact-save"]');
    await form.locator("[name=name]").fill("Demo contact");
    await form.locator("[name=email]").fill("contact@example.test");
    await form.locator("[name=phone]").fill("0123456");
    await form.locator("[name=role]").fill("Buyer");
    await form
      .getByRole("button", { name: "Save contact", exact: true })
      .click();
    await page.getByText("Record an activity", { exact: true }).click();
    form = page.locator('form[data-form="crm-activity-save"]');
    await form.locator("[name=note]").fill("Inline source activity");
    await form
      .getByRole("button", { name: "Save activity", exact: true })
      .click();
    await page.getByText("Inline source activity", { exact: true }).waitFor();
    await page.locator('#navigation [data-nav="pipeline"]').click();
    assert.equal(
      await page
        .getByRole("button", { name: "Leads", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.getByText("Add a lead", { exact: true }).click();
    form = page.locator('form[data-form="crm-opportunity-save"]');
    await form.locator("[name=name]").fill("Source parity lead");
    await form.locator("[name=companyName]").fill("New conversion company");
    await form.locator("[name=email]").fill("newbuyer@example.test");
    await form
      .locator("[name=notes]")
      .fill("New custom lead, no customer prerequisite.");
    await form
      .getByRole("button", { name: "Create lead", exact: true })
      .click();
    await page.getByText("Edit lead", { exact: true }).click();
    form = page.locator('form[data-form="crm-opportunity-edit"]');
    await form.locator("[name=status]").selectOption("QUALIFIED");
    await form
      .getByRole("button", { name: "Save lead changes", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Convert lead to customer and deal",
        exact: true,
      })
      .click();
    await page.getByText("Edit deal", { exact: true }).click();
    form = page.locator('form[data-form="crm-opportunity-edit"]');
    await form.locator("[name=value]").fill("1250.50");
    await form.locator("[name=stage]").selectOption("WON");
    await form
      .getByRole("button", { name: "Save deal changes", exact: true })
      .click();
    form = page.locator('form[data-form="crm-project-save"]');
    await form.locator("[name=deadline]").fill("2026-12-15");
    await form.locator("[name=managerId]").selectOption("u-manager");
    await form
      .getByRole("button", { name: "Create delivery project", exact: true })
      .click();
    assert.equal(
      await page.evaluate(
        () =>
          Nova.data.projects.filter(
            (p) => p.name === "New conversion company opportunity",
          ).length,
      ),
      1,
    );
    await page.reload();
    assert.equal(
      await page.evaluate(
        () =>
          Nova.data.customers.filter((c) => c.name === "New conversion company")
            .length,
      ),
      1,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS inline source parity: customer create/edit website notes status, contacts phone/job, activity, Leads default, company-only lead creation, qualified lead -> customer/contact/deal, edit deal WON, project handover, persistence, zero browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
