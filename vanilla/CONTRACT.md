# Implementation contract (plain JS, classic scripts)
Global `Nova` (alias N) exposes:
- `data`: persisted object, arrays customers, contacts, activities, leads, deals, quotes, orders, projects, tasks, milestones, times, rates, invoices, notifications, meetings; `company` object; `users` array.
- `user`: current {id,name,role:OWNER|MANAGER|MEMBER}; `view` string, `params` object (current selection).
- `views` registry returning HTML strings for view ids; `actions` registry called on click data-action="key" with `(button,event)`; `forms` registry called on form data-form="key" submit with `(form, new FormData(form))`.
- `go(view,params={})`: render, hash routing; `render()`: refresh current view; `save(message='')`: persist data then render; returns false on storage failure; `notify(message,type='success')`; `id(prefix)`, `today()` returns YYYY-MM-DD; `esc(value)` HTML escape every user-origin string; `money(amount,currency='USD')` decimal amounts; `date(value)` human date; `badge(status)` HTML; `button(text,action,id='',className='secondary')`; `field(label,name,value='',type='text',extra='')` HTML labeled input; `select(label,name,options,value='',extra='')`, options array of [value,label]; `textarea(label,name,value='',extra='')`.
- `modal(title,body)` native dialog with close button; body form with `<p class="form-error" role="alert"></p>`; `closeModal()`; `formError(form,message)`; `empty(title,text)` HTML; `table(headers,rows)` HTML wrapping accessible responsive table; `customerName(id)`, `userName(id)`, `projectName(id)`; `canManage()` owner or manager; `isOwner()`.
- Each mutation must check role and record state, validate fields, escape displayed text. Actions have button.dataset.id; cross-module data attributes optional. FormData.get returns string.
- `N.go('quotes',{dealId})`, `N.go('invoices',{orderId})`, `N.go('delivery',{projectId})` are cross-module entry points; view may consume once via clearing params property, or show linked composer button. Avoid mutating/persisting during render.

Schemas (amounts are decimal numbers in stated currency; use integer cents when calculating):
company {name,currency,email,address}; users {id,name,role,email};
customers {id,name,email,phone,industry,status:PROSPECT|ACTIVE|ARCHIVED};
contacts {id,customerId,name,email,role}; activities {id,customerId,type,note,date};
leads {id,name,customerId,source,status:NEW|QUALIFIED|DISQUALIFIED,value,currency,dealId?};
deals {id,name,customerId,value,stage:NEW|QUALIFIED|PROPOSAL|WON|LOST,probability,currency,leadId?};
quotes {id,title,dealId,customerId,currency,status:DRAFT|SENT|ACCEPTED|DECLINED,validUntil,terms,items:[{description,quantity,price,tax}],acceptedAt?,acceptanceNote?};
orders {id,quoteId,customerId,title,currency,total,status:CONFIRMED|CANCELLED,date};
projects {id,name,customerId,dealId?,managerId,deadline,status:ACTIVE|COMPLETED|ON_HOLD,description};
tasks {id,projectId,title,assigneeId,deadline,hours,status:TODO|IN_PROGRESS|DONE,description,comments:[{id,userId,text,date}]};
milestones {id,projectId,title,deadline,status:OPEN|DONE};
times {id,projectId,taskId,userId,date,hours,note,status:DRAFT|SUBMITTED|APPROVED|REJECTED,reviewerId?,billable:true|false};
rates {id,userId,amount,currency,effectiveFrom};
invoices {id,number,customerId,orderId?,timeIds:[],type:ORDER|TIME,status:DRAFT|ISSUED|PAID|VOID|CREDITED,currency,items:[{description,quantity,price,tax}],total,issuedAt?,dueDate,payments:[{amount,date,reference}],creditReason?};
notifications {id,title,date,read}; meetings {id,title,transcript,status:REVIEW|APPROVED|DISCARDED,projectId?}.

CSS shared classes: page-head, eyebrow, muted, primary, secondary, danger, text-button, actions, card, card-grid, stats, stat, panel, section-head, toolbar, search, tabs, badge, status-*, form-grid, full, detail-grid, data-table, table-wrap, empty, back, list, timeline, field, hint, banner, board, board-column, deal-card, avatar, progress.
All files in this folder should be directly usable from file:// with classic scripts and no fetch, modules, JSX or build step. No npm dependencies.
