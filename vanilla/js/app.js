/* Application entry: classic JavaScript, explicit events, DOM rendering, no framework. */
(function () {
  "use strict";
  var N = window.Nova;
  var titles = {
    overview: [
      "Company overview",
      "A current view of your company work, from opportunity to delivery.",
    ],
    customers: [
      "Customer relationships",
      "People, companies and conversations that move your business forward.",
    ],
    pipeline: [
      "Sales pipeline",
      "Qualify opportunities and connect won work to delivery.",
    ],
    quotes: [
      "Quotes & sales orders",
      "Agree the scope, preserve the terms and confirm the work.",
    ],
    delivery: [
      "Projects & tasks",
      "Clear ownership, shared milestones and a practical delivery plan.",
    ],
    time: [
      "Timesheets",
      "Record actual work, submit it and review it independently.",
    ],
    invoices: [
      "Client invoices",
      "Bill agreed work and approved time, then record external receipts.",
    ],
    reports: [
      "Company reports",
      "Useful summaries calculated from the records in this browser.",
    ],
    ai: [
      "Meeting to project",
      "Review a prepared meeting plan before creating assigned work.",
    ],
    settings: [
      "Company settings",
      "Your workspace, people and effective billing rates.",
    ],
    billing: [
      "Subscription",
      "A clear boundary between this local demo and the hosted application.",
    ],
  };
  var iconPaths = {
    overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    customers:
      "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    pipeline: "M4 5h16l-6 7v7l-4 2v-9z",
    quotes: "M6 3h9l4 4v14H6zM9 11h7M9 15h7",
    delivery: "M3 5h6l2 2h10v13H3z",
    time: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    invoices: "M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h6",
    reports: "M4 20V9M10 20V4M16 20v-8M22 20H2",
    ai: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
    billing: "M3 5h18v14H3zM3 10h18M7 15h3",
  };
  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      iconPaths[name] +
      '"/></svg>'
    );
  }
  function groups() {
    return [
      [
        "Workspace",
        [
          ["overview", "Overview"],
          ["delivery", "Projects & tasks"],
          ["time", "Timesheets"],
        ],
      ],
    ]
      .concat(
        N.canManage()
          ? [
              [
                "Sales",
                [
                  ["customers", "Customers"],
                  ["pipeline", "Pipeline"],
                  ["quotes", "Quotes / orders"],
                ],
              ],
            ]
          : [],
      )
      .concat(N.isOwner() ? [["Finance", [["invoices", "Invoices"]]]] : [])
      .concat(
        [
          [
            "Insights",
            [["reports", "Reports"]].concat(
              N.isOwner() ? [["ai", "Meeting review"]] : [],
            ),
          ],
        ],
        [
          [
            "Company",
            [["settings", "Settings"]].concat(
              N.isOwner() ? [["billing", "Subscription"]] : [],
            ),
          ],
        ],
      );
  }
  function accessible(view) {
    return groups().some(function (group) {
      return group[1].some(function (row) {
        return row[0] === view;
      });
    });
  }
  function projects() {
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
  function tasks() {
    var ids = projects().map(function (p) {
      return p.id;
    });
    return N.data.tasks.filter(function (t) {
      return (
        ids.includes(t.projectId) &&
        (N.user.role !== "MEMBER" || t.assigneeId === N.user.id)
      );
    });
  }
  function receipts(i) {
    return (
      Math.round(
        (i.payments || []).reduce(function (sum, p) {
          return sum + Math.round(p.amount * 100);
        }, 0),
      ) / 100
    );
  }
  function currencyGroups(rows, amount) {
    var result = {};
    rows.forEach(function (row) {
      var c = row.currency || "USD";
      result[c] = (result[c] || 0) + Math.round(amount(row) * 100);
    });
    return Object.keys(result)
      .sort()
      .map(function (c) {
        return { currency: c, total: result[c] / 100 };
      });
  }
  function stat(label, value, sub, symbol) {
    return (
      '<article class="stat"><span class="stat-label">' +
      N.esc(label) +
      '</span><span class="stat-icon" aria-hidden="true">' +
      icon(
        symbol === "◷"
          ? "time"
          : symbol === "◇"
            ? "delivery"
            : symbol === "▤"
              ? "overview"
              : "pipeline",
      ) +
      "</span><strong>" +
      N.esc(value) +
      "</strong><p>" +
      N.esc(sub) +
      "</p></article>"
    );
  }
  function flow() {
    var rows = [
      ["Customers", "customers"],
      ["Pipeline", "pipeline"],
      ["Quotes / orders", "quotes"],
      ["Delivery", "delivery"],
      ["Time", "time"],
      ["Invoices", "invoices"],
      ["Reports", "reports"],
    ].filter(function (r) {
      return accessible(r[1]);
    });
    return (
      '<div class="flow-ribbon" aria-label="Connected business flow">' +
      rows
        .map(function (row, index) {
          return (
            (index ? '<span aria-hidden="true">→</span>' : "") +
            '<button data-nav="' +
            row[1] +
            '">' +
            row[0] +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }
  function bar(label, value, max, color) {
    return (
      '<div class="bar-row"><span>' +
      N.esc(label) +
      '</span><div class="bar-track"><span style="width:' +
      Math.max(0, Math.min(100, max ? (value / max) * 100 : 0)) +
      "%;" +
      (color ? "background:" + color : "") +
      '"></span></div><strong>' +
      N.esc(value) +
      "</strong></div>"
    );
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  N.render = function () {
    document.getElementById("entry").hidden = !!N.user;
    document.getElementById("workspace").hidden = !N.user;
    if (!N.user) return;
    if (!accessible(N.view)) N.view = "overview";
    document.getElementById("navigation").innerHTML = groups()
      .map(function (group) {
        return (
          '<div class="nav-group"><p class="nav-label">' +
          group[0].toUpperCase() +
          "</p>" +
          group[1]
            .map(function (row) {
              return (
                '<a href="#' +
                row[0] +
                '" data-nav="' +
                row[0] +
                '"' +
                (N.view === row[0] ? ' aria-current="page"' : "") +
                ">" +
                icon(row[0]) +
                "<span>" +
                row[1] +
                "</span></a>"
              );
            })
            .join("") +
          "</div>"
        );
      })
      .join("");
    document.getElementById("user-name").textContent = N.user.name;
    document.getElementById("user-role").textContent =
      N.user.role.toLowerCase() + " · Demo role";
    document.getElementById("user-avatar").textContent = N.user.name
      .split(" ")
      .slice(0, 2)
      .map(function (w) {
        return w[0];
      })
      .join("");
    document.getElementById("company-name").textContent = N.data.company.name;
    document.getElementById("breadcrumb").textContent =
      "COMPANY / " + N.view.toUpperCase();
    document.getElementById("page-title").textContent = titles[N.view][0];
    document.getElementById("page-description").textContent = titles[N.view][1];
    document.title = titles[N.view][0] + " · NovaWorks";
    document.getElementById("today-label").textContent = N.date(N.today());
    var unread = N.data.notifications.filter(function (n) {
      return !n.read;
    }).length;
    document.getElementById("notification-count").textContent = unread || "";
    var warning = document.getElementById("storage-warning");
    warning.hidden = !N.storageWarning;
    if (N.storageWarning) warning.textContent = N.storageWarning;
    try {
      document.getElementById("view").innerHTML = N.views[N.view]
        ? N.views[N.view]()
        : N.empty("Screen unavailable", "Choose another company section.");
    } catch (error) {
      console.error(error);
      document.getElementById("view").innerHTML = N.empty(
        "This record could not be displayed",
        "Reload the page, or reset the fictional demo from the company menu.",
      );
    }
  };
  N.views.overview = function () {
    var list = tasks(),
      open = list.filter(function (t) {
        return t.status !== "DONE";
      }),
      done = list.length - open.length;
    var pending = N.data.times.filter(function (t) {
      return (
        t.status === "SUBMITTED" &&
        t.userId !== N.user.id &&
        (N.isOwner() ||
          projects().some(function (p) {
            return p.id === t.projectId;
          }))
      );
    });
    var pipeline = N.data.deals.filter(function (d) {
      return !["WON", "LOST"].includes(d.stage);
    });
    var invoices = N.data.invoices.filter(function (i) {
      return i.status === "ISSUED";
    });
    var stats =
      stat(
        "Delivery",
        open.length,
        "Open tasks in your visible projects",
        "▤",
      ) +
      stat("Projects", projects().length, "Projects in your role view", "◇") +
      stat(
        N.canManage() ? "Time review" : "My approved time",
        N.canManage()
          ? pending.length
          : N.data.times.filter(function (t) {
              return t.userId === N.user.id && t.status === "APPROVED";
            }).length,
        N.canManage()
          ? "Entries awaiting an independent reviewer"
          : "Approved entries in this browser",
        "◷",
      ) +
      stat(
        N.canManage() ? "Opportunities" : "Completed work",
        N.canManage() ? pipeline.length : done,
        N.canManage()
          ? "Open deals across all currencies"
          : "Tasks marked done",
        "↗",
      );
    var sales = N.canManage()
      ? '<section class="panel"><div class="section-head"><h2>Sales momentum</h2>' +
        N.button("View pipeline", "go-pipeline", "", "text-button") +
        '</div><p class="muted">Opportunity count by stage. Values stay separated by currency.</p><div class="bar-chart">' +
        ["NEW", "QUALIFIED", "PROPOSAL", "WON"]
          .map(function (s) {
            return bar(
              s.toLowerCase(),
              N.data.deals.filter(function (d) {
                return d.stage === s;
              }).length,
              Math.max(N.data.deals.length, 1),
            );
          })
          .join("") +
        "</div></section>"
      : '<section class="panel"><h2>Your delivery progress</h2><div class="bar-chart">' +
        bar(
          "To do",
          list.filter(function (t) {
            return t.status === "TODO";
          }).length,
          list.length,
        ) +
        bar(
          "In progress",
          list.filter(function (t) {
            return t.status === "IN_PROGRESS";
          }).length,
          list.length,
        ) +
        bar("Done", done, list.length) +
        '</div><p class="muted">Calculated from your assigned task records.</p></section>';
    var attention =
      '<section class="panel"><div class="section-head"><h2>Your next steps</h2>' +
      N.button("Open delivery", "go-delivery", "", "text-button") +
      "</div>" +
      open
        .slice()
        .sort(function (a, b) {
          return a.deadline.localeCompare(b.deadline);
        })
        .slice(0, 3)
        .map(function (t) {
          return (
            '<div class="attention-item"><div><strong>' +
            N.esc(t.title) +
            "</strong><p>" +
            N.esc(N.projectName(t.projectId)) +
            " · " +
            N.esc(N.date(t.deadline)) +
            "</p></div>" +
            N.badge(t.status) +
            "</div>"
          );
        })
        .join("") +
      (open.length
        ? ""
        : N.empty("All caught up", "There are no open tasks in this view.")) +
      "</section>";
    var finance = N.isOwner()
      ? '<section class="panel"><div class="section-head"><h2>Outstanding invoices</h2>' +
        N.button("Open invoices", "go-invoices", "", "text-button") +
        '</div><div class="report-summary">' +
        currencyGroups(invoices, function (i) {
          return i.total - receipts(i);
        })
          .map(function (g) {
            return (
              "<div><span>" +
              g.currency +
              " outstanding</span><strong>" +
              N.money(g.total, g.currency) +
              "</strong></div>"
            );
          })
          .join("") +
        '</div><p class="hint">Issued balances less recorded receipts. Draft and credited invoices excluded.</p></section>'
      : "";
    return (
      '<section class="overview-headline"><div><p class="eyebrow">A CONNECTED VIEW OF YOUR BUSINESS</p><h2>Good work.<br><em>From first hello to final delivery.</em></h2><p>Welcome back, ' +
      N.esc(N.user.name.split(" ")[0]) +
      ". Your relationships, delivery and business records are connected in one workspace.</p></div><div>" +
      N.button("Follow the workflow", "show-guide", "", "secondary") +
      '</div></section><div class="stats">' +
      stats +
      "</div>" +
      flow() +
      '<div class="overview-grid">' +
      sales +
      attention +
      "</div>" +
      finance
    );
  };
  ["pipeline", "delivery", "invoices", "quotes", "time", "customers"].forEach(
    function (view) {
      N.actions["go-" + view] = function () {
        N.go(view);
      };
    },
  );
  var reportKind = "delivery";
  N.views.reports = function () {
    if (N.user.role === "MEMBER") reportKind = "delivery";
    if (!N.isOwner() && reportKind === "finance") reportKind = "delivery";
    var tabs =
      '<div class="tabs">' +
      N.button(
        "Delivery",
        "report-kind",
        "delivery",
        reportKind === "delivery" ? "primary" : "secondary",
      ) +
      (N.canManage()
        ? N.button(
            "Sales",
            "report-kind",
            "sales",
            reportKind === "sales" ? "primary" : "secondary",
          )
        : "") +
      (N.isOwner()
        ? N.button(
            "Finance",
            "report-kind",
            "finance",
            reportKind === "finance" ? "primary" : "secondary",
          )
        : "") +
      "</div>";
    var html = "";
    if (reportKind === "delivery") {
      html =
        '<div class="stats">' +
        stat("Projects", projects().length, "In your role scope") +
        stat("Tasks", tasks().length, "Visible assigned work") +
        stat(
          "Complete",
          tasks().filter(function (t) {
            return t.status === "DONE";
          }).length,
          "Tasks marked done",
        ) +
        stat(
          "Estimated effort",
          tasks().reduce(function (sum, t) {
            return sum + t.hours;
          }, 0) + " h",
          "Estimates, not billed time",
        ) +
        "</div>" +
        N.table(
          ["Project", "Tasks", "Done", "Estimated hours", "Deadline"],
          projects().map(function (p) {
            var ts = tasks().filter(function (t) {
              return t.projectId === p.id;
            });
            return [
              N.esc(p.name),
              String(ts.length),
              String(
                ts.filter(function (t) {
                  return t.status === "DONE";
                }).length,
              ),
              N.esc(
                ts.reduce(function (sum, t) {
                  return sum + t.hours;
                }, 0),
              ),
              N.esc(N.date(p.deadline)),
            ];
          }),
        );
    } else if (reportKind === "sales") {
      html =
        '<div class="detail-grid"><section class="panel"><h2>Open pipeline by currency</h2><div class="report-summary">' +
        currencyGroups(
          N.data.deals.filter(function (d) {
            return !["WON", "LOST"].includes(d.stage);
          }),
          function (d) {
            return d.value;
          },
        )
          .map(function (g) {
            return (
              "<div><span>" +
              g.currency +
              "</span><strong>" +
              N.money(g.total, g.currency) +
              "</strong></div>"
            );
          })
          .join("") +
        '</div></section><section class="panel"><h2>Confirmed sales orders</h2><div class="report-summary">' +
        currencyGroups(
          N.data.orders.filter(function (o) {
            return o.status === "CONFIRMED";
          }),
          function (o) {
            return o.total;
          },
        )
          .map(function (g) {
            return (
              "<div><span>" +
              g.currency +
              "</span><strong>" +
              N.money(g.total, g.currency) +
              "</strong></div>"
            );
          })
          .join("") +
        '</div></section></div><div style="height:20px"></div>' +
        N.table(
          ["Opportunity", "Customer", "Stage", "Currency", "Value"],
          N.data.deals.map(function (d) {
            return [
              N.esc(d.name),
              N.esc(N.customerName(d.customerId)),
              N.badge(d.stage),
              N.esc(d.currency),
              N.money(d.value, d.currency),
            ];
          }),
        );
    } else {
      var currencies = Array.from(
        new Set(
          N.data.invoices.map(function (i) {
            return i.currency;
          }),
        ),
      );
      html =
        N.table(
          [
            "Currency",
            "Issued / paid total",
            "Recorded receipts",
            "Outstanding",
            "Full credits",
          ],
          currencies.map(function (c) {
            var active = N.data.invoices.filter(function (i) {
              return i.currency === c && ["ISSUED", "PAID"].includes(i.status);
            });
            var total =
              active.reduce(function (s, i) {
                return s + Math.round(i.total * 100);
              }, 0) / 100;
            var paid =
              active.reduce(function (s, i) {
                return s + Math.round(receipts(i) * 100);
              }, 0) / 100;
            var credited =
              N.data.invoices
                .filter(function (i) {
                  return i.currency === c && i.status === "CREDITED";
                })
                .reduce(function (s, i) {
                  return s + Math.round(i.total * 100);
                }, 0) / 100;
            return [
              N.esc(c),
              N.money(total, c),
              N.money(paid, c),
              N.money(Math.max(0, total - paid), c),
              N.money(credited, c),
            ];
          }),
        ) +
        '<p class="hint">Recorded receipts represent external evidence, not processed payments. Credited invoices retain their receipt history and are excluded from active balances.</p>';
    }
    return (
      '<div class="section-head"><div><h2>Reports that follow the records</h2><p class="muted">No invented metrics. Each total is calculated from this workspace.</p></div>' +
      N.button("Export CSV", "report-export", "", "secondary") +
      "</div>" +
      tabs +
      html
    );
  };
  N.actions["report-kind"] = function (el) {
    reportKind = el.dataset.id;
    N.render();
  };
  N.actions["report-export"] = function () {
    var rows, headers;
    if (reportKind === "sales" && N.canManage()) {
      headers = ["Deal", "Customer", "Stage", "Currency", "Value"];
      rows = N.data.deals.map(function (d) {
        return [
          d.name,
          N.customerName(d.customerId),
          d.stage,
          d.currency,
          d.value,
        ];
      });
    } else if (reportKind === "finance" && N.isOwner()) {
      headers = [
        "Invoice",
        "Customer",
        "Status",
        "Currency",
        "Total",
        "Recorded receipts",
      ];
      rows = N.data.invoices.map(function (i) {
        return [
          i.number,
          N.customerName(i.customerId),
          i.status,
          i.currency,
          i.total,
          receipts(i),
        ];
      });
    } else {
      headers = [
        "Project",
        "Task",
        "Assignee",
        "Status",
        "Estimated hours",
        "Deadline",
      ];
      rows = tasks().map(function (t) {
        return [
          N.projectName(t.projectId),
          t.title,
          N.userName(t.assigneeId),
          t.status,
          t.hours,
          t.deadline,
        ];
      });
    }
    function csv(value) {
      var str = String(value == null ? "" : value);
      if (/^[=+@\-\t\r]/.test(str)) str = "'" + str;
      return '"' + str.replace(/"/g, '""') + '"';
    }
    download(
      "novaworks-" + reportKind + ".csv",
      [headers]
        .concat(rows)
        .map(function (r) {
          return r.map(csv).join(",");
        })
        .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };
  N.views.settings = function () {
    return (
      '<div class="detail-grid"><section class="panel"><div class="section-head"><h2>Workspace profile</h2>' +
      N.badge(N.user.role) +
      '</div><form data-form="company-save"><p class="form-error" role="alert"></p>' +
      N.field(
        "Company name",
        "name",
        N.data.company.name,
        "text",
        'required maxlength="100"' + (!N.isOwner() ? " readonly" : ""),
      ) +
      N.field(
        "Company email",
        "email",
        N.data.company.email,
        "email",
        "required" + (!N.isOwner() ? " readonly" : ""),
      ) +
      N.textarea(
        "Company address",
        "address",
        N.data.company.address,
        !N.isOwner() ? "readonly" : 'maxlength="300"',
      ) +
      (N.isOwner()
        ? '<button class="primary">Save company profile</button>'
        : '<p class="hint">Only the Owner demo view can edit the company profile.</p>') +
      '</form></section><section class="panel"><h2>Presentation tools</h2><p class="muted" style="margin:12px 0 20px">Switch roles to demonstrate the same records from different perspectives. These are browser filters, not security permissions.</p>' +
      N.data.users
        .map(function (u) {
          return (
            '<div class="attention-item"><div><strong>' +
            N.esc(u.name) +
            "</strong><p>" +
            N.esc(u.role) +
            "</p></div>" +
            N.button(
              u.id === N.user.id ? "Current view" : "View as role",
              "switch-role",
              u.id,
              u.id === N.user.id ? "text-button" : "secondary",
            ) +
            "</div>"
          );
        })
        .join("") +
      (N.isOwner()
        ? '<div class="actions" style="margin-top:20px">' +
          N.button("Export workspace JSON", "export-data", "", "secondary") +
          N.button("Reset demo", "reset", "", "danger") +
          "</div>"
        : "") +
      '</section></div><section class="panel" style="margin-top:20px"><div class="section-head"><h2>Company members</h2><span class="muted">Fictional demonstration team</span></div>' +
      N.table(
        ["Name", "Email", "Demo role"],
        N.data.users.map(function (u) {
          return [N.esc(u.name), N.esc(u.email), N.badge(u.role)];
        }),
      ) +
      "</section>" +
      (N.isOwner()
        ? '<section class="panel"><div class="section-head"><div><h2>Effective billing rates</h2><p class="muted">New rates apply according to the work date. Old rate records are retained.</p></div>' +
          N.button("Add effective rate", "rate-new", "", "primary") +
          "</div>" +
          N.table(
            ["Worker", "Hourly rate", "Currency", "Effective from"],
            N.data.rates.map(function (r) {
              return [
                N.esc(N.userName(r.userId)),
                N.money(r.amount, r.currency),
                N.esc(r.currency),
                N.esc(N.date(r.effectiveFrom)),
              ];
            }),
          ) +
          "</section>"
        : "")
    );
  };
  N.forms["company-save"] = function (form, fd) {
    if (!N.isOwner()) return;
    var name = String(fd.get("name")).trim(),
      email = String(fd.get("email")).trim();
    if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return N.formError(form, "Enter a company name and valid email.");
    N.data.company = {
      ...N.data.company,
      name: name,
      email: email,
      address: String(fd.get("address")).trim().slice(0, 300),
    };
    N.save("Company profile saved in this browser.");
  };
  N.actions["switch-role"] = function (el) {
    var user = N.data.users.find(function (u) {
      return u.id === el.dataset.id;
    });
    if (!user) return;
    N.closeModal();
    N.user = user;
    try {
      sessionStorage.setItem("novaworks.vanilla.user", user.id);
    } catch (error) {
      N.notify(
        "Role works for this page only; session storage is unavailable.",
        "error",
      );
    }
    N.go("overview");
  };
  N.actions["rate-new"] = function () {
    if (!N.isOwner()) return;
    N.modal(
      "Add an effective billing rate",
      '<form data-form="rate-save"><p class="form-error" role="alert"></p><div class="form-grid">' +
        N.select(
          "Worker",
          "userId",
          N.data.users.map(function (u) {
            return [u.id, u.name];
          }),
          "",
          "required",
        ) +
        N.field(
          "Hourly amount",
          "amount",
          "",
          "number",
          'required min="0.01" max="1000000" step="0.01"',
        ) +
        N.select(
          "Currency",
          "currency",
          [
            ["USD", "USD"],
            ["GBP", "GBP"],
            ["PKR", "PKR"],
          ],
          "USD",
        ) +
        N.field(
          "Effective from",
          "effectiveFrom",
          N.today(),
          "date",
          "required",
        ) +
        '</div><p class="hint">This simplified demo uses worker-level effective rates, not customer/project-specific rate agreements.</p><button class="primary">Save rate</button></form>',
    );
  };
  N.forms["rate-save"] = function (form, fd) {
    if (!N.isOwner()) return;
    var amount = Number(fd.get("amount")),
      date = String(fd.get("effectiveFrom")),
      currency = String(fd.get("currency")),
      userId = String(fd.get("userId"));
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1000000 ||
      !/^\d+(\.\d{1,2})?$/.test(String(fd.get("amount"))) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      isNaN(Date.parse(date)) ||
      !["USD", "GBP", "PKR"].includes(currency) ||
      !N.data.users.some(function (u) {
        return u.id === userId;
      })
    )
      return N.formError(
        form,
        "Provide a valid worker, amount, currency and date.",
      );
    if (
      N.data.rates.some(function (r) {
        return (
          r.userId === userId &&
          r.currency === currency &&
          r.effectiveFrom === date
        );
      })
    )
      return N.formError(
        form,
        "A rate already exists for this worker, currency and effective date.",
      );
    N.data.rates.push({
      id: N.id("rate"),
      userId: userId,
      amount: amount,
      currency: currency,
      effectiveFrom: date,
    });
    if (N.save("Effective rate added. Existing issued invoices are unchanged."))
      N.closeModal();
  };
  N.views.billing = function () {
    return (
      '<section class="panel"><p class="eyebrow">DEMONSTRATION BOUNDARY</p><h2 style="margin:12px 0">No subscription needed.</h2><p class="muted">This standalone version has no paid plans, subscription checkout or online services. All available screens run in your browser. The reference repository includes subscription controls; they are intentionally not simulated as a working payment service here.</p><div class="actions" style="margin-top:20px">' +
      N.button("Return to overview", "go-overview", "", "primary") +
      "</div></section>"
    );
  };
  N.actions["go-overview"] = function () {
    N.go("overview");
  };
  var sampleMeeting =
    "Meeting: Northstar client portal\nCustomer: Northstar Studio\nAgreed project: Northstar client portal\nScope: A responsive client portal with project summaries and clear delivery milestones.\nTasks: Design the portal screens (Ali, 8 hours); Review accessibility and content (Maryam, 4 hours).\nFinal decision: Prepare a local draft for review; no live AI generation.";
  function meetingDetail(m) {
    if (m.status !== "REVIEW")
      return (
        '<section class="panel"><div class="section-head"><h2>' +
        N.esc(m.title) +
        "</h2>" +
        N.badge(m.status) +
        '</div><p class="muted">' +
        (m.status === "APPROVED"
          ? "This reviewed sample was saved once as a project and two tasks."
          : "This draft was discarded without creating delivery work.") +
        '</p><div class="actions" style="margin-top:20px">' +
        N.button("Back to meetings", "meeting-back") +
        (m.projectId
          ? N.button(
              "Open created project",
              "meeting-project",
              m.projectId,
              "primary",
            )
          : "") +
        "</div></section>"
      );
    var d = m.draft;
    return (
      '<div class="meeting-steps"><span>1 / Prepared meeting</span><span>2 / Review and edit</span><span>3 / Approve delivery work</span></div><div class="banner">Prepared sample mapping, not AI analysis. Review every field before creating records. No custom transcript extraction is performed.</div><form class="panel" data-form="meeting-approve" data-id="' +
      N.esc(m.id) +
      '"><p class="form-error" role="alert"></p><h2 style="margin-bottom:20px">Review the project plan</h2><div class="form-grid">' +
      N.field(
        "Project name",
        "name",
        d.name,
        "text",
        'required maxlength="160"',
      ) +
      N.select(
        "Customer",
        "customerId",
        N.data.customers
          .filter(function (c) {
            return c.status !== "ARCHIVED";
          })
          .map(function (c) {
            return [c.id, c.name];
          }),
        d.customerId,
      ) +
      N.select(
        "Project manager",
        "managerId",
        N.data.users
          .filter(function (u) {
            return ["OWNER", "MANAGER"].includes(u.role);
          })
          .map(function (u) {
            return [u.id, u.name];
          }),
        d.managerId,
      ) +
      N.field("Delivery deadline", "deadline", d.deadline, "date", "required") +
      N.textarea(
        "Agreed scope",
        "description",
        d.description,
        'required maxlength="2000"',
      ) +
      "</div>" +
      d.tasks
        .map(function (t, index) {
          return (
            "<fieldset><legend>Task " +
            (index + 1) +
            '</legend><div class="form-grid">' +
            N.field(
              "Task title",
              "title" + index,
              t.title,
              "text",
              'required maxlength="160"',
            ) +
            N.select(
              "Assignee",
              "assignee" + index,
              N.data.users.map(function (u) {
                return [u.id, u.name];
              }),
              t.assigneeId,
            ) +
            N.field(
              "Task deadline",
              "date" + index,
              t.deadline,
              "date",
              "required",
            ) +
            N.field(
              "Estimated hours",
              "hours" + index,
              t.hours,
              "number",
              'required min="0.25" max="1000" step="0.25"',
            ) +
            "</div></fieldset>"
          );
        })
        .join("") +
      '<div class="actions"><button class="primary">Approve project & tasks</button>' +
      N.button("Discard draft", "meeting-discard", m.id, "danger") +
      N.button("Back", "meeting-back") +
      "</div></form>"
    );
  }
  N.views.ai = function () {
    if (!N.isOwner())
      return N.empty(
        "Owner role required",
        "Meeting review belongs to the Owner demonstration view.",
      );
    var current =
      N.params.meetingId &&
      N.data.meetings.find(function (m) {
        return m.id === N.params.meetingId;
      });
    if (current) return meetingDetail(current);
    return (
      '<div class="banner">Meeting review is a local prepared-sample workflow. It never calls an AI provider or understands arbitrary meeting text.</div><section class="panel"><div class="section-head"><h2>From conversation to assigned work</h2>' +
      N.button("Load sample meeting", "meeting-sample", "", "secondary") +
      '</div><form data-form="meeting-queue"><p class="form-error" role="alert"></p>' +
      N.textarea(
        "Prepared meeting transcript",
        "transcript",
        "",
        'required maxlength="15000" placeholder="Load the sample meeting to begin…"',
      ) +
      '<button class="primary">Prepare sample draft</button></form></section><section class="panel"><h2 style="margin-bottom:18px">Review history</h2>' +
      (N.data.meetings.length
        ? N.table(
            ["Meeting", "Status", ""],
            N.data.meetings.map(function (m) {
              return [
                N.esc(m.title),
                N.badge(m.status),
                N.button("Open review", "meeting-open", m.id),
              ];
            }),
          )
        : N.empty(
            "No meeting drafts yet",
            "Load the sample and prepare an editable draft.",
          )) +
      "</section>"
    );
  };
  N.actions["meeting-sample"] = function () {
    var area = document.querySelector("[name=transcript]");
    if (area) {
      area.value = sampleMeeting;
      area.focus();
    }
  };
  N.actions["meeting-open"] = function (el) {
    N.go("ai", { meetingId: el.dataset.id });
  };
  N.actions["meeting-back"] = function () {
    N.go("ai");
  };
  N.actions["meeting-project"] = function (el) {
    N.go("delivery", { projectId: el.dataset.id });
  };
  N.forms["meeting-queue"] = function (form, fd) {
    if (!N.isOwner()) return;
    var text = String(fd.get("transcript")).replace(/\r\n?/g, "\n").trim();
    if (text !== sampleMeeting)
      return N.formError(
        form,
        "Load the prepared sample. Arbitrary transcript analysis is not available in this static version.",
      );
    var existing = N.data.meetings.find(function (m) {
      return m.transcript === text && m.status !== "DISCARDED";
    });
    if (existing) {
      N.go("ai", { meetingId: existing.id });
      N.notify("Opening the existing review. No duplicate draft was created.");
      return;
    }
    var due = new Date();
    due.setUTCDate(due.getUTCDate() + 14);
    var date = due.toISOString().slice(0, 10);
    var m = {
      id: N.id("meeting"),
      title: "Northstar client portal planning",
      transcript: text,
      status: "REVIEW",
      draft: {
        name: "Northstar client portal",
        customerId: "c-north",
        managerId: "u-manager",
        description:
          "A responsive client portal with project summaries and clear delivery milestones.",
        deadline: date,
        tasks: [
          {
            title: "Design the portal screens",
            assigneeId: "u-ali",
            hours: 8,
            deadline: date,
          },
          {
            title: "Review accessibility and content",
            assigneeId: "u-maryam",
            hours: 4,
            deadline: date,
          },
        ],
      },
    };
    N.data.meetings.push(m);
    if (N.save()) N.go("ai", { meetingId: m.id });
  };
  N.forms["meeting-approve"] = function (form, fd) {
    if (!N.isOwner()) return;
    var m = N.data.meetings.find(function (x) {
      return x.id === form.dataset.id;
    });
    if (!m || m.status !== "REVIEW")
      return N.formError(form, "This draft was already processed.");
    var name = String(fd.get("name")).trim(),
      description = String(fd.get("description")).trim(),
      deadline = String(fd.get("deadline")),
      managerId = String(fd.get("managerId")),
      customerId = String(fd.get("customerId"));
    function validDate(d) {
      return (
        /^\d{4}-\d{2}-\d{2}$/.test(d) &&
        !isNaN(Date.parse(d + "T00:00:00Z")) &&
        new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d
      );
    }
    if (
      !name ||
      !description ||
      !validDate(deadline) ||
      !N.data.customers.some(function (c) {
        return c.id === customerId && c.status !== "ARCHIVED";
      }) ||
      !N.data.users.some(function (u) {
        return u.id === managerId && ["OWNER", "MANAGER"].includes(u.role);
      })
    )
      return N.formError(
        form,
        "Complete the project name, scope, customer, manager and real deadline.",
      );
    var list = [0, 1].map(function (i) {
      return {
        id: N.id("task"),
        title: String(fd.get("title" + i)).trim(),
        assigneeId: String(fd.get("assignee" + i)),
        hours: Number(fd.get("hours" + i)),
        deadline: String(fd.get("date" + i)),
        status: "TODO",
        description: "Created from the reviewed meeting plan.",
        comments: [],
      };
    });
    if (
      list.some(function (t) {
        return (
          !t.title ||
          !N.data.users.some(function (u) {
            return u.id === t.assigneeId;
          }) ||
          !Number.isFinite(t.hours) ||
          t.hours <= 0 ||
          t.hours > 1000 ||
          !validDate(t.deadline) ||
          t.deadline > deadline
        );
      })
    )
      return N.formError(
        form,
        "Every task needs a title, valid assignee, positive hours and a real deadline on or before project delivery.",
      );
    var p = {
      id: N.id("project"),
      name: name.slice(0, 160),
      description: description.slice(0, 2000),
      customerId: customerId,
      managerId: managerId,
      deadline: deadline,
      status: "ACTIVE",
    };
    list.forEach(function (t) {
      t.projectId = p.id;
    });
    N.data.projects.push(p);
    N.data.tasks.push.apply(N.data.tasks, list);
    m.status = "APPROVED";
    m.projectId = p.id;
    N.data.notifications.push({
      id: N.id("notification"),
      title: "Meeting plan approved: " + p.name,
      date: N.today(),
      read: false,
    });
    if (N.save("Reviewed plan saved as one project and two assigned tasks."))
      N.go("delivery", { projectId: p.id });
  };
  N.actions["meeting-discard"] = function (el) {
    if (!N.isOwner()) return;
    var m = N.data.meetings.find(function (x) {
      return x.id === el.dataset.id;
    });
    if (!m || m.status !== "REVIEW") return;
    if (!confirm("Discard this draft without creating a project?")) return;
    m.status = "DISCARDED";
    N.save("Draft discarded. No delivery records were created.");
  };
  N.actions["notifications"] = function () {
    N.modal(
      "Workspace notifications",
      '<div class="list">' +
        (N.data.notifications.length
          ? N.data.notifications
              .slice()
              .reverse()
              .map(function (n) {
                return (
                  "<article><h3>" +
                  N.esc(n.title) +
                  '</h3><p class="muted">' +
                  N.esc(N.date(n.date)) +
                  " · " +
                  (n.read ? "Read" : "Unread") +
                  "</p></article>"
                );
              })
              .join("")
          : N.empty("No notifications", "You are all caught up.")) +
        '</div><div class="actions" style="margin-top:18px">' +
        N.button("Mark all read", "notifications-read", "", "primary") +
        "</div>",
    );
  };
  N.actions["notifications-read"] = function () {
    N.data.notifications.forEach(function (n) {
      n.read = true;
    });
    N.save("Notifications marked as read.");
    N.closeModal();
  };
  N.actions["show-guide"] = function () {
    N.modal(
      "The NovaWorks workflow",
      '<p class="muted">Follow one connected customer journey. Every action in this version is local to your browser.</p><ol class="guide-list"><li><strong>Customers</strong><p>Create the company, contacts and relationship history.</p></li><li><strong>Pipeline</strong><p>Qualify a lead, convert to a deal and agree the opportunity.</p></li><li><strong>Quotes → sales orders</strong><p>Prepare line items, record acceptance and preserve the agreed terms.</p></li><li><strong>Projects & tasks</strong><p>Hand over won work, assign people and track milestones.</p></li><li><strong>Timesheets</strong><p>A team member logs and submits time; another manager or owner reviews it.</p></li><li><strong>Invoices</strong><p>Invoice a confirmed order or independently approved billable time, then record external receipt evidence.</p></li><li><strong>Reports</strong><p>Review the actual records and export a currency-separated summary.</p></li></ol><div class="banner">No secure authentication, live email, AI, money movement or shared backend is included. The original repository supplies those server-side boundaries.</div>' +
        N.button("Start with customers", "guide-start", "", "primary"),
    );
  };
  N.actions["guide-start"] = function () {
    N.closeModal();
    N.go(N.canManage() ? "customers" : "delivery");
  };
  N.actions.menu = function () {
    var sidebar = document.getElementById("sidebar"),
      open = sidebar.classList.toggle("open");
    document
      .getElementById("menu-button")
      .setAttribute("aria-expanded", String(open));
  };
  N.actions.logout = function () {
    N.closeModal();
    N.user = null;
    try {
      sessionStorage.removeItem("novaworks.vanilla.user");
    } catch (error) {}
    N.render();
    document.getElementById("entry-role").focus();
  };
  N.actions.reset = function () {
    if (
      !confirm(
        "Replace this browser’s NovaWorks demonstration records with the original fictional sample workspace?",
      )
    )
      return;
    var previous = N.data;
    N.data = createDemoData();
    try {
      localStorage.setItem(N.storageKey, JSON.stringify(N.data));
      N.lastSaved = JSON.stringify(N.data);
      N.storageWarning = "";
    } catch (error) {
      N.data = previous;
      N.notify("Reset failed. Enable site storage to reset the demo.", "error");
      return;
    }
    if (N.user)
      N.user =
        N.data.users.find(function (u) {
          return u.id === N.user.id;
        }) || N.data.users[0];
    N.closeModal();
    N.go("overview");
    N.notify("Sample workspace restored. Other browser data was not changed.");
  };
  N.actions["export-data"] = function () {
    if (N.isOwner())
      download(
        "novaworks-workspace.json",
        JSON.stringify(N.data, null, 2),
        "application/json",
      );
  };
  N.forms.enter = function (form, fd) {
    var user = N.data.users.find(function (u) {
      return u.id === fd.get("userId");
    });
    if (!user) return N.formError(form, "Choose an available demo role.");
    N.user = user;
    try {
      sessionStorage.setItem("novaworks.vanilla.user", user.id);
    } catch (error) {
      N.notify(
        "Session storage is unavailable. Your role will last until this page reloads.",
        "error",
      );
    }
    N.go("overview");
  };
  document.addEventListener("click", function (event) {
    var nav = event.target.closest("[data-nav]");
    if (nav) {
      event.preventDefault();
      if (N.user) {
        N.closeModal();
        N.go(nav.dataset.nav);
      }
      return;
    }
    var button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    var action = N.actions[button.dataset.action];
    if (action) {
      event.preventDefault();
      try {
        action(button, event);
      } catch (error) {
        console.error(error);
        N.notify(
          "That action could not be completed. Reload or reset the demo if the saved data is invalid.",
          "error",
        );
      }
    }
  });
  document.addEventListener("submit", function (event) {
    var form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    if (!form.reportValidity()) return;
    var handler = N.forms[form.dataset.form];
    if (handler)
      try {
        handler(form, new FormData(form));
      } catch (error) {
        console.error(error);
        N.formError(
          form,
          "Could not complete the action. Check your input and try again.",
        );
      }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      document.getElementById("sidebar").classList.remove("open");
      var btn = document.getElementById("menu-button");
      if (btn.getAttribute("aria-expanded") === "true") {
        btn.setAttribute("aria-expanded", "false");
        btn.focus();
      }
    }
  });
  document.getElementById("modal").addEventListener("click", function (event) {
    if (event.target === event.currentTarget) {
      var rect = event.currentTarget.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        N.closeModal();
    }
  });
  window.addEventListener("hashchange", function () {
    if (N.user) {
      var view = location.hash.slice(1);
      N.go(accessible(view) ? view : "overview");
    }
  });
  N.load();
  N.view = location.hash.slice(1) || "overview";
  N.render();
})();
