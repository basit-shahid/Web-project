/* Quotes, orders and invoices using ordinary DOM events and browser data.
   No payment processing, email delivery, accounting service or server calls. */
(function () {
  "use strict";
  const N = window.Nova;
  const E = (value) => N.esc(value == null ? "" : value);
  const find = (kind, id) => N.data[kind].find((row) => row.id === id);
  const button = (text, action, id = "", style = "secondary") =>
    N.button(text, action, id, style);
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  const cents = (value) => {
    if (!/^\d+(\.\d{1,2})?$/.test(String(value).trim()))
      throw new Error(
        "Amounts must be positive numbers with at most two decimal places.",
      );
    const result = Math.round(Number(value) * 100);
    if (!Number.isSafeInteger(result) || result > 100000000000)
      throw new Error("Amount exceeds the supported demo limit.");
    return result;
  };
  function total(items) {
    return (
      items.reduce((sum, item) => {
        const subtotal = Math.round(
          Math.round(Number(item.price) * 100) * Number(item.quantity),
        );
        return (
          sum + subtotal + Math.round((subtotal * Number(item.tax || 0)) / 100)
        );
      }, 0) / 100
    );
  }
  function guarded(manage) {
    if (manage ? N.canManage() : N.isOwner()) return true;
    N.notify(
      manage
        ? "Select an owner or manager demo role for sales records."
        : "Invoices require the owner demo role.",
      "error",
    );
    return false;
  }
  function listTable(headers, rows) {
    return N.table(headers, rows);
  }
  function lineTable(items, currency) {
    return listTable(
      ["Description", "Quantity", "Unit price", "Tax", "Total"],
      items.map((item) => [
        E(item.description),
        E(item.quantity),
        N.money(item.price, currency),
        E(item.tax || 0) + "%",
        N.money(total([item]), currency),
      ]),
    );
  }
  function salesTabs(active) {
    return `<div class="tabs" aria-label="Sales records">${button("Quotes", "fin-tab", "quotes", active === "quotes" ? "primary" : "secondary")}${button("Sales orders", "fin-tab", "orders", active === "orders" ? "primary" : "secondary")}</div>`;
  }
  N.actions["fin-tab"] = (el) => N.go("quotes", { tab: el.dataset.id });
  N.actions["fin-open-quote"] = (el) =>
    N.go("quotes", { quoteId: el.dataset.id });
  N.actions["fin-open-order"] = (el) =>
    N.go("quotes", { orderId: el.dataset.id, tab: "orders" });
  N.actions["fin-back-quotes"] = () => N.go("quotes");
  N.actions["fin-back-orders"] = () => N.go("quotes", { tab: "orders" });
  N.actions["fin-invoice-order"] = (el) =>
    N.go("invoices", { orderId: el.dataset.id });

  N.views.quotes = function () {
    if (!N.canManage())
      return N.empty(
        "Sales records are unavailable",
        "Choose an owner or manager demo role to explore quotes and sales orders.",
      );
    const quote = find("quotes", N.params.quoteId);
    const order = find("orders", N.params.orderId);
    if (quote) return quoteDetail(quote);
    if (order) return orderDetail(order);
    const tab = N.params.tab === "orders" ? "orders" : "quotes";
    const deal = find("deals", N.params.dealId);
    const rows = N.data[tab];
    return `<div class="page-head"><div><p class="eyebrow">SALES / AGREED WORK</p><h1>Quotes & sales orders</h1><p class="muted">Agree the scope and price, record approval, then preserve those terms in a sales order.</p></div>${tab === "quotes" ? button("New quote", "fin-new-quote", deal?.id || "", "primary") : ""}</div>
      ${deal ? `<div class="banner">Preparing a quote for <strong>${E(deal.name)}</strong> · ${E(N.customerName(deal.customerId))}. ${button("Create quote from this deal", "fin-new-quote", deal.id)}</div>` : ""}
      ${salesTabs(tab)}<div class="toolbar"><label class="search">Search ${tab === "orders" ? "sales orders" : "quotes"}<input type="search" data-fin-filter="${tab}" placeholder="Title or customer"></label></div>
      <div id="fin-sales-list">${salesRows(tab, rows)}</div><p class="hint">Acceptance is a locally recorded demonstration. This version does not send quotes or provide a customer approval portal.</p>`;
  };
  function salesRows(kind, rows) {
    if (!rows.length)
      return N.empty(
        kind === "orders" ? "No sales orders yet" : "No quotes yet",
        kind === "orders"
          ? "Accept a quote and convert it to a sales order."
          : "Create a quote directly or start from a deal in Pipeline.",
      );
    return listTable(
      ["Record", "Customer", "Status", "Total", ""],
      rows.map((row) => [
        E(row.title),
        E(N.customerName(row.customerId)),
        N.badge(row.status),
        N.money(kind === "quotes" ? total(row.items) : row.total, row.currency),
        button(
          "Open " + (kind === "quotes" ? "quote" : "order"),
          kind === "quotes" ? "fin-open-quote" : "fin-open-order",
          row.id,
        ),
      ]),
    );
  }
  function quoteDetail(q) {
    const order = N.data.orders.find((row) => row.quoteId === q.id);
    return `<div class="page-head"><div>${button("← All quotes", "fin-back-quotes", "", "text-button")}<p class="eyebrow">SALES / QUOTE</p><h1>${E(q.title)}</h1><p class="muted">${E(N.customerName(q.customerId))} · ${E(q.currency)}</p></div>${N.badge(q.status)}</div>
      <div class="panel"><div class="section-head"><h2>Quoted scope</h2><strong>${N.money(total(q.items), q.currency)}</strong></div>${lineTable(q.items, q.currency)}<div class="detail-grid"><div><h3>Terms</h3><p>${E(q.terms || "No additional terms.")}</p></div><div><h3>Valid until</h3><p>${q.validUntil ? N.date(q.validUntil) : "No expiry set"}</p>${q.dealId ? `<p>Linked opportunity: ${E(find("deals", q.dealId)?.name || "Saved deal")}</p>` : ""}</div></div></div>
      ${q.acceptedAt ? `<div class="panel"><h2>Recorded customer response</h2><p>${N.date(q.acceptedAt)} · ${E(q.acceptanceNote)}</p><p class="hint">Evidence entered for the demonstration; no external approval was requested.</p></div>` : ""}
      <div class="actions">${q.status === "DRAFT" ? button("Edit draft", "fin-edit-quote", q.id) + button("Issue quote", "fin-issue-quote", q.id, "primary") : ""}${q.status === "SENT" ? button("Record acceptance", "fin-accept-quote", q.id, "primary") + button("Record decline", "fin-decline-quote", q.id) : ""}${q.status === "ACCEPTED" ? (order ? button("Open sales order", "fin-open-order", order.id, "primary") : button("Create sales order", "fin-convert-order", q.id, "primary")) : ""}</div><p class="hint">Issuing locks the quoted terms. Repeated conversion reopens the same order.</p>`;
  }
  function orderDetail(order) {
    const quote = find("quotes", order.quoteId);
    const invoice = N.data.invoices.find(
      (row) => row.orderId === order.id && row.status !== "VOID",
    );
    return `<div class="page-head"><div>${button("← Sales orders", "fin-back-orders", "", "text-button")}<p class="eyebrow">SALES / ORDER</p><h1>${E(order.title)}</h1><p class="muted">${E(N.customerName(order.customerId))} · ${N.date(order.date)}</p></div>${N.badge(order.status)}</div><div class="panel"><div class="section-head"><h2>Preserved order terms</h2><strong>${N.money(order.total, order.currency)}</strong></div>${quote ? lineTable(quote.items, order.currency) : "<p>Saved order total.</p>"}<p>${E(quote?.terms || "")}</p></div><div class="actions">${quote ? button("Open accepted quote", "fin-open-quote", quote.id) : ""}${N.isOwner() ? (invoice ? button("Open linked invoice", "fin-open-invoice", invoice.id, "primary") : button("Create invoice from order", "fin-invoice-order", order.id, "primary")) : ""}</div>`;
  }
  function lineEditor(
    item = { description: "", quantity: 1, price: "", tax: 0 },
  ) {
    return `<fieldset class="quote-line"><legend>Line item</legend><div class="form-grid">${N.field("Description", "description", item.description, "text", 'required maxlength="300"')}${N.field("Quantity", "quantity", item.quantity, "number", 'required min="1" max="1000000" step="1"')}${N.field("Unit price", "price", item.price, "number", 'required min="0.01" max="1000000000" step="0.01"')}${N.field("Tax %", "tax", item.tax, "number", 'required min="0" max="100" step="0.01"')}</div>${button("Remove line", "fin-remove-line", "", "text-button")}</fieldset>`;
  }
  function quoteForm(id, dealId) {
    if (!guarded(true)) return;
    const quote = find("quotes", id),
      deal = find("deals", dealId || quote?.dealId);
    if (quote && quote.status !== "DRAFT")
      return N.notify("Issued quote terms cannot be edited.", "error");
    if (!N.data.customers.length)
      return N.notify("Create a customer before creating a quote.", "error");
    N.modal(
      quote ? "Edit draft quote" : "New quote",
      `<form data-form="fin-save-quote"><input type="hidden" name="id" value="${E(id || "")}"><input type="hidden" name="dealId" value="${E(deal?.id || "")}"><p class="form-error" role="alert"></p><div class="form-grid">${N.field("Quote title", "title", quote?.title || (deal ? deal.name + " quote" : ""), "text", 'required maxlength="160"')}${N.select(
        "Customer",
        "customerId",
        N.data.customers
          .filter((c) => c.status !== "ARCHIVED")
          .map((c) => [c.id, c.name]),
        quote?.customerId || deal?.customerId || "",
        "required",
      )}${N.select(
        "Currency",
        "currency",
        [
          ["USD", "USD"],
          ["PKR", "PKR"],
          ["EUR", "EUR"],
          ["GBP", "GBP"],
        ],
        quote?.currency || deal?.currency || N.data.company.currency || "USD",
        "required",
      )}${N.field("Valid until", "validUntil", quote?.validUntil || "", "date")}</div><div id="fin-lines">${(quote?.items || [{}]).map(lineEditor).join("")}</div><div class="actions">${button("Add line item", "fin-add-line")}</div>${N.textarea("Terms", "terms", quote?.terms || "Payment due within 14 days of invoice.", 'maxlength="2000"')}<p class="hint">Prices and tax are calculated in integer cents. Issuing a quote locks these terms.</p><button class="primary" type="submit">Save draft quote</button></form>`,
    );
  }
  N.actions["fin-new-quote"] = (el) => quoteForm("", el.dataset.id);
  N.actions["fin-edit-quote"] = (el) => quoteForm(el.dataset.id);
  N.actions["fin-add-line"] = () => {
    const holder = document.getElementById("fin-lines");
    if (holder.children.length >= 20)
      return N.notify("Use at most 20 line items.", "error");
    holder.insertAdjacentHTML("beforeend", lineEditor());
  };
  N.actions["fin-remove-line"] = (el) => {
    const holder = document.getElementById("fin-lines");
    if (holder.children.length > 1) el.closest(".quote-line").remove();
    else N.notify("Keep at least one quote line.", "error");
  };
  N.forms["fin-save-quote"] = function (form, fd) {
    if (!guarded(true)) return;
    try {
      const old = find("quotes", fd.get("id"));
      if (old && old.status !== "DRAFT")
        throw new Error("Only draft quotes can be edited.");
      const customer = find("customers", fd.get("customerId"));
      if (!customer || customer.status === "ARCHIVED")
        throw new Error("Choose an active customer or prospect.");
      const title = String(fd.get("title")).trim();
      if (!title) throw new Error("Enter a quote title.");
      const currency = fd.get("currency");
      if (!["USD", "PKR", "EUR", "GBP"].includes(currency))
        throw new Error("Choose a supported currency.");
      const validUntil = fd.get("validUntil");
      if (validUntil && !validDate(validUntil))
        throw new Error("Enter a valid expiry date.");
      const descriptions = fd.getAll("description"),
        quantities = fd.getAll("quantity"),
        prices = fd.getAll("price"),
        taxes = fd.getAll("tax");
      const items = descriptions.map((description, i) => {
        const quantity = Number(quantities[i]),
          price = cents(prices[i]) / 100,
          tax = cents(taxes[i]) / 100;
        if (
          !String(description).trim() ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 1000000 ||
          price <= 0 ||
          tax > 100
        )
          throw new Error(
            "Each line needs a description, positive whole quantity and price, and tax between 0 and 100%.",
          );
        if (!Number.isSafeInteger(Math.round(price * 100) * quantity))
          throw new Error("Line amount is too large.");
        return {
          description: String(description).trim().slice(0, 300),
          quantity,
          price,
          tax,
        };
      });
      if (!items.length || items.length > 20 || total(items) > 1000000000)
        throw new Error("Use 1–20 lines and a total below one billion.");
      const quote = {
        id: old?.id || N.id("quote"),
        title: title.slice(0, 160),
        customerId: customer.id,
        dealId: String(fd.get("dealId") || ""),
        currency,
        status: "DRAFT",
        validUntil,
        terms: String(fd.get("terms") || "")
          .trim()
          .slice(0, 2000),
        items,
      };
      if (old) Object.assign(old, quote);
      else N.data.quotes.push(quote);
      if (N.save("Draft quote saved.")) {
        N.closeModal();
        N.go("quotes", { quoteId: quote.id });
      }
    } catch (error) {
      N.formError(form, error.message);
    }
  };
  N.actions["fin-issue-quote"] = (el) => {
    if (!guarded(true)) return;
    const quote = find("quotes", el.dataset.id);
    if (!quote || quote.status !== "DRAFT") return;
    if (quote.validUntil && quote.validUntil < N.today())
      return N.notify(
        "This quote has expired. Edit its validity date before issuing.",
        "error",
      );
    quote.status = "SENT";
    N.save("Quote issued locally. Terms are now locked; no email was sent.");
  };
  function decisionDialog(id, accept) {
    if (!guarded(true)) return;
    const quote = find("quotes", id);
    if (!quote || quote.status !== "SENT") return;
    N.modal(
      accept ? "Record customer acceptance" : "Record customer decline",
      `<form data-form="fin-decision"><input type="hidden" name="id" value="${E(id)}"><input type="hidden" name="decision" value="${accept ? "ACCEPTED" : "DECLINED"}"><p class="form-error" role="alert"></p><p>This records evidence locally; it does not contact the customer.</p>${N.textarea("Approval reference or reason", "evidence", "", 'required minlength="3" maxlength="1000"')}<button class="primary" type="submit">Record ${accept ? "acceptance" : "decline"}</button></form>`,
    );
  }
  N.actions["fin-accept-quote"] = (el) => decisionDialog(el.dataset.id, true);
  N.actions["fin-decline-quote"] = (el) => decisionDialog(el.dataset.id, false);
  N.forms["fin-decision"] = (form, fd) => {
    if (!guarded(true)) return;
    const quote = find("quotes", fd.get("id"));
    if (!quote || quote.status !== "SENT")
      return N.formError(form, "This quote is no longer awaiting a response.");
    const evidence = String(fd.get("evidence")).trim();
    if (evidence.length < 3)
      return N.formError(
        form,
        "Enter a meaningful customer reference or reason.",
      );
    if (
      quote.validUntil &&
      quote.validUntil < N.today() &&
      fd.get("decision") === "ACCEPTED"
    )
      return N.formError(
        form,
        "This quote has expired and cannot be accepted. Create a new quote.",
      );
    quote.status = fd.get("decision") === "ACCEPTED" ? "ACCEPTED" : "DECLINED";
    quote.acceptanceNote = evidence.slice(0, 1000);
    quote.acceptedAt = N.today();
    if (N.save("Customer response recorded.")) N.closeModal();
  };
  N.actions["fin-convert-order"] = (el) => {
    if (!guarded(true)) return;
    const quote = find("quotes", el.dataset.id);
    if (!quote || quote.status !== "ACCEPTED")
      return N.notify("Accept the quote before creating an order.", "error");
    let order = N.data.orders.find((row) => row.quoteId === quote.id);
    if (!order) {
      order = {
        id: N.id("order"),
        quoteId: quote.id,
        customerId: quote.customerId,
        title: quote.title.replace(/ quote$/i, "") + " — sales order",
        currency: quote.currency,
        total: total(quote.items),
        status: "CONFIRMED",
        date: N.today(),
      };
      N.data.orders.push(order);
      if (!N.save("Sales order created with the accepted terms.")) return;
    }
    N.go("quotes", { tab: "orders", orderId: order.id });
  };

  /* Invoices: source reservations remain linked even after a full credit.
     Credits preserve history and never trigger refunds or release charges. */
  const linkedInvoice = (key, id) =>
    N.data.invoices.find(
      (row) =>
        row.status !== "VOID" &&
        (key === "orderId"
          ? row.orderId === id
          : (row.timeIds || []).includes(id)),
    );
  const paid = (invoice) =>
    (invoice.payments || []).reduce(
      (sum, payment) => sum + Math.round(payment.amount * 100),
      0,
    ) / 100;
  const rateFor = (entry, currency) =>
    N.data.rates
      .filter(
        (rate) =>
          rate.userId === entry.userId &&
          rate.currency === currency &&
          rate.effectiveFrom <= entry.date,
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  N.views.invoices = function () {
    if (!N.isOwner())
      return N.empty(
        "Invoices require the owner role",
        "Managers can explore sales and delivery; financial records are shown to the owner.",
      );
    const invoice = find("invoices", N.params.invoiceId);
    if (invoice) return invoiceDetail(invoice);
    const order = find("orders", N.params.orderId);
    const outstanding = N.data.invoices
      .filter((i) => ["ISSUED", "PAID"].includes(i.status))
      .reduce((sum, i) => {
        const key = i.currency;
        sum[key] =
          (sum[key] || 0) +
          Math.max(0, Math.round((i.total - paid(i)) * 100)) / 100;
        return sum;
      }, {});
    return `<div class="page-head"><div><p class="eyebrow">FINANCE / BILLING</p><h1>Invoices</h1><p class="muted">Turn confirmed orders or independently approved time into an invoice, then record receipts.</p></div><div class="actions">${button("From sales order", "fin-order-compose")}${button("Invoice approved time", "fin-time-compose", "", "primary")}</div></div>
      ${order ? `<div class="banner">Sales order: <strong>${E(order.title)}</strong> · ${N.money(order.total, order.currency)} ${button("Create invoice for this order", "fin-create-order-invoice", order.id, "primary")}</div>` : ""}
      <div class="stats">${
        Object.entries(outstanding)
          .map(
            ([currency, amount]) =>
              `<article class="stat"><span>Outstanding · ${E(currency)}</span><strong>${N.money(amount, currency)}</strong></article>`,
          )
          .join("") ||
        '<article class="stat"><span>Invoice records</span><strong>0</strong></article>'
      }<article class="stat"><span>Draft invoices</span><strong>${N.data.invoices.filter((i) => i.status === "DRAFT").length}</strong></article></div>
      <div class="toolbar"><label class="search">Find invoices<input type="search" data-fin-filter="invoices" placeholder="Number or customer"></label></div><div id="fin-invoice-list">${invoiceRows(N.data.invoices)}</div><p class="hint">Payment entries are evidence of external receipts. This browser demo never charges cards, transfers funds or sends invoices.</p>`;
  };
  function invoiceRows(rows) {
    if (!rows.length)
      return N.empty(
        "No invoices yet",
        "Create an invoice from a confirmed order or approved billable time.",
      );
    return listTable(
      ["Invoice", "Customer", "Source", "Status", "Total", "Balance", ""],
      rows.map((row) => [
        E(row.number),
        E(N.customerName(row.customerId)),
        E(row.type === "TIME" ? "Approved time" : "Sales order"),
        N.badge(row.status),
        N.money(row.total, row.currency),
        N.money(
          ["CREDITED", "VOID"].includes(row.status)
            ? 0
            : Math.max(0, row.total - paid(row)),
          row.currency,
        ),
        button("Open invoice", "fin-open-invoice", row.id),
      ]),
    );
  }
  function invoiceDetail(invoice) {
    const quote = find("quotes", find("orders", invoice.orderId)?.quoteId);
    return `<div class="page-head"><div>${button("← All invoices", "fin-back-invoices", "", "text-button")}<p class="eyebrow">FINANCE / INVOICE</p><h1>${E(invoice.number)}</h1><p class="muted">${E(N.customerName(invoice.customerId))} · ${invoice.type === "TIME" ? "Approved time" : "Sales order"}</p></div>${N.badge(invoice.status)}</div>
      <section class="panel printable-invoice" id="printable-invoice"><div class="section-head"><div><h2>${E(N.data.company.name)}</h2><p class="muted">${E(N.data.company.address || "")}</p></div><div><strong>${E(invoice.number)}</strong><p>Due ${N.date(invoice.dueDate)}</p></div></div><p><strong>Bill to:</strong> ${E(N.customerName(invoice.customerId))}</p>${lineTable(invoice.items, invoice.currency)}<div class="section-head"><span>Invoice total</span><strong>${N.money(invoice.total, invoice.currency)}</strong></div><p>Recorded receipts: ${N.money(paid(invoice), invoice.currency)}</p><p><strong>Outstanding: ${N.money(["CREDITED", "VOID"].includes(invoice.status) ? 0 : Math.max(0, invoice.total - paid(invoice)), invoice.currency)}</strong></p>${quote ? `<p class="muted">${E(quote.terms)}</p>` : ""}<p class="hint">Fictional demonstration invoice. Not a tax-compliant accounting document.</p></section>
      ${invoice.creditReason ? `<div class="banner"><strong>Full credit recorded:</strong> ${E(invoice.creditReason)}. Original receipts are preserved; no refund was made.</div>` : ""}
      <div class="actions">${invoice.status === "DRAFT" ? button("Issue invoice", "fin-issue-invoice", invoice.id, "primary") + button("Void draft", "fin-void-invoice", invoice.id) : ""}${invoice.status === "ISSUED" ? button("Record external receipt", "fin-payment", invoice.id, "primary") : ""}${["ISSUED", "PAID"].includes(invoice.status) ? button("Record full credit", "fin-credit", invoice.id) : ""}${button("Print / save PDF", "fin-print", invoice.id)}${invoice.orderId ? button("Open source order", "fin-open-order", invoice.orderId) : ""}</div>
      <section class="panel"><h2>Receipt history</h2>${
        invoice.payments?.length
          ? listTable(
              ["Date", "Reference", "Amount"],
              invoice.payments.map((row) => [
                N.date(row.date),
                E(row.reference),
                N.money(row.amount, invoice.currency),
              ]),
            )
          : '<p class="muted">No external receipts recorded.</p>'
      }</section>`;
  }
  function newInvoice(fields) {
    const number = "INV-" + String(N.data.invoices.length + 1).padStart(4, "0");
    return Object.assign(
      {
        id: N.id("invoice"),
        number,
        status: "DRAFT",
        dueDate: dateAfter(14),
        payments: [],
        timeIds: [],
      },
      fields,
    );
  }
  function dateAfter(days) {
    const date = new Date(N.today() + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  N.actions["fin-open-invoice"] = (el) =>
    N.go("invoices", { invoiceId: el.dataset.id });
  N.actions["fin-back-invoices"] = () => N.go("invoices");
  N.actions["fin-order-compose"] = () => {
    if (!guarded(false)) return;
    const orders = N.data.orders.filter(
      (order) =>
        order.status === "CONFIRMED" && !linkedInvoice("orderId", order.id),
    );
    if (!orders.length)
      return N.notify(
        "No uninvoiced confirmed sales orders. Accept a quote and create an order first.",
        "error",
      );
    N.modal(
      "Invoice a confirmed sales order",
      `<form data-form="fin-order-select"><p class="form-error" role="alert"></p>${N.select(
        "Sales order",
        "orderId",
        orders.map((order) => [
          order.id,
          order.title + " · " + N.money(order.total, order.currency),
        ]),
        "",
        "required",
      )}<p class="hint">Accepted order lines and prices are copied unchanged into a draft invoice.</p><button class="primary" type="submit">Create draft invoice</button></form>`,
    );
  };
  function createFromOrder(id) {
    if (!guarded(false)) return;
    const order = find("orders", id);
    if (!order || order.status !== "CONFIRMED")
      return N.notify("Choose a confirmed sales order.", "error");
    const existing = linkedInvoice("orderId", id);
    if (existing) {
      N.closeModal();
      N.go("invoices", { invoiceId: existing.id });
      return;
    }
    const quote = find("quotes", order.quoteId);
    if (!quote || quote.status !== "ACCEPTED")
      return N.notify("The order must refer to an accepted quote.", "error");
    const items = JSON.parse(JSON.stringify(quote.items));
    const invoice = newInvoice({
      customerId: order.customerId,
      orderId: order.id,
      type: "ORDER",
      currency: order.currency,
      items,
      total: total(items),
    });
    N.data.invoices.push(invoice);
    if (N.save("Draft invoice created from the confirmed order.")) {
      N.closeModal();
      N.go("invoices", { invoiceId: invoice.id });
    }
  }
  N.forms["fin-order-select"] = (form, fd) =>
    createFromOrder(fd.get("orderId"));
  N.actions["fin-create-order-invoice"] = (el) =>
    createFromOrder(el.dataset.id);
  N.actions["fin-time-compose"] = () => {
    if (!guarded(false)) return;
    const projects = N.data.projects.filter((p) => p.customerId);
    if (!projects.length)
      return N.notify(
        "Create a customer-linked project and approve billable time first.",
        "error",
      );
    N.modal(
      "Invoice approved time",
      `<form data-form="fin-time-select"><p class="form-error" role="alert"></p>${N.select(
        "Project / customer",
        "projectId",
        projects.map((p) => [
          p.id,
          p.name + " · " + N.customerName(p.customerId),
        ]),
        "",
        "required",
      )}${N.select(
        "Billing currency",
        "currency",
        [
          ["USD", "USD"],
          ["PKR", "PKR"],
          ["EUR", "EUR"],
          ["GBP", "GBP"],
        ],
        N.data.company.currency || "USD",
        "required",
      )}<p class="hint">Only independently approved, billable and unbilled entries are eligible. Each entry uses its worker’s latest rate effective on the work date.</p><button class="primary" type="submit">Review eligible time</button></form>`,
    );
  };
  function eligibleTime(projectId, currency) {
    return N.data.times
      .filter(
        (entry) =>
          entry.projectId === projectId &&
          entry.status === "APPROVED" &&
          entry.billable &&
          entry.reviewerId &&
          entry.reviewerId !== entry.userId &&
          !linkedInvoice("timeId", entry.id),
      )
      .map((entry) => ({ entry, rate: rateFor(entry, currency) }));
  }
  N.forms["fin-time-select"] = (form, fd) => {
    if (!guarded(false)) return;
    const project = find("projects", fd.get("projectId")),
      currency = fd.get("currency");
    if (!project || !["USD", "PKR", "EUR", "GBP"].includes(currency))
      return N.formError(form, "Choose a valid project and currency.");
    const rows = eligibleTime(project.id, currency);
    N.modal(
      "Review approved time charges",
      `<form data-form="fin-create-time-invoice"><input type="hidden" name="projectId" value="${E(project.id)}"><input type="hidden" name="currency" value="${E(currency)}"><p class="form-error" role="alert"></p><p><strong>${E(project.name)}</strong> · ${E(N.customerName(project.customerId))}</p>${rows.length ? rows.map(({ entry, rate }) => `<label class="card"><input type="checkbox" name="entryId" value="${E(entry.id)}" ${rate ? "checked" : "disabled"}> <strong>${E(N.userName(entry.userId))}</strong> · ${N.date(entry.date)} · ${E(entry.hours)} hours<br><span class="muted">${E(entry.note)}</span><br>${rate ? `${N.money(rate.amount, currency)} / hour → <strong>${N.money(Math.round(Math.round(rate.amount * 100) * entry.hours) / 100, currency)}</strong>` : "No effective worker rate in this currency. Add a rate in Timesheets first."}</label>`).join("") : N.empty("No eligible time", "Approve billable entries independently, then return to create a draft.")}${N.field("Invoice due date", "dueDate", dateAfter(14), "date", "required")}<p class="hint">Charges are rounded per entry in cents. Creating this draft reserves the selected time so it cannot be billed twice.</p><button class="primary" type="submit" ${rows.some((row) => row.rate) ? "" : "disabled"}>Create draft from approved time</button></form>`,
    );
  };
  N.forms["fin-create-time-invoice"] = (form, fd) => {
    if (!guarded(false)) return;
    try {
      const project = find("projects", fd.get("projectId")),
        currency = fd.get("currency"),
        dueDate = fd.get("dueDate");
      if (!project || !validDate(dueDate))
        throw new Error("Choose a valid project and due date.");
      const ids = [...new Set(fd.getAll("entryId"))];
      if (!ids.length || ids.length > 50)
        throw new Error("Select between 1 and 50 eligible entries.");
      const eligible = eligibleTime(project.id, currency);
      const items = ids.map((id) => {
        const row = eligible.find((item) => item.entry.id === id);
        if (!row?.rate)
          throw new Error(
            "A selected entry is no longer eligible or has no effective rate.",
          );
        if (!Number.isFinite(row.entry.hours) || row.entry.hours <= 0)
          throw new Error("A time entry has invalid hours.");
        return {
          description:
            N.userName(row.entry.userId) +
            " · " +
            row.entry.date +
            " · " +
            row.entry.note,
          quantity: row.entry.hours,
          price: row.rate.amount,
          tax: 0,
        };
      });
      const amount = total(items);
      if (amount <= 0 || amount > 1000000000)
        throw new Error(
          "The selected charges must have a positive supported total.",
        );
      const invoice = newInvoice({
        customerId: project.customerId,
        timeIds: ids,
        type: "TIME",
        currency,
        items,
        total: amount,
        dueDate,
      });
      N.data.invoices.push(invoice);
      if (N.save("Approved time reserved in a draft invoice.")) {
        N.closeModal();
        N.go("invoices", { invoiceId: invoice.id });
      }
    } catch (error) {
      N.formError(form, error.message);
    }
  };
  N.actions["fin-issue-invoice"] = (el) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", el.dataset.id);
    if (!invoice || invoice.status !== "DRAFT") return;
    invoice.status = "ISSUED";
    invoice.issuedAt = N.today();
    N.save("Invoice issued locally. No email or payment request was sent.");
  };
  N.actions["fin-void-invoice"] = (el) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", el.dataset.id);
    if (!invoice || invoice.status !== "DRAFT") return;
    if (
      !window.confirm(
        "Void this draft? It will remain in history; its source becomes available for a new draft.",
      )
    )
      return;
    invoice.status = "VOID";
    N.save("Draft voided; original history preserved.");
  };
  N.actions["fin-payment"] = (el) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", el.dataset.id);
    if (!invoice || invoice.status !== "ISSUED") return;
    N.modal(
      "Record an external receipt",
      `<form data-form="fin-save-payment"><input type="hidden" name="id" value="${E(invoice.id)}"><p class="form-error" role="alert"></p><p>No money moves here. Record a fictional external payment reference.</p>${N.field("Amount received (" + invoice.currency + ")", "amount", Math.max(0, invoice.total - paid(invoice)).toFixed(2), "number", 'required min="0.01" step="0.01"')}${N.field("Receipt date", "date", N.today(), "date", 'required max="' + E(N.today()) + '"')}${N.field("External receipt reference", "reference", "", "text", 'required minlength="3" maxlength="160"')}<button class="primary" type="submit">Save receipt record</button></form>`,
    );
  };
  N.forms["fin-save-payment"] = (form, fd) => {
    if (!guarded(false)) return;
    try {
      const invoice = find("invoices", fd.get("id"));
      if (!invoice || invoice.status !== "ISSUED")
        throw new Error("Only issued invoices can receive receipt records.");
      const amount = cents(fd.get("amount")),
        balance =
          Math.round(invoice.total * 100) - Math.round(paid(invoice) * 100),
        date = fd.get("date"),
        reference = String(fd.get("reference")).trim();
      if (amount <= 0 || amount > balance)
        throw new Error(
          "Receipt amount must be positive and cannot exceed the outstanding balance.",
        );
      if (!validDate(date) || date > N.today())
        throw new Error("Receipt date must be a real date, today or earlier.");
      if (reference.length < 3)
        throw new Error("Provide an external receipt reference.");
      if (
        (invoice.payments || []).some(
          (row) => row.reference.toLowerCase() === reference.toLowerCase(),
        )
      )
        throw new Error(
          "This receipt reference was already recorded on this invoice.",
        );
      (invoice.payments ||= []).push({
        amount: amount / 100,
        date,
        reference: reference.slice(0, 160),
      });
      if (amount === balance) invoice.status = "PAID";
      if (N.save("External receipt recorded; no funds were moved."))
        N.closeModal();
    } catch (error) {
      N.formError(form, error.message);
    }
  };
  N.actions["fin-credit"] = (el) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", el.dataset.id);
    if (!invoice || !["ISSUED", "PAID"].includes(invoice.status)) return;
    N.modal(
      "Record a full invoice credit",
      `<form data-form="fin-save-credit"><input type="hidden" name="id" value="${E(invoice.id)}"><p class="form-error" role="alert"></p><p>This credits the full ${N.money(invoice.total, invoice.currency)} in the demo history. Receipt records remain; no refund is made. Partial credits and replacement invoices are not simulated.</p>${N.textarea("Credit reason", "reason", "", 'required minlength="5" maxlength="1000"')}<button type="submit" class="danger">Record full credit</button></form>`,
    );
  };
  N.forms["fin-save-credit"] = (form, fd) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", fd.get("id")),
      reason = String(fd.get("reason")).trim();
    if (!invoice || !["ISSUED", "PAID"].includes(invoice.status))
      return N.formError(form, "This invoice cannot be credited.");
    if (reason.length < 5)
      return N.formError(
        form,
        "Provide a meaningful reason for the full credit.",
      );
    invoice.status = "CREDITED";
    invoice.creditReason = reason.slice(0, 1000);
    if (
      N.save(
        "Full credit recorded. Receipt history is preserved; no refund was made.",
      )
    )
      N.closeModal();
  };
  N.actions["fin-print"] = () => {
    if (!guarded(false)) return;
    const section = document.getElementById("printable-invoice");
    if (!section) return;
    document.body.classList.add("printing-invoice");
    window.print();
    document.body.classList.remove("printing-invoice");
  };
  document.addEventListener("input", (event) => {
    const input = event.target.closest("[data-fin-filter]");
    if (!input) return;
    const kind = input.dataset.finFilter,
      q = input.value.trim().toLowerCase();
    const rows = N.data[kind].filter((row) =>
      [row.title, row.number, N.customerName(row.customerId)].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(q),
      ),
    );
    const target = document.getElementById(
      kind === "invoices" ? "fin-invoice-list" : "fin-sales-list",
    );
    if (target)
      target.innerHTML =
        kind === "invoices" ? invoiceRows(rows) : salesRows(kind, rows);
  });
})();
