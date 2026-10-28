// Optional source-aligned browser workflow check.
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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.DEMO_URL || "http://127.0.0.1:5173");
    await page.locator('form[data-form="enter"] button').click();
    await page.evaluate(() => Nova.go("quotes", { dealId: "deal-2" }));
    await page.locator('[data-action="fin-new-quote"]').first().click();
    await page
      .locator('form[data-form="fin-save-quote"] [name="title"]')
      .fill("Northstar QA quote");
    await page
      .locator('form[data-form="fin-save-quote"] [name="description"]')
      .fill("Design sprint");
    await page
      .locator('form[data-form="fin-save-quote"] [name="quantity"]')
      .fill("2");
    await page
      .locator('form[data-form="fin-save-quote"] [name="price"]')
      .fill("100.25");
    await page
      .locator('form[data-form="fin-save-quote"] [name="tax"]')
      .fill("5");
    await page
      .locator('form[data-form="fin-save-quote"] [data-action="fin-add-line"]')
      .click();
    await page
      .locator('form[data-form="fin-save-quote"] [name="description"]')
      .nth(1)
      .fill("Second line");
    await page
      .locator('form[data-form="fin-save-quote"] [name="price"]')
      .nth(1)
      .fill("10");
    await page
      .locator('form[data-form="fin-save-quote"] button[type="submit"]')
      .click();
    await page.locator('[data-action="fin-issue-quote"]').click();
    await page.locator('[data-action="fin-accept-quote"]').click();
    await page
      .locator('#modal [name="evidence"]')
      .fill("Fictional customer email approval");
    await page.locator('#modal button[type="submit"]').click();
    await page.locator('[data-action="fin-convert-order"]').click();
    let order = await page.evaluate(() => Nova.data.orders.at(-1));
    assert.equal(order.total, 220.53);
    await page.locator('[data-action="fin-invoice-order"]').click();
    await page.locator('[data-action="fin-create-order-invoice"]').click();
    let invoice = await page.evaluate(() => Nova.data.invoices.at(-1));
    assert.equal(invoice.total, 220.53);
    await page.locator('[data-action="fin-issue-invoice"]').click();
    await page.locator('[data-action="fin-payment"]').click();
    await page.locator('#modal [name="amount"]').fill("100");
    await page.locator('#modal [name="reference"]').fill("Bank QA part 1");
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(
      await page.evaluate(() => Nova.data.invoices.at(-1).status),
      "ISSUED",
    );
    await page.locator('[data-action="fin-payment"]').click();
    await page.locator('#modal [name="reference"]').fill("Bank QA balance");
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(
      await page.evaluate(() => Nova.data.invoices.at(-1).status),
      "PAID",
    );
    assert.equal(await page.locator("#printable-invoice").count(), 1);
    await page.locator('[data-action="fin-credit"]').click();
    await page
      .locator('#modal [name="reason"]')
      .fill("Fictional complete cancellation");
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(
      await page.evaluate(() => Nova.data.invoices.at(-1).status),
      "CREDITED",
    );
    assert.equal(
      await page.evaluate(() => Nova.data.invoices.at(-1).payments.length),
      2,
    );
    await page.evaluate(() => Nova.go("invoices"));
    await page.locator('[data-action="fin-new-invoice"]').click();
    await page.locator('[data-action="fin-source"][data-id="time"]').click();
    await page.locator('[data-action="fin-time-compose"]').click();
    await page.locator('#modal [name="projectId"]').selectOption("project-1");
    await page.locator('#modal [name="currency"]').selectOption("USD");
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(
      await page.locator('#modal input[name="entryId"]:checked').count(),
      1,
    );
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(
      await page.evaluate(() => Nova.data.invoices.at(-1).total),
      135,
    );
    await page.evaluate(() => Nova.go("invoices"));
    await page.locator('[data-action="fin-new-invoice"]').click();
    await page.locator('[data-action="fin-source"][data-id="time"]').click();
    await page.locator('[data-action="fin-time-compose"]').click();
    await page.locator('#modal [name="projectId"]').selectOption("project-1");
    await page.locator('#modal button[type="submit"]').click();
    assert.equal(await page.locator('#modal input[name="entryId"]').count(), 0);
    await page.locator('#modal [data-action="close-modal"]').click();
    for (const width of [320, 375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() =>
        Nova.go("invoices", { invoiceId: Nova.data.invoices.at(-1).id }),
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "invoice overflow " + width,
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real browser multi-line quote, issue/accept, order→invoice, partial/full receipt, credit history, time invoice 3h×45=135, duplicate time prevention, invoice responsive widths and no JS errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
