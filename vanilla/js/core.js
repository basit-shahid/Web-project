/* Shared DOM helpers and browser storage. No framework or build tool is used. */
(function () {
  "use strict";
  var N = (window.Nova = {
    views: {},
    actions: {},
    forms: {},
    view: "overview",
    params: {},
    user: null,
    storageKey: "novaworks.vanilla.erp.v1",
  });
  N.esc = function (value) {
    return String(value == null ? "" : value).replace(
      /[&<>"']/g,
      function (char) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[char];
      },
    );
  };
  N.id = function (prefix) {
    return (
      prefix +
      "-" +
      (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2))
    );
  };
  N.today = function () {
    return new Date().toISOString().slice(0, 10);
  };
  N.date = function (value) {
    if (!value) return "Not set";
    var d = new Date(String(value).slice(0, 10) + "T00:00:00Z");
    return Number.isNaN(d.getTime())
      ? "Invalid date"
      : d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        });
  };
  N.money = function (amount, currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  };
  N.badge = function (status) {
    return (
      '<span class="badge status-' +
      N.esc(String(status || "").toLowerCase()) +
      '">' +
      N.esc(String(status || "").replace(/_/g, " ")) +
      "</span>"
    );
  };
  N.button = function (text, action, id, style) {
    return (
      '<button type="button" class="' +
      N.esc(style || "secondary") +
      '" data-action="' +
      N.esc(action) +
      '" data-id="' +
      N.esc(id || "") +
      '">' +
      N.esc(text) +
      "</button>"
    );
  };
  N.field = function (label, name, value, type, extra) {
    return (
      '<label class="field"><span>' +
      N.esc(label) +
      '</span><input name="' +
      N.esc(name) +
      '" type="' +
      N.esc(type || "text") +
      '" value="' +
      N.esc(value) +
      '" ' +
      (extra || "") +
      "></label>"
    );
  };
  N.select = function (label, name, options, value, extra) {
    return (
      '<label class="field"><span>' +
      N.esc(label) +
      '</span><select name="' +
      N.esc(name) +
      '" ' +
      (extra || "") +
      ">" +
      options
        .map(function (pair) {
          return (
            '<option value="' +
            N.esc(pair[0]) +
            '"' +
            (String(pair[0]) === String(value) ? " selected" : "") +
            ">" +
            N.esc(pair[1]) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  };
  N.textarea = function (label, name, value, extra) {
    return (
      '<label class="field full"><span>' +
      N.esc(label) +
      '</span><textarea name="' +
      N.esc(name) +
      '" rows="3" ' +
      (extra || "") +
      ">" +
      N.esc(value) +
      "</textarea></label>"
    );
  };
  N.empty = function (title, text) {
    return (
      '<div class="empty"><span class="empty-icon" aria-hidden="true">◇</span><h3>' +
      N.esc(title) +
      "</h3><p>" +
      N.esc(text) +
      "</p></div>"
    );
  };
  N.table = function (headers, rows) {
    return (
      '<div class="table-wrap" tabindex="0" role="region" aria-label="' +
      N.esc(headers.join(", ")) +
      '"><table class="data-table"><thead><tr>' +
      headers
        .map(function (h) {
          return '<th scope="col">' + N.esc(h) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(function (row) {
          return (
            "<tr>" +
            row
              .map(function (cell) {
                return "<td>" + cell + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    );
  };
  N.customerName = function (id) {
    var row = N.data.customers.find(function (x) {
      return x.id === id;
    });
    return row ? row.name : "Unlinked customer";
  };
  N.userName = function (id) {
    var row = N.data.users.find(function (x) {
      return x.id === id;
    });
    return row ? row.name : "Unassigned";
  };
  N.projectName = function (id) {
    var row = N.data.projects.find(function (x) {
      return x.id === id;
    });
    return row ? row.name : "Unknown project";
  };
  N.canManage = function () {
    return !!N.user && ["OWNER", "MANAGER"].includes(N.user.role);
  };
  N.isOwner = function () {
    return !!N.user && N.user.role === "OWNER";
  };
  N.formError = function (form, message) {
    var el = form.querySelector(".form-error");
    if (!el) {
      el = document.createElement("p");
      el.className = "form-error";
      el.setAttribute("role", "alert");
      form.prepend(el);
    }
    el.textContent = message;
    el.tabIndex = -1;
    el.focus();
  };
  N.notify = function (message, type) {
    var box = document.getElementById("toast");
    box.className = "toast " + (type || "success");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(N.toastTimer);
    N.toastTimer = setTimeout(function () {
      box.hidden = true;
    }, 6500);
  };
  N.closeModal = function () {
    var d = document.getElementById("modal");
    if (d.open) d.close();
  };
  N.modal = function (title, body) {
    var d = document.getElementById("modal");
    d.innerHTML =
      '<div class="dialog-head"><h2 id="dialog-title">' +
      N.esc(title) +
      '</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div>' +
      body;
    if (!d.open) d.showModal();
  };
  N.actions["close-modal"] = N.closeModal;
  N.save = function (message) {
    try {
      localStorage.setItem(N.storageKey, JSON.stringify(N.data));
      N.lastSaved = JSON.stringify(N.data);
    } catch (error) {
      if (N.lastSaved) N.data = JSON.parse(N.lastSaved);
      N.notify(
        "Could not save changes. Enable browser storage or free space. No changes were saved.",
        "error",
      );
      return false;
    }
    N.render();
    if (message) N.notify(message);
    return true;
  };
  N.load = function () {
    var seed = createDemoData();
    try {
      var raw = localStorage.getItem(N.storageKey);
      if (!raw) {
        N.data = seed;
        localStorage.setItem(N.storageKey, JSON.stringify(seed));
      } else {
        var saved = JSON.parse(raw);
        if (
          saved.version !== 1 ||
          !saved.company ||
          !Object.keys(seed)
            .filter(function (k) {
              return Array.isArray(seed[k]);
            })
            .every(function (k) {
              return Array.isArray(saved[k]);
            })
        )
          throw new Error("Unsupported demo data");
        N.data = saved;
      }
      N.lastSaved = JSON.stringify(N.data);
    } catch (error) {
      N.data = seed;
      N.lastSaved = JSON.stringify(seed);
      N.storageWarning =
        "Saved data could not be read. You are viewing fresh sample data. Use Reset demo to replace unreadable storage, or enable site storage.";
    }
    try {
      N.user =
        N.data.users.find(function (u) {
          return u.id === sessionStorage.getItem("novaworks.vanilla.user");
        }) || null;
    } catch (error) {
      N.user = null;
    }
  };
  N.go = function (view, params) {
    N.view = view;
    N.params = params || {};
    if (location.hash !== "#" + view)
      history.replaceState(null, "", "#" + view);
    N.render();
    document.getElementById("page-title").focus();
    document.getElementById("sidebar").classList.remove("open");
    document
      .getElementById("menu-button")
      .setAttribute("aria-expanded", "false");
  };
  // The app entry point supplies render after all screen scripts have loaded.
})();
