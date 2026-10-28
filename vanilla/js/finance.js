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

  function lineEditor(
    item = { description: "", quantity: 1, price: "", tax: 0 },
  ) {
    item = Object.assign(
      { description: "", quantity: 1, price: "", tax: 0 },
      item,
    );
    return `<fieldset class="quote-line"><legend>Item</legend><div class="form-grid">${N.field("Item description", "description", item.description, "text", 'required maxlength="300"')}${N.field("Quantity", "quantity", item.quantity, "number", 'required min="1" max="1000000" step="1"')}${N.field("Unit price", "price", item.price, "number", 'required min="0.01" max="1000000000" step="0.01"')}${N.field("Tax percent", "tax", item.tax, "number", 'required min="0" max="100" step="0.01"')}</div>${button("Remove item", "fin-remove-line", "", "text-button")}</fieldset>`;
  }
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
  function snapshotInvoiceBilling(invoice) {
    const company = N.data.company,
      customer = find("customers", invoice.customerId),
      quote = find("quotes", find("orders", invoice.orderId)?.quoteId);
    const defaults = {
      issuerName: company.legalName || company.name,
      issuerAddress: company.address || "",
      customerName: customer?.name || "Unlinked customer",
      customerEmail: customer?.email || "",
      customerAddress: customer?.billingAddress || customer?.address || "",
      terms: quote?.terms || "",
      paymentInstructions: company.paymentInstructions || "",
    };
    Object.keys(defaults).forEach((key) => {
      if (invoice[key] === undefined) invoice[key] = defaults[key];
    });
    return invoice;
  }
  function invoiceBillingView(invoice) {
    if (invoice.status === "DRAFT")
      return snapshotInvoiceBilling({ ...invoice });
    // Older seeded invoices have no issuer snapshot. Never invent one from changed settings.
    return {
      ...invoice,
      issuerName:
        invoice.issuerName ?? "Issuer not recorded on this legacy demo invoice",
      issuerAddress: invoice.issuerAddress ?? "",
      customerName: invoice.customerName ?? N.customerName(invoice.customerId),
      customerEmail: invoice.customerEmail ?? "",
      customerAddress: invoice.customerAddress ?? "",
      terms: invoice.terms ?? "",
      paymentInstructions: invoice.paymentInstructions ?? "",
    };
  }
  function newInvoice(fields) {
    const number = "INV-" + String(N.data.invoices.length + 1).padStart(4, "0");
    return snapshotInvoiceBilling(
      Object.assign(
        {
          id: N.id("invoice"),
          number,
          status: "DRAFT",
          dueDate: dateAfter(14),
          payments: [],
          timeIds: [],
        },
        fields,
      ),
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
    snapshotInvoiceBilling(invoice);
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
  /* Source-aligned screen layout. Business transitions above remain unchanged. */
  const sourceFilters = {
    quotes: { q: "", status: "" },
    orders: { q: "", status: "" },
    invoices: { q: "", status: "" },
  };
  const sourceLabel = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase());
  const sourceQuoteLabel = (value) =>
    value === "SENT" ? "Issued" : sourceLabel(value);
  const sourceHead = (title, description) =>
    `<div class="page-head section-heading"><div><h2>${E(title)}</h2><p class="muted">${E(description)}</p></div></div>`;
  const sourceStatus = (invoice) =>
    `${["PAID", "CREDITED"].includes(invoice.status) ? "Issued" : sourceLabel(invoice.status)} · ${invoice.status === "CREDITED" ? "Credited" : paid(invoice) >= invoice.total ? "Paid" : paid(invoice) > 0 ? "Part paid" : "Unpaid"}`;
  N.viewFilters = N.viewFilters || {};
  N.viewFilters.invoices = {
    get: () => ({ ...sourceFilters.invoices }),
    apply: (prefs) => {
      sourceFilters.invoices = {
        q: String(prefs.q || ""),
        status: String(prefs.status || ""),
      };
      N.render();
    },
  };
  function sourceSearch(kind) {
    const state = sourceFilters[kind],
      isQuote = kind === "quotes",
      isInvoice = kind === "invoices";
    return `<form class="list-tools toolbar" data-form="fin-source-search"><input type="hidden" name="kind" value="${kind}"><label class="field search"><span>Find ${kind === "orders" ? "sales orders" : kind}</span><input type="search" name="q" maxlength="200" value="${E(state.q)}"></label>${
      isQuote
        ? N.select(
            "Quote status",
            "status",
            [
              ["", "All statuses"],
              ["DRAFT", "Draft"],
              ["SENT", "Issued"],
              ["ACCEPTED", "Accepted"],
              ["DECLINED", "Declined"],
              ["SUPERSEDED", "Superseded"],
            ],
            state.status,
          )
        : isInvoice
          ? N.select(
              "Invoice status",
              "status",
              [
                ["", "All statuses"],
                ["DRAFT", "Draft"],
                ["ISSUED", "Issued"],
              ],
              state.status,
            )
          : ""
    }<button type="submit" class="secondary">Search</button></form>`;
  }
  N.forms["fin-source-search"] = (form, fd) => {
    const kind = fd.get("kind");
    if (sourceFilters[kind]) {
      sourceFilters[kind] = {
        q: String(fd.get("q") || "").trim(),
        status: String(fd.get("status") || ""),
      };
      N.render();
    }
  };
  function sourceRows(kind) {
    const state = sourceFilters[kind];
    return N.data[kind].filter(
      (row) =>
        (!state.status ||
          (kind === "invoices" && state.status === "ISSUED"
            ? ["ISSUED", "PAID", "CREDITED"].includes(row.status)
            : row.status === state.status)) &&
        (!state.q ||
          [row.title, row.number, N.customerName(row.customerId)].some(
            (value) =>
              String(value || "")
                .toLowerCase()
                .includes(state.q.toLowerCase()),
          )),
    );
  }
  function sourceQuoteRows(kind, rows) {
    if (!rows.length)
      return N.empty(
        "No " +
          (kind === "orders" ? "sales orders" : "quotes") +
          " match this view.",
        "Create a record or change the current search filters.",
      );
    return `<div class="directory sales-records">${rows.map((row) => `<article class="directory-row record-row"><div><h3>${E(row.title)}</h3><p>${E(N.customerName(row.customerId))} · ${kind === "quotes" ? sourceQuoteLabel(row.status) : "Sales order"}</p><p>${N.money(kind === "quotes" ? total(row.items) : row.total, row.currency)}</p></div>${button("Open " + (kind === "quotes" ? "quote" : "sales order"), kind === "quotes" ? "fin-open-quote" : "fin-open-order", row.id)}</article>`).join("")}</div>`;
  }
  N.views.quotes = function () {
    if (!N.canManage())
      return N.empty(
        "Sales records are unavailable",
        "Choose an owner or manager demo role.",
      );
    const heading = sourceHead(
      "Quotes and sales orders",
      "Agree the scope and price, preserve the approved terms, then create a sales order.",
    );
    const quote = find("quotes", N.params.quoteId),
      order = find("orders", N.params.orderId);
    if (quote) return heading + sourceQuoteDetail(quote);
    if (order) return heading + sourceOrderDetail(order);
    if (N.params.compose === "quote")
      return (
        heading + sourceQuoteForm(N.params.editId || "", N.params.dealId || "")
      );
    const kind = N.params.tab === "orders" ? "orders" : "quotes",
      rows = sourceRows(kind);
    return (
      heading +
      salesTabs(kind) +
      (kind === "quotes"
        ? `<div class="actions">${button("New quote", "fin-new-quote", N.params.dealId || "", "primary")}</div>`
        : "") +
      sourceSearch(kind) +
      `<p class="list-summary" role="status">${rows.length} ${kind === "orders" ? "sales orders" : "quotes"}</p>` +
      sourceQuoteRows(kind, rows)
    );
  };
  function sourceQuoteForm(id, dealId) {
    const quote = find("quotes", id),
      deal = find("deals", dealId || quote?.dealId);
    return `<section aria-label="New quote">${button("← All quotes", "fin-back-quotes", "", "back")}<h3>${quote ? "Edit draft quote" : "New quote"}</h3>${deal ? `<div class="notice"><p>Deal: ${E(deal.name)}</p><p>Customer: ${E(N.customerName(deal.customerId))}</p></div>` : ""}<form class="draft-fields" data-form="fin-save-quote"><input type="hidden" name="id" value="${E(id)}"><input type="hidden" name="dealId" value="${E(deal?.id || "")}"><p class="form-error" role="alert"></p>${N.select("Customer for this quote", "customerId", [["", "Choose a customer"]].concat(N.data.customers.filter((c) => c.status !== "ARCHIVED").map((c) => [c.id, c.name])), quote?.customerId || deal?.customerId || "", "required")}<fieldset><legend>Quote terms</legend>${N.field("Quote title", "title", quote?.title || (deal ? deal.name + " quote" : ""), "text", 'required maxlength="160"')}${N.select(
      "Quote currency",
      "currency",
      [
        ["USD", "USD"],
        ["GBP", "GBP"],
        ["PKR", "PKR"],
        ["EUR", "EUR"],
      ],
      quote?.currency || deal?.currency || N.data.company.currency || "USD",
      "required",
    )}${N.field("Valid until (optional, UTC date)", "validUntil", quote?.validUntil || "", "date")}${N.textarea("Payment and delivery terms", "terms", quote?.terms || "", 'maxlength="2000"')}<h3>Line items</h3><p class="muted">Whole-unit quantities. Tax is entered explicitly and rounded per line; confirm the applicable rate for your quote.</p><div id="fin-lines">${(quote?.items || [{}]).map(lineEditor).join("")}</div><div class="actions">${button("Add item", "fin-add-line")}</div><p class="hint">Totals are calculated locally when you save. This standalone version has no server.</p><button class="primary" type="submit">${quote ? "Save quote changes" : "Save draft quote"}</button></fieldset></form></section>`;
  }
  N.actions["fin-new-quote"] = (el) => {
    if (guarded(true))
      N.go("quotes", { compose: "quote", dealId: el.dataset.id });
  };
  N.actions["fin-edit-quote"] = (el) => {
    const quote = find("quotes", el.dataset.id);
    if (guarded(true) && quote?.status === "DRAFT")
      N.go("quotes", { compose: "quote", editId: quote.id });
  };
  function sourceTotals(items, currency, invoice) {
    const subtotal =
        items.reduce(
          (sum, item) =>
            sum + Math.round(Math.round(item.price * 100) * item.quantity),
          0,
        ) / 100,
      amount = total(items);
    return `<dl class="quote-totals"><dt>Subtotal</dt><dd>${N.money(subtotal, currency)}</dd><dt>Tax</dt><dd>${N.money(Math.round((amount - subtotal) * 100) / 100, currency)}</dd><dt>${invoice ? "Invoice total" : "Total"}</dt><dd><strong>${N.money(amount, currency)}</strong></dd>${invoice ? `<dt>Active payments</dt><dd>${N.money(paid(invoice), currency)}</dd><dt>Credited</dt><dd>${N.money(invoice.status === "CREDITED" ? invoice.total : 0, currency)}</dd><dt>Unpaid balance</dt><dd><strong>${N.money(["CREDITED", "VOID"].includes(invoice.status) ? 0 : Math.max(0, invoice.total - paid(invoice)), currency)}</strong></dd>` : ""}</dl>`;
  }
  function sourceQuoteDetail(q) {
    const order = N.data.orders.find((row) => row.quoteId === q.id),
      customer = find("customers", q.customerId);
    return `${button("← All quotes", "fin-back-quotes", "", "back")}<h2>${E(q.title)}</h2><section class="panel transcript-panel quote-snapshot"><h3>Saved quote</h3><p>Status: ${sourceQuoteLabel(q.status)} · Saved locally</p><p>Customer: ${E(N.customerName(q.customerId))}</p><p>Email: ${E(customer?.email || "Not provided")}</p><p>Valid until: ${q.validUntil ? N.date(q.validUntil) : "Not set"}</p><p>Terms: ${E(q.terms || "Not added")}</p><ol class="quote-saved-items">${q.items.map((item) => `<li><strong>${E(item.description)}</strong><p>${E(item.quantity)} × ${N.money(item.price, q.currency)} · Tax ${E(item.tax || 0)}%</p><p>Line total: ${N.money(total([item]), q.currency)}</p></li>`).join("")}</ol>${sourceTotals(q.items, q.currency)}${q.acceptanceNote ? `<p>${q.status === "DECLINED" ? "Decline reason" : "Approval reference"}: ${E(q.acceptanceNote)}</p><p>Response recorded: ${N.date(q.acceptedAt)}</p>` : ""}</section>${q.status !== "DRAFT" ? '<p class="notice">Issued terms and line items are read only. Customer approval is recorded internally; no email has been sent.</p>' : ""}${q.status === "DRAFT" ? `<details class="panel transcript-panel" open><summary>Edit draft quote</summary>${sourceQuoteForm(q.id, q.dealId)}</details><section class="panel transcript-panel"><h3>Issue the saved quote</h3><p>Review the saved totals and terms above. Issuing locks that saved version. Save any edits first.</p>${button("Issue saved quote", "fin-issue-quote", q.id, "primary")}</section>` : ""}${q.status === "SENT" ? `<section class="panel transcript-panel"><h3>Record customer decision</h3><p>Record the evidence received from the customer for the saved version above.</p><div class="actions">${button("Record customer acceptance", "fin-accept-quote", q.id, "primary")}${button("Record customer decline", "fin-decline-quote", q.id)}</div></section>` : ""}${["SENT", "DECLINED", "SUPERSEDED"].includes(q.status) ? `<section class="panel transcript-panel"><h3>Revise terms</h3><p>Create a new draft. The previous quote remains visible and can no longer be accepted.</p>${button(q.status === "SUPERSEDED" ? "Open replacement quote" : "Create quote revision", "fin-revise-quote", q.id)}</section>` : ""}${q.status === "ACCEPTED" ? `<section class="panel transcript-panel"><h3>Create a sales order</h3><p>Copy this accepted version and its exact totals into an immutable sales order. Retrying opens the same order.</p>${order ? button("Open sales order", "fin-open-order", order.id, "primary") : button("Create sales order", "fin-convert-order", q.id, "primary")}</section>` : ""}`;
  }
  function sourceOrderDetail(order) {
    const q = find("quotes", order.quoteId);
    return `${button("← All sales orders", "fin-back-orders", "", "back")}<h2>${E(order.title)}</h2><section class="panel transcript-panel quote-snapshot"><h3>Saved sales order</h3><p>Customer: ${E(N.customerName(order.customerId))}</p><p>Created: ${N.date(order.date)}</p>${q ? button("View approved quote", "fin-open-quote", q.id) : ""}<p>Terms: ${E(q?.terms || "Not added")}</p>${q ? lineTable(q.items, order.currency) : ""}${q ? sourceTotals(q.items, order.currency) : `<p>Total: ${N.money(order.total, order.currency)}</p>`}</section>${N.isOwner() ? button("Prepare invoice", "fin-invoice-order", order.id, "primary") : ""}<p class="notice">This sales order preserves the accepted quote. It is not an invoice or a payment record.</p>`;
  }
  N.views.invoices = function () {
    if (!N.isOwner())
      return N.empty(
        "Invoices require owner permission.",
        "Choose the owner demonstration role.",
      );
    const heading = sourceHead(
      "Client invoices",
      "Bill agreed work, record payment evidence, and preserve corrections without rewriting issued documents.",
    );
    const invoice = find("invoices", N.params.invoiceId);
    if (invoice) return heading + sourceInvoiceDetail(invoice);
    if (N.params.compose || N.params.orderId)
      return heading + sourceInvoiceComposer();
    const rows = sourceRows("invoices"),
      state = sourceFilters.invoices;
    return (
      heading +
      `<div class="actions">${button("New invoice", "fin-new-invoice", "", "primary")}</div>${N.savedViews ? N.savedViews("invoices", state) : ""}` +
      sourceSearch("invoices") +
      `<p class="list-summary" role="status">${rows.length} invoices</p>${sourceInvoiceRows(rows)}`
    );
  };
  function sourceInvoiceRows(rows) {
    if (!rows.length)
      return '<p class="empty">No invoices match this view.</p>';
    return `<div class="premium-table-wrap table-wrap" tabindex="0" role="region" aria-label="Records table, scroll horizontally for all columns"><table class="premium-table data-table"><caption>Client invoices · ${rows.length} records</caption><thead><tr><th scope="col">Invoice</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col">Balance</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${E(row.number || "Draft invoice")}<span class="premium-cell-detail">${E(row.title || find("orders", row.orderId)?.title || "Approved time")}</span></th><td>${E(N.customerName(row.customerId))}</td><td><span class="record-status">${sourceStatus(row)}</span></td><td>${N.money(row.total, row.currency)}</td><td>${N.money(["CREDITED", "VOID"].includes(row.status) ? 0 : Math.max(0, row.total - paid(row)), row.currency)}</td><td>${button("Open invoice", "fin-open-invoice", row.id)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function sourceInvoiceComposer() {
    const source = N.params.source || "order",
      order = find("orders", N.params.orderId);
    return `<section aria-label="New invoice"><nav class="list-tools tabs" aria-label="Invoice source">${button("Sales order", "fin-source", "order", source === "order" ? "primary" : "secondary")}${button("Approved time", "fin-source", "time", source === "time" ? "primary" : "secondary")}</nav>${button("← All invoices", "fin-back-invoices", "", "back")}${source === "time" ? `<section class="panel transcript-panel"><h3>Invoice approved time</h3><p class="muted">Select approved, billable entries for one customer and project. Preview the exact charge before creating a draft.</p>${button("Choose project and approved entries", "fin-time-compose", "", "primary")}</section>` : `<h3>Invoice accepted work</h3><p>Each sales order has one original invoice. Repeating this action opens its existing invoice.</p>${order ? `<section class="panel transcript-panel"><h3>${E(order.title)}</h3><p>Customer: ${E(N.customerName(order.customerId))}</p><p>Accepted total: ${N.money(order.total, order.currency)}</p><p>Amounts, currency, items and agreed terms are copied unchanged.</p>${button("Create or open invoice", "fin-create-order-invoice", order.id, "primary")}</section>` : `<form data-form="fin-inline-order"><p class="form-error" role="alert"></p>${N.select("Sales order to invoice", "orderId", [["", "Choose a sales order"]].concat(N.data.orders.filter((o) => o.status === "CONFIRMED").map((o) => [o.id, o.title + " · " + N.customerName(o.customerId)])), "", "required")}<button type="submit" class="primary">Review selected order</button></form>`}`}</section>`;
  }
  N.actions["fin-new-invoice"] = () => {
    if (guarded(false)) N.go("invoices", { compose: "invoice" });
  };
  N.actions["fin-source"] = (el) =>
    N.go("invoices", { compose: "invoice", source: el.dataset.id });
  N.forms["fin-inline-order"] = (form, fd) => {
    if (guarded(false))
      N.go("invoices", { compose: "invoice", orderId: fd.get("orderId") });
  };
  function sourceBillingForm(invoice) {
    const billing = invoiceBillingView(invoice);
    return `<form class="draft-fields" data-form="fin-save-billing"><input type="hidden" name="id" value="${E(invoice.id)}"><p class="form-error" role="alert"></p><fieldset><legend>Billing details</legend>${N.field("Issuer name", "issuerName", billing.issuerName, "text", 'required maxlength="200"')}${N.textarea("Issuer address", "issuerAddress", billing.issuerAddress, 'maxlength="2000"')}${N.textarea("Billing address", "customerAddress", billing.customerAddress, 'maxlength="2000"')}${N.field("Payment due date (optional, UTC)", "dueDate", invoice.dueDate || "", "date")}${N.textarea("Payment instructions", "paymentInstructions", billing.paymentInstructions, 'maxlength="2000"')}<button class="primary" type="submit">Save billing details</button></fieldset></form>`;
  }
  N.forms["fin-save-billing"] = (form, fd) => {
    if (!guarded(false)) return;
    const invoice = find("invoices", fd.get("id"));
    if (!invoice || invoice.status !== "DRAFT")
      return N.formError(form, "Issued billing details are locked.");
    const issuer = String(fd.get("issuerName") || "").trim(),
      due = String(fd.get("dueDate") || "");
    if (!issuer) return N.formError(form, "Issuer name is required.");
    if (due && !validDate(due))
      return N.formError(form, "Enter a real payment due date.");
    invoice.issuerName = issuer.slice(0, 200);
    invoice.issuerAddress = String(fd.get("issuerAddress") || "").slice(
      0,
      2000,
    );
    invoice.customerAddress = String(fd.get("customerAddress") || "").slice(
      0,
      2000,
    );
    invoice.paymentInstructions = String(
      fd.get("paymentInstructions") || "",
    ).slice(0, 2000);
    invoice.dueDate = due;
    N.save("Billing details saved.");
  };
  function sourceInvoiceDetail(invoice) {
    const billing = invoiceBillingView(invoice);
    const quote = find("quotes", find("orders", invoice.orderId)?.quoteId),
      balance = ["CREDITED", "VOID"].includes(invoice.status)
        ? 0
        : Math.max(0, invoice.total - paid(invoice));
    return `${button("← All invoices", "fin-back-invoices", "", "back")}<h2>${E(invoice.number || "Draft invoice")}</h2><header class="invoice-summary premium-record-detail panel"><div><p class="muted">${invoice.type === "TIME" ? "Approved time" : "Sales order"} · ${sourceStatus(invoice)}</p><h3>${E(invoice.title || find("orders", invoice.orderId)?.title || "Approved time")}</h3><p>${E(billing.customerName)}</p><p class="muted">Issued ${invoice.issuedAt ? N.date(invoice.issuedAt) : "not yet"} · Due ${invoice.dueDate ? N.date(invoice.dueDate) : "not specified"}</p></div><dl class="invoice-metrics"><div><dt>Unpaid balance</dt><dd><strong>${N.money(balance, invoice.currency)}</strong></dd></div><div><dt>Invoice total</dt><dd>${N.money(invoice.total, invoice.currency)}</dd></div></dl><div class="invoice-actions">${button("Print / save invoice PDF", "fin-print", invoice.id)}<p class="muted">Uses your browser print dialog. No server PDF service is used.</p></div></header>
      <details class="invoice-secondary"><summary>Saved billing details and terms</summary><div class="quote-snapshot"><p>Customer: ${E(billing.customerName)} · ${E(billing.customerEmail || "Email not provided")}</p><p>Issuer: ${E(billing.issuerName)}</p><p>Issuer address: ${E(billing.issuerAddress || "Not provided")}</p><p>Billing address: ${E(billing.customerAddress || "Not provided")}</p><p>Terms: ${E(billing.terms || "Not provided")}</p><p>Payment instructions: ${E(billing.paymentInstructions || "Not provided")}</p></div></details>
      <section class="invoice-line-items panel printable-invoice" id="printable-invoice"><h3>${E(invoice.number)} · ${E(billing.issuerName)}</h3><p>${E(billing.issuerAddress)}</p><p class="muted">${E(billing.customerName)} · Due ${invoice.dueDate ? N.date(invoice.dueDate) : "not specified"}</p><p>${E(billing.customerAddress)}</p>${listTable(
        ["Description", "Quantity and pricing", "Line total"],
        invoice.items.map((item) => [
          E(item.description),
          `${E(item.quantity)} × ${N.money(item.price, invoice.currency)} · Tax ${E(item.tax || 0)}%`,
          N.money(total([item]), invoice.currency),
        ]),
      )}${sourceTotals(invoice.items, invoice.currency, invoice)}<p>${E(billing.terms)}</p><p>${E(billing.paymentInstructions)}</p><p class="hint">Fictional demonstration invoice. Not a tax-compliant accounting document.</p></section>
      ${invoice.status === "DRAFT" ? `<details class="panel transcript-panel" open><summary>Billing details</summary>${sourceBillingForm(invoice)}</details><section class="panel transcript-panel"><h3>Issue this invoice</h3><p>Review and save the billing details before issuing. Issuing locks the saved document.</p><div class="actions">${button("Issue invoice", "fin-issue-invoice", invoice.id, "primary")}${button("Void draft", "fin-void-invoice", invoice.id)}</div></section>` : ""}
      ${invoice.status === "ISSUED" ? `<section class="panel transcript-panel"><h3>Record a received payment</h3><p>Record external evidence only. This action does not charge a customer or move money.</p>${button("Record payment", "fin-payment", invoice.id, "primary")}</section>` : ""}
      <details class="invoice-secondary" open><summary>Payment evidence and corrections</summary><section class="panel"><h3>Recorded payments</h3>${
        invoice.payments?.length
          ? listTable(
              ["Date", "Receipt or bank reference", "Amount"],
              invoice.payments.map((row) => [
                N.date(row.date),
                E(row.reference),
                N.money(row.amount, invoice.currency),
              ]),
            )
          : '<p class="muted">No external receipts recorded.</p>'
      }${["ISSUED", "PAID"].includes(invoice.status) ? button("Record full credit", "fin-credit", invoice.id) : ""}${invoice.creditReason ? `<p class="notice">Full credit: ${E(invoice.creditReason)}. Original receipts remain; no refund was made.</p>` : ""}<p class="hint">Partial credits, payment reversals and replacement drafts are not simulated in this static version.</p></section></details>${invoice.orderId ? button("Open source order", "fin-open-order", invoice.orderId) : ""}`;
  }

  N.actions["fin-revise-quote"] = (el) => {
    if (!guarded(true)) return;
    const quote = find("quotes", el.dataset.id);
    if (!quote || !["SENT", "DECLINED", "SUPERSEDED"].includes(quote.status))
      return;
    let replacement = N.data.quotes.find(
      (row) => row.supersedesQuoteId === quote.id,
    );
    if (!replacement) {
      replacement = JSON.parse(JSON.stringify(quote));
      replacement.id = N.id("quote");
      replacement.status = "DRAFT";
      replacement.supersedesQuoteId = quote.id;
      delete replacement.acceptanceNote;
      delete replacement.acceptedAt;
      quote.status = "SUPERSEDED";
      N.data.quotes.push(replacement);
      if (
        !N.save("New draft revision created. Previous terms remain preserved.")
      )
        return;
    }
    N.go("quotes", { quoteId: replacement.id });
  };
  function markFinancialDraftDirty(event) {
    const form = event.target.closest(
      'form[data-form="fin-save-quote"],form[data-form="fin-save-billing"]',
    );
    if (!form) return;
    const issue = document.querySelector(
      '[data-action="fin-issue-quote"],[data-action="fin-issue-invoice"]',
    );
    if (!issue) return;
    issue.disabled = true;
    if (!form.querySelector(".financial-dirty")) {
      const note = document.createElement("p");
      note.className = "hint financial-dirty";
      note.setAttribute("role", "status");
      note.textContent = "Save your draft changes before issuing.";
      form.appendChild(note);
    }
  }
  document.addEventListener("input", markFinancialDraftDirty);
  document.addEventListener("change", markFinancialDraftDirty);
})();
