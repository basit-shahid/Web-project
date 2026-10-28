/* Screen alignment to the inspected source UI. The data adapter remains local. */
(function () {
  "use strict";
  var N = window.Nova;
  var E = N.esc;
  var labels = {
    overview: "Overview",
    delivery: "Projects & tasks",
    time: "Timesheets",
    customers: "Customers",
    pipeline: "Pipeline",
    quotes: "Quotes",
    invoices: "Invoices",
    reports: "Reports",
    ai: "Meeting AI",
    billing: "Subscription",
    settings: "Settings",
  };
  var paths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    delivery: "M3 5h7l2 2h9v14H3zM6 11h12M6 15h7",
    time: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    customers:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 4a4 4 0 0 1 0 8",
    pipeline: "M3 3h4v18H3zM10 3h4v12h-4zM17 3h4v8h-4z",
    quotes: "M5 3h10l4 4v14H5zM8 11h8M8 15h8",
    invoices: "M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h6",
    reports: "M4 20V9M10 20V4M16 20v-8M22 20H2",
    ai: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    billing: "M3 5h18v14H3zM3 10h18M7 15h3",
    settings: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
  };
  function icon(id) {
    return (
      '<svg width="18" height="18" viewBox="0 0 24 24" class="nw-module-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      paths[id] +
      '"/></svg>'
    );
  }
  function title(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/^./, function (c) {
        return c.toUpperCase();
      });
  }
  function groups() {
    return [["Workspace", ["overview", "delivery", "time"]]]
      .concat(
        N.canManage() ? [["Sales", ["customers", "pipeline", "quotes"]]] : [],
      )
      .concat(N.isOwner() ? [["Finance", ["invoices"]]] : [])
      .concat(
        [["Insights", ["reports"].concat(N.isOwner() ? ["ai"] : [])]],
        [["Company", (N.isOwner() ? ["billing"] : []).concat(["settings"])]],
      );
  }
  function canView(view) {
    return groups().some(function (g) {
      return g[1].includes(view);
    });
  }
  function visibleProjects() {
    return N.data.projects.filter(function (p) {
      return (
        N.isOwner() ||
        (N.user.role === "MANAGER"
          ? p.managerId === N.user.id
          : N.data.tasks.some(function (t) {
              return t.projectId === p.id && t.assigneeId === N.user.id;
            }))
      );
    });
  }
  function visibleTasks() {
    var ids = visibleProjects().map(function (p) {
      return p.id;
    });
    return N.data.tasks.filter(function (t) {
      return (
        ids.includes(t.projectId) &&
        (N.user.role !== "MEMBER" || t.assigneeId === N.user.id)
      );
    });
  }
  function visibleTime() {
    var ids = visibleProjects().map(function (p) {
      return p.id;
    });
    return N.data.times.filter(function (t) {
      return (
        N.isOwner() ||
        (N.user.role === "MANAGER"
          ? ids.includes(t.projectId)
          : t.userId === N.user.id)
      );
    });
  }
  function minutes(entries) {
    return entries.reduce(function (s, t) {
      return s + Math.round(Number(t.hours) * 60);
    }, 0);
  }
  function duration(min) {
    return Math.floor(min / 60) + "h " + (min % 60) + "m";
  }
  function paid(i) {
    return (
      Math.round(
        (i.payments || []).reduce(function (s, p) {
          return s + Math.round(p.amount * 100);
        }, 0),
      ) / 100
    );
  }
  function financeRows(currency) {
    var rows = {};
    N.data.invoices
      .filter(function (i) {
        return (
          ["ISSUED", "PAID", "CREDITED"].includes(i.status) &&
          (!currency || i.currency === currency)
        );
      })
      .forEach(function (i) {
        var r =
          rows[i.currency] ||
          (rows[i.currency] = {
            currency: i.currency,
            count: 0,
            total: 0,
            paid: 0,
            outstanding: 0,
            overdue: 0,
            credited: 0,
          });
        r.count++;
        r.total += Math.round(i.total * 100);
        r.paid += Math.round(paid(i) * 100);
        if (i.status === "CREDITED") r.credited += Math.round(i.total * 100);
        var balance =
          i.status === "CREDITED"
            ? 0
            : Math.max(0, Math.round((i.total - paid(i)) * 100));
        r.outstanding += balance;
        if (i.dueDate < N.today()) r.overdue += balance;
      });
    return Object.keys(rows)
      .sort()
      .map(function (c) {
        return rows[c];
      });
  }
  var updated = new Date().toISOString(),
    tables = {},
    reportKind = "delivery",
    reportCurrency = "";
  function meta() {
    return (
      '<p class="overview-meta">Scope: ' +
      (N.user.role === "MEMBER"
        ? "Personal"
        : N.user.role === "MANAGER"
          ? "Managed"
          : "Company-wide") +
      ' <span aria-hidden="true">·</span> Updated <time datetime="' +
      updated +
      '">' +
      E(
        new Date(updated).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        }),
      ) +
      " UTC</time></p>"
    );
  }
  function link(text, view, css) {
    return (
      '<button type="button" class="' +
      (css || "overview-link") +
      '" data-nav="' +
      view +
      '">' +
      E(text) +
      " →</button>"
    );
  }
  function countCard(label, value, detail, view, text) {
    return (
      '<article class="overview-kpi"><p>' +
      E(label) +
      "</p><strong>" +
      E(value) +
      "</strong><span>" +
      E(detail) +
      "</span>" +
      link(text || "View projects & tasks", view) +
      "</article>"
    );
  }
  function statuses(list) {
    var map = {};
    list.forEach(function (x) {
      map[x.status] = (map[x.status] || 0) + 1;
    });
    return Object.keys(map)
      .sort()
      .map(function (status) {
        return { status: status, count: map[status] };
      });
  }
  var colors = {
    TODO: "#9a630c",
    IN_PROGRESS: "#2369b5",
    DONE: "#176b57",
    PLANNED: "#596779",
    ACTIVE: "#2369b5",
    ARCHIVED: "#737c89",
    COMPLETED: "#176b57",
    ON_HOLD: "#9a630c",
  };
  function statusTitle(status) {
    return (
      {
        TODO: "To do",
        IN_PROGRESS: "In progress",
        DONE: "Done",
        PLANNED: "Planned",
        ACTIVE: "Active",
        ARCHIVED: "Archived",
        COMPLETED: "Completed",
        ON_HOLD: "On hold",
      }[status] || title(status)
    );
  }
  function chart(name, rows, ring) {
    var key = name.replace(/\W/g, "").toLowerCase(),
      sum = rows.reduce(function (s, r) {
        return s + r.count;
      }, 0),
      max = Math.max.apply(
        null,
        [1].concat(
          rows.map(function (r) {
            return r.count;
          }),
        ),
      ),
      body = "";
    if (!sum)
      body = '<p class="insight-empty">No records in this scope yet.</p>';
    else if (tables[key])
      body =
        '<table class="insight-data"><caption>' +
        E(name) +
        ": exact record counts</caption><thead><tr><th>Status</th><th>Records</th></tr></thead><tbody>" +
        rows
          .map(function (r) {
            return (
              '<tr><th scope="row">' +
              E(statusTitle(r.status)) +
              "</th><td>" +
              r.count +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    else if (ring) {
      var offset = 0;
      body =
        '<div class="insight-ring-layout"><svg viewBox="0 0 120 120" class="insight-ring" role="img" aria-label="' +
        E(
          name +
            ": " +
            rows
              .map(function (r) {
                return statusTitle(r.status) + " " + r.count;
              })
              .join(", "),
        ) +
        '"><circle cx="60" cy="60" r="43" fill="none" stroke="#edf0f4" stroke-width="14"/>' +
        rows
          .map(function (r) {
            var size = (r.count / sum) * 270.177,
              at = offset;
            offset += size;
            return (
              '<circle cx="60" cy="60" r="43" fill="none" stroke="' +
              (colors[r.status] || "#596779") +
              '" stroke-width="14" stroke-dasharray="' +
              size +
              " " +
              (270.177 - size) +
              '" stroke-dashoffset="' +
              -at +
              '" transform="rotate(-90 60 60)"/>'
            );
          })
          .join("") +
        '<text x="60" y="58" text-anchor="middle" class="insight-ring-total">' +
        sum +
        '</text><text x="60" y="75" text-anchor="middle" class="insight-ring-label">tasks</text></svg><ul class="insight-legend">' +
        rows
          .map(function (r) {
            return (
              '<li><span><i style="background:' +
              (colors[r.status] || "#596779") +
              '" aria-hidden="true"></i>' +
              E(statusTitle(r.status)) +
              "</span><strong>" +
              r.count +
              "</strong></li>"
            );
          })
          .join("") +
        "</ul></div>";
    } else
      body =
        '<ul class="insight-bars">' +
        rows
          .map(function (r) {
            return (
              "<li><div><span>" +
              E(statusTitle(r.status)) +
              "</span><strong>" +
              r.count +
              '</strong></div><div class="insight-track" aria-hidden="true"><span style="width:' +
              (r.count / max) * 100 +
              "%;background:" +
              (colors[r.status] || "#596779") +
              '"></span></div></li>'
            );
          })
          .join("") +
        "</ul>";
    return (
      '<section class="insight-card"><header class="insight-card-heading"><div><p class="insight-eyebrow">Current snapshot</p><h3>' +
      E(name) +
      '</h3></div><button type="button" class="insight-switch" data-action="source-chart" data-id="' +
      key +
      '" aria-pressed="' +
      !!tables[key] +
      '">' +
      (tables[key] ? "Show chart" : "Show values") +
      '</button></header><p class="insight-total">' +
      sum +
      "<span> records in your scope</span></p>" +
      body +
      "</section>"
    );
  }
  N.actions["source-chart"] = function (el) {
    tables[el.dataset.id] = !tables[el.dataset.id];
    N.render();
  };
  N.actions["source-refresh"] = function () {
    updated = new Date().toISOString();
    N.render();
    N.notify("Current browser records refreshed.");
  };
  N.views.overview = function () {
    var projects = visibleProjects(),
      tasks = visibleTasks(),
      open = tasks.filter(function (t) {
        return t.status !== "DONE";
      }).length,
      time = visibleTime().filter(function (t) {
        return t.status === "APPROVED";
      }),
      pending = visibleTime().filter(function (t) {
        return t.status === "SUBMITTED";
      }),
      fin = financeRows();
    var attention =
      '<article class="attention-card"><div><p class="insight-eyebrow">Delivery</p><h3>Open work</h3></div><strong>' +
      open +
      "</strong><p>" +
      open +
      " open " +
      (open === 1 ? "task" : "tasks") +
      " in your permitted scope</p>" +
      link("View projects & tasks", "delivery") +
      "</article>";
    if (N.canManage())
      attention +=
        '<article class="attention-card"><div><p class="insight-eyebrow">Time review</p><h3>Submitted team time</h3></div><strong>' +
        pending.length +
        '</strong><p>submitted entries · may include your own; self-approval is not allowed</p><ul class="attention-list">' +
        pending
          .slice(0, 3)
          .map(function (t) {
            return (
              "<li><span><b>" +
              E(N.userName(t.userId)) +
              "</b><small>" +
              E(N.projectName(t.projectId)) +
              "</small></span><span>" +
              duration(Math.round(t.hours * 60)) +
              "</span></li>"
            );
          })
          .join("") +
        '</ul><button class="overview-link" data-action="source-team-time">Review team time →</button></article>';
    if (N.isOwner())
      attention +=
        '<article class="attention-card"><div><p class="insight-eyebrow">Finance</p><h3>Outstanding invoices</h3></div><ul class="attention-finance">' +
        fin
          .map(function (r) {
            return (
              "<li><span>" +
              r.currency +
              "</span><strong>" +
              N.money(r.outstanding / 100, r.currency) +
              "</strong></li>"
            );
          })
          .join("") +
        "</ul><p>Exact outstanding balances, grouped by currency.</p>" +
        link("View issued invoices", "invoices") +
        "</article>";
    var html =
      '<section class="overview-workspace"><header class="overview-heading"><div><p class="insight-eyebrow">Company / Overview</p><h2 id="overview-title">Company overview</h2><p class="overview-intro">A current view of your permitted company work for <strong>' +
      E(N.data.company.name) +
      "</strong>.</p></div>" +
      N.button(
        "Refresh overview",
        "source-refresh",
        "",
        "secondary overview-refresh",
      ) +
      '</header><section class="overview-attention" aria-label="Work that needs attention">' +
      attention +
      '</section><section class="overview-section"><div class="overview-section-heading"><div><p class="insight-eyebrow">Delivery</p><h3>Projects and approved time</h3></div>' +
      meta() +
      '</div><div class="overview-kpis">' +
      countCard(
        "Projects",
        projects.length,
        "In your current delivery scope",
        "delivery",
      ) +
      countCard(
        "Open tasks",
        open,
        "To do and in progress in your scope",
        "delivery",
      ) +
      countCard(
        "Approved time",
        duration(minutes(time)),
        minutes(time) + " exact minutes · recorded, not estimated",
        "time",
        "Open timesheets",
      ) +
      "</div>" +
      chart("Task distribution", statuses(tasks)) +
      "</section>";
    if (N.canManage())
      html +=
        '<section class="overview-section"><div class="overview-section-heading"><div><p class="insight-eyebrow">Sales</p><h3>Current sales records</h3></div>' +
        meta() +
        '</div><div class="overview-kpis overview-kpis-sales">' +
        countCard(
          "Deals",
          N.data.deals.length,
          "Current opportunities",
          "pipeline",
          "Open pipeline",
        ) +
        countCard(
          "Quotes",
          N.data.quotes.filter(function (q) {
            return q.status !== "SUPERSEDED";
          }).length,
          "Current versions; superseded versions excluded",
          "quotes",
          "Open quotes & orders",
        ) +
        countCard(
          "Orders",
          N.data.orders.length,
          "Accepted sales orders",
          "quotes",
          "Open quotes & orders",
        ) +
        '</div><p class="overview-note">Counts describe current records, not a time trend. Stages and currencies remain separate.</p></section>';
    if (N.isOwner())
      html +=
        '<section class="overview-section"><div class="overview-section-heading"><div><p class="insight-eyebrow">Finance</p><h3>Issued invoice balances</h3></div>' +
        meta() +
        '</div><div class="overview-finance-grid">' +
        fin
          .map(function (r) {
            return (
              '<article class="overview-finance-card"><h4>' +
              r.currency +
              "</h4><dl><div><dt>Issued invoices</dt><dd>" +
              r.count +
              "</dd></div><div><dt>Outstanding</dt><dd>" +
              N.money(r.outstanding / 100, r.currency) +
              "</dd></div><div><dt>Overdue outstanding</dt><dd>" +
              N.money(r.overdue / 100, r.currency) +
              "</dd></div></dl></article>"
            );
          })
          .join("") +
        '</div><p class="overview-note">Invoice and recorded payment evidence only. Draft invoices are excluded; currencies are kept separate. These figures are not revenue, cash balance or profit.</p></section>';
    return (
      html +
      '<nav class="overview-actions" aria-label="Company workspace actions"><div><p class="insight-eyebrow">Continue work</p><h3>Open a workspace</h3></div><div class="overview-action-links">' +
      ["delivery", "time"]
        .concat(N.canManage() ? ["pipeline"] : [])
        .concat(N.isOwner() ? ["invoices"] : [])
        .concat(["reports", "settings"])
        .map(function (v) {
          return link(labels[v], v, "secondary");
        })
        .join("") +
      '</div></nav><p class="overview-footer">Browser snapshots are calculated from the current local records. These are not live server reports.</p></section>'
    );
  };
  N.actions["source-team-time"] = function () {
    N.go("time");
    if (N.actions["del-time-team"]) N.actions["del-time-team"]();
  };
  function reportSnapshot() {
    return {
      kind: reportKind,
      generatedAt: updated,
      scope:
        N.user.role === "OWNER"
          ? "Company-wide"
          : N.user.role === "MANAGER"
            ? "Managed"
            : "Personal",
      currency: reportCurrency || null,
      projects: statuses(visibleProjects()),
      tasks: statuses(visibleTasks()),
      approvedTime: {
        minutes: minutes(
          visibleTime().filter(function (t) {
            return t.status === "APPROVED";
          }),
        ),
        billableMinutes: minutes(
          visibleTime().filter(function (t) {
            return t.status === "APPROVED" && t.billable;
          }),
        ),
      },
      deals: N.canManage()
        ? N.data.deals.filter(function (d) {
            return !reportCurrency || d.currency === reportCurrency;
          })
        : [],
      quotes: N.canManage()
        ? N.data.quotes.filter(function (q) {
            return (
              (!reportCurrency || q.currency === reportCurrency) &&
              q.status !== "SUPERSEDED"
            );
          })
        : [],
      orders: N.canManage()
        ? N.data.orders.filter(function (o) {
            return !reportCurrency || o.currency === reportCurrency;
          })
        : [],
      currencies: N.isOwner() ? financeRows(reportCurrency) : [],
    };
  }
  function salesTable(name, records) {
    var map = {};
    records.forEach(function (r) {
      var key =
          (r.currency || "USD") + "|" + (r.stage || r.status || "CONFIRMED"),
        row =
          map[key] ||
          (map[key] = {
            currency: r.currency || "USD",
            status: r.stage || r.status || "CONFIRMED",
            count: 0,
            total: 0,
          });
      row.count++;
      row.total += Math.round(
        (Number(r.value) ||
          Number(r.total) ||
          (r.items || []).reduce(function (s, i) {
            return s + i.quantity * i.price * (1 + (i.tax || 0) / 100);
          }, 0)) * 100,
      );
    });
    return (
      '<section class="transcript-panel"><h3>' +
      E(name) +
      "</h3>" +
      N.table(
        ["Status", "Currency", "Records", "Total terms"],
        Object.keys(map).map(function (k) {
          var r = map[k];
          return [
            E(title(r.status)),
            r.currency,
            String(r.count),
            N.money(r.total / 100, r.currency),
          ];
        }),
      ) +
      "</section>"
    );
  }
  N.views.reports = function () {
    if (!N.canManage()) reportKind = "delivery";
    if (!N.isOwner() && reportKind === "financial") reportKind = "delivery";
    var r = reportSnapshot();
    var kinds = [["delivery", "Delivery"]]
      .concat(N.canManage() ? [["sales", "Sales"]] : [])
      .concat(N.isOwner() ? [["financial", "Invoice & payment evidence"]] : []);
    var html =
      '<section class="report-workspace"><div class="report-page-heading"><div><p class="insight-eyebrow">NovaWorks / Intelligence</p><h2>Company reports</h2><p class="muted">A clear view of delivery, sales and recorded payments.</p></div><span class="report-live-label">Saved company records</span></div><div class="list-tools report-controls"><div>' +
      N.select(
        "Report type",
        "report-kind",
        kinds,
        reportKind,
        'data-source-report="kind"',
      ) +
      "</div>" +
      (reportKind !== "delivery"
        ? "<div>" +
          N.select(
            "Currency",
            "report-currency",
            [
              ["", "All currencies"],
              ["USD", "USD"],
              ["GBP", "GBP"],
              ["PKR", "PKR"],
            ],
            reportCurrency,
            'data-source-report="currency"',
          ) +
          "</div>"
        : "") +
      N.button("Refresh report", "source-refresh") +
      N.button("Export report JSON", "source-report-json") +
      '</div><p class="muted">Scope: ' +
      r.scope +
      ". Snapshot: " +
      updated +
      " UTC.</p>";
    if (reportKind === "delivery")
      html +=
        '<div class="insight-grid">' +
        chart("Project status", r.projects) +
        chart("Task distribution", r.tasks, true) +
        '<section class="insight-card insight-time"><p class="insight-eyebrow">Reviewed work</p><h3>Approved time</h3><p class="insight-total">' +
        duration(r.approvedTime.minutes) +
        "</p><dl><div><dt>Approved minutes</dt><dd>" +
        r.approvedTime.minutes +
        " minutes (" +
        duration(r.approvedTime.minutes) +
        ")</dd></div><div><dt>Billable minutes</dt><dd>" +
        r.approvedTime.billableMinutes +
        " minutes (" +
        duration(r.approvedTime.billableMinutes) +
        ')</dd></div></dl><p class="muted">All recorded dates. Excludes draft, submitted, rejected and void time. This is recorded time, not estimated effort.</p></section></div><p class="muted report-note">Status counts reflect your current permissions. They do not measure percentage completion. Personal approved time includes historical entries after reassignment.</p>';
    if (reportKind === "sales")
      html +=
        '<section class="insight-card sales-flow"><header><p class="insight-eyebrow">From opportunity to commitment</p><h3>Your sales workflow</h3></header><ol>' +
        [
          ["Deals", r.deals.length, "Open and closed opportunities"],
          ["Current quotes", r.quotes.length, "Latest quotation versions"],
          ["Sales orders", r.orders.length, "Accepted commercial terms"],
        ]
          .map(function (row, i) {
            return (
              '<li><span class="flow-step">0' +
              (i + 1) +
              "</span><div><h4>" +
              row[0] +
              "</h4><strong>" +
              row[1] +
              "</strong><p>" +
              row[2] +
              "</p></div>" +
              (i < 2
                ? '<span class="flow-arrow" aria-hidden="true">→</span>'
                : "") +
              "</li>"
            );
          })
          .join("") +
        '</ol><p class="muted">Separate record counts across the selected currency scope. This diagram does not measure conversion rates; amounts must not be added across stages or currencies.</p></section>' +
        salesTable("Deals", r.deals) +
        salesTable("Quotes", r.quotes) +
        salesTable("Sales orders", r.orders);
    if (reportKind === "financial")
      html +=
        "<p>Current issued-invoice and manual payment evidence. Draft invoices are excluded. Payments are recorded evidence; full credits reduce outstanding balances. This view does not calculate revenue recognition, project costs, profit or foreign exchange.</p>" +
        r.currencies
          .map(function (c) {
            return (
              '<section class="transcript-panel financial-insight"><h3>' +
              c.currency +
              ' invoice evidence</h3><dl class="report-values">' +
              [
                ["Issued invoices", c.count],
                ["Issued total", N.money(c.total / 100, c.currency)],
                ["Full credits", N.money(c.credited / 100, c.currency)],
                ["Recorded net payments", N.money(c.paid / 100, c.currency)],
                ["Outstanding", N.money(c.outstanding / 100, c.currency)],
                ["Overdue outstanding", N.money(c.overdue / 100, c.currency)],
              ]
                .map(function (row) {
                  return (
                    "<div><dt>" + row[0] + "</dt><dd>" + row[1] + "</dd></div>"
                  );
                })
                .join("") +
              "</dl></section>"
            );
          })
          .join("");
    return html + "</section>";
  };
  function download(name, data, type) {
    var a = document.createElement("a"),
      url = URL.createObjectURL(new Blob([data], { type: type }));
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  N.actions["source-report-json"] = function () {
    download(
      "novaworks-" + reportKind + "-report.json",
      JSON.stringify(reportSnapshot(), null, 2),
      "application/json",
    );
  };
  document.addEventListener("change", function (event) {
    var el = event.target.closest("[data-source-report]");
    if (!el) return;
    if (el.dataset.sourceReport === "kind") reportKind = el.value;
    else reportCurrency = el.value;
    N.render();
  });
  N.views.settings = function () {
    var c = N.data.company,
      locked = N.isOwner() ? "" : "disabled";
    return (
      '<section class="source-settings"><h2>Company settings</h2><p>Company identity and defaults for new business records. Issued documents retain their original terms.</p><form class="transcript-panel settings-form" data-form="source-settings"><p class="form-error" role="alert"></p>' +
      N.field(
        "Legal company name",
        "legalName",
        c.legalName || c.name,
        "text",
        'required maxlength="180" ' + locked,
      ) +
      N.field(
        "Default currency",
        "currency",
        c.currency || "USD",
        "text",
        'required maxlength="3" ' + locked,
      ) +
      N.field(
        "Locale",
        "locale",
        c.locale || "en-US",
        "text",
        'required maxlength="80" ' + locked,
      ) +
      N.field(
        "Timezone",
        "timezone",
        c.timezone || "UTC",
        "text",
        'required maxlength="80" ' + locked,
      ) +
      '<p class="muted">Use an ISO currency such as USD or PKR, a locale such as en-US or en-PK, and a timezone such as UTC or Asia/Karachi. Daily AI allowances remain based on UTC.</p>' +
      (N.isOwner()
        ? '<button class="primary">Save company settings</button>'
        : "<p>Settings are readable. Updates require company administrator access.</p>") +
      '<p class="source-version">Settings version: ' +
      (c.settingsVersion || 0) +
      "</p>" +
      (c.savedAt
        ? '<p class="source-version">Last saved: ' +
          E(
            new Intl.DateTimeFormat(c.locale || "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: c.timezone || "UTC",
            }).format(new Date(c.savedAt)),
          ) +
          " (" +
          E(c.timezone || "UTC") +
          ")</p>"
        : "") +
      '<p class="muted">Company currency starts new direct quotes. Legal name starts new invoice drafts. Locale and timezone format this saved timestamp; operational deadlines and usage windows retain their explicitly labeled UTC rules.</p></form><section class="settings-members">' +
      (N.isOwner()
        ? '<details class="transcript-panel"><summary>Company member controls</summary><p class="muted">Role views are local demonstrations. Switching a role does not provide secure authentication or change any server membership.</p><div class="source-role-tools">' +
          N.data.users
            .map(function (u) {
              return (
                '<div class="directory-row"><div><strong>' +
                E(u.name) +
                '</strong><p class="muted">' +
                E(u.email) +
                "</p></div>" +
                N.button(
                  u.id === N.user.id
                    ? "Current view"
                    : "View as " + title(u.role),
                  "switch-role",
                  u.id,
                ) +
                "</div>"
              );
            })
            .join("") +
          "</div></details>"
        : "") +
      '<h2>Company members</h2><div class="directory">' +
      N.data.users
        .map(function (u) {
          return (
            '<article class="directory-row"><div><strong>' +
            E(u.name) +
            '</strong><p class="muted">' +
            E(u.email) +
            "</p></div><span>" +
            E(title(u.role)) +
            "</span></article>"
          );
        })
        .join("") +
      "</div>" +
      (N.isOwner()
        ? '<details class="transcript-panel" style="margin-top:24px"><summary>Invite a company member</summary><p class="muted">Invitation tokens and email delivery require the original backend. This standalone demo provides the same local role perspectives through Company member controls above.</p><label class="field"><span>Invited email</span><input type="email" disabled placeholder="teammate@company.com"></label><label class="field"><span>Company role</span><select disabled><option>Member</option><option>Manager</option></select></label><button class="secondary" disabled>Create invitation (backend required)</button></details>'
        : "") +
      '</section><details class="transcript-panel source-role-tools"><summary>Local presentation tools</summary><p class="muted">These controls belong to the standalone demo, not the source account-security model.</p>' +
      N.data.users
        .map(function (u) {
          return N.button("View as " + u.name, "switch-role", u.id);
        })
        .join("") +
      '<div class="actions" style="margin-top:15px">' +
      (N.isOwner() ? N.button("Export workspace JSON", "export-data") : "") +
      N.button("Reset demo", "reset", "", "danger") +
      "</div></details></section>"
    );
  };
  N.forms["source-settings"] = function (form, fd) {
    if (!N.isOwner()) return;
    var name = String(fd.get("legalName")).trim(),
      currency = String(fd.get("currency")).trim().toUpperCase(),
      locale = String(fd.get("locale")).trim(),
      timezone = String(fd.get("timezone")).trim();
    try {
      if (!name || name.length > 180 || !/^[A-Z]{3}$/.test(currency))
        throw new Error("Enter a legal name and a three-letter currency code.");
      new Intl.NumberFormat(locale, { style: "currency", currency: currency });
      new Intl.DateTimeFormat(locale, { timeZone: timezone }).format(
        new Date(),
      );
    } catch (error) {
      return N.formError(
        form,
        "Provide a valid legal name, ISO currency, locale and timezone.",
      );
    }
    Object.assign(N.data.company, {
      legalName: name,
      currency: currency,
      locale: locale,
      timezone: timezone,
      settingsVersion: (N.data.company.settingsVersion || 0) + 1,
      savedAt: new Date().toISOString(),
    });
    N.save("Company settings saved. Issued document terms are unchanged.");
  };
  N.views.billing = function () {
    var rows = [
      ["Subscription state", "Development"],
      ["Company access", "Updates allowed"],
      ["Configured plan", "No commercial plan configured"],
      ["Member seats", N.data.users.length + " — subscription limit disabled"],
    ];
    return (
      '<section class="billing-workspace"><div class="section-heading"><h2>Company subscription</h2></div><p class="muted">SaaS access for this company, separate from invoices you send to your own customers.</p>' +
      N.button("Refresh subscription", "source-refresh") +
      '<p class="notice">Subscription enforcement is disabled in this local demonstration.</p><section class="transcript-panel"><h3>Current access</h3><dl class="source-subscription-facts">' +
      rows
        .map(function (r) {
          return "<dt>" + r[0] + "</dt><dd>" + E(r[1]) + "</dd>";
        })
        .join("") +
      '</dl><p class="muted">Self-service checkout and plan changes are not available in this preview. Plan limits shown here are configuration, not an invoice or proof of payment.</p></section><section class="transcript-panel"><h3>Verify provider access</h3><p class="muted">These actions read existing provider records in the original application. No provider lookup is configured in this frontend-only version.</p>' +
      N.field(
        "Existing provider subscription ID",
        "provider",
        "",
        "text",
        "disabled",
      ) +
      '<label class="field"><span><input type="checkbox" disabled> Verify that this existing subscription belongs to the selected company.</span></label><button class="secondary" disabled>Verify and link subscription</button></section><section class="transcript-panel"><h3>Configured inclusions</h3>' +
      N.table(
        ["Capability", "Access"],
        [
          "CRM",
          "Projects and tasks",
          "Quotes and orders",
          "Time entries",
          "Client invoicing",
          "Meeting extraction",
          "Sales and financial summaries",
        ].map(function (name) {
          return [
            name,
            name === "Meeting extraction"
              ? "Prepared sample only"
              : "Included in local demo",
          ];
        }),
      ) +
      '<p class="muted">Mandatory human review and independent approval safeguards are preserved. No checkout, provider lookup or paid subscription is simulated.</p></section><section class="transcript-panel"><h3>Subscription event history</h3><p class="muted">No provider events recorded for this company.</p></section><section class="transcript-panel"><h3>Provider lookup history</h3><p class="muted">No provider lookups recorded for this company.</p></section></section>'
    );
  };
  var originalMeeting = N.views.ai;
  N.views.ai = function () {
    var m =
      N.params.meetingId &&
      N.data.meetings.find(function (x) {
        return x.id === N.params.meetingId;
      });
    if (m && m.status === "QUEUED")
      return (
        '<section><h2>Meeting to company work</h2><p class="muted">Meeting queued. Process the prepared sample to create an editable draft; only approval creates delivery records.</p><section class="transcript-panel"><h3>' +
        E(m.title) +
        "</h3>" +
        N.badge("QUEUED") +
        "<pre>" +
        E(m.transcript) +
        "</pre>" +
        N.button("Process meeting", "source-process-meeting", m.id, "primary") +
        N.button("Back to saved meetings", "meeting-back") +
        "</section></section>"
      );
    if (m) return originalMeeting();
    return (
      '<section class="company-ai-workspace"><div class="section-heading"><h2>Meeting to company work</h2></div><p class="muted">Queue a meeting, process it, then review and approve its projects and tasks. Only approval creates delivery records.</p><p class="source-local-meeting-note">Local sample review only. No transcript or directory is sent to an AI provider.</p><form data-form="source-meeting-queue"><p class="form-error" role="alert"></p>' +
      N.textarea(
        "Meeting transcript",
        "transcript",
        "",
        'required maxlength="15000"',
      ) +
      '<p class="muted">Load the prepared meeting to demonstrate the queue, review and approval steps. Arbitrary transcript analysis requires the original backend.</p><div class="actions">' +
      N.button("Load sample meeting", "meeting-sample") +
      '<button class="primary">Queue meeting</button></div></form><div class="section-heading" style="margin-top:28px"><h3>Saved meetings</h3>' +
      N.button("Refresh meetings", "source-refresh") +
      "</div>" +
      (N.data.meetings.length
        ? N.table(
            ["Meeting", "Status", ""],
            N.data.meetings.map(function (x) {
              return [
                E(x.title),
                N.badge(x.status),
                N.button("Open meeting", "meeting-open", x.id),
              ];
            }),
          )
        : '<p class="muted">No meetings queued for this company.</p>') +
      "</section>"
    );
  };
  N.forms["source-meeting-queue"] = function (form, fd) {
    var oldLength = N.data.meetings.length;
    N.forms["meeting-queue"](form, fd);
    if (N.data.meetings.length > oldLength) {
      var m = N.data.meetings[N.data.meetings.length - 1];
      m.status = "QUEUED";
      N.save(
        "Meeting queued. Process the prepared sample to review its draft.",
      );
    }
  };
  N.actions["source-process-meeting"] = function (el) {
    if (!N.isOwner()) return;
    var m = N.data.meetings.find(function (x) {
      return x.id === el.dataset.id;
    });
    if (!m || m.status !== "QUEUED") return;
    m.status = "REVIEW";
    N.save("Prepared sample draft ready for review. No AI service was called.");
  };
  N.actions["focus-signin"] = function () {
    document.getElementById("email").focus();
  };
  N.forms["local-signin"] = function (form, fd) {
    var email = String(fd.get("email")).trim().toLowerCase(),
      user = N.data.users.find(function (u) {
        return u.email.toLowerCase() === email;
      });
    if (!user || fd.get("password") !== "Demo123!")
      return N.formError(
        form,
        "Use Explore demo workspace, or a listed sample email with Demo123!. Real account sign-in requires the backend.",
      );
    N.user = user;
    try {
      sessionStorage.setItem("novaworks.vanilla.user", user.id);
    } catch (error) {}
    N.go("overview");
  };
  N.actions["local-account"] = function () {
    N.modal(
      "Create ERP account",
      '<p class="muted">Real signup, password storage and recovery belong to the original backend. This standalone version intentionally provides only local demonstration roles.</p><div class="actions" style="margin-top:20px">' +
        N.button("Choose a demo role", "show-local-roles", "", "primary") +
        "</div>",
    );
  };
  N.actions["show-local-roles"] = function () {
    N.modal(
      "Demonstration roles",
      '<p class="muted">Choose a local perspective. This is not real authentication or company membership.</p><div class="list">' +
        N.data.users
          .map(function (u) {
            return (
              "<article><strong>" +
              E(u.name) +
              '</strong><p class="muted">' +
              E(u.email) +
              " · " +
              E(title(u.role)) +
              "</p>" +
              N.button("View as " + title(u.role), "switch-role", u.id) +
              "</article>"
            );
          })
          .join("") +
        "</div>",
    );
  };
  function catalog() {
    try {
      var rows = JSON.parse(
        localStorage.getItem("novaworks.vanilla.company-catalog.v1") || "[]",
      );
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      return [];
    }
  }
  function switchCompany(id, newData) {
    try {
      var rows = catalog(),
        currentId = N.data.company.id || "company-original",
        index = rows.findIndex(function (r) {
          return r.id === currentId;
        });
      var current = { id: currentId, data: N.data };
      if (index < 0) rows.push(current);
      else rows[index] = current;
      var next =
        newData ||
        (
          rows.find(function (r) {
            return r.id === id;
          }) || {}
        ).data;
      if (!next) return;
      localStorage.setItem(
        "novaworks.vanilla.company-catalog.v1",
        JSON.stringify(rows),
      );
      localStorage.setItem(N.storageKey, JSON.stringify(next));
      N.data = next;
      N.lastSaved = JSON.stringify(next);
      N.user =
        N.data.users.find(function (u) {
          return u.id === N.user.id;
        }) || N.data.users[0];
      N.go("overview");
      N.notify(
        "Company selected. Projects and members belong to this local company.",
      );
    } catch (error) {
      N.notify("Could not switch company. Check browser storage.", "error");
    }
  }
  document.addEventListener("change", function (event) {
    if (event.target.id === "company-picker") switchCompany(event.target.value);
  });
  N.forms["local-company"] = function (form, fd) {
    if (!N.isOwner())
      return N.formError(
        form,
        "Choose the Owner demo role to create a local company.",
      );
    var name = String(fd.get("name")).trim();
    if (!name || name.length > 160)
      return N.formError(form, "Enter a company name.");
    var fresh = createDemoData();
    Object.keys(fresh).forEach(function (k) {
      if (Array.isArray(fresh[k]) && k !== "users") fresh[k] = [];
    });
    fresh.company = {
      ...fresh.company,
      id: N.id("company"),
      name: name,
      legalName: name,
    };
    switchCompany(fresh.company.id, fresh);
  };
  N.render = function () {
    document.getElementById("entry").hidden = !!N.user;
    document.getElementById("workspace").hidden = !N.user;
    document.getElementById("entry-company").textContent = N.data.company.name;
    if (!N.user) return;
    if (!canView(N.view)) N.view = "overview";
    document.getElementById("navigation").innerHTML = groups()
      .map(function (g) {
        return (
          '<div class="nav-group erp-module-group"><h2>' +
          g[0] +
          "</h2>" +
          g[1]
            .map(function (v) {
              return (
                '<button type="button" class="secondary" data-nav="' +
                v +
                '"' +
                (v === N.view ? ' aria-current="page"' : "") +
                ">" +
                icon(v) +
                "<span>" +
                labels[v] +
                "</span></button>"
              );
            })
            .join("") +
          "</div>"
        );
      })
      .join("");
    document.getElementById("user-name").textContent = N.user.name;
    document.getElementById("company-name").textContent = N.data.company.name;
    document.getElementById("company-role").textContent = title(N.user.role);
    var currentId = N.data.company.id || "company-original",
      rows = catalog().filter(function (r) {
        return r.id !== currentId;
      });
    rows.unshift({ id: currentId, data: N.data });
    document.getElementById("company-picker").innerHTML = rows
      .map(function (row) {
        return (
          '<option value="' +
          E(row.id) +
          '"' +
          (row.id === currentId ? " selected" : "") +
          ">" +
          E(row.data.company.name) +
          " · " +
          E(title(N.user.role)) +
          "</option>"
        );
      })
      .join("");
    var unread = N.data.notifications.filter(function (n) {
      return !n.read;
    }).length;
    document.getElementById("notification-count").textContent = unread || "";
    document.getElementById("source-notifications-content").innerHTML =
      '<p class="muted">Company notifications</p><div class="list">' +
      N.data.notifications
        .slice()
        .reverse()
        .map(function (n) {
          return (
            "<article><h3>" +
            E(n.title) +
            '</h3><p class="muted">' +
            E(N.date(n.date)) +
            " · " +
            (n.read ? "Read" : "Unread") +
            "</p></article>"
          );
        })
        .join("") +
      '</div><div class="actions">' +
      N.button("Mark all read", "notifications-read") +
      "</div>";
    var warning = document.getElementById("storage-warning");
    warning.hidden = !N.storageWarning;
    if (N.storageWarning) warning.textContent = N.storageWarning;
    try {
      document.getElementById("view").innerHTML = N.views[N.view]();
    } catch (error) {
      console.error(error);
      document.getElementById("view").innerHTML = N.empty(
        "This record could not be displayed",
        "Reload or reset the local demo.",
      );
    }
    document.title = labels[N.view] + " · NovaWorks";
  };
  N.actions.notifications = function () {
    var details = document.getElementById("source-notifications");
    details.open = !details.open;
  };
  N.render();
})();
/* Local source motion asset; respect reduced motion, small screens and data saving. */
(function () {
  var N = window.Nova,
    video = document.getElementById("entry-motion-video"),
    button = document.querySelector("[data-action=source-toggle-motion]"),
    paused = false,
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function allowed() {
    return (
      !reduced.matches &&
      !document.getElementById("entry").hidden &&
      !document.hidden
    );
  }
  function sync() {
    button.hidden = reduced.matches;
    if (
      !allowed() ||
      paused ||
      innerWidth <= 760 ||
      navigator.connection?.saveData
    ) {
      video.pause();
      return;
    }
    if (!video.src) video.src = "assets/novaworks-flow.mp4";
    video.play().catch(function () {});
  }
  N.actions["source-toggle-motion"] = function () {
    if (!allowed()) return;
    if (video.paused) {
      paused = false;
      if (!video.src) video.src = "assets/novaworks-flow.mp4";
      video.play().catch(function () {
        N.notify(
          "Animation playback is unavailable. The workflow image remains visible.",
          "error",
        );
      });
    } else {
      paused = true;
      video.pause();
    }
  };
  video.addEventListener("play", function () {
    button.textContent = "Pause animation";
    button.setAttribute("aria-pressed", "true");
  });
  video.addEventListener("pause", function () {
    button.textContent = "Play animation";
    button.setAttribute("aria-pressed", "false");
  });
  video.addEventListener("error", function () {
    video.hidden = true;
    button.hidden = true;
  });
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  new MutationObserver(sync).observe(document.getElementById("entry"), {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  sync();
})();
