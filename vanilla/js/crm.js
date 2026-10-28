/* Customer relationships and sales pipeline. Plain functions + DOM events. */
(function () {
  "use strict";
  var N = window.Nova;
  var customerFilter = { query: "", status: "" };
  var pipelineFilter = {
    kind: "deals",
    query: "",
    status: "",
    layout: "board",
  };
  var stages = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  var leadStates = ["NEW", "QUALIFIED", "DISQUALIFIED"];
  var currencies = ["USD", "GBP", "PKR"];

  function text(value) {
    return String(value || "").trim();
  }
  function title(value) {
    return text(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, function (c) {
        return c.toUpperCase();
      });
  }
  function includes(query, values) {
    return values.join(" ").toLowerCase().includes(query.toLowerCase());
  }
  function choices(values) {
    return values.map(function (value) {
      return [value, title(value)];
    });
  }
  function customers() {
    return N.data.customers
      .filter(function (item) {
        return item.status !== "ARCHIVED";
      })
      .map(function (item) {
        return [item.id, item.name];
      });
  }
  function formStart(name, id) {
    return (
      '<form data-form="' +
      name +
      '" data-id="' +
      N.esc(id || "") +
      '"><p class="form-error" role="alert"></p><div class="form-grid">'
    );
  }
  function formEnd(label) {
    return (
      '</div><div class="actions"><button type="submit" class="primary">' +
      N.esc(label) +
      "</button></div></form>"
    );
  }
  function noAccess() {
    return N.empty(
      "Company role required",
      "Customer relationships and pipeline records are available in the Owner and Manager demo views.",
    );
  }
  function allowed() {
    if (!N.canManage()) {
      N.notify(
        "Select an Owner or Manager role to manage sales records.",
        "error",
      );
      return false;
    }
    return true;
  }
  function record(list, id) {
    return N.data[list].find(function (item) {
      return item.id === id;
    });
  }
  function moneyValue(value) {
    var v = text(value);
    return /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(v) ? Number(v) : NaN;
  }
  function validDate(value) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    );
  }
  function emailValid(value) {
    return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function finish(message, view, params) {
    N.closeModal();
    if (N.save(message) !== false && view) N.go(view, params || {});
  }
  function header(eyebrow, name, description, action) {
    return (
      '<div class="page-head"><div><p class="eyebrow">' +
      eyebrow +
      "</p><h1>" +
      N.esc(name) +
      '</h1><p class="muted">' +
      N.esc(description) +
      "</p></div>" +
      (action || "") +
      "</div>"
    );
  }

  /* CUSTOMERS: list -> customer detail -> contacts and relationship history. */
  N.views.customers = function () {
    if (!N.canManage()) return noAccess();
    var customer =
      N.params.customerId && record("customers", N.params.customerId);
    if (customer) return customerDetail(customer);
    var list = N.data.customers.filter(function (item) {
      return (
        (!customerFilter.status || item.status === customerFilter.status) &&
        includes(customerFilter.query, [item.name, item.email, item.industry])
      );
    });
    return (
      header(
        "SALES / RELATIONSHIPS",
        "Customers",
        "Customer details, contacts and conversations in one place.",
        N.button("Add customer", "crm-customer-new", "", "primary"),
      ) +
      '<form class="toolbar" data-form="crm-customer-filter">' +
      N.field(
        "Find a customer",
        "query",
        customerFilter.query,
        "search",
        'maxlength="200" placeholder="Company, email or industry"',
      ) +
      N.select(
        "Status",
        "status",
        [["", "All statuses"]].concat(
          choices(["PROSPECT", "ACTIVE", "ARCHIVED"]),
        ),
        customerFilter.status,
      ) +
      '<button class="secondary">Apply filters</button>' +
      N.button("Clear", "crm-customer-clear") +
      "</form>" +
      '<p class="hint">' +
      list.length +
      " of " +
      N.data.customers.length +
      " customers</p>" +
      (list.length
        ? N.table(
            ["Customer", "Industry", "Email", "Status", ""],
            list.map(function (item) {
              return [
                "<strong>" + N.esc(item.name) + "</strong>",
                N.esc(item.industry || "—"),
                N.esc(item.email || "—"),
                N.badge(item.status),
                N.button("Open customer", "crm-customer-open", item.id),
              ];
            }),
          )
        : N.empty(
            "No matching customers",
            "Try another search, clear the filters or add a customer.",
          ))
    );
  };
  function customerDetail(customer) {
    var contacts = N.data.contacts.filter(function (item) {
      return item.customerId === customer.id;
    });
    var activities = N.data.activities
      .filter(function (item) {
        return item.customerId === customer.id;
      })
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    var deals = N.data.deals.filter(function (item) {
      return item.customerId === customer.id;
    });
    var projects = N.data.projects.filter(function (item) {
      return item.customerId === customer.id;
    });
    return (
      N.button("← All customers", "crm-customer-back", "", "back") +
      header(
        "CUSTOMER / RELATIONSHIP",
        customer.name,
        "A connected view of this customer’s sales and delivery work.",
        N.button("Edit customer", "crm-customer-edit", customer.id),
      ) +
      '<div class="detail-grid"><section class="panel"><div class="section-head"><h2>Company details</h2>' +
      N.badge(customer.status) +
      '</div><dl class="record-details"><dt>Email</dt><dd>' +
      N.esc(customer.email || "Not added") +
      "</dd><dt>Phone</dt><dd>" +
      N.esc(customer.phone || "Not added") +
      "</dd><dt>Industry</dt><dd>" +
      N.esc(customer.industry || "Not added") +
      "</dd></dl></section>" +
      '<section class="panel"><div class="section-head"><h2>Contacts</h2>' +
      N.button("Add contact", "crm-contact-new", customer.id) +
      "</div>" +
      (contacts.length
        ? '<ul class="list">' +
          contacts
            .map(function (contact) {
              return (
                "<li><strong>" +
                N.esc(contact.name) +
                '</strong><p class="muted">' +
                N.esc(contact.role || "Contact") +
                " · " +
                N.esc(contact.email || "No email") +
                "</p></li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="muted">No contacts yet. Add the person you work with.</p>') +
      "</section></div>" +
      '<section class="panel"><div class="section-head"><div><h2>Relationship history</h2><p class="muted">Notes recorded in this browser; no email is sent.</p></div>' +
      N.button("Log activity", "crm-activity-new", customer.id) +
      "</div>" +
      (activities.length
        ? '<ul class="timeline">' +
          activities
            .map(function (activity) {
              return (
                "<li><p><strong>" +
                N.esc(title(activity.type)) +
                '</strong> <span class="muted">' +
                N.esc(N.date(activity.date)) +
                "</span></p><p>" +
                N.esc(activity.note) +
                "</p></li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="muted">No activity recorded.</p>') +
      "</section>" +
      '<div class="detail-grid"><section class="panel"><div class="section-head"><h2>Linked opportunities</h2>' +
      N.button("New lead", "crm-lead-for-customer", customer.id) +
      "</div>" +
      (deals.length
        ? '<ul class="list">' +
          deals
            .map(function (deal) {
              return (
                "<li><strong>" +
                N.esc(deal.name) +
                "</strong><p>" +
                N.badge(deal.stage) +
                " " +
                N.esc(N.money(deal.value, deal.currency)) +
                "</p>" +
                N.button("Open deal", "crm-deal-open", deal.id) +
                "</li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="muted">No linked opportunities.</p>') +
      "</section>" +
      '<section class="panel"><h2>Delivery projects</h2>' +
      (projects.length
        ? '<ul class="list">' +
          projects
            .map(function (project) {
              return (
                "<li><strong>" +
                N.esc(project.name) +
                '</strong><p class="muted">' +
                N.esc(N.userName(project.managerId)) +
                " · " +
                N.esc(N.date(project.deadline)) +
                "</p>" +
                N.button("Open project", "crm-project-open", project.id) +
                "</li>"
              );
            })
            .join("") +
          "</ul>"
        : '<p class="muted">No delivery projects yet. Won deals can become projects.</p>') +
      "</section></div>"
    );
  }
  function customerForm(customer) {
    var item = customer || {
      name: "",
      email: "",
      phone: "",
      industry: "",
      status: "PROSPECT",
    };
    N.modal(
      customer ? "Edit customer" : "Add customer",
      formStart("crm-customer-save", customer && customer.id) +
        N.field(
          "Company name",
          "name",
          item.name,
          "text",
          'required maxlength="200"',
        ) +
        N.field("Email", "email", item.email, "email", 'maxlength="254"') +
        N.field("Phone", "phone", item.phone, "tel", 'maxlength="50"') +
        N.field(
          "Industry",
          "industry",
          item.industry,
          "text",
          'maxlength="100"',
        ) +
        N.select(
          "Customer status",
          "status",
          choices(["PROSPECT", "ACTIVE", "ARCHIVED"]),
          item.status,
          "required",
        ) +
        formEnd("Save customer"),
    );
  }
  N.actions["crm-customer-new"] = function () {
    if (allowed()) customerForm();
  };
  N.actions["crm-customer-edit"] = function (button) {
    var item = record("customers", button.dataset.id);
    if (allowed() && item) customerForm(item);
  };
  N.actions["crm-customer-open"] = function (button) {
    N.go("customers", { customerId: button.dataset.id });
  };
  N.actions["crm-customer-back"] = function () {
    N.go("customers");
  };
  N.actions["crm-customer-clear"] = function () {
    customerFilter = { query: "", status: "" };
    N.render();
  };
  N.forms["crm-customer-filter"] = function (form, data) {
    customerFilter = {
      query: text(data.get("query")),
      status: text(data.get("status")),
    };
    N.render();
  };
  N.forms["crm-customer-save"] = function (form, data) {
    if (!allowed()) return;
    var name = text(data.get("name")),
      email = text(data.get("email")),
      status = data.get("status");
    if (
      !name ||
      name.length > 200 ||
      !emailValid(email) ||
      !["PROSPECT", "ACTIVE", "ARCHIVED"].includes(status)
    )
      return N.formError(
        form,
        "Enter a company name, a valid email and a supported status.",
      );
    var item = record("customers", form.dataset.id);
    if (form.dataset.id && !item)
      return N.formError(form, "The customer no longer exists.");
    if (!item) {
      item = { id: N.id("customer") };
      N.data.customers.push(item);
    }
    Object.assign(item, {
      name: name,
      email: email,
      phone: text(data.get("phone")).slice(0, 50),
      industry: text(data.get("industry")).slice(0, 100),
      status: status,
    });
    finish("Customer saved.", "customers", { customerId: item.id });
  };
  N.actions["crm-contact-new"] = function (button) {
    if (!allowed() || !record("customers", button.dataset.id)) return;
    N.modal(
      "Add customer contact",
      formStart("crm-contact-save", button.dataset.id) +
        N.field(
          "Contact name",
          "name",
          "",
          "text",
          'required maxlength="160"',
        ) +
        N.field("Email", "email", "", "email", 'maxlength="254"') +
        N.field("Job title", "role", "", "text", 'maxlength="100"') +
        formEnd("Save contact"),
    );
  };
  N.forms["crm-contact-save"] = function (form, data) {
    if (!allowed()) return;
    var name = text(data.get("name")),
      email = text(data.get("email"));
    if (
      !record("customers", form.dataset.id) ||
      !name ||
      name.length > 160 ||
      !emailValid(email)
    )
      return N.formError(
        form,
        "Enter a contact name and valid email for an existing customer.",
      );
    N.data.contacts.push({
      id: N.id("contact"),
      customerId: form.dataset.id,
      name: name,
      email: email,
      role: text(data.get("role")).slice(0, 100),
    });
    finish("Contact saved.");
  };
  N.actions["crm-activity-new"] = function (button) {
    if (!allowed() || !record("customers", button.dataset.id)) return;
    N.modal(
      "Log relationship activity",
      formStart("crm-activity-save", button.dataset.id) +
        N.select(
          "Activity type",
          "type",
          choices(["NOTE", "CALL", "MEETING", "EMAIL"]),
          "NOTE",
        ) +
        N.field("Date", "date", N.today(), "date", "required") +
        N.textarea("Activity note", "note", "", 'required maxlength="2000"') +
        '<p class="hint full">Logging an email records a note; it does not send an email.</p>' +
        formEnd("Save activity"),
    );
  };
  N.forms["crm-activity-save"] = function (form, data) {
    if (!allowed()) return;
    var note = text(data.get("note")),
      date = text(data.get("date")),
      type = data.get("type");
    if (
      !record("customers", form.dataset.id) ||
      !note ||
      note.length > 2000 ||
      !validDate(date) ||
      !["NOTE", "CALL", "MEETING", "EMAIL"].includes(type)
    )
      return N.formError(form, "Add an activity note and valid date.");
    N.data.activities.push({
      id: N.id("activity"),
      customerId: form.dataset.id,
      type: type,
      note: note,
      date: date,
    });
    finish("Activity recorded in this browser.");
  };

  /* PIPELINE: lead qualification -> deal -> won work -> delivery and quote. */
  N.views.pipeline = function () {
    if (!N.canManage()) return noAccess();
    var selectedLead = N.params.leadId && record("leads", N.params.leadId);
    var selectedDeal = N.params.dealId && record("deals", N.params.dealId);
    if (selectedLead) return leadDetail(selectedLead);
    if (selectedDeal) return dealDetail(selectedDeal);
    var leads = pipelineFilter.kind === "leads";
    var list = N.data[leads ? "leads" : "deals"].filter(function (item) {
      var state = leads
        ? item.dealId
          ? "CONVERTED"
          : item.status
        : item.stage;
      return (
        (!pipelineFilter.status || state === pipelineFilter.status) &&
        includes(pipelineFilter.query, [
          item.name,
          N.customerName(item.customerId),
          item.source || "",
        ])
      );
    });
    var intro = header(
      "SALES / OPPORTUNITIES",
      "Sales pipeline",
      "Qualify leads, develop opportunities and connect won work to delivery.",
      N.button(
        leads ? "Add lead" : "Add deal",
        leads ? "crm-lead-new" : "crm-deal-new",
        "",
        "primary",
      ),
    );
    var tabs =
      '<div class="tabs" role="group" aria-label="Pipeline records"><button data-action="crm-kind-leads" class="' +
      (leads ? "primary" : "secondary") +
      '" aria-pressed="' +
      leads +
      '">Leads</button><button data-action="crm-kind-deals" class="' +
      (!leads ? "primary" : "secondary") +
      '" aria-pressed="' +
      !leads +
      '">Deals</button></div>';
    var tools =
      '<form class="toolbar" data-form="crm-pipeline-filter">' +
      N.field(
        "Find " + (leads ? "leads" : "deals"),
        "query",
        pipelineFilter.query,
        "search",
        'maxlength="200" placeholder="Name or customer"',
      ) +
      N.select(
        leads ? "Lead status" : "Deal stage",
        "status",
        [["", leads ? "All statuses" : "All stages"]].concat(
          choices(leads ? leadStates.concat(["CONVERTED"]) : stages),
        ),
        pipelineFilter.status,
      ) +
      '<button class="secondary">Apply filters</button>' +
      N.button("Clear", "crm-pipeline-clear") +
      "</form>";
    var layout = leads
      ? ""
      : '<div class="actions"><span class="muted">Deal display</span><button class="' +
        (pipelineFilter.layout === "board" ? "primary" : "secondary") +
        '" data-action="crm-layout-board" aria-pressed="' +
        (pipelineFilter.layout === "board") +
        '">Board</button><button class="' +
        (pipelineFilter.layout === "table" ? "primary" : "secondary") +
        '" data-action="crm-layout-table" aria-pressed="' +
        (pipelineFilter.layout === "table") +
        '">Table</button></div>';
    var content;
    if (!list.length)
      content = N.empty(
        "No matching " + (leads ? "leads" : "deals"),
        "Clear the filters or add a new opportunity.",
      );
    else if (leads || pipelineFilter.layout === "table")
      content = N.table(
        ["Name", "Customer", leads ? "Status" : "Stage", "Potential value", ""],
        list.map(function (item) {
          return [
            "<strong>" + N.esc(item.name) + "</strong>",
            N.esc(N.customerName(item.customerId)),
            N.badge(
              leads ? (item.dealId ? "CONVERTED" : item.status) : item.stage,
            ),
            N.esc(N.money(item.value, item.currency)),
            N.button(
              leads ? "Open lead" : "Open deal",
              leads ? "crm-lead-open" : "crm-deal-open",
              item.id,
            ),
          ];
        }),
      );
    else
      content =
        '<div class="board" role="region" aria-label="Deals by stage" tabindex="0">' +
        stages
          .map(function (stage) {
            var items = list.filter(function (item) {
              return item.stage === stage;
            });
            return (
              '<section class="board-column"><div class="section-head"><h2>' +
              N.esc(title(stage)) +
              '</h2><span class="badge">' +
              items.length +
              "</span></div>" +
              (items.length
                ? items
                    .map(function (deal) {
                      return (
                        '<article class="deal-card"><p class="eyebrow">' +
                        N.esc(N.customerName(deal.customerId)) +
                        "</p><h3>" +
                        N.esc(deal.name) +
                        "</h3><p><strong>" +
                        N.esc(N.money(deal.value, deal.currency)) +
                        '</strong></p><p class="hint">' +
                        Number(deal.probability || 0) +
                        "% probability · estimate, not revenue</p>" +
                        N.button("Open deal", "crm-deal-open", deal.id) +
                        "</article>"
                      );
                    })
                    .join("")
                : '<p class="muted">No deals in this stage.</p>') +
              "</section>"
            );
          })
          .join("") +
        "</div>";
    return (
      intro +
      tabs +
      tools +
      layout +
      '<p class="hint">' +
      list.length +
      " " +
      (leads ? "leads" : "deals") +
      " in this view. Values remain separate by currency.</p>" +
      content
    );
  };
  function opportunityForm(kind, seedCustomer) {
    var lead = kind === "lead";
    if (!customers().length) {
      N.notify(
        "Add an active customer before creating an opportunity.",
        "error",
      );
      N.go("customers");
      return;
    }
    N.modal(
      lead ? "Add lead" : "Add deal",
      formStart("crm-opportunity-save", kind) +
        N.field(
          lead ? "Lead name" : "Deal name",
          "name",
          "",
          "text",
          'required maxlength="200"',
        ) +
        N.select(
          "Customer",
          "customerId",
          [["", "Choose customer"]].concat(customers()),
          seedCustomer || "",
          "required",
        ) +
        N.field(
          "Potential value",
          "value",
          "",
          "number",
          'required min="0" max="999999999" step="0.01"',
        ) +
        N.select(
          "Currency",
          "currency",
          currencies.map(function (code) {
            return [code, code];
          }),
          N.data.company.currency || "USD",
          "required",
        ) +
        (lead
          ? N.field(
              "Lead source",
              "source",
              "",
              "text",
              'maxlength="100" placeholder="Referral, website, event…"',
            )
          : N.select(
              "Stage",
              "stage",
              choices(["NEW", "QUALIFIED", "PROPOSAL"]),
              "NEW",
            )) +
        formEnd(lead ? "Create lead" : "Create deal"),
    );
  }
  function leadDetail(lead) {
    var converted = !!lead.dealId;
    return (
      N.button("← Sales pipeline", "crm-pipeline-back", "", "back") +
      header(
        "PIPELINE / LEAD",
        lead.name,
        N.customerName(lead.customerId),
        N.badge(converted ? "CONVERTED" : lead.status),
      ) +
      '<section class="panel"><dl class="record-details"><dt>Lead source</dt><dd>' +
      N.esc(lead.source || "Not specified") +
      "</dd><dt>Potential value</dt><dd>" +
      N.esc(N.money(lead.value, lead.currency)) +
      "</dd><dt>Customer</dt><dd>" +
      N.esc(N.customerName(lead.customerId)) +
      "</dd></dl>" +
      '<div class="actions">' +
      (converted
        ? N.button(
            "Open converted deal",
            "crm-deal-open",
            lead.dealId,
            "primary",
          )
        : lead.status === "DISQUALIFIED"
          ? '<p class="muted">This lead was disqualified and cannot be converted.</p>'
          : (lead.status === "NEW"
              ? N.button("Qualify lead", "crm-lead-qualify", lead.id, "primary")
              : N.button(
                  "Convert to deal",
                  "crm-lead-convert",
                  lead.id,
                  "primary",
                )) +
            N.button("Disqualify", "crm-lead-disqualify", lead.id, "danger")) +
      N.button("Open customer", "crm-customer-open", lead.customerId) +
      '</div><p class="hint">Conversion preserves the customer relationship and creates a single linked opportunity.</p></section>'
    );
  }
  function dealDetail(deal) {
    var linked = N.data.projects.find(function (project) {
      return project.dealId === deal.id;
    });
    var quotes = N.data.quotes.filter(function (quote) {
      return quote.dealId === deal.id;
    });
    var terminal = ["WON", "LOST"].includes(deal.stage);
    return (
      N.button("← Sales pipeline", "crm-pipeline-back", "", "back") +
      header(
        "PIPELINE / DEAL",
        deal.name,
        N.customerName(deal.customerId),
        N.badge(deal.stage),
      ) +
      '<div class="detail-grid"><section class="panel"><p class="eyebrow">POTENTIAL VALUE</p><h2>' +
      N.esc(N.money(deal.value, deal.currency)) +
      '</h2><p class="muted">' +
      Number(deal.probability || 0) +
      "% probability. Opportunity value is not issued invoice revenue.</p>" +
      (!terminal
        ? '<form data-form="crm-deal-stage" data-id="' +
          N.esc(deal.id) +
          '"><p class="form-error" role="alert"></p>' +
          N.select(
            "Move to stage",
            "stage",
            choices(stages),
            deal.stage,
            "required",
          ) +
          '<button class="primary">Update stage</button></form>'
        : '<p class="hint">' +
          (deal.stage === "WON"
            ? "Won work is ready to hand over to delivery."
            : "This opportunity is closed as lost.") +
          "</p>") +
      "</section>" +
      '<section class="panel"><h2>Next step</h2><p class="muted">Carry the customer and deal context into the next part of the workflow.</p><div class="actions">' +
      (deal.stage !== "LOST"
        ? N.button("Create quote", "crm-deal-quote", deal.id, "primary")
        : "") +
      (linked
        ? N.button("Open delivery project", "crm-project-open", linked.id)
        : deal.stage === "WON"
          ? N.button("Create delivery project", "crm-project-new", deal.id)
          : "") +
      N.button("Open customer", "crm-customer-open", deal.customerId) +
      "</div></section></div>" +
      '<section class="panel"><h2>Linked quotes</h2>' +
      (quotes.length
        ? N.table(
            ["Quote", "Status", ""],
            quotes.map(function (quote) {
              return [
                N.esc(quote.title),
                N.badge(quote.status),
                N.button("Open quotes", "crm-quotes-open"),
              ];
            }),
          )
        : '<p class="muted">No quote has been created for this opportunity.</p>') +
      "</section>"
    );
  }
  N.actions["crm-kind-leads"] = function () {
    pipelineFilter.kind = "leads";
    pipelineFilter.status = "";
    N.go("pipeline");
  };
  N.actions["crm-kind-deals"] = function () {
    pipelineFilter.kind = "deals";
    pipelineFilter.status = "";
    N.go("pipeline");
  };
  N.actions["crm-layout-board"] = function () {
    pipelineFilter.layout = "board";
    N.render();
  };
  N.actions["crm-layout-table"] = function () {
    pipelineFilter.layout = "table";
    N.render();
  };
  N.actions["crm-pipeline-clear"] = function () {
    pipelineFilter.query = "";
    pipelineFilter.status = "";
    N.render();
  };
  N.actions["crm-pipeline-back"] = function () {
    N.go("pipeline");
  };
  N.actions["crm-lead-new"] = function () {
    if (allowed()) opportunityForm("lead");
  };
  N.actions["crm-deal-new"] = function () {
    if (allowed()) opportunityForm("deal");
  };
  N.actions["crm-lead-for-customer"] = function (button) {
    if (allowed()) opportunityForm("lead", button.dataset.id);
  };
  N.actions["crm-lead-open"] = function (button) {
    N.go("pipeline", { leadId: button.dataset.id });
  };
  N.actions["crm-deal-open"] = function (button) {
    N.go("pipeline", { dealId: button.dataset.id });
  };
  N.actions["crm-deal-quote"] = function (button) {
    var deal = record("deals", button.dataset.id);
    if (allowed() && deal && deal.stage !== "LOST")
      N.go("quotes", { dealId: deal.id });
  };
  N.actions["crm-quotes-open"] = function () {
    N.go("quotes");
  };
  N.actions["crm-project-open"] = function (button) {
    N.go("delivery", { projectId: button.dataset.id });
  };
  N.forms["crm-pipeline-filter"] = function (form, data) {
    pipelineFilter.query = text(data.get("query"));
    pipelineFilter.status = text(data.get("status"));
    N.render();
  };
  N.forms["crm-opportunity-save"] = function (form, data) {
    if (!allowed()) return;
    var kind = form.dataset.id,
      name = text(data.get("name")),
      customerId = text(data.get("customerId")),
      value = moneyValue(data.get("value")),
      currency = data.get("currency");
    var customer = record("customers", customerId);
    if (
      !["lead", "deal"].includes(kind) ||
      !name ||
      name.length > 200 ||
      !customer ||
      customer.status === "ARCHIVED" ||
      !Number.isFinite(value) ||
      !currencies.includes(currency)
    )
      return N.formError(
        form,
        "Enter a name, active customer, nonnegative amount with up to two decimal places and supported currency.",
      );
    var item = {
      id: N.id(kind),
      name: name,
      customerId: customerId,
      value: value,
      currency: currency,
    };
    if (kind === "lead") {
      Object.assign(item, {
        source: text(data.get("source")).slice(0, 100),
        status: "NEW",
      });
      N.data.leads.push(item);
      finish("Lead created.", "pipeline", { leadId: item.id });
    } else {
      var stage = data.get("stage");
      if (!["NEW", "QUALIFIED", "PROPOSAL"].includes(stage))
        return N.formError(form, "Choose a valid initial deal stage.");
      Object.assign(item, {
        stage: stage,
        probability: { NEW: 10, QUALIFIED: 35, PROPOSAL: 65 }[stage],
      });
      N.data.deals.push(item);
      finish("Deal created.", "pipeline", { dealId: item.id });
    }
  };
  N.actions["crm-lead-qualify"] = function (button) {
    var lead = record("leads", button.dataset.id);
    if (!allowed() || !lead || lead.dealId || lead.status !== "NEW") return;
    lead.status = "QUALIFIED";
    N.save("Lead qualified. It can now become a deal.");
  };
  N.actions["crm-lead-disqualify"] = function (button) {
    var lead = record("leads", button.dataset.id);
    if (!allowed() || !lead || lead.dealId || lead.status === "DISQUALIFIED")
      return;
    if (
      !window.confirm(
        "Disqualify this lead? It will remain in the relationship history.",
      )
    )
      return;
    lead.status = "DISQUALIFIED";
    N.save("Lead disqualified.");
  };
  N.actions["crm-lead-convert"] = function (button) {
    if (!allowed()) return;
    var lead = record("leads", button.dataset.id);
    if (!lead) return;
    var existing =
      (lead.dealId && record("deals", lead.dealId)) ||
      N.data.deals.find(function (deal) {
        return deal.leadId === lead.id;
      });
    if (existing) {
      N.go("pipeline", { dealId: existing.id });
      N.notify("This lead already has a linked deal.");
      return;
    }
    if (lead.status !== "QUALIFIED")
      return N.notify("Qualify the lead before converting it.", "error");
    var customer = record("customers", lead.customerId);
    if (!customer || customer.status === "ARCHIVED")
      return N.notify(
        "The linked customer must be active before converting this lead.",
        "error",
      );
    var deal = {
      id: N.id("deal"),
      name: lead.name,
      customerId: lead.customerId,
      value: lead.value,
      currency: lead.currency,
      stage: "QUALIFIED",
      probability: 35,
      leadId: lead.id,
    };
    N.data.deals.push(deal);
    lead.dealId = deal.id;
    if (N.save("Lead converted into one linked deal.") !== false)
      N.go("pipeline", { dealId: deal.id });
  };
  N.forms["crm-deal-stage"] = function (form, data) {
    if (!allowed()) return;
    var deal = record("deals", form.dataset.id),
      stage = data.get("stage");
    if (
      !deal ||
      ["WON", "LOST"].includes(deal.stage) ||
      !stages.includes(stage)
    )
      return N.formError(form, "Choose an available stage for an open deal.");
    if (
      ["WON", "LOST"].includes(stage) &&
      !window.confirm(
        "Close this deal as " +
          title(stage) +
          "? Closed deals are kept as history.",
      )
    )
      return;
    deal.stage = stage;
    deal.probability = {
      NEW: 10,
      QUALIFIED: 35,
      PROPOSAL: 65,
      WON: 100,
      LOST: 0,
    }[stage];
    N.save(
      stage === "WON"
        ? "Deal won. Create a delivery project or prepare its quote."
        : "Deal stage updated.",
    );
  };
  N.actions["crm-project-new"] = function (button) {
    if (!allowed()) return;
    var deal = record("deals", button.dataset.id);
    if (!deal || deal.stage !== "WON") return;
    var existing = N.data.projects.find(function (project) {
      return project.dealId === deal.id;
    });
    if (existing) {
      N.go("delivery", { projectId: existing.id });
      return;
    }
    var managers = N.data.users
      .filter(function (user) {
        return ["OWNER", "MANAGER"].includes(user.role);
      })
      .map(function (user) {
        return [user.id, user.name];
      });
    N.modal(
      "Hand won work to delivery",
      formStart("crm-project-save", deal.id) +
        N.field(
          "Project name",
          "name",
          deal.name,
          "text",
          'required maxlength="200"',
        ) +
        N.select(
          "Project manager",
          "managerId",
          [["", "Choose manager"]].concat(managers),
          "",
          "required",
        ) +
        N.field("Delivery deadline", "deadline", "", "date", "required") +
        N.textarea(
          "Agreed scope",
          "description",
          "",
          'required maxlength="3000"',
        ) +
        formEnd("Create delivery project"),
    );
  };
  N.forms["crm-project-save"] = function (form, data) {
    if (!allowed()) return;
    var deal = record("deals", form.dataset.id),
      name = text(data.get("name")),
      managerId = data.get("managerId"),
      deadline = text(data.get("deadline")),
      description = text(data.get("description"));
    if (!deal || deal.stage !== "WON")
      return N.formError(form, "Only won deals can be handed to delivery.");
    var existing = N.data.projects.find(function (project) {
      return project.dealId === deal.id;
    });
    if (existing) {
      N.closeModal();
      N.go("delivery", { projectId: existing.id });
      return;
    }
    var manager = N.data.users.find(function (user) {
      return user.id === managerId && ["OWNER", "MANAGER"].includes(user.role);
    });
    if (
      !name ||
      name.length > 200 ||
      !description ||
      description.length > 3000 ||
      !validDate(deadline) ||
      !manager
    )
      return N.formError(
        form,
        "Enter the project name, agreed scope, manager and a valid deadline.",
      );
    var project = {
      id: N.id("project"),
      name: name,
      customerId: deal.customerId,
      dealId: deal.id,
      managerId: managerId,
      deadline: deadline,
      description: description,
      status: "ACTIVE",
    };
    N.data.projects.push(project);
    finish("Won deal handed over to delivery.", "delivery", {
      projectId: project.id,
    });
  };
})();
