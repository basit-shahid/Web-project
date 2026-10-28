// Optional browser workflow acceptance, not a runtime dependency.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(process.env.DEMO_URL || "http://127.0.0.1:5173");
    await page.locator("#entry-role").selectOption("u-owner");
    await page.getByRole("button", { name: /Explore demo workspace/ }).click();
    await page.locator('#navigation [data-nav="customers"]').click();
    await page
      .getByRole("button", { name: "Add customer", exact: true })
      .click();
    let modal = page.locator("#modal");
    await modal
      .getByLabel("Company name", { exact: true })
      .fill("Examiner flow customer");
    await modal
      .getByLabel("Email", { exact: true })
      .fill("examiner@example.test");
    await modal.getByLabel("Phone", { exact: true }).fill("+1 555 0123");
    await modal.getByLabel("Industry", { exact: true }).fill("Consulting");
    await modal.getByLabel("Customer status").selectOption("ACTIVE");
    await modal
      .getByRole("button", { name: "Save customer", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add contact", exact: true })
      .click();
    await modal
      .getByLabel("Contact name", { exact: true })
      .fill("Demo Contact");
    await modal
      .getByLabel("Email", { exact: true })
      .fill("contact@example.test");
    await modal.getByLabel("Job title", { exact: true }).fill("Buyer");
    await modal
      .getByRole("button", { name: "Save contact", exact: true })
      .click();
    await page.getByText("Demo Contact", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Log activity", exact: true })
      .click();
    await modal
      .getByLabel("Activity note", { exact: true })
      .fill("Discussed the project scope and confirmed the next meeting.");
    await modal
      .getByRole("button", { name: "Save activity", exact: true })
      .click();
    await page
      .getByText(
        "Discussed the project scope and confirmed the next meeting.",
        { exact: true },
      )
      .waitFor();
    await page.getByRole("button", { name: "New lead", exact: true }).click();
    await modal
      .getByLabel("Lead name", { exact: true })
      .fill("Examiner flow opportunity");
    await modal.getByLabel("Potential value", { exact: true }).fill("1250.50");
    await modal.getByLabel("Lead source", { exact: true }).fill("Referral");
    await modal
      .getByRole("button", { name: "Create lead", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Qualify lead", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Convert to deal", exact: true })
      .click();
    await page.locator("select[name=stage]").selectOption("WON");
    await page
      .getByRole("button", { name: "Update stage", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Create delivery project", exact: true })
      .click();
    await modal.locator("select[name=managerId]").selectOption("u-manager");
    await modal
      .getByLabel("Delivery deadline", { exact: true })
      .fill("2026-12-15");
    await modal
      .getByLabel("Agreed scope", { exact: true })
      .fill("Delivery for examiner flow.");
    await modal
      .getByRole("button", { name: "Create delivery project", exact: true })
      .click();
    await page
      .getByText("Delivery for examiner flow.", { exact: true })
      .waitFor();
    let ids = await page.evaluate(() => {
      const c = Nova.data.customers.find(
        (c) => c.name === "Examiner flow customer",
      );
      const d = Nova.data.deals.find(
        (d) => d.name === "Examiner flow opportunity",
      );
      return {
        customer: c.id,
        deal: d.id,
        project: Nova.data.projects.find((p) => p.dealId === d.id).id,
      };
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Exit demo", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        (id) => Nova.data.projects.filter((p) => p.dealId === id).length,
        ids.deal,
      ),
      1,
    );
    await page.evaluate((id) => Nova.go("pipeline", { dealId: id }), ids.deal);
    await page
      .getByRole("button", { name: "Open delivery project", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Create quote", exact: true })
      .click();
    await page
      .getByText("Examiner flow opportunity", { exact: false })
      .first()
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: customer create, contact, activity, lead create/qualify/convert, won deal, project handover, quote cross-link, reload persistence, zero browser JS errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
