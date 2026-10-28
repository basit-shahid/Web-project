/* Delivery and time workflow: plain DOM templates and named event handlers. */
(function () {
  "use strict";
  var N = window.Nova;
  var filters = {
    projectSearch: "",
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

  N.views.delivery = function () {
    var project = N.params.projectId ? projectById(N.params.projectId) : null;
    if (N.params.projectId && !project)
      return N.empty(
        "Project unavailable",
        "Choose Projects & tasks to return to work in your selected role.",
      );
    if (project) return projectDetail(project);
    var projects = visibleProjects().filter(function (item) {
      return [item.name, item.description, N.customerName(item.customerId)]
        .join(" ")
        .toLowerCase()
        .includes(filters.projectSearch.toLowerCase());
    });
    var tasks = visibleTasks();
    return (
      '<div class="section-head"><div><p class="eyebrow">Delivery workspace</p><h2>Projects & tasks</h2><p class="muted">Agreed scope, clear ownership and a measurable next step.</p></div>' +
      (N.canManage()
        ? N.button("New project", "del-project-new", "", "primary")
        : "") +
      "</div>" +
      '<form data-form="del-project-filter" class="toolbar">' +
      N.field(
        "Find a project",
        "query",
        filters.projectSearch,
        "search",
        'placeholder="Project, customer or scope"',
      ) +
      '<button class="secondary">Search</button></form>' +
      '<div class="stats"><article class="stat"><span>Accessible projects</span><strong>' +
      visibleProjects().length +
      '</strong></article><article class="stat"><span>Open tasks</span><strong>' +
      tasks.filter(function (task) {
        return task.status !== "DONE";
      }).length +
      '</strong></article><article class="stat"><span>Estimated effort</span><strong>' +
      tasks.reduce(function (sum, task) {
        return sum + Number(task.hours || 0);
      }, 0) +
      "<small> h</small></strong></article></div>" +
      (projects.length
        ? '<div class="card-grid">' +
          projects
            .map(function (item) {
              var ownTasks = visibleTasks(item.id);
              return (
                '<article class="card"><div class="section-head"><span class="eyebrow">' +
                N.esc(N.customerName(item.customerId)) +
                "</span>" +
                N.badge(item.status) +
                "</div><h3>" +
                N.esc(item.name) +
                '</h3><p class="muted">' +
                N.esc(item.description) +
                "</p>" +
                progress(ownTasks) +
                "<dl><dt>Project manager</dt><dd>" +
                N.esc(N.userName(item.managerId)) +
                "</dd><dt>Delivery deadline</dt><dd>" +
                N.date(item.deadline) +
                "</dd></dl>" +
                N.button("Open project", "del-project-open", item.id) +
                "</article>"
              );
            })
            .join("") +
          "</div>"
        : N.empty(
            "No matching projects",
            "Try another search or ask your manager to assign you work.",
          ))
    );
  };

  function projectDetail(project) {
    var allTasks = visibleTasks(project.id);
    var tasks = allTasks.filter(function (task) {
      return !filters.taskStatus || task.status === filters.taskStatus;
    });
    var milestones = N.data.milestones.filter(function (item) {
      return item.projectId === project.id;
    });
    return (
      N.button("← All projects", "del-project-back", "", "text-button") +
      '<div class="section-head"><div><p class="eyebrow">' +
      N.esc(N.customerName(project.customerId)) +
      "</p><h2>" +
      N.esc(project.name) +
      '</h2><p class="muted">' +
      N.esc(project.description) +
      '</p></div><div class="actions">' +
      (canEditProject(project)
        ? N.button("Edit project", "del-project-edit", project.id) +
          N.button("Assign task", "del-task-new", project.id, "primary")
        : "") +
      "</div></div>" +
      '<section class="panel"><div class="detail-grid"><div><span class="hint">Manager</span><p>' +
      N.esc(N.userName(project.managerId)) +
      '</p></div><div><span class="hint">Deadline</span><p>' +
      N.date(project.deadline) +
      '</p></div><div><span class="hint">Project status</span><p>' +
      N.badge(project.status) +
      "</p></div></div>" +
      progress(allTasks) +
      "</section>" +
      '<div class="section-head"><h3>Assigned tasks</h3><form data-form="del-task-filter" class="toolbar">' +
      N.select(
        "Task status",
        "status",
        [["", "All statuses"]].concat(taskLabels),
        filters.taskStatus,
      ) +
      '<button class="secondary">Apply</button></form></div>' +
      (tasks.length
        ? '<div class="list">' +
          tasks
            .map(function (task) {
              var comments = Array.isArray(task.comments) ? task.comments : [];
              return (
                '<article class="panel"><div class="section-head"><div><h3>' +
                N.esc(task.title) +
                '</h3><p class="hint">' +
                N.esc(N.userName(task.assigneeId)) +
                " · Due " +
                N.date(task.deadline) +
                " · " +
                Number(task.hours) +
                " estimated hours</p></div>" +
                N.badge(task.status) +
                "</div><p>" +
                N.esc(task.description) +
                '</p><div class="actions">' +
                N.button(
                  canEditProject(project) ? "Edit task" : "Update status",
                  "del-task-edit",
                  task.id,
                ) +
                N.button("Log time", "del-time-for-task", task.id) +
                "</div><details><summary>Discussion · " +
                comments.length +
                '</summary><div class="timeline">' +
                comments
                  .map(function (comment) {
                    return (
                      "<article><strong>" +
                      N.esc(N.userName(comment.userId)) +
                      '</strong><span class="hint"> · ' +
                      N.date(comment.date) +
                      "</span><p>" +
                      N.esc(comment.text) +
                      "</p></article>"
                    );
                  })
                  .join("") +
                "</div>" +
                startForm("del-comment", task.id) +
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
            "No matching tasks",
            "Change the status filter or assign the next piece of work.",
          )) +
      '<section class="panel"><div class="section-head"><div><h3>Milestones</h3><p class="muted">Dated checkpoints for this project.</p></div>' +
      (canEditProject(project)
        ? N.button("Add milestone", "del-milestone-new", project.id)
        : "") +
      "</div>" +
      (milestones.length
        ? '<div class="list">' +
          milestones
            .map(function (item) {
              return (
                '<article><div class="section-head"><div><strong>' +
                N.esc(item.title) +
                '</strong><p class="hint">Due ' +
                N.date(item.deadline) +
                '</p></div><div class="actions">' +
                N.badge(item.status) +
                (canEditProject(project) && item.status !== "DONE"
                  ? N.button("Mark complete", "del-milestone-done", item.id)
                  : "") +
                "</div></div></article>"
              );
            })
            .join("") +
          "</div>"
        : '<p class="muted">No milestones added yet.</p>') +
      "</section>"
    );
  }

  N.forms["del-project-filter"] = function (form, data) {
    filters.projectSearch = safeText(data.get("query"));
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
      deadline = data.get("deadline"),
      customerId = data.get("customerId"),
      managerId = data.get("managerId"),
      status = data.get("status");
    if (
      !name ||
      !description ||
      !validDate(deadline) ||
      !N.data.customers.some(function (customer) {
        return customer.id === customerId;
      }) ||
      !N.data.users.some(function (user) {
        return user.id === managerId && user.role !== "MEMBER";
      }) ||
      (!N.isOwner() && managerId !== N.user.id) ||
      !["ACTIVE", "ON_HOLD", "COMPLETED"].includes(status)
    )
      return N.formError(
        form,
        "Enter a name, scope, valid customer, manager and deadline.",
      );
    if (
      project &&
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
      hours = Number(data.get("hours")),
      assigneeId = data.get("assigneeId");
    if (
      !title ||
      !description ||
      !validDate(deadline) ||
      deadline > project.deadline ||
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
      deadline > project.deadline
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
  N.views.time = function () {
    var team = filters.timeScope === "team" && N.canManage();
    var entries = availableTimeEntries()
      .filter(function (entry) {
        return (
          (team ? entry.userId !== N.user.id : entry.userId === N.user.id) &&
          (!filters.timeStatus || entry.status === filters.timeStatus)
        );
      })
      .slice()
      .sort(function (a, b) {
        return b.date.localeCompare(a.date);
      });
    var hours = entries.reduce(function (sum, entry) {
      return sum + Number(entry.hours);
    }, 0);
    return (
      '<div class="section-head"><div><p class="eyebrow">Time & approval</p><h2>Timesheets</h2><p class="muted">Record actual work, submit it, and keep independent approval visible.</p></div>' +
      N.button("Log time", "del-time-new", "", "primary") +
      '</div><nav class="tabs" aria-label="Time views">' +
      N.button("My time", "del-time-mine", "", team ? "secondary" : "primary") +
      (N.canManage()
        ? N.button(
            "Team review",
            "del-time-team",
            "",
            team ? "primary" : "secondary",
          )
        : "") +
      '</nav><div class="banner">Approved time is locked. You cannot approve your own entries. Approval does not create an invoice.</div><form data-form="del-time-filter" class="toolbar">' +
      N.select(
        "Time status",
        "status",
        [
          ["", "All statuses"],
          ["DRAFT", "Draft"],
          ["SUBMITTED", "Submitted"],
          ["APPROVED", "Approved"],
          ["REJECTED", "Rejected"],
        ],
        filters.timeStatus,
      ) +
      '<button class="secondary">Apply filters</button></form>' +
      '<div class="stats"><article class="stat"><span>Filtered recorded hours</span><strong>' +
      Number(hours.toFixed(2)) +
      '</strong></article><article class="stat"><span>Approved hours</span><strong>' +
      Number(
        entries
          .filter(function (entry) {
            return entry.status === "APPROVED";
          })
          .reduce(function (sum, entry) {
            return sum + Number(entry.hours);
          }, 0)
          .toFixed(2),
      ) +
      '</strong></article><article class="stat"><span>Awaiting review</span><strong>' +
      entries.filter(function (entry) {
        return entry.status === "SUBMITTED";
      }).length +
      "</strong></article></div>" +
      (entries.length
        ? N.table(
            ["Work", "Person / date", "Hours", "Status", "Action"],
            entries.map(function (entry) {
              var task = N.data.tasks.find(function (item) {
                return item.id === entry.taskId;
              });
              var action =
                entry.userId === N.user.id &&
                ["DRAFT", "REJECTED"].includes(entry.status)
                  ? N.button("Edit", "del-time-edit", entry.id) +
                    N.button("Submit", "del-time-submit", entry.id, "primary")
                  : "";
              if (entry.status === "SUBMITTED" && canReview(entry))
                action = N.button(
                  "Review",
                  "del-time-review",
                  entry.id,
                  "primary",
                );
              return [
                "<strong>" +
                  N.esc(N.projectName(entry.projectId)) +
                  '</strong><p class="hint">' +
                  N.esc(task ? task.title : "Project-level time") +
                  "</p><p>" +
                  N.esc(entry.note) +
                  "</p>" +
                  (entry.reviewNote
                    ? '<p class="hint">Review: ' +
                      N.esc(entry.reviewNote) +
                      "</p>"
                    : ""),
                N.esc(N.userName(entry.userId)) +
                  '<p class="hint">' +
                  N.date(entry.date) +
                  "</p>",
                Number(entry.hours) +
                  '<p class="hint">' +
                  (entry.billable ? "Billable" : "Nonbillable") +
                  "</p>",
                N.badge(entry.status) +
                  (entry.reviewerId
                    ? '<p class="hint">By ' +
                      N.esc(N.userName(entry.reviewerId)) +
                      "</p>"
                    : ""),
                '<div class="actions">' + action + "</div>",
              ];
            }),
          )
        : N.empty(
            "No time entries in this view",
            team
              ? "Team members can submit time for your independent review."
              : "Log work against an accessible project and submit it for review.",
          ))
    );
  };
  N.actions["del-time-mine"] = function () {
    filters.timeScope = "mine";
    filters.timeStatus = "";
    N.render();
  };
  N.actions["del-time-team"] = function () {
    if (N.canManage()) {
      filters.timeScope = "team";
      filters.timeStatus = "";
      N.render();
    }
  };
  N.forms["del-time-filter"] = function (form, data) {
    filters.timeStatus = data.get("status") || "";
    N.render();
  };
  function timeForm(entry, selectedTask) {
    var projects = visibleProjects();
    if (
      entry &&
      (entry.userId !== N.user.id ||
        !["DRAFT", "REJECTED"].includes(entry.status))
    )
      return denied();
    if (!projects.length)
      return N.notify(
        "No project is assigned to this role. Ask a manager to assign a task first.",
        "error",
      );
    var projectId = entry
      ? entry.projectId
      : selectedTask
        ? selectedTask.projectId
        : projects[0].id;
    N.modal(
      entry ? "Edit time entry" : "Log actual work",
      startForm("del-time-save", entry && entry.id) +
        '<div class="form-grid">' +
        N.select(
          "Project",
          "projectId",
          projectOptions(),
          projectId,
          "required",
        ) +
        N.select(
          "Task (optional for managers)",
          "taskId",
          [["", "Project-level time"]].concat(
            visibleTasks().map(function (task) {
              return [
                task.id,
                N.projectName(task.projectId) + " / " + task.title,
              ];
            }),
          ),
          entry ? entry.taskId : selectedTask ? selectedTask.id : "",
        ) +
        N.field(
          "Work date",
          "date",
          entry ? entry.date : N.today(),
          "date",
          'required max="' + N.today() + '"',
        ) +
        N.field(
          "Hours worked",
          "hours",
          entry ? entry.hours : 1,
          "number",
          'required min="0.01" max="24" step="0.01"',
        ) +
        N.select(
          "Billing",
          "billable",
          [
            ["yes", "Billable"],
            ["no", "Nonbillable"],
          ],
          !entry || entry.billable ? "yes" : "no",
        ) +
        "</div>" +
        N.textarea(
          "Work description",
          "note",
          entry && entry.note,
          'required maxlength="2000" rows="3"',
        ) +
        '<p class="hint">Choose a task belonging to the selected project. Members must select one of their assigned tasks. Maximum 24 hours per person per day.</p>' +
        finishForm("Save draft"),
    );
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
    var entry = availableTimeEntries().find(function (item) {
      return item.id === button.dataset.id;
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
      hours = Number(data.get("hours")),
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
      !reason ||
      reason.length > 1000
    )
      return N.formError(form, "Choose a decision and enter a review reason.");
    entry.status = decision;
    entry.reviewerId = N.user.id;
    entry.reviewNote = reason;
    saveAndClose(
      decision === "APPROVED"
        ? "Time approved and locked."
        : "Time rejected with a reason. The worker can edit and resubmit.",
    );
  };
})();
