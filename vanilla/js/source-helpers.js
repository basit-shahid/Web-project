/* Source-style saved views. Preferences stay local to a demo role and company. */
(function () {
  "use strict";
  var N = window.Nova;
  N.viewFilters = N.viewFilters || {};
  N.selectedViews = {};
  function key() {
    return (
      "novaworks.source.views.v1." +
      (N.user ? N.user.id : "guest") +
      "." +
      (N.data ? N.data.company.id || N.data.company.name : "company")
    );
  }
  function read() {
    try {
      var rows = JSON.parse(localStorage.getItem(key()) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      return [];
    }
  }
  function write(rows) {
    try {
      localStorage.setItem(key(), JSON.stringify(rows));
      return true;
    } catch (e) {
      N.notify(
        "View preferences could not be saved. Check browser storage.",
        "error",
      );
      return false;
    }
  }
  N.savedViews = function (module, filters) {
    var rows = read().filter(function (v) {
      return v.module === module;
    });
    return (
      '<section class="nw-saved-views"><div class="nw-saved-view-controls"><label for="saved-' +
      N.esc(module) +
      '">Saved view</label><select id="saved-' +
      N.esc(module) +
      '" data-saved-module="' +
      N.esc(module) +
      '"><option value="">Current view</option>' +
      rows
        .map(function (v) {
          return (
            '<option value="' +
            N.esc(v.id) +
            '"' +
            (N.selectedViews[module] === v.id ? " selected" : "") +
            ">" +
            N.esc(v.name) +
            "</option>"
          );
        })
        .join("") +
      "</select>" +
      N.button("Save current view", "source-save-view", module) +
      (N.selectedViews[module]
        ? N.button("Remove saved view", "source-delete-view", module)
        : "") +
      '</div><p class="nw-view-hint">Save search, status and ordering preferences for this company and role. Saved views do not change record access.</p></section>'
    );
  };
  N.actions["source-save-view"] = function (el) {
    var module = el.dataset.id;
    if (!N.viewFilters[module])
      return N.notify(
        "Use the current screen filters to save a view.",
        "error",
      );
    N.modal(
      "Save current view",
      '<form data-form="source-save-view" data-module="' +
        N.esc(module) +
        '"><p class="form-error" role="alert"></p>' +
        N.field("View name", "name", "", "text", 'required maxlength="80"') +
        '<button class="primary">Save view</button></form>',
    );
  };
  N.forms["source-save-view"] = function (form, fd) {
    var name = String(fd.get("name") || "").trim(),
      module = form.dataset.module;
    if (!name || !N.viewFilters[module])
      return N.formError(form, "Enter a name for this view.");
    var rows = read(),
      row = {
        id: N.id("view"),
        module: module,
        name: name,
        filters: N.viewFilters[module].get(),
      };
    rows.push(row);
    if (write(rows)) {
      N.selectedViews[module] = row.id;
      N.closeModal();
      N.render();
      N.notify("View saved for this company and role.");
    }
  };
  N.actions["source-delete-view"] = function (el) {
    var module = el.dataset.id,
      id = N.selectedViews[module];
    if (
      write(
        read().filter(function (r) {
          return r.id !== id;
        }),
      )
    ) {
      delete N.selectedViews[module];
      N.render();
      N.notify("Saved view removed.");
    }
  };
  document.addEventListener("change", function (event) {
    var select = event.target.closest("[data-saved-module]");
    if (!select) return;
    var module = select.dataset.savedModule,
      row = read().find(function (r) {
        return r.id === select.value && r.module === module;
      });
    N.selectedViews[module] = row ? row.id : "";
    if (row && N.viewFilters[module]) N.viewFilters[module].apply(row.filters);
  });
})();
