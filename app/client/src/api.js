// Frontend-only demonstration. Browser role selection is not authentication.
import { previewUsers, previewProjects, previewTasks } from './preview.js';
import sampleMeeting from '../public/sample-meeting.txt?raw';

export class ApiError extends Error {
  constructor(message, status, issues = []) { super(message); this.status = status; this.issues = issues; }
}
const workspaceKey = 'novaworks.frontend.workspace.v1';
const sessionKey = 'novaworks.frontend.role.v1';
const normalize = value => value.replace(/\r\n?/g, '\n').trim();
function readWorkspace() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(workspaceKey) || 'null'); }
  catch { throw new ApiError('Saved demo data could not be read. Use Reset demo to start again, or enable site storage.', 400); }
  if (saved === null) return { projects: [], tasks: [] };
  const strings = (row, fields) => row && fields.every(field => typeof row[field] === 'string');
  const valid = Array.isArray(saved?.projects) && Array.isArray(saved?.tasks)
    && saved.projects.every(project => strings(project, ['id', 'name', 'clientName', 'managerId', 'deadline', 'description']))
    && saved.tasks.every(task => strings(task, ['id', 'projectId', 'title', 'description', 'assigneeId', 'deadline']) && Number.isFinite(task.estimatedHours) && task.estimatedHours > 0);
  if (!valid) throw new ApiError('Saved demo data has an unsupported format. Use Reset demo to start again.', 400);
  return saved;
}
function saveWorkspace(data) {
  try { localStorage.setItem(workspaceKey, JSON.stringify(data)); }
  catch { throw new ApiError('Browser storage is unavailable or full. Enable site storage to save this demo.', 400); }
}
function currentUser() {
  try { return previewUsers.find(user => user.id === sessionStorage.getItem(sessionKey)); }
  catch { return undefined; }
}
export function resetDemo() {
  try { localStorage.removeItem(workspaceKey); }
  catch { throw new ApiError('Browser storage could not be reset. Check site storage permissions.', 400); }
}
export async function request(path, { body, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (path === '/auth/login') {
    const email = body?.email?.trim().toLowerCase();
    const names = { 'admin@novaworks.example': 'ADMIN', 'ayesha@novaworks.example': 'PM01', 'ali@novaworks.example': 'DEV01' };
    const user = previewUsers.find(person => person.id === names[email]);
    if (!user || body?.password !== 'Demo123!') throw new ApiError('Choose one of the supplied demo roles. This is a frontend simulation.', 401);
    try { sessionStorage.setItem(sessionKey, user.id); }
    catch { throw new ApiError('Enable browser session storage to enter the demo.', 400); }
    return { user };
  }
  if (path === '/auth/logout') {
    try { sessionStorage.removeItem(sessionKey); } catch { /* No server session exists. */ }
    return { success: true };
  }
  const user = currentUser();
  if (!user) throw new ApiError('Select a demo role to continue.', 401);
  if (path === '/auth/me') return { user };
  if (path === '/team') return { users: previewUsers };
  const workspace = readWorkspace();
  const tasks = user.role === 'AGENT' ? workspace.tasks.filter(task => task.assigneeId === user.id) : user.role === 'MANAGER' ? workspace.tasks.filter(task => workspace.projects.some(project => project.id === task.projectId && project.managerId === user.id)) : workspace.tasks;
  const projects = workspace.projects.filter(project => user.role === 'ADMIN' || (user.role === 'MANAGER' ? project.managerId === user.id : tasks.some(task => task.projectId === project.id)));
  if (path === '/projects') return { projects };
  if (path === '/tasks/mine') return { tasks };
  if (path.startsWith('/projects/')) {
    const project = projects.find(item => item.id === decodeURIComponent(path.slice('/projects/'.length)));
    if (!project) throw new ApiError('This project is unavailable for the selected demo role.', 404);
    return { project, tasks: tasks.filter(task => task.projectId === project.id) };
  }
  if (path === '/transcripts') {
    if (user.role !== 'ADMIN') throw new ApiError('Select the administrator demo role to import the sample plan.', 403);
    if (typeof body?.transcript !== 'string' || normalize(body.transcript) !== normalize(sampleMeeting)) {
      throw new ApiError('This frontend demo imports only the supplied sample meeting. Select Clear transcript, then Load sample meeting. Custom meeting analysis needs a backend and AI provider.', 422);
    }
    const replayed = workspace.projects.length > 0;
    if (!replayed) saveWorkspace({ projects: previewProjects, tasks: previewTasks });
    return { projectCount: previewProjects.length, taskCount: previewTasks.length, replayed };
  }
  throw new ApiError('This action is not available in the frontend demo.', 404);
}
