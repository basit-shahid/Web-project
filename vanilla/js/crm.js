/* CRM screens follow CustomerWorkspace and PipelineWorkspace in the source app.
   Forms and filtering use ordinary HTML, JavaScript events and browser storage. */
(function () {
  "use strict";
  var N = window.Nova;
  var customerFilter = { query: "", status: "" };
  var pipelineFilter = {
    kind: "leads",
    query: "",
    status: "",
    layout: "table",
  };
  var savedEditing = "",
    selectedView = "";
  var stages = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
  var leadStates = ["NEW", "QUALIFIED", "DISQUALIFIED"];
  var currencies = ["USD", "GBP", "PKR"];
  function text(v) {
    return String(v == null ? "" : v).trim();
  }
  function label(v) {
    return text(v)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, function (c) {
        return c.toUpperCase();
      });
  }
  function pairs(list) {
    return list.map(function (v) {
      return [v, label(v)];
    });
  }
  function row(kind, id) {
    return N.data[kind].find(function (r) {
      return r.id === id;
    });
  }
  function managers() {
    return N.data.users
      .filter(function (u) {
        return ["OWNER", "MANAGER"].includes(u.role);
      })
      .map(function (u) {
        return [u.id, u.name];
      });
  }
  function canEdit(r) {
    return (
      N.isOwner() || (N.canManage() && (!r.ownerId || r.ownerId === N.user.id))
    );
  }
  function allowed() {
    if (N.canManage()) return true;
    N.notify(
      "Customer records require the Owner or Manager demonstration role.",
      "error",
    );
    return false;
  }
  function denied() {
    return N.empty(
      "Company role required",
      "Customer records are available to company administrators and managers.",
    );
  }
  function validDate(v) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(v) &&
      Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v
    );
  }
  function validEmail(v) {
    return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function validWebsite(v) {
    if (!v) return true;
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch (e) {
      return false;
    }
  }
  function amount(v) {
    v = text(v);
    return !v
      ? null
      : /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(v)
        ? Number(v)
        : NaN;
  }
  function customerOptions() {
    return N.data.customers
      .filter(function (c) {
        return c.status !== "ARCHIVED";
      })
      .map(function (c) {
        return [c.id, c.name];
      });
  }
  function leadStatus(r) {
    return r.dealId ? "CONVERTED" : r.status;
  }
  function stageValue(r) {
    return r.stage || "NEW";
  }
  function customerLabel(r) {
    return r.companyName || N.customerName(r.customerId);
  }
  function ownerName(r) {
    return N.userName(
      r.ownerId ||
        N.data.users.find(function (u) {
          return u.role === "OWNER";
        }).id,
    );
  }
  function begin(name, id, className) {
    return (
      '<form data-form="' +
      name +
      '" data-id="' +
      N.esc(id || "") +
      '" class="' +
      (className || "draft-fields") +
      '"><p class="form-error" role="alert"></p>'
    );
  }
  function end(button) {
    return (
      '<button class="primary" type="submit">' +
      N.esc(button) +
      "</button></form>"
    );
  }
  function details(title, body) {
    return (
      '<details class="transcript-panel"><summary>' +
      title +
      "</summary>" +
      body +
      "</details>"
    );
  }
  function heading(title, description) {
    return (
      '<div class="section-heading"><h2 class="module-title" tabindex="-1">' +
      N.esc(title) +
      "</h2></div>" +
      (description ? '<p class="muted">' + N.esc(description) + "</p>" : "")
    );
  }
  function table(caption, headers, values) {
    return (
      '<div class="premium-table-wrap" tabindex="0" role="region" aria-label="Records table, scroll horizontally for all columns"><table class="premium-table data-table"><caption>' +
      N.esc(caption) +
      "</caption><thead><tr>" +
      headers
        .map(function (h) {
          return (
            '<th scope="col">' +
            (h ? N.esc(h) : '<span class="sr-only">Actions</span>') +
            "</th>"
          );
        })
        .join("") +
      "</tr></thead><tbody>" +
      values
        .map(function (cells) {
          return (
            "<tr>" +
            cells
              .map(function (cell, i) {
                return (
                  (i ? "<td>" : '<th scope="row">') +
                  cell +
                  (i ? "</td>" : "</th>")
                );
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  }
  function ownerField(value, defaultOption) {
    return N.isOwner()
      ? N.select(
          "Relationship owner",
          "ownerId",
          (defaultOption ? [["", "Assign to me"]] : []).concat(managers()),
          value || "",
          "",
        )
      : "";
  }
  function save(message, view, params) {
    N.closeModal();
    if (N.save(message) !== false && view) N.go(view, params || {});
  }

  /* Named preferences match the source SavedViews panel. They are scoped to the
     selected role and record type and never hold business records or secrets. */
  function viewScope(module) {
    return N.storageKey + ".views." + N.user.id + "." + module;
  }
  function readViews(module) {
    try {
      var list = JSON.parse(localStorage.getItem(viewScope(module)) || "[]");
      return Array.isArray(list)
        ? list
            .filter(function (v) {
              return v && typeof v.name === "string" && v.preferences;
            })
            .slice(0, 10)
        : [];
    } catch (e) {
      return [];
    }
  }
  function preferences(module) {
    var f = module === "customers" ? customerFilter : pipelineFilter;
    return { query: f.query, status: f.status, layout: f.layout || "table" };
  }
  function savedViews(module) {
    if (N.savedViews) return N.savedViews(module, preferences(module));
    var views = readViews(module);
    return (
      '<section class="nw-saved-views" aria-label="Saved views"><div class="nw-saved-view-controls"><label for="crm-saved-view">Saved views</label><select id="crm-saved-view" data-crm-saved="' +
      module +
      '"><option value="">Choose a saved view</option>' +
      views
        .map(function (v) {
          return (
            '<option value="' +
            N.esc(v.name) +
            '"' +
            (selectedView === v.name ? " selected" : "") +
            ">" +
            N.esc(v.name) +
            "</option>"
          );
        })
        .join("") +
      '</select><button type="button" class="secondary" data-action="crm-view-edit" data-id="' +
      module +
      '" aria-expanded="' +
      (savedEditing === module) +
      '"' +
      (views.length >= 10 ? " disabled" : "") +
      ">Save current view</button>" +
      (selectedView
        ? N.button("Remove view", "crm-view-remove", module, "text-button")
        : "") +
      "</div>" +
      (savedEditing === module
        ? begin("crm-view-save", module, "nw-save-view-form") +
          N.field("View name", "name", "", "text", 'required maxlength="60"') +
          '<button class="primary">Save view</button>' +
          N.button("Cancel", "crm-view-cancel") +
          "</form>"
        : "") +
      '<p class="nw-view-hint">Only named filter preferences are saved in this browser, for your current account and company.</p></section>'
    );
  }
  N.actions["crm-view-edit"] = function (b) {
    savedEditing = savedEditing === b.dataset.id ? "" : b.dataset.id;
    N.render();
  };
  N.actions["crm-view-cancel"] = function () {
    savedEditing = "";
    N.render();
  };
  N.forms["crm-view-save"] = function (form, fd) {
    var module = form.dataset.id,
      name = text(fd.get("name")),
      views = readViews(module);
    if (
      !name ||
      name.length > 60 ||
      views.some(function (v) {
        return v.name.toLowerCase() === name.toLowerCase();
      }) ||
      views.length >= 10
    )
      return N.formError(
        form,
        "Use a unique view name of 1–60 characters. At most 10 views can be saved.",
      );
    views.push({ name: name, preferences: preferences(module) });
    try {
      localStorage.setItem(viewScope(module), JSON.stringify(views));
    } catch (e) {
      return N.formError(
        form,
        "This browser could not save the view. Your current filters still work.",
      );
    }
    savedEditing = "";
    selectedView = name;
    N.render();
    N.notify("View saved in this browser.");
  };
  N.actions["crm-view-remove"] = function (b) {
    try {
      localStorage.setItem(
        viewScope(b.dataset.id),
        JSON.stringify(
          readViews(b.dataset.id).filter(function (v) {
            return v.name !== selectedView;
          }),
        ),
      );
      selectedView = "";
      N.render();
      N.notify("Saved view removed. Current filters are unchanged.");
    } catch (e) {
      N.notify("Browser storage could not remove this view.", "error");
    }
  };
  document.addEventListener("change", function (event) {
    var select = event.target;
    if (select.dataset.crmStage) {
      var form = select.closest("form"),
        lost = form.querySelector("[data-crm-lost]"),
        note = form.querySelector("[data-crm-terminal]");
      if (lost) {
        lost.hidden = select.value !== "LOST";
        lost.querySelector("textarea").required = select.value === "LOST";
      }
      if (note) note.hidden = !["WON", "LOST"].includes(select.value);
    }
    if (select.dataset.crmSaved) {
      var module = select.dataset.crmSaved,
        view = readViews(module).find(function (v) {
          return v.name === select.value;
        });
      if (!view) return;
      var filter = module === "customers" ? customerFilter : pipelineFilter;
      filter.query = text(view.preferences.query);
      filter.status = text(view.preferences.status);
      if (module !== "customers")
        filter.layout = view.preferences.layout === "board" ? "board" : "table";
      selectedView = view.name;
      N.render();
      N.notify("Saved filters applied.");
    }
    if (select.dataset.crmStatus) {
      (select.dataset.crmStatus === "customers"
        ? customerFilter
        : pipelineFilter
      ).status = select.value;
      selectedView = "";
      N.render();
    }
  });

  N.viewFilters = N.viewFilters || {};
  ["customers", "leads", "deals"].forEach(function (module) {
    N.viewFilters[module] = {
      get: function () {
        return preferences(module);
      },
      apply: function (value) {
        var filter = module === "customers" ? customerFilter : pipelineFilter;
        filter.query = text(value.query || value.q);
        filter.status = text(value.status || value.stage);
        if (module !== "customers") {
          filter.kind = module;
          filter.layout = value.layout === "board" ? "board" : "table";
        }
        N.render();
      },
    };
  });

  /* CUSTOMER LIST */
  N.views.customers = function () {
    if (!N.canManage()) return denied();
    var customer = N.params.customerId && row("customers", N.params.customerId);
    if (customer) return customerDetail(customer);
    var list = N.data.customers.filter(function (c) {
      return (
        (!customerFilter.status || c.status === customerFilter.status) &&
        [c.name, c.email]
          .join(" ")
          .toLowerCase()
          .includes(customerFilter.query.toLowerCase())
      );
    });
    var filters =
      '<form class="list-tools toolbar" data-form="crm-customer-filter"><div class="search-field">' +
      N.field(
        "Find a customer",
        "query",
        customerFilter.query,
        "search",
        'id="crm-search" maxlength="200"',
      ) +
      '</div><div class="select-field">' +
      N.select(
        "Customer status",
        "status",
        [["", "All statuses"]].concat(
          pairs(["PROSPECT", "ACTIVE", "ARCHIVED"]),
        ),
        customerFilter.status,
        'data-crm-status="customers"',
      ) +
      '</div><button class="primary">Search</button></form>';
    var add = details(
      "Add a customer",
      begin("crm-customer-create") +
        N.field(
          "Customer name",
          "name",
          "",
          "text",
          'required maxlength="200"',
        ) +
        N.field(
          "Customer email (optional)",
          "email",
          "",
          "email",
          'maxlength="254"',
        ) +
        ownerField("", true) +
        end("Create customer"),
    );
    return (
      '<section class="crm-workspace" aria-label="Customers">' +
      heading(
        "Customers",
        "Keep customer details, contacts, and relationship history together.",
      ) +
      savedViews("customers") +
      filters +
      add +
      '<p class="list-summary" role="status">' +
      list.length +
      " customers" +
      (customerFilter.query || customerFilter.status
        ? " match your filters"
        : "") +
      "</p>" +
      (list.length
        ? table(
            "Customers · " + list.length + " records",
            ["Customer", "Email", "Status", ""],
            list.map(function (c) {
              return [
                N.esc(c.name),
                N.esc(c.email || "No email added"),
                N.badge(c.status),
                N.button("Open customer", "crm-customer-open", c.id),
              ];
            }),
          )
        : N.empty(
            "No customers found",
            customerFilter.query || customerFilter.status
              ? "Try another search or status."
              : "Add your first customer to begin tracking relationships.",
          )) +
      "</section>"
    );
  };
  function customerEditForm(c) {
    return (
      begin("crm-customer-save", c.id) +
      N.field(
        "Customer name",
        "name",
        c.name,
        "text",
        'required maxlength="200"',
      ) +
      N.field(
        "Email (optional)",
        "email",
        c.email || "",
        "email",
        'maxlength="254"',
      ) +
      N.field(
        "Phone (optional)",
        "phone",
        c.phone || "",
        "tel",
        'maxlength="50"',
      ) +
      N.field(
        "Website (optional)",
        "website",
        c.website || "",
        "url",
        'maxlength="2048"',
      ) +
      N.select(
        "Status",
        "status",
        pairs(["PROSPECT", "ACTIVE", "ARCHIVED"]),
        c.status,
      ) +
      ownerField(c.ownerId || N.user.id, false) +
      N.textarea("Notes", "notes", c.notes || "", 'maxlength="10000"') +
      end("Save customer changes")
    );
  }
  function customerDetail(c) {
    var editable = canEdit(c),
      contacts = N.data.contacts.filter(function (r) {
        return r.customerId === c.id;
      }),
      activities = N.data.activities
        .filter(function (r) {
          return r.customerId === c.id;
        })
        .slice()
        .reverse(),
      projects = N.data.projects.filter(function (p) {
        return p.customerId === c.id;
      });
    var contactForm =
      begin("crm-contact-save", c.id) +
      N.field("Contact name", "name", "", "text", 'required maxlength="200"') +
      N.field("Email (optional)", "email", "", "email", 'maxlength="254"') +
      N.field("Phone (optional)", "phone", "", "tel", 'maxlength="50"') +
      N.field("Job title (optional)", "role", "", "text", 'maxlength="200"') +
      end("Save contact");
    var activityForm =
      begin("crm-activity-save", c.id) +
      N.select(
        "Activity type",
        "type",
        pairs(["NOTE", "CALL", "MEETING"]),
        "NOTE",
      ) +
      N.textarea("What happened?", "note", "", 'required maxlength="10000"') +
      end("Save activity");
    return (
      '<section class="crm-workspace">' +
      N.button("← All customers", "crm-customer-back", "", "back") +
      heading(c.name) +
      '<div class="premium-record-summary">' +
      N.badge(c.status) +
      "<span>Relationship owner: " +
      N.esc(ownerName(c)) +
      "</span>" +
      (c.email ? "<span>" + N.esc(c.email) + "</span>" : "") +
      '</div><div class="transcript-panel"><h3>Customer information</h3><p>Phone: ' +
      N.esc(c.phone || "Not added") +
      "</p><p>Website: " +
      N.esc(c.website || "Not added") +
      '</p><p class="pre-wrap">Notes: ' +
      N.esc(c.notes || "Not added") +
      "</p></div>" +
      (editable ? details("Edit customer", customerEditForm(c)) : "") +
      '<section><div class="section-heading"><h3>Customer delivery projects</h3></div>' +
      (editable
        ? details(
            "Link existing project",
            begin("crm-customer-link-project", c.id) +
              '<p class="muted">Connect work already created in this company to the customer. A project can belong to one customer.</p>' +
              N.select(
                "Company project",
                "projectId",
                [["", "Choose an existing project"]].concat(
                  N.data.projects
                    .filter(function (p) {
                      return (
                        !p.customerId &&
                        (N.isOwner() || p.managerId === N.user.id)
                      );
                    })
                    .map(function (p) {
                      return [p.id, p.name];
                    }),
                ),
                "",
                "required",
              ) +
              end("Link project"),
          )
        : "") +
      (projects.length
        ? '<div class="directory">' +
          projects
            .map(function (p) {
              return (
                '<article class="directory-row"><div><h3>' +
                N.esc(p.name) +
                '</h3><p class="muted">' +
                N.esc(p.description || "") +
                "</p><p>" +
                N.esc(N.userName(p.managerId)) +
                " · " +
                N.esc(N.date(p.deadline)) +
                "</p></div>" +
                N.button("Open project", "crm-project-open", p.id) +
                "</article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="muted">No projects linked to this customer yet.</p>') +
      "</section>" +
      '<section><div class="section-heading"><h3>Contacts</h3></div>' +
      (editable ? details("Add a contact", contactForm) : "") +
      (contacts.length
        ? '<div class="directory">' +
          contacts
            .map(function (r) {
              return (
                '<article class="directory-row" style="display:block"><h3>' +
                N.esc(r.name) +
                '</h3><p class="muted">' +
                N.esc(r.role || "No job title added") +
                "</p><p>" +
                N.esc(
                  [r.email, r.phone].filter(Boolean).join(" · ") ||
                    "No email or phone added",
                ) +
                "</p></article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="muted">No contacts yet.</p>') +
      "</section>" +
      '<section><div class="section-heading"><h3>Activity timeline</h3></div>' +
      (editable ? details("Record an activity", activityForm) : "") +
      (activities.length
        ? '<div class="directory">' +
          activities
            .map(function (r) {
              return (
                '<article class="directory-row" style="display:block"><h3>' +
                N.esc(label(r.type)) +
                '</h3><p class="pre-wrap">' +
                N.esc(r.note || r.body) +
                '</p><p class="muted">' +
                N.esc(N.date(r.date)) +
                " · " +
                N.esc(N.userName(r.userId || N.user.id)) +
                "</p></article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="muted">No activity recorded.</p>') +
      "</section></section>"
    );
  }
  N.actions["crm-customer-open"] = function (b) {
    N.go("customers", { customerId: b.dataset.id });
  };
  N.actions["crm-customer-back"] = function () {
    N.go("customers");
  };
  N.forms["crm-customer-filter"] = function (form, fd) {
    customerFilter = {
      query: text(fd.get("query")),
      status: text(fd.get("status")),
    };
    selectedView = "";
    N.render();
  };
  N.actions["crm-customer-clear"] = function () {
    customerFilter = { query: "", status: "" };
    selectedView = "";
    N.render();
  };
  N.forms["crm-customer-create"] = function (form, fd) {
    if (!allowed()) return;
    var name = text(fd.get("name")),
      email = text(fd.get("email")),
      ownerId = text(fd.get("ownerId")) || N.user.id;
    if (
      !name ||
      name.length > 200 ||
      !validEmail(email) ||
      !managers().some(function (p) {
        return p[0] === ownerId;
      })
    )
      return N.formError(
        form,
        "Enter a customer name, valid email and relationship owner.",
      );
    var c = {
      id: N.id("customer"),
      name: name,
      email: email,
      phone: "",
      website: "",
      notes: "",
      industry: "",
      status: "PROSPECT",
      ownerId: ownerId,
    };
    N.data.customers.push(c);
    save("Customer created.", "customers", { customerId: c.id });
  };
  N.forms["crm-customer-save"] = function (form, fd) {
    var c = row("customers", form.dataset.id);
    if (!allowed() || !c || !canEdit(c)) return;
    var name = text(fd.get("name")),
      email = text(fd.get("email")),
      website = text(fd.get("website")),
      status = fd.get("status"),
      ownerId = N.isOwner()
        ? text(fd.get("ownerId")) || N.user.id
        : c.ownerId || N.user.id;
    if (
      !name ||
      name.length > 200 ||
      !validEmail(email) ||
      !validWebsite(website) ||
      !["PROSPECT", "ACTIVE", "ARCHIVED"].includes(status) ||
      !managers().some(function (p) {
        return p[0] === ownerId;
      })
    )
      return N.formError(
        form,
        "Enter a customer name, valid optional email/website, status and relationship owner.",
      );
    Object.assign(c, {
      name: name,
      email: email,
      phone: text(fd.get("phone")).slice(0, 50),
      website: website.slice(0, 2048),
      notes: text(fd.get("notes")).slice(0, 10000),
      status: status,
      ownerId: ownerId,
    });
    save("Customer changes saved.");
  };
  N.forms["crm-customer-link-project"] = function (form, fd) {
    var c = row("customers", form.dataset.id),
      p = row("projects", text(fd.get("projectId")));
    if (!allowed() || !c || !canEdit(c)) return;
    if (!p || (!N.isOwner() && p.managerId !== N.user.id))
      return N.formError(form, "Choose an available company project.");
    if (p.customerId && p.customerId !== c.id)
      return N.formError(
        form,
        "This project already belongs to another customer.",
      );
    p.customerId = c.id;
    save("Project linked to this customer.");
  };
  N.forms["crm-contact-save"] = function (form, fd) {
    var c = row("customers", form.dataset.id);
    if (!allowed() || !c || !canEdit(c)) return;
    var name = text(fd.get("name")),
      email = text(fd.get("email"));
    if (!name || name.length > 200 || !validEmail(email))
      return N.formError(
        form,
        "Enter a contact name and valid optional email.",
      );
    N.data.contacts.push({
      id: N.id("contact"),
      customerId: c.id,
      name: name,
      email: email,
      phone: text(fd.get("phone")).slice(0, 50),
      role: text(fd.get("role")).slice(0, 200),
    });
    save("Contact saved.");
  };
  N.forms["crm-activity-save"] = function (form, fd) {
    var c = row("customers", form.dataset.id);
    if (!allowed() || !c || !canEdit(c)) return;
    var note = text(fd.get("note")),
      type = fd.get("type");
    if (
      !note ||
      note.length > 10000 ||
      !["NOTE", "CALL", "MEETING", "EMAIL"].includes(type)
    )
      return N.formError(
        form,
        "Select an activity type and describe what happened.",
      );
    N.data.activities.push({
      id: N.id("activity"),
      customerId: c.id,
      type: type,
      note: note,
      date: text(fd.get("date")) || N.today(),
      userId: N.user.id,
    });
    save("Activity saved in this browser.");
  };

  /* PIPELINE LIST: the source defaults to Leads and a table, with the board
     available as an explicit Deals layout choice. */
  N.views.pipeline = function () {
    if (!N.canManage()) return denied();
    var lead = N.params.leadId && row("leads", N.params.leadId),
      deal = N.params.dealId && row("deals", N.params.dealId);
    if (lead) return opportunityDetail(lead, true);
    if (deal) return opportunityDetail(deal, false);
    var isLead = pipelineFilter.kind === "leads",
      kind = isLead ? "leads" : "deals",
      list = N.data[kind].filter(function (r) {
        return (
          (!pipelineFilter.status ||
            (isLead ? leadStatus(r) : r.stage) === pipelineFilter.status) &&
          [r.name, isLead ? customerLabel(r) : N.customerName(r.customerId)]
            .join(" ")
            .toLowerCase()
            .includes(pipelineFilter.query.toLowerCase())
        );
      });
    var tabs =
      '<nav class="list-tools tabs" aria-label="Pipeline records"><button class="' +
      (isLead ? "primary" : "secondary") +
      '" data-action="crm-kind-leads" aria-pressed="' +
      isLead +
      '">Leads</button><button class="' +
      (!isLead ? "primary" : "secondary") +
      '" data-action="crm-kind-deals" aria-pressed="' +
      !isLead +
      '">Deals</button></nav>';
    var filter =
      '<form class="list-tools toolbar" data-form="crm-pipeline-filter"><div class="search-field">' +
      N.field(
        "Find " + kind,
        "query",
        pipelineFilter.query,
        "search",
        'maxlength="200"',
      ) +
      '</div><div class="select-field">' +
      N.select(
        isLead ? "Lead status" : "Deal stage",
        "status",
        [["", isLead ? "All statuses" : "All stages"]].concat(
          pairs(isLead ? leadStates.concat(["CONVERTED"]) : stages),
        ),
        pipelineFilter.status,
        'data-crm-status="pipeline"',
      ) +
      '</div><button class="primary">Search</button>' +
      (!isLead
        ? '<div class="premium-layout-toggle" role="group" aria-label="Deal display"><button class="' +
          (pipelineFilter.layout === "table" ? "primary" : "secondary") +
          '" data-action="crm-layout-table" aria-pressed="' +
          (pipelineFilter.layout === "table") +
          '">Table</button><button class="' +
          (pipelineFilter.layout === "board" ? "primary" : "secondary") +
          '" data-action="crm-layout-board" aria-pressed="' +
          (pipelineFilter.layout === "board") +
          '">Board</button></div>'
        : "") +
      "</form>";
    var content = !list.length
      ? N.empty(
          "No " + kind + " found",
          pipelineFilter.query || pipelineFilter.status
            ? "Try another search or filter."
            : "Add your first " + (isLead ? "lead" : "deal") + " to begin.",
        )
      : isLead || pipelineFilter.layout === "table"
        ? table(
            (isLead ? "Leads" : "Deals") + " · " + list.length + " records",
            [
              "Name",
              isLead ? "Company" : "Stage",
              isLead ? "Status" : "Potential value",
              "Owner",
              "",
            ],
            list.map(function (r) {
              return [
                N.esc(r.name),
                isLead ? N.esc(customerLabel(r)) : N.esc(label(r.stage)),
                isLead
                  ? N.badge(leadStatus(r))
                  : N.esc(
                      r.value == null
                        ? "Not specified"
                        : N.money(r.value, r.currency),
                    ),
                N.esc(ownerName(r)),
                N.button(
                  isLead ? "Open lead" : "Open deal",
                  isLead ? "crm-lead-open" : "crm-deal-open",
                  r.id,
                ),
              ];
            }),
          )
        : dealBoard(list);
    return (
      '<section class="crm-workspace" aria-label="Sales pipeline">' +
      heading(
        "Sales pipeline",
        "Qualify a lead, develop the opportunity, then connect won work to delivery.",
      ) +
      tabs +
      savedViews(kind) +
      filter +
      details(isLead ? "Add a lead" : "Add a deal", opportunityForm(isLead)) +
      '<p class="list-summary" role="status">' +
      list.length +
      " " +
      kind +
      (pipelineFilter.query || pipelineFilter.status
        ? " match your filters"
        : "") +
      "</p>" +
      content +
      "</section>"
    );
  };
  function dealBoard(list) {
    return (
      '<p class="muted">Showing this view: ' +
      list.length +
      ' matching deals.</p><div class="premium-board board" tabindex="0" role="region" aria-label="Deals by stage, scroll horizontally for more stages">' +
      stages
        .map(function (stage) {
          var deals = list.filter(function (d) {
            return d.stage === stage;
          });
          return (
            '<section class="premium-board-column board-column"><h3>' +
            N.esc(label(stage)) +
            " <span>" +
            deals.length +
            "</span></h3>" +
            (deals.length
              ? deals
                  .map(function (d) {
                    return (
                      '<article class="premium-deal-card deal-card"><h4>' +
                      N.esc(d.name) +
                      "</h4><p>Owner: " +
                      N.esc(ownerName(d)) +
                      "</p>" +
                      (d.expectedCloseOn
                        ? "<p>Expected close: " +
                          N.esc(d.expectedCloseOn) +
                          "</p>"
                        : "") +
                      "<p>" +
                      N.esc(
                        d.value == null
                          ? "Not specified"
                          : N.money(d.value, d.currency),
                      ) +
                      "</p>" +
                      N.button("Open deal", "crm-deal-open", d.id) +
                      "</article>"
                    );
                  })
                  .join("")
              : '<p class="muted">No deals in this stage.</p>') +
            "</section>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function opportunityForm(isLead, r) {
    var edit = !!r,
      item = r || {},
      form = begin(
        edit ? "crm-opportunity-edit" : "crm-opportunity-save",
        edit ? item.id : isLead ? "lead" : "deal",
      );
    form += N.field(
      isLead ? "Lead name" : "Deal name",
      "name",
      item.name || "",
      "text",
      'required maxlength="200"',
    );
    if (isLead)
      form +=
        N.field(
          "Company name",
          "companyName",
          item.companyName ||
            (item.customerId ? N.customerName(item.customerId) : ""),
          "text",
          'required maxlength="200"',
        ) +
        N.field(
          "Lead email (optional)",
          "email",
          item.email || "",
          "email",
          'maxlength="254"',
        ) +
        N.field(
          "Lead phone (optional)",
          "phone",
          item.phone || "",
          "tel",
          'maxlength="50"',
        ) +
        N.field(
          "Follow up on (optional)",
          "followUpOn",
          item.followUpOn || "",
          "date",
        ) +
        (edit
          ? N.select("Lead status", "status", pairs(leadStates), item.status)
          : "");
    else
      form +=
        (!edit
          ? N.select(
              "Customer",
              "customerId",
              [["", "Choose a customer"]].concat(customerOptions()),
              "",
              "required",
            )
          : "") +
        N.field(
          "Potential value (optional, two decimal places)",
          "value",
          item.value == null ? "" : item.value,
          "text",
          'inputmode="decimal" maxlength="20" placeholder="1250.50"',
        ) +
        N.select(
          "Currency code",
          "currency",
          currencies.map(function (c) {
            return [c, c];
          }),
          item.currency || "USD",
          "required",
        ) +
        N.field(
          "Expected close date (optional)",
          "expectedCloseOn",
          item.expectedCloseOn || "",
          "date",
        ) +
        (edit
          ? N.select(
              "Deal stage",
              "stage",
              pairs(stages),
              item.stage,
              'data-crm-stage="true"',
            ) +
            "<div data-crm-lost" +
            (item.stage === "LOST" ? "" : " hidden") +
            ">" +
            N.textarea(
              "Lost reason",
              "lostReason",
              item.lostReason || "",
              'maxlength="2000"' + (item.stage === "LOST" ? " required" : ""),
            ) +
            '</div><p class="notice" data-crm-terminal' +
            (["WON", "LOST"].includes(item.stage) ? "" : " hidden") +
            ">Saving this stage closes the deal. The record becomes read only.</p>"
          : "");
    return (
      form +
      ownerField(item.ownerId || "", !edit) +
      N.textarea(
        "Notes (optional)",
        "notes",
        item.notes || "",
        'maxlength="10000"',
      ) +
      end(
        edit
          ? isLead
            ? "Save lead changes"
            : "Save deal changes"
          : isLead
            ? "Create lead"
            : "Create deal",
      )
    );
  }
  function opportunityDetail(r, isLead) {
    var state = isLead ? leadStatus(r) : r.stage,
      terminal = isLead ? !!r.dealId : ["WON", "LOST"].includes(r.stage),
      editable = canEdit(r),
      linked =
        !isLead &&
        N.data.projects.find(function (p) {
          return p.dealId === r.id;
        });
    var info =
      '<div class="transcript-panel"><h3>Saved ' +
      (isLead ? "lead" : "deal") +
      " information</h3><p>" +
      (isLead
        ? "Company: " + N.esc(customerLabel(r))
        : "Potential value: " +
          N.esc(
            r.value == null ? "Not specified" : N.money(r.value, r.currency),
          )) +
      "</p><p>" +
      (isLead ? "Status" : "Stage") +
      ": " +
      N.esc(label(state)) +
      "</p><p>Owner: " +
      N.esc(ownerName(r)) +
      "</p>" +
      (isLead
        ? "<p>Email: " +
          N.esc(r.email || "Not added") +
          "</p><p>Phone: " +
          N.esc(r.phone || "Not added") +
          "</p><p>Follow up: " +
          N.esc(r.followUpOn || "Not set") +
          "</p>"
        : "<p>Expected close: " +
          N.esc(r.expectedCloseOn || "Not set") +
          "</p>" +
          (r.lostReason
            ? "<p>Lost reason: " + N.esc(r.lostReason) + "</p>"
            : "")) +
      '<p class="pre-wrap">Notes: ' +
      N.esc(r.notes || "Not added") +
      "</p></div>";
    var conversion =
      isLead && editable && !terminal && r.status === "QUALIFIED"
        ? '<div class="transcript-panel"><h3>Convert qualified lead</h3><p class="muted">Create the customer, a contact, and a new deal together. The converted lead remains available as read-only history.</p>' +
          N.button(
            "Convert lead to customer and deal",
            "crm-lead-convert",
            r.id,
            "primary",
          ) +
          "</div>"
        : "";
    var delivery =
      !isLead && editable && r.stage === "WON"
        ? '<div class="transcript-panel"><h3>Start delivery</h3><p class="muted">Create one delivery project for this won deal and connect it to the customer. Retrying returns the existing project.</p>' +
          (linked
            ? "<p>Delivery project: " +
              N.esc(linked.name) +
              "</p>" +
              N.button("Open delivery project", "crm-project-open", linked.id)
            : begin("crm-project-save", r.id) +
              N.field(
                "Delivery project name (optional)",
                "name",
                "",
                "text",
                'maxlength="200"',
              ) +
              N.select(
                "Delivery manager",
                "managerId",
                [["", "Assign to me"]].concat(managers()),
                "",
              ) +
              N.field("Delivery deadline (optional)", "deadline", "", "date") +
              end("Create delivery project")) +
          "</div>"
        : "";
    return (
      '<section class="premium-record-detail" aria-label="' +
      (isLead ? "Lead details" : "Deal details") +
      '">' +
      N.button(
        "← All " + (isLead ? "leads" : "deals"),
        "crm-pipeline-back",
        "",
        "back",
      ) +
      heading(r.name) +
      '<div class="premium-record-summary">' +
      N.badge(state) +
      "<span>" +
      N.esc(
        isLead
          ? customerLabel(r)
          : r.value == null
            ? "Not specified"
            : N.money(r.value, r.currency),
      ) +
      "</span><span>Relationship owner: " +
      N.esc(ownerName(r)) +
      "</span>" +
      (r.email ? "<span>" + N.esc(r.email) + "</span>" : "") +
      "</div>" +
      info +
      (!isLead && editable && r.stage !== "LOST"
        ? N.button("Prepare quote", "crm-deal-quote", r.id)
        : "") +
      (terminal
        ? '<p class="notice">' +
          (isLead
            ? "This lead has been converted. Its details are read only."
            : "This deal is " +
              N.esc(label(r.stage)) +
              ". Its details are read only.") +
          "</p>"
        : "") +
      (editable && !terminal
        ? details(
            isLead ? "Edit lead" : "Edit deal",
            opportunityForm(isLead, r),
          )
        : "") +
      conversion +
      delivery +
      "</section>"
    );
  }
  N.actions["crm-kind-leads"] = function () {
    pipelineFilter.kind = "leads";
    pipelineFilter.query = "";
    pipelineFilter.status = "";
    selectedView = "";
    N.go("pipeline");
  };
  N.actions["crm-kind-deals"] = function () {
    pipelineFilter.kind = "deals";
    pipelineFilter.query = "";
    pipelineFilter.status = "";
    selectedView = "";
    N.go("pipeline");
  };
  N.actions["crm-layout-table"] = function () {
    pipelineFilter.layout = "table";
    selectedView = "";
    N.render();
  };
  N.actions["crm-layout-board"] = function () {
    pipelineFilter.layout = "board";
    selectedView = "";
    N.render();
  };
  N.forms["crm-pipeline-filter"] = function (form, fd) {
    pipelineFilter.query = text(fd.get("query"));
    pipelineFilter.status = text(fd.get("status"));
    selectedView = "";
    N.render();
  };
  N.actions["crm-pipeline-clear"] = function () {
    pipelineFilter.query = "";
    pipelineFilter.status = "";
    selectedView = "";
    N.render();
  };
  N.actions["crm-lead-open"] = function (b) {
    N.go("pipeline", { leadId: b.dataset.id });
  };
  N.actions["crm-deal-open"] = function (b) {
    N.go("pipeline", { dealId: b.dataset.id });
  };
  N.actions["crm-pipeline-back"] = function () {
    N.go("pipeline");
  };
  N.actions["crm-project-open"] = function (b) {
    N.go("delivery", { projectId: b.dataset.id });
  };
  N.actions["crm-deal-quote"] = function (b) {
    var deal = row("deals", b.dataset.id);
    if (allowed() && deal && deal.stage !== "LOST")
      N.go("quotes", { dealId: deal.id });
  };
  N.actions["crm-quotes-open"] = function () {
    N.go("quotes");
  };
  function saveOpportunity(form, fd, edit) {
    if (!allowed()) return;
    var existing = edit
        ? row("leads", form.dataset.id) || row("deals", form.dataset.id)
        : null,
      isLead = edit
        ? N.data.leads.includes(existing)
        : form.dataset.id === "lead";
    if (
      edit &&
      (!existing ||
        !canEdit(existing) ||
        (isLead ? existing.dealId : ["WON", "LOST"].includes(existing.stage)))
    )
      return N.formError(form, "This record cannot be edited.");
    var name = text(fd.get("name")),
      ownerId = N.isOwner()
        ? text(fd.get("ownerId")) || N.user.id
        : (existing && existing.ownerId) || N.user.id,
      notes = text(fd.get("notes"));
    if (
      !name ||
      name.length > 200 ||
      !managers().some(function (p) {
        return p[0] === ownerId;
      })
    )
      return N.formError(form, "Enter a name and valid relationship owner.");
    var result = { name: name, ownerId: ownerId, notes: notes.slice(0, 10000) };
    if (isLead) {
      var companyName = text(fd.get("companyName")),
        email = text(fd.get("email")),
        follow = text(fd.get("followUpOn")),
        status = edit ? fd.get("status") : "NEW";
      if (
        !companyName ||
        companyName.length > 200 ||
        !validEmail(email) ||
        (follow && !validDate(follow)) ||
        !leadStates.includes(status)
      )
        return N.formError(
          form,
          "Enter the company name, valid optional email/follow-up date and supported lead status.",
        );
      Object.assign(result, {
        companyName: companyName,
        email: email,
        phone: text(fd.get("phone")).slice(0, 50),
        followUpOn: follow,
        status: status,
      });
    } else {
      var value = amount(fd.get("value")),
        currency = fd.get("currency"),
        close = text(fd.get("expectedCloseOn")),
        customerId = edit ? existing.customerId : text(fd.get("customerId")),
        customer = row("customers", customerId),
        stage = edit ? fd.get("stage") : "NEW",
        lostReason = text(fd.get("lostReason"));
      if (
        !customer ||
        customer.status === "ARCHIVED" ||
        Number.isNaN(value) ||
        !currencies.includes(currency) ||
        (close && !validDate(close)) ||
        !stages.includes(stage) ||
        (stage === "LOST" && !lostReason)
      )
        return N.formError(
          form,
          "Choose a customer, valid optional value/date, currency and stage. A lost deal needs a reason.",
        );
      if (
        edit &&
        ["WON", "LOST"].includes(stage) &&
        !confirm(
          "Saving this stage closes the deal as " +
            label(stage) +
            ". Continue?",
        )
      )
        return;
      Object.assign(result, {
        customerId: customerId,
        value: value,
        currency: currency,
        expectedCloseOn: close,
        stage: stage,
        lostReason: lostReason.slice(0, 2000),
        probability: {
          NEW: 10,
          QUALIFIED: 35,
          PROPOSAL: 65,
          WON: 100,
          LOST: 0,
        }[stage],
      });
    }
    if (existing) Object.assign(existing, result);
    else {
      existing = Object.assign({ id: N.id(isLead ? "lead" : "deal") }, result);
      N.data[isLead ? "leads" : "deals"].push(existing);
    }
    save(
      isLead ? "Lead changes saved." : "Deal changes saved.",
      "pipeline",
      isLead ? { leadId: existing.id } : { dealId: existing.id },
    );
  }
  N.forms["crm-opportunity-save"] = function (form, fd) {
    saveOpportunity(form, fd, false);
  };
  N.forms["crm-opportunity-edit"] = function (form, fd) {
    saveOpportunity(form, fd, true);
  };
  N.actions["crm-lead-convert"] = function (b) {
    if (!allowed()) return;
    var lead = row("leads", b.dataset.id);
    if (!lead || !canEdit(lead)) return;
    var existing =
      (lead.dealId && row("deals", lead.dealId)) ||
      N.data.deals.find(function (d) {
        return d.leadId === lead.id;
      });
    if (existing) {
      N.go("pipeline", { dealId: existing.id });
      return;
    }
    if (lead.status !== "QUALIFIED")
      return N.notify("Qualify the lead before conversion.", "error");
    var customer = lead.customerId && row("customers", lead.customerId);
    if (!customer) {
      customer = {
        id: N.id("customer"),
        name: lead.companyName || lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        website: "",
        notes: lead.notes || "",
        status: "PROSPECT",
        ownerId: lead.ownerId || N.user.id,
      };
      N.data.customers.push(customer);
    } else if (customer.status === "ARCHIVED")
      return N.notify("The linked customer is archived.", "error");
    if (
      !N.data.contacts.some(function (c) {
        return (
          c.customerId === customer.id &&
          lead.email &&
          c.email &&
          c.email.toLowerCase() === lead.email.toLowerCase()
        );
      })
    )
      N.data.contacts.push({
        id: N.id("contact"),
        customerId: customer.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone || "",
        role: "Lead contact",
      });
    var deal = {
      id: N.id("deal"),
      name: ((lead.companyName || customer.name) + " opportunity").slice(
        0,
        200,
      ),
      customerId: customer.id,
      value: null,
      currency: lead.currency || "USD",
      stage: "NEW",
      probability: 10,
      leadId: lead.id,
      ownerId: lead.ownerId || N.user.id,
      notes: lead.notes || "",
    };
    N.data.deals.push(deal);
    lead.customerId = customer.id;
    lead.dealId = deal.id;
    lead.status = "CONVERTED";
    save("Lead converted. Customer, contact and deal are saved.", "pipeline", {
      dealId: deal.id,
    });
  };
  N.forms["crm-project-save"] = function (form, fd) {
    if (!allowed()) return;
    var deal = row("deals", form.dataset.id);
    if (!deal || deal.stage !== "WON" || !canEdit(deal))
      return N.formError(form, "Only editable won deals can start delivery.");
    var existing = N.data.projects.find(function (p) {
      return p.dealId === deal.id;
    });
    if (existing) {
      N.go("delivery", { projectId: existing.id });
      N.closeModal();
      return;
    }
    var name = text(fd.get("name")) || deal.name,
      managerId = text(fd.get("managerId")) || N.user.id,
      deadline = text(fd.get("deadline")),
      description =
        text(fd.get("description")) ||
        deal.notes ||
        "Delivery project created from won deal: " + deal.name;
    if (
      name.length > 200 ||
      !managers().some(function (p) {
        return p[0] === managerId;
      }) ||
      (deadline && !validDate(deadline))
    )
      return N.formError(
        form,
        "Choose a valid delivery manager and optional deadline.",
      );
    var project = {
      id: N.id("project"),
      name: name,
      customerId: deal.customerId,
      dealId: deal.id,
      managerId: managerId,
      deadline: deadline,
      description: description.slice(0, 3000),
      status: "ACTIVE",
    };
    N.data.projects.push(project);
    save("Delivery project created and linked to this customer.", "delivery", {
      projectId: project.id,
    });
  };

  /* Compatibility entry points retained for existing demos and automated tests.
     The primary screens use the inline disclosure forms above. */
  N.actions["crm-customer-new"] = function () {
    if (allowed())
      N.modal(
        "Add customer",
        begin("crm-customer-create") +
          N.field(
            "Customer name",
            "name",
            "",
            "text",
            'required maxlength="200"',
          ) +
          N.field("Customer email (optional)", "email", "", "email") +
          ownerField("", true) +
          end("Create customer"),
      );
  };
  N.actions["crm-customer-edit"] = function (b) {
    var c = row("customers", b.dataset.id);
    if (allowed() && c && canEdit(c))
      N.modal("Edit customer", customerEditForm(c));
  };
  N.actions["crm-contact-new"] = function (b) {
    var c = row("customers", b.dataset.id);
    if (allowed() && c && canEdit(c))
      N.modal(
        "Add contact",
        begin("crm-contact-save", c.id) +
          N.field("Contact name", "name", "", "text", "required") +
          N.field("Email (optional)", "email", "", "email") +
          N.field("Phone (optional)", "phone", "", "tel") +
          N.field("Job title (optional)", "role", "", "text") +
          end("Save contact"),
      );
  };
  N.actions["crm-activity-new"] = function (b) {
    var c = row("customers", b.dataset.id);
    if (allowed() && c && canEdit(c))
      N.modal(
        "Log relationship activity",
        begin("crm-activity-save", c.id) +
          N.select(
            "Activity type",
            "type",
            pairs(["NOTE", "CALL", "MEETING"]),
            "NOTE",
          ) +
          N.textarea("What happened?", "note", "", "required") +
          end("Save activity"),
      );
  };
  N.actions["crm-lead-new"] = function () {
    if (allowed()) N.modal("Add a lead", opportunityForm(true));
  };
  N.actions["crm-deal-new"] = function () {
    if (allowed()) N.modal("Add a deal", opportunityForm(false));
  };
  N.actions["crm-lead-for-customer"] = function (b) {
    if (!allowed()) return;
    var c = row("customers", b.dataset.id);
    N.modal(
      "Add a lead",
      opportunityForm(true, {
        name: "",
        companyName: c ? c.name : "",
        email: c ? c.email : "",
        ownerId: N.user.id,
      })
        .replace(
          'data-form="crm-opportunity-edit"',
          'data-form="crm-opportunity-save"',
        )
        .replace('data-id=""', 'data-id="lead"'),
    );
  };
  N.actions["crm-lead-qualify"] = function (b) {
    var l = row("leads", b.dataset.id);
    if (allowed() && l && canEdit(l) && !l.dealId && l.status === "NEW") {
      l.status = "QUALIFIED";
      N.save("Lead changes saved.");
    }
  };
  N.actions["crm-lead-disqualify"] = function (b) {
    var l = row("leads", b.dataset.id);
    if (allowed() && l && canEdit(l) && !l.dealId) {
      l.status = "DISQUALIFIED";
      N.save("Lead changes saved.");
    }
  };
  N.forms["crm-deal-stage"] = function (form, fd) {
    var d = row("deals", form.dataset.id),
      stage = fd.get("stage");
    if (
      allowed() &&
      d &&
      canEdit(d) &&
      !["WON", "LOST"].includes(d.stage) &&
      stages.includes(stage)
    ) {
      if (stage === "LOST")
        return N.formError(form, "Use Edit deal to record a lost reason.");
      d.stage = stage;
      d.probability = {
        NEW: 10,
        QUALIFIED: 35,
        PROPOSAL: 65,
        WON: 100,
        LOST: 0,
      }[stage];
      N.save("Deal stage updated.");
    }
  };
  N.actions["crm-project-new"] = function (b) {
    var d = row("deals", b.dataset.id);
    if (allowed() && d && d.stage === "WON")
      N.modal(
        "Start delivery",
        begin("crm-project-save", d.id) +
          N.field("Delivery project name (optional)", "name", d.name, "text") +
          N.select(
            "Delivery manager",
            "managerId",
            [["", "Assign to me"]].concat(managers()),
            "",
          ) +
          N.field("Delivery deadline (optional)", "deadline", "", "date") +
          end("Create delivery project"),
      );
  };
})();
