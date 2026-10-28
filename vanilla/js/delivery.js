/* Delivery and time workflow: plain DOM templates and named event handlers. */
(function () {
  "use strict";
  var N = window.Nova;
  var filters = {
    projectSearch: "",
    projectStatus: "",
    timeQuery: "",
    timeFrom: "",
    timeTo: "",
    timeSelected: "",
    timeCreating: false,
    timeTask: "",
    taskStatus: "",
    timeScope: "mine",
    timeStatus: "",
  };
  var taskLabels = [
    ["TODO", "To do"],
    ["IN_PROGRESS", "In progress"],
    ["DONE", "Done"],
  ];

  function visibleProjects() {
    return N.data.projects.filter(function (project) {
      return (
        N.isOwner() ||
        (N.user.role === "MANAGER"
          ? project.managerId === N.user.id
          : N.data.tasks.some(function (task) {
              return (
                task.projectId === project.id && task.assigneeId === N.user.id
              );
            }))
      );
    });
  }
  function projectById(id) {
    return visibleProjects().find(function (project) {
      return project.id === id;
    });
  }
  function canEditProject(project) {
    return (
      !!project &&
      (N.isOwner() ||
        (N.user.role === "MANAGER" && project.managerId === N.user.id))
    );
  }
  function visibleTasks(projectId) {
    return N.data.tasks.filter(function (task) {
      return (
        (!projectId || task.projectId === projectId) &&
        !!projectById(task.projectId) &&
        (N.user.role !== "MEMBER" || task.assigneeId === N.user.id)
      );
    });
  }
  function taskById(id) {
    return visibleTasks().find(function (task) {
      return task.id === id;
    });
  }
  function validDate(value) {
    return (
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value + "T00:00:00Z")) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    );
  }
  function safeText(value) {
    return String(value || "").trim();
  }
  function saveAndClose(message) {
    if (N.save(message) !== false) N.closeModal();
  }
  function projectOptions() {
    return visibleProjects().map(function (project) {
      return [project.id, project.name];
    });
  }
  function userOptions() {
    return N.data.users.map(function (user) {
      return [user.id, user.name + " · " + user.role];
    });
  }
  function startForm(name, id) {
    return (
      '<form data-form="' +
      name +
      '"' +
      (id ? ' data-id="' + N.esc(id) + '"' : "") +
      '><p class="form-error" role="alert"></p>'
    );
  }
  function finishForm(label) {
    return (
      '<div class="actions"><button class="primary" type="submit">' +
      label +
      "</button></div></form>"
    );
  }
  function denied() {
    N.notify("This record is unavailable for the selected role.", "error");
  }
  function progress(tasks) {
    var done = tasks.filter(function (task) {
      return task.status === "DONE";
    }).length;
    var percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    return (
      '<div class="progress" role="progressbar" aria-label="Task completion" aria-valuenow="' +
      percent +
      '" aria-valuemin="0" aria-valuemax="100"><span style="width:' +
      percent +
      '%"></span></div><p class="hint">' +
      done +
      " of " +
      tasks.length +
      " tasks complete · " +
      percent +
      "%</p>"
    );
  }

  var projectStatuses = [
    ["PLANNED", "Planned"],
    ["ACTIVE", "Active"],
    ["DONE", "Done"],
    ["ARCHIVED", "Archived"],
  ];
  function projectStatus(value) {
    return value === "COMPLETED"
      ? "DONE"
      : value === "ON_HOLD"
        ? "PLANNED"
        : value;
  }
  function inlineProjectForm() {
    return (
      '<details class="transcript-panel"><summary>Create a project</summary>' +
      startForm("del-project-save") +
      N.field("Project name", "name", "", "text", 'required maxlength="160"') +
      N.textarea("Project description", "description", "", 'maxlength="5000"') +
      N.select(
        "Project manager",
        "managerId",
        N.data.users
          .filter(function (u) {
            return u.role !== "MEMBER" && (N.isOwner() || u.id === N.user.id);
          })
          .map(function (u) {
            return [u.id, u.name];
          }),
        N.user.id,
      ) +
      '<input type="hidden" name="status" value="PLANNED">' +
      finishForm("Create project") +
      "</details>"
    );
  }
  function savedProjectViews() {
    var saved = (N.data.projectViews || []).filter(function (v) {
      return v.userId === N.user.id;
    });
    return (
      '<section class="nw-saved-views" aria-label="Saved views"><div class="nw-saved-view-controls"><label>Saved views<select data-del-change="saved-view"><option value="">Choose a saved view</option>' +
      saved
        .map(function (v) {
          return (
            '<option value="' +
            N.esc(v.id) +
            '"' +
            (filters.savedProjectView === v.id ? " selected" : "") +
            ">" +
            N.esc(v.name) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>" +
      N.button("Save current view", "del-view-new") +
      (filters.savedProjectView
        ? N.button("Remove view", "del-view-remove", "", "text-button")
        : "") +
      '</div><p class="nw-view-hint">Only named filter preferences are saved in this browser, for your current account and company.</p></section>'
    );
  }
  function taskList(projectId) {
    var all = visibleTasks(projectId),
      tasks = all.filter(function (t) {
        return !filters.taskStatus || t.status === filters.taskStatus;
      });
    var managed = visibleProjects().filter(canEditProject);
    return (
      '<section aria-label="Company tasks"><div class="section-heading"><h2>Company tasks</h2></div><p class="muted">' +
      (N.user.role === "MEMBER"
        ? "Your assigned work in this company."
        : N.user.role === "MANAGER"
          ? "Tasks in projects you manage."
          : "Assignments across this company.") +
      "</p>" +
      (managed.length
        ? '<details class="transcript-panel"><summary>Assign a task</summary>' +
          startForm("del-task-save") +
          N.select(
            "Task project",
            "projectId",
            managed.map(function (p) {
              return [p.id, p.name];
            }),
            projectId || managed[0].id,
            "required",
          ) +
          N.field(
            "Task title",
            "title",
            "",
            "text",
            'required maxlength="200"',
          ) +
          N.textarea(
            "Task description",
            "description",
            "",
            'required maxlength="5000"',
          ) +
          N.select(
            "Task assignee",
            "assigneeId",
            userOptions(),
            "",
            "required",
          ) +
          N.field("Task deadline", "deadline", "", "date", "required") +
          N.field(
            "Estimated hours",
            "hours",
            1,
            "number",
            'required min="0.01" max="10000" step="0.01"',
          ) +
          '<input type="hidden" name="status" value="TODO">' +
          finishForm("Save assignment") +
          "</details>"
        : "") +
      '<form data-form="del-task-filter" class="list-tools">' +
      N.select(
        "Filter task status",
        "status",
        [["", "All statuses"]].concat(taskLabels),
        filters.taskStatus,
        'data-del-change="task-filter"',
      ) +
      '</form><p class="list-summary" role="status">' +
      tasks.length +
      " tasks available</p>" +
      (tasks.length
        ? '<div class="directory">' +
          tasks
            .map(function (t) {
              var comments = Array.isArray(t.comments) ? t.comments : [];
              return (
                '<article class="directory-row company-task-row"><div class="company-task-content"><p class="muted">' +
                N.esc(N.projectName(t.projectId)) +
                "</p><h3>" +
                N.esc(t.title) +
                '</h3><p class="muted">' +
                N.esc(N.userName(t.assigneeId)) +
                " · " +
                N.esc(t.deadline) +
                " · " +
                Number(t.hours) +
                " hours</p></div>" +
                N.select(
                  "Task status",
                  "status",
                  taskLabels,
                  t.status,
                  'data-del-change="task-status" data-id="' + N.esc(t.id) + '"',
                ) +
                '<details class="erp-task-details"><summary>Task details &amp; discussion</summary><p class="erp-task-description">' +
                N.esc(t.description) +
                '</p><div class="actions">' +
                (canEditProject(projectById(t.projectId))
                  ? N.button("Edit task", "del-task-edit", t.id)
                  : "") +
                N.button("Log time", "del-time-for-task", t.id) +
                "</div><h4>Comments</h4>" +
                comments
                  .map(function (c) {
                    return (
                      "<article><strong>" +
                      N.esc(N.userName(c.userId)) +
                      '</strong><p class="muted">' +
                      N.esc(c.date) +
                      "</p><p>" +
                      N.esc(c.text) +
                      "</p></article>"
                    );
                  })
                  .join("") +
                startForm("del-comment", t.id) +
                N.textarea(
                  "Add a comment",
                  "comment",
                  "",
                  'required maxlength="2000" rows="2"',
                ) +
                finishForm("Post comment") +
                "</details></article>"
              );
            })
            .join("") +
          "</div>"
        : N.empty(
            "No tasks match this view.",
            "Change the status filter or assign work.",
          )) +
      "</section>"
    );
  }
  N.views.delivery = function () {
    var project = N.params.projectId ? projectById(N.params.projectId) : null;
    if (N.params.projectId && !project)
      return N.empty(
        "Project unavailable",
        "This project is not in your selected role view.",
      );
    var all = visibleProjects(),
      matches = all.filter(function (p) {
        return (
          (!filters.projectStatus ||
            projectStatus(p.status) === filters.projectStatus) &&
          [p.name, p.description, N.userName(p.managerId)]
            .join(" ")
            .toLowerCase()
            .includes(filters.projectSearch.toLowerCase())
        );
      });
    var header =
      '<div class="section-heading"><div><p class="erp-eyebrow">Delivery</p><h2>Company projects</h2></div><span class="erp-count">' +
      all.length +
      " loaded projects</span></div>" +
      (N.canManage() ? inlineProjectForm() : "");
    if (project) return header + projectDetail(project) + taskList();
    return (
      header +
      '<section aria-label="Project directory"><form class="list-tools nw-project-filters" data-form="del-project-filter">' +
      N.field(
        "Search loaded projects",
        "query",
        filters.projectSearch,
        "search",
        'maxlength="200" placeholder="Name, scope or manager" data-del-change="project-search"',
      ) +
      N.select(
        "Project status",
        "status",
        [["", "All statuses"]].concat(projectStatuses),
        filters.projectStatus,
        'data-del-change="project-filter"',
      ) +
      (filters.projectSearch || filters.projectStatus
        ? N.button("Clear filters", "del-project-clear")
        : "") +
      "</form>" +
      savedProjectViews() +
      '<p class="list-summary" role="status">' +
      matches.length +
      " of " +
      all.length +
      " loaded projects</p>" +
      (matches.length
        ? N.table(
            ["Project", "Status", "Manager", "Deadline", "Action"],
            matches.map(function (p) {
              return [
                "<strong>" +
                  N.esc(p.name) +
                  '</strong><span class="nw-table-secondary">' +
                  N.esc(
                    p.customerId
                      ? N.customerName(p.customerId)
                      : "Company project",
                  ) +
                  "</span>",
                N.badge(projectStatus(p.status)),
                N.esc(N.userName(p.managerId)),
                N.esc(p.deadline || "Not set"),
                N.button(
                  "Open project →",
                  "del-project-open",
                  p.id,
                  "text-button",
                ),
              ];
            }),
          )
        : N.empty(
            all.length
              ? "No projects match these filters"
              : "No company projects yet",
            all.length
              ? "Clear the filters or try another search."
              : "Create a project to begin planning delivery.",
          )) +
      "</section>" +
      taskList()
    );
  };
  function projectDetail(project) {
    var manage = canEditProject(project),
      milestones = N.data.milestones.filter(function (m) {
        return m.projectId === project.id;
      });
    return (
      '<section class="nw-record-detail" aria-label="Project details">' +
      N.button("← All projects", "del-project-back", "", "back") +
      '<header class="nw-record-header"><div><p class="erp-eyebrow">Delivery / Project</p><h2>' +
      N.esc(project.name) +
      '</h2><p class="muted">' +
      N.esc(
        project.customerId
          ? N.customerName(project.customerId)
          : "Company delivery project",
      ) +
      "</p></div>" +
      N.badge(projectStatus(project.status)) +
      '</header><dl class="nw-record-facts"><div><dt>Project manager</dt><dd>' +
      N.esc(N.userName(project.managerId)) +
      "</dd></div><div><dt>Deadline</dt><dd>" +
      N.esc(project.deadline || "Not set") +
      "</dd></div><div><dt>Status</dt><dd>" +
      N.esc(projectStatus(project.status)) +
      "</dd></div></dl>" +
      (manage
        ? '<section class="nw-deadline-editor" aria-label="Project deadline"><h3>Project deadline</h3><p class="muted">Saved deadline: ' +
          N.esc(project.deadline || "Not set") +
          "</p><details><summary>Edit deadline</summary>" +
          startForm("del-deadline-save", project.id) +
          N.field("Deadline", "deadline", project.deadline, "date") +
          '<p class="muted">Leave blank for no deadline.</p>' +
          finishForm("Save deadline") +
          "</details></section>"
        : "") +
      '<section class="nw-detail-section"><h3>Scope of work</h3><p class="nw-preserve-text">' +
      N.esc(project.description || "No description added yet.") +
      "</p></section>" +
      (manage
        ? N.select(
            "Update project status",
            "status",
            projectStatuses,
            projectStatus(project.status),
            'data-del-change="project-status" data-id="' +
              N.esc(project.id) +
              '"',
          )
        : "") +
      '<details class="project-milestones"><summary>Milestones for ' +
      N.esc(project.name) +
      '</summary><p class="muted">Dated delivery checkpoints. Unsent edits stay on this page only.</p>' +
      (milestones.length
        ? '<ol class="milestone-list">' +
          milestones
            .map(function (m) {
              return (
                "<li><div><strong>" +
                N.esc(m.title) +
                '</strong><p class="muted">Due ' +
                N.esc(m.deadline) +
                " · " +
                N.esc(m.status) +
                "</p></div>" +
                (manage && m.status !== "DONE"
                  ? N.button("Mark complete", "del-milestone-done", m.id)
                  : "") +
                "</li>"
              );
            })
            .join("") +
          "</ol>"
        : '<p class="empty">No milestones yet.</p>') +
      (manage
        ? N.button("Add milestone", "del-milestone-new", project.id)
        : "") +
      '</details><p class="muted">Company tasks and their project names remain available below.</p></section>'
    );
  }
  N.actions["del-project-clear"] = function () {
    filters.projectSearch = "";
    filters.projectStatus = "";
    N.render();
  };
  N.actions["del-view-remove"] = function () {
    N.data.projectViews = (N.data.projectViews || []).filter(function (v) {
      return v.id !== filters.savedProjectView || v.userId !== N.user.id;
    });
    filters.savedProjectView = "";
    N.save("Saved view removed. Current filters are unchanged.");
  };
  N.actions["del-view-new"] = function () {
    N.modal(
      "Save current view",
      startForm("del-view-save") +
        N.field("View name", "name", "", "text", 'required maxlength="60"') +
        finishForm("Save view"),
    );
  };
  N.forms["del-view-save"] = function (form, data) {
    var name = safeText(data.get("name"));
    if (!name || name.length > 60)
      return N.formError(form, "Enter a view name of 1–60 characters.");
    if (
      (N.data.projectViews || []).some(function (v) {
        return (
          v.userId === N.user.id && v.name.toLowerCase() === name.toLowerCase()
        );
      })
    )
      return N.formError(form, "A view with this name already exists.");
    if (!N.data.projectViews) N.data.projectViews = [];
    if (
      N.data.projectViews.filter(function (v) {
        return v.userId === N.user.id;
      }).length >= 10
    )
      return N.formError(
        form,
        "You can save up to ten project views per role.",
      );
    N.data.projectViews.push({
      id: N.id("view"),
      userId: N.user.id,
      name: name,
      q: filters.projectSearch,
      status: filters.projectStatus,
    });
    saveAndClose("View saved in this browser.");
  };
  N.forms["del-deadline-save"] = function (form, data) {
    var p = projectById(form.dataset.id),
      date = data.get("deadline") || "";
    if (!canEditProject(p) || (date && !validDate(date)))
      return N.formError(form, "Enter a valid deadline.");
    if (
      date &&
      (N.data.tasks.some(function (t) {
        return t.projectId === p.id && t.deadline > date;
      }) ||
        N.data.milestones.some(function (m) {
          return m.projectId === p.id && m.deadline > date;
        }))
    )
      return N.formError(
        form,
        "The deadline must include existing tasks and milestones.",
      );
    p.deadline = date;
    N.save("Project deadline saved.");
  };
  document.addEventListener("input", function (event) {
    var el = event.target;
    if (el.dataset.delChange !== "project-search" || !N.user) return;
    var cursor = el.selectionStart;
    filters.projectSearch = el.value;
    N.render();
    var next = document.querySelector('[data-del-change="project-search"]');
    if (next) {
      next.focus();
      next.setSelectionRange(cursor, cursor);
    }
  });
  document.addEventListener("change", function (event) {
    var el = event.target,
      key = el.dataset.delChange;
    if (!key || !N.user) return;
    if (key === "project-search") {
      filters.projectSearch = el.value;
      N.render();
    }
    if (key === "project-filter") {
      filters.projectStatus = el.value;
      N.render();
    }
    if (key === "task-filter") {
      filters.taskStatus = el.value;
      N.render();
    }
    if (key === "project-status") {
      var p = projectById(el.dataset.id);
      if (
        canEditProject(p) &&
        projectStatuses.some(function (pair) {
          return pair[0] === el.value;
        })
      ) {
        p.status = el.value;
        N.save("Project status saved.");
      }
    }
    if (key === "task-status") {
      var t = taskById(el.dataset.id);
      if (
        t &&
        taskLabels.some(function (pair) {
          return pair[0] === el.value;
        })
      ) {
        t.status = el.value;
        N.save("Task status saved.");
      }
    }
    if (key === "saved-view") {
      var v = (N.data.projectViews || []).find(function (item) {
        return item.id === el.value && item.userId === N.user.id;
      });
      if (v) {
        filters.savedProjectView = v.id;
        filters.projectSearch = v.q;
        filters.projectStatus = v.status;
        N.render();
        N.notify("Saved filters applied.");
      }
    }
  });

  N.forms["del-project-filter"] = function (form, data) {
    filters.projectSearch = safeText(data.get("query"));
    filters.projectStatus = data.get("status") || "";
    N.render();
  };
  N.forms["del-task-filter"] = function (form, data) {
    filters.taskStatus = data.get("status") || "";
    N.render();
  };
  N.actions["del-project-open"] = function (button) {
    filters.taskStatus = "";
    N.go("delivery", { projectId: button.dataset.id });
  };
  N.actions["del-project-back"] = function () {
    N.go("delivery");
  };
  function projectForm(project) {
    if (!N.canManage() || (project && !canEditProject(project)))
      return denied();
    N.modal(
      project ? "Edit project" : "New project",
      startForm("del-project-save", project && project.id) +
        '<div class="form-grid">' +
        N.field(
          "Project name",
          "name",
          project && project.name,
          "text",
          'required maxlength="200"',
        ) +
        N.select(
          "Customer",
          "customerId",
          N.data.customers
            .filter(function (customer) {
              return (
                customer.status !== "ARCHIVED" ||
                (project && customer.id === project.customerId)
              );
            })
            .map(function (customer) {
              return [customer.id, customer.name];
            }),
          project && project.customerId,
          "required",
        ) +
        N.select(
          "Project manager",
          "managerId",
          N.data.users
            .filter(function (user) {
              return (
                user.role !== "MEMBER" && (N.isOwner() || user.id === N.user.id)
              );
            })
            .map(function (user) {
              return [user.id, user.name];
            }),
          project ? project.managerId : N.user.id,
          "required",
        ) +
        N.field(
          "Delivery deadline",
          "deadline",
          project && project.deadline,
          "date",
          "required",
        ) +
        N.select(
          "Project status",
          "status",
          [
            ["ACTIVE", "Active"],
            ["ON_HOLD", "On hold"],
            ["COMPLETED", "Completed"],
          ],
          project ? project.status : "ACTIVE",
        ) +
        "</div>" +
        N.textarea(
          "Agreed scope",
          "description",
          project && project.description,
          'required maxlength="5000" rows="4"',
        ) +
        finishForm("Save project"),
    );
  }
  N.actions["del-project-new"] = function () {
    projectForm(null);
  };
  N.actions["del-project-edit"] = function (button) {
    var project = projectById(button.dataset.id);
    if (project) projectForm(project);
    else denied();
  };
  N.forms["del-project-save"] = function (form, data) {
    var project = form.dataset.id ? projectById(form.dataset.id) : null;
    if (
      !N.canManage() ||
      (form.dataset.id && (!project || !canEditProject(project)))
    )
      return N.formError(form, "You cannot change this project.");
    var name = safeText(data.get("name")),
      description = safeText(data.get("description")),
      deadline = data.get("deadline") || "",
      customerId = data.get("customerId") || "",
      managerId = data.get("managerId"),
      status = data.get("status");
    if (
      !name ||
      (deadline && !validDate(deadline)) ||
      (customerId &&
        !N.data.customers.some(function (customer) {
          return customer.id === customerId;
        })) ||
      !N.data.users.some(function (user) {
        return user.id === managerId && user.role !== "MEMBER";
      }) ||
      (!N.isOwner() && managerId !== N.user.id) ||
      ![
        "PLANNED",
        "ACTIVE",
        "DONE",
        "ARCHIVED",
        "ON_HOLD",
        "COMPLETED",
      ].includes(status)
    )
      return N.formError(
        form,
        "Enter a name, scope, valid customer, manager and deadline.",
      );
    if (
      project &&
      deadline &&
      (N.data.tasks.some(function (task) {
        return task.projectId === project.id && task.deadline > deadline;
      }) ||
        N.data.milestones.some(function (item) {
          return item.projectId === project.id && item.deadline > deadline;
        }))
    )
      return N.formError(
        form,
        "The project deadline must include its existing task and milestone deadlines.",
      );
    var values = {
      name: name,
      description: description,
      deadline: deadline,
      customerId: customerId,
      managerId: managerId,
      status: status,
    };
    if (project) Object.assign(project, values);
    else N.data.projects.push(Object.assign({ id: N.id("project") }, values));
    saveAndClose("Project saved.");
  };

  function taskForm(project, task) {
    if (!project) return denied();
    var manage = canEditProject(project);
    if (!manage && (!task || task.assigneeId !== N.user.id)) return denied();
    N.modal(
      task ? "Update task" : "Assign task",
      startForm("del-task-save", task && task.id) +
        '<input type="hidden" name="projectId" value="' +
        N.esc(project.id) +
        '">' +
        (manage
          ? '<div class="form-grid">' +
            N.field(
              "Task title",
              "title",
              task && task.title,
              "text",
              'required maxlength="200"',
            ) +
            N.select(
              "Assigned to",
              "assigneeId",
              userOptions(),
              task && task.assigneeId,
              "required",
            ) +
            N.field(
              "Task deadline",
              "deadline",
              task ? task.deadline : project.deadline,
              "date",
              'required max="' + N.esc(project.deadline) + '"',
            ) +
            N.field(
              "Estimated hours",
              "hours",
              task ? task.hours : 1,
              "number",
              'required min="0.01" max="10000" step="0.01"',
            ) +
            "</div>" +
            N.textarea(
              "Task scope",
              "description",
              task && task.description,
              'required maxlength="5000" rows="3"',
            )
          : "<p>" +
            N.esc(task.title) +
            '</p><p class="hint">You can update the status of your own assigned task.</p>') +
        N.select(
          "Task status",
          "status",
          taskLabels,
          task ? task.status : "TODO",
        ) +
        finishForm("Save task"),
    );
  }
  N.actions["del-task-new"] = function (button) {
    var project = projectById(button.dataset.id);
    if (canEditProject(project)) taskForm(project, null);
    else denied();
  };
  N.actions["del-task-edit"] = function (button) {
    var task = taskById(button.dataset.id);
    if (task) taskForm(projectById(task.projectId), task);
    else denied();
  };
  N.forms["del-task-save"] = function (form, data) {
    var task = form.dataset.id ? taskById(form.dataset.id) : null;
    var project = projectById(task ? task.projectId : data.get("projectId"));
    var manage = canEditProject(project),
      status = data.get("status");
    if (
      !project ||
      (form.dataset.id && !task) ||
      (!manage && (!task || task.assigneeId !== N.user.id))
    )
      return N.formError(form, "This task is unavailable.");
    if (!["TODO", "IN_PROGRESS", "DONE"].includes(status))
      return N.formError(form, "Choose a valid task status.");
    if (!manage) {
      task.status = status;
      return saveAndClose("Task status saved.");
    }
    var title = safeText(data.get("title")),
      description = safeText(data.get("description")),
      deadline = data.get("deadline"),
      hours =
        data.get("minutes") !== null
          ? Number(data.get("minutes")) / 60
          : Number(data.get("hours")),
      assigneeId = data.get("assigneeId");
    if (
      !title ||
      !description ||
      !validDate(deadline) ||
      (project.deadline && deadline > project.deadline) ||
      !Number.isFinite(hours) ||
      hours <= 0 ||
      hours > 10000 ||
      !N.data.users.some(function (user) {
        return user.id === assigneeId;
      })
    )
      return N.formError(
        form,
        "Enter a title, scope, valid assignee, positive hours, and a deadline within the project deadline.",
      );
    var values = {
      projectId: project.id,
      title: title,
      description: description,
      deadline: deadline,
      hours: hours,
      assigneeId: assigneeId,
      status: status,
    };
    if (task) Object.assign(task, values);
    else
      N.data.tasks.push(
        Object.assign({ id: N.id("task"), comments: [] }, values),
      );
    saveAndClose("Task assignment saved.");
  };
  N.forms["del-comment"] = function (form, data) {
    var task = taskById(form.dataset.id),
      text = safeText(data.get("comment"));
    if (!task || !text || text.length > 2000)
      return N.formError(
        form,
        "Enter a comment of 1–2,000 characters on a task you can access.",
      );
    if (!Array.isArray(task.comments)) task.comments = [];
    task.comments.push({
      id: N.id("comment"),
      userId: N.user.id,
      text: text,
      date: N.today(),
    });
    N.save("Comment added.");
  };
  N.actions["del-milestone-new"] = function (button) {
    var project = projectById(button.dataset.id);
    if (!canEditProject(project)) return denied();
    N.modal(
      "Add milestone",
      startForm("del-milestone-save", project.id) +
        N.field(
          "Milestone title",
          "title",
          "",
          "text",
          'required maxlength="200"',
        ) +
        N.field(
          "Due date",
          "deadline",
          project.deadline,
          "date",
          'required max="' + N.esc(project.deadline) + '"',
        ) +
        finishForm("Save milestone"),
    );
  };
  N.forms["del-milestone-save"] = function (form, data) {
    var project = projectById(form.dataset.id),
      title = safeText(data.get("title")),
      deadline = data.get("deadline");
    if (
      !canEditProject(project) ||
      !title ||
      !validDate(deadline) ||
      (project.deadline && deadline > project.deadline)
    )
      return N.formError(
        form,
        "Enter a title and a valid date within the project deadline.",
      );
    N.data.milestones.push({
      id: N.id("milestone"),
      projectId: project.id,
      title: title,
      deadline: deadline,
      status: "OPEN",
    });
    saveAndClose("Milestone saved.");
  };
  N.actions["del-milestone-done"] = function (button) {
    var milestone = N.data.milestones.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (!milestone || !canEditProject(projectById(milestone.projectId)))
      return denied();
    milestone.status = "DONE";
    N.save("Milestone completed.");
  };

  function canReview(entry) {
    return (
      N.canManage() &&
      entry.userId !== N.user.id &&
      !!projectById(entry.projectId)
    );
  }
  function availableTimeEntries() {
    return N.data.times.filter(function (entry) {
      return entry.userId === N.user.id || canReview(entry);
    });
  }
  function duration(hours) {
    var minutes = Math.round(Number(hours || 0) * 60);
    return Math.floor(minutes / 60) + "h " + (minutes % 60) + "m";
  }
  function rateSection() {
    return N.isOwner()
      ? '<details class="transcript-panel"><summary>Hourly billing rates</summary><p class="muted">Rates for future time billing. Saving a rate does not create an invoice or bill recorded time.</p><p class="hint">This standalone demo uses effective worker rates rather than customer/project-specific rates.</p>' +
          N.button("Add hourly billing rate", "rate-new") +
          N.table(
            ["Worker", "Hourly rate", "Currency", "Effective from"],
            N.data.rates.map(function (r) {
              return [
                N.esc(N.userName(r.userId)),
                N.money(r.amount, r.currency),
                N.esc(r.currency),
                N.esc(r.effectiveFrom),
              ];
            }),
          ) +
          "</details>"
      : "";
  }
  N.views.time = function () {
    var team = filters.timeScope === "team" && N.canManage();
    var head =
      '<section class="crm-workspace" aria-label="Timesheets"><div class="section-heading"><h2>Timesheets</h2></div><p class="muted">Record actual work, submit it for review, and keep approved time protected.</p><nav class="list-tools" aria-label="Time views">' +
      N.button("My time", "del-time-mine", "", team ? "secondary" : "primary") +
      (N.canManage()
        ? N.button(
            "Team review",
            "del-time-team",
            "",
            team ? "primary" : "secondary",
          )
        : "") +
      "</nav>";
    if (filters.timeCreating)
      return (
        head +
        '<section aria-label="Log time">' +
        N.button("← My time", "del-time-back", "", "back") +
        "<h3>Log actual work</h3>" +
        timeFields(null, filters.timeTask ? taskById(filters.timeTask) : null) +
        "</section>" +
        rateSection() +
        "</section>"
      );
    var selected = availableTimeEntries().find(function (e) {
      return e.id === filters.timeSelected;
    });
    if (selected)
      return head + timeDetail(selected) + rateSection() + "</section>";
    var entries = availableTimeEntries()
      .filter(function (e) {
        return (
          (team ? e.userId !== N.user.id : e.userId === N.user.id) &&
          (!filters.timeStatus || e.status === filters.timeStatus) &&
          (!filters.timeFrom || e.date >= filters.timeFrom) &&
          (!filters.timeTo || e.date <= filters.timeTo) &&
          [e.note, N.projectName(e.projectId), N.userName(e.userId)]
            .join(" ")
            .toLowerCase()
            .includes(filters.timeQuery.toLowerCase())
        );
      })
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    function sum(predicate) {
      return entries
        .filter(function (e) {
          return e.status !== "VOID" && (!predicate || predicate(e));
        })
        .reduce(function (n, e) {
          return n + Number(e.hours);
        }, 0);
    }
    return (
      head +
      (!team ? N.button("Log time", "del-time-new", "", "primary") : "") +
      '<form data-form="del-time-filter" class="list-tools time-filter-form">' +
      N.field(
        "Find time entries",
        "query",
        filters.timeQuery,
        "search",
        'maxlength="200"',
      ) +
      N.field("From date", "from", filters.timeFrom, "date") +
      N.field("To date", "to", filters.timeTo, "date") +
      N.select(
        "Time status",
        "status",
        [["", "All visible statuses"]].concat(
          (team
            ? ["SUBMITTED", "APPROVED", "REJECTED"]
            : ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "VOID"]
          ).map(function (v) {
            return [v, v];
          }),
        ),
        filters.timeStatus,
      ) +
      '<button class="secondary">Apply filters</button></form><h3>' +
      (team ? "Team filtered time" : "My filtered time") +
      '</h3><dl class="time-summary"><dt>Recorded</dt><dd>' +
      duration(sum()) +
      "</dd><dt>Billable</dt><dd>" +
      duration(
        sum(function (e) {
          return e.billable;
        }),
      ) +
      "</dd><dt>Approved</dt><dd>" +
      duration(
        sum(function (e) {
          return e.status === "APPROVED";
        }),
      ) +
      "</dd><dt>Approved billable</dt><dd>" +
      duration(
        sum(function (e) {
          return e.status === "APPROVED" && e.billable;
        }),
      ) +
      '</dd></dl><p class="muted">Totals cover all entries matching this view. Discarded time is excluded. Approval does not create an invoice.</p><p class="list-summary" role="status">' +
      entries.length +
      " time entries</p>" +
      (entries.length
        ? '<div class="directory">' +
          entries
            .map(function (e) {
              return (
                '<article class="directory-row"><div><h3>' +
                N.esc(N.projectName(e.projectId)) +
                "</h3><p>" +
                N.esc(e.note) +
                "</p><p>" +
                N.esc(N.userName(e.userId)) +
                " · " +
                N.esc(e.date) +
                " · " +
                duration(e.hours) +
                "</p><p>" +
                N.esc(e.status.charAt(0) + e.status.slice(1).toLowerCase()) +
                " · " +
                (e.billable ? "Billable" : "Nonbillable") +
                "</p></div>" +
                N.button("Open time entry", "del-time-open", e.id) +
                "</article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="empty">No time entries match this view.</p>') +
      rateSection() +
      "</section>"
    );
  };
  function timeFields(entry, task) {
    var projectId = entry
      ? entry.projectId
      : task
        ? task.projectId
        : (visibleProjects()[0] || {}).id;
    return (
      startForm("del-time-save", entry && entry.id) +
      '<fieldset class="draft-fields"><legend>Time details</legend><fieldset><legend>Work assignment</legend>' +
      N.select(
        "Time project",
        "projectId",
        [["", "Choose a project"]].concat(projectOptions()),
        projectId,
        "required",
      ) +
      N.select(
        "Time task" +
          (N.user.role === "MEMBER" ? " (required)" : " (optional)"),
        "taskId",
        [
          [
            "",
            N.user.role === "MEMBER"
              ? "Choose your assigned task"
              : "Project-level time",
          ],
        ].concat(
          visibleTasks().map(function (t) {
            return [t.id, N.projectName(t.projectId) + " / " + t.title];
          }),
        ),
        entry ? entry.taskId : task ? task.id : "",
        N.user.role === "MEMBER" ? "required" : "",
      ) +
      "</fieldset>" +
      N.field(
        "Work date (UTC)",
        "date",
        entry ? entry.date : N.today(),
        "date",
        'required max="' + N.today() + '"',
      ) +
      N.field(
        "Minutes worked",
        "minutes",
        entry ? Math.round(entry.hours * 60) : "",
        "number",
        'required min="1" max="1440" step="1"',
      ) +
      '<p class="muted">Use whole minutes. Each person can record at most 1440 minutes on one date.</p>' +
      N.select(
        "Billable time",
        "billable",
        [
          ["yes", "Billable"],
          ["no", "Nonbillable"],
        ],
        !entry || entry.billable ? "yes" : "no",
      ) +
      N.textarea(
        "Work description",
        "note",
        entry && entry.note,
        'required maxlength="2000" rows="3"',
      ) +
      "</fieldset>" +
      finishForm(entry ? "Save time changes" : "Save time draft")
    );
  }
  function timeDetail(entry) {
    var mine = entry.userId === N.user.id,
      editable = mine && ["DRAFT", "REJECTED"].includes(entry.status);
    return (
      '<section aria-label="Time entry details">' +
      N.button("← Time entries", "del-time-back", "", "back") +
      '<h2>Time entry</h2><dl class="nw-record-facts"><div><dt>Project</dt><dd>' +
      N.esc(N.projectName(entry.projectId)) +
      "</dd></div><div><dt>Worker</dt><dd>" +
      N.esc(N.userName(entry.userId)) +
      "</dd></div><div><dt>Work date</dt><dd>" +
      N.esc(entry.date) +
      "</dd></div><div><dt>Time</dt><dd>" +
      duration(entry.hours) +
      "</dd></div><div><dt>Status</dt><dd>" +
      N.esc(entry.status) +
      "</dd></div></dl><p>" +
      N.esc(entry.note) +
      "</p>" +
      (editable
        ? '<details class="transcript-panel" open><summary>Edit my time</summary>' +
          timeFields(entry, null) +
          '</details><section class="transcript-panel"><h3>Submit the saved time</h3><p>Submission locks the saved description, duration and billable choice while a different authorized person reviews them.</p>' +
          N.button(
            "Submit saved time",
            "del-time-submit",
            entry.id,
            "primary",
          ) +
          "<p>Discarding keeps a historical record and removes these minutes from totals.</p>" +
          N.button("Discard time entry", "del-time-void", entry.id) +
          "</section>"
        : "") +
      (entry.status === "SUBMITTED" && canReview(entry)
        ? '<section class="transcript-panel"><h3>Review submitted time</h3>' +
          startForm("del-time-decision", entry.id) +
          '<input type="hidden" name="decision" value="APPROVED">' +
          N.textarea(
            "Review note (required for rejection)",
            "reason",
            "",
            'maxlength="1000" rows="3"',
          ) +
          '<div class="list-tools"><button class="primary" type="submit">Approve time</button>' +
          N.button("Reject time", "del-time-reject", entry.id) +
          "</div></form>" +
          "</section>"
        : "") +
      '<section class="transcript-panel" aria-label="Time review history"><h3>Review history</h3>' +
      (entry.reviewHistory && entry.reviewHistory.length
        ? "<ol>" +
          entry.reviewHistory
            .map(function (r) {
              return (
                "<li><strong>" +
                N.esc(r.decision) +
                " · " +
                N.esc(N.userName(r.reviewerId)) +
                "</strong><p>" +
                N.esc(r.date) +
                "</p><p>" +
                N.esc(r.note || "No note added.") +
                "</p></li>"
              );
            })
            .join("") +
          "</ol>"
        : entry.reviewerId
          ? "<strong>" +
            N.esc(entry.status) +
            " · " +
            N.esc(N.userName(entry.reviewerId)) +
            "</strong><p>" +
            N.esc(entry.reviewNote || "No note added.") +
            "</p>"
          : "<p>No decisions recorded yet.</p>") +
      "</section></section>"
    );
  }
  N.actions["del-time-reject"] = function (button) {
    var form = button.closest("form");
    if (!form) return;
    var fd = new FormData(form);
    fd.set("decision", "REJECTED");
    N.forms["del-time-decision"](form, fd);
  };
  N.actions["del-time-open"] = function (button) {
    if (
      availableTimeEntries().some(function (e) {
        return e.id === button.dataset.id;
      })
    ) {
      filters.timeSelected = button.dataset.id;
      filters.timeCreating = false;
      N.render();
    }
  };
  N.actions["del-time-back"] = function () {
    filters.timeSelected = "";
    filters.timeCreating = false;
    N.render();
  };
  N.actions["del-time-void"] = function (button) {
    var e = N.data.times.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (
      e &&
      e.userId === N.user.id &&
      ["DRAFT", "REJECTED"].includes(e.status)
    ) {
      e.status = "VOID";
      N.save("Time discarded. Its minutes are excluded from totals.");
    } else denied();
  };
  N.actions["del-time-mine"] = function () {
    filters.timeScope = "mine";
    filters.timeStatus = "";
    filters.timeSelected = "";
    filters.timeCreating = false;
    N.render();
  };
  N.actions["del-time-team"] = function () {
    if (N.canManage()) {
      filters.timeScope = "team";
      filters.timeStatus = "SUBMITTED";
      filters.timeSelected = "";
      filters.timeCreating = false;
      N.render();
    }
  };
  N.forms["del-time-filter"] = function (form, data) {
    filters.timeStatus = data.get("status") || "";
    filters.timeQuery = safeText(data.get("query"));
    filters.timeFrom = data.get("from") || "";
    filters.timeTo = data.get("to") || "";
    if (filters.timeFrom && filters.timeTo && filters.timeFrom > filters.timeTo)
      return N.formError(form, "From date must be on or before To date.");
    N.render();
  };
  function timeForm(entry, selectedTask) {
    if (
      entry &&
      (entry.userId !== N.user.id ||
        !["DRAFT", "REJECTED"].includes(entry.status))
    )
      return denied();
    if (!visibleProjects().length)
      return N.notify("Ask your manager to assign a project first.", "error");
    filters.timeSelected = entry ? entry.id : "";
    filters.timeCreating = !entry;
    filters.timeTask = selectedTask ? selectedTask.id : "";
    N.go("time");
  }
  N.actions["del-time-new"] = function () {
    timeForm(null, null);
  };
  N.actions["del-time-for-task"] = function (button) {
    var task = taskById(button.dataset.id);
    if (task) timeForm(null, task);
    else denied();
  };
  N.actions["del-time-edit"] = function (button) {
    var entry = availableTimeEntries().find(function (e) {
      return e.id === button.dataset.id;
    });
    if (entry) timeForm(entry, null);
    else denied();
  };
  N.forms["del-time-save"] = function (form, data) {
    var entry = form.dataset.id
      ? N.data.times.find(function (item) {
          return item.id === form.dataset.id;
        })
      : null;
    if (
      form.dataset.id &&
      (!entry ||
        entry.userId !== N.user.id ||
        !["DRAFT", "REJECTED"].includes(entry.status))
    )
      return N.formError(
        form,
        "Only your draft or rejected time can be changed.",
      );
    var project = projectById(data.get("projectId")),
      taskId = data.get("taskId") || "",
      task = taskId ? taskById(taskId) : null,
      date = data.get("date"),
      hours =
        data.get("minutes") !== null
          ? Number(data.get("minutes")) / 60
          : Number(data.get("hours")),
      note = safeText(data.get("note"));
    if (
      !project ||
      (taskId && (!task || task.projectId !== project.id)) ||
      (N.user.role === "MEMBER" && (!task || task.assigneeId !== N.user.id))
    )
      return N.formError(
        form,
        "Choose a permitted project and a matching task. Members must choose their own task.",
      );
    if (
      !validDate(date) ||
      date > N.today() ||
      !Number.isFinite(hours) ||
      hours <= 0 ||
      hours > 24 ||
      (data.get("minutes") !== null &&
        (!/^\d+$/.test(String(data.get("minutes"))) ||
          Number(data.get("minutes")) < 1)) ||
      !note ||
      note.length > 2000
    )
      return N.formError(
        form,
        "Enter a valid non-future date, 0.01–24 hours and a work description.",
      );
    var dailyHours = N.data.times
      .filter(function (item) {
        return (
          item.userId === N.user.id &&
          item.date === date &&
          item.status !== "VOID" &&
          (!entry || item.id !== entry.id)
        );
      })
      .reduce(function (sum, item) {
        return sum + Number(item.hours);
      }, 0);
    if (dailyHours + hours > 24 + 0.000001)
      return N.formError(
        form,
        "Your total time on this date would exceed 24 hours.",
      );
    var values = {
      projectId: project.id,
      taskId: taskId,
      userId: N.user.id,
      date: date,
      hours: hours,
      note: note,
      billable: data.get("billable") === "yes",
      status: "DRAFT",
    };
    if (entry) {
      Object.assign(entry, values);
      delete entry.reviewerId;
      delete entry.reviewNote;
    } else N.data.times.push(Object.assign({ id: N.id("time") }, values));
    filters.timeScope = "mine";
    filters.timeStatus = "";
    filters.timeCreating = false;
    filters.timeSelected = entry
      ? entry.id
      : N.data.times[N.data.times.length - 1].id;
    saveAndClose("Time draft saved. Submit it when ready for review.");
  };
  N.actions["del-time-submit"] = function (button) {
    var entry = N.data.times.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (
      !entry ||
      entry.userId !== N.user.id ||
      !["DRAFT", "REJECTED"].includes(entry.status)
    )
      return denied();
    entry.status = "SUBMITTED";
    N.save("Time submitted for independent review.");
  };
  N.actions["del-time-review"] = function (button) {
    var entry = N.data.times.find(function (item) {
      return item.id === button.dataset.id;
    });
    if (!entry || entry.status !== "SUBMITTED" || !canReview(entry))
      return denied();
    N.modal(
      "Review submitted time",
      startForm("del-time-decision", entry.id) +
        "<p><strong>" +
        N.esc(N.userName(entry.userId)) +
        "</strong> · " +
        Number(entry.hours) +
        " h · " +
        N.date(entry.date) +
        "</p><p>" +
        N.esc(entry.note) +
        "</p>" +
        N.select(
          "Decision",
          "decision",
          [
            ["APPROVED", "Approve"],
            ["REJECTED", "Reject"],
          ],
          "APPROVED",
        ) +
        N.textarea(
          "Review reason",
          "reason",
          "",
          'required maxlength="1000" rows="3"',
        ) +
        '<p class="hint">Approval locks this entry. It does not invoice time or move money.</p>' +
        finishForm("Record review"),
    );
  };
  N.forms["del-time-decision"] = function (form, data) {
    var entry = N.data.times.find(function (item) {
        return item.id === form.dataset.id;
      }),
      decision = data.get("decision"),
      reason = safeText(data.get("reason"));
    if (!entry || entry.status !== "SUBMITTED" || !canReview(entry))
      return N.formError(
        form,
        "Only another person’s submitted time in your scope can be reviewed.",
      );
    if (
      !["APPROVED", "REJECTED"].includes(decision) ||
      (decision === "REJECTED" && !reason) ||
      reason.length > 1000
    )
      return N.formError(form, "Choose a decision and enter a review reason.");
    entry.status = decision;
    entry.reviewerId = N.user.id;
    entry.reviewNote = reason;
    if (!Array.isArray(entry.reviewHistory)) entry.reviewHistory = [];
    entry.reviewHistory.push({
      decision: decision,
      reviewerId: N.user.id,
      note: reason,
      date: N.today(),
    });
    saveAndClose(
      decision === "APPROVED"
        ? "Time approved and locked."
        : "Time rejected with a reason. The worker can edit and resubmit.",
    );
  };
})();
