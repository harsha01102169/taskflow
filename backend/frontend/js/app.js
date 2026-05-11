/* ============================================
   TaskFlow — Frontend App Logic
   Pure vanilla JS, no frameworks
   ============================================ */

const API = '/api';
let currentUser = null;
let currentProjectId = null;
let allUsers = [];
let allTasks = [];

// ——— UTILITIES ———

function getToken() { return localStorage.getItem('tf_token'); }
function setToken(t) { localStorage.setItem('tf_token', t); }
function clearToken() { localStorage.removeItem('tf_token'); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3000);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(id) {
  document.getElementById(id).classList.add('hidden');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(task) {
  return task.overdue === true || task.overdue === 'true';
}

// ——— SCREEN SWITCHING ———

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(name + '-screen');
  if (el) el.classList.add('active');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === name);
  });
}

// ——— AUTH ———

document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-form').classList.add('active');
    hideError('login-error');
    hideError('signup-error');
  });
});

document.getElementById('login-btn').addEventListener('click', async () => {
  hideError('login-error');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return showError('login-error', 'Please fill in all fields');
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
    setToken(data.token);
    currentUser = data.user;
    initApp();
  } catch (err) {
    showError('login-error', err.message);
  }
});

document.getElementById('signup-btn').addEventListener('click', async () => {
  hideError('signup-error');
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const role = document.getElementById('signup-role').value;
  if (!name || !email || !password) return showError('signup-error', 'Please fill in all fields');
  try {
    const data = await apiFetch('/auth/signup', { method: 'POST', body: { name, email, password, role } });
    setToken(data.token);
    currentUser = data.user;
    initApp();
  } catch (err) {
    showError('signup-error', err.message);
  }
});

// Enter key support for login
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ——— APP INIT ———

async function initApp() {
  showScreen('app');

  // Set user info in sidebar
  document.getElementById('sidebar-username').textContent = currentUser.name;
  document.getElementById('sidebar-role').textContent = currentUser.role;
  document.getElementById('user-avatar').textContent = currentUser.name.charAt(0).toUpperCase();

  // Show/hide admin-only elements
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !isAdmin);
  });

  // If admin, preload all users for assignment dropdowns
  if (isAdmin) {
    try {
      allUsers = await apiFetch('/users');
    } catch (_) {}
  }

  loadDashboard();
}

document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  currentUser = null;
  allUsers = [];
  showScreen('auth');
});

// ——— NAVIGATION ———

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    showView(view);
    if (view === 'dashboard') loadDashboard();
    else if (view === 'projects') loadProjects();
    else if (view === 'tasks') loadAllTasks();
    else if (view === 'users') loadUsers();
  });
});

// ——— DASHBOARD ———

async function loadDashboard() {
  try {
    const [stats, tasks] = await Promise.all([
      apiFetch('/tasks/stats'),
      apiFetch('/tasks')
    ]);
    allTasks = tasks;

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-todo').textContent = stats.todo;
    document.getElementById('stat-progress').textContent = stats.in_progress;
    document.getElementById('stat-done').textContent = stats.done;
    document.getElementById('stat-overdue').textContent = stats.overdue;

    const recent = tasks.slice(0, 8);
    renderTaskList('dashboard-tasks', recent);
  } catch (err) {
    showToast('Failed to load dashboard', 'error');
  }
}

// ——— PROJECTS ———

async function loadProjects() {
  try {
    const projects = await apiFetch('/projects');
    const container = document.getElementById('projects-list');
    if (projects.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◫</div><div class="empty-state-text">No projects yet${currentUser.role === 'admin' ? ' — create one above' : ''}</div></div>`;
      return;
    }
    container.innerHTML = projects.map(p => `
      <div class="project-card" data-id="${p.id}">
        <div class="project-card-name">${escHtml(p.name)}</div>
        <div class="project-card-desc">${escHtml(p.description || 'No description')}</div>
        <div class="project-card-footer">
          <span>by ${escHtml(p.owner_name)}</span>
          <span class="project-task-count">${p.task_count} task${p.task_count == 1 ? '' : 's'}</span>
        </div>
      </div>
    `).join('');
    container.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', () => openProjectDetail(card.dataset.id));
    });
  } catch (err) {
    showToast('Failed to load projects', 'error');
  }
}

async function openProjectDetail(projectId) {
  currentProjectId = projectId;
  try {
    const project = await apiFetch('/projects/' + projectId);
    document.getElementById('project-detail-name').textContent = project.name;
    document.getElementById('project-detail-desc').textContent = project.description || '';

    // Members bar
    const membersEl = document.getElementById('project-members-list');
    membersEl.innerHTML = project.members.length === 0
      ? '<span style="color:var(--text-muted);font-size:12px">No members added yet</span>'
      : project.members.map(m => `<span class="member-chip">${escHtml(m.name)}</span>`).join('');

    // Load tasks for this project
    const tasks = await apiFetch('/tasks/project/' + projectId);
    renderTaskList('project-tasks', tasks);

    showView('project-detail');
  } catch (err) {
    showToast('Failed to load project', 'error');
  }
}

document.getElementById('back-to-projects').addEventListener('click', () => {
  showView('projects');
  loadProjects();
});

// New Project
document.getElementById('new-project-btn')?.addEventListener('click', () => {
  document.getElementById('project-name-input').value = '';
  document.getElementById('project-desc-input').value = '';
  hideError('project-modal-error');
  openModal('modal-project');
});

document.getElementById('save-project-btn').addEventListener('click', async () => {
  const name = document.getElementById('project-name-input').value.trim();
  const description = document.getElementById('project-desc-input').value.trim();
  if (!name) return showError('project-modal-error', 'Project name is required');
  try {
    await apiFetch('/projects', { method: 'POST', body: { name, description } });
    closeModal('modal-project');
    showToast('Project created!');
    loadProjects();
  } catch (err) {
    showError('project-modal-error', err.message);
  }
});

// Add Member to Project
document.getElementById('add-member-btn')?.addEventListener('click', () => {
  const select = document.getElementById('member-user-select');
  select.innerHTML = '<option value="">Choose a user...</option>' +
    allUsers.map(u => `<option value="${u.id}">${escHtml(u.name)} (${u.role})</option>`).join('');
  openModal('modal-member');
});

document.getElementById('save-member-btn').addEventListener('click', async () => {
  const userId = document.getElementById('member-user-select').value;
  if (!userId) return showToast('Select a user', 'error');
  try {
    await apiFetch(`/projects/${currentProjectId}/members`, { method: 'POST', body: { user_id: userId } });
    closeModal('modal-member');
    showToast('Member added!');
    openProjectDetail(currentProjectId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ——— TASKS ———

async function loadAllTasks() {
  try {
    const tasks = await apiFetch('/tasks');
    allTasks = tasks;
    renderFilteredTasks(tasks);
  } catch (err) {
    showToast('Failed to load tasks', 'error');
  }
}

function renderFilteredTasks(tasks) {
  const status = document.getElementById('task-filter-status').value;
  const priority = document.getElementById('task-filter-priority').value;
  let filtered = tasks;
  if (status) filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  renderTaskList('all-tasks-list', filtered);
}

['task-filter-status', 'task-filter-priority'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => renderFilteredTasks(allTasks));
});

// New Task
document.getElementById('new-task-btn')?.addEventListener('click', () => {
  openTaskModal(null);
});

function openTaskModal(task) {
  document.getElementById('task-modal-title').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('task-id-input').value = task?.id || '';
  document.getElementById('task-title-input').value = task?.title || '';
  document.getElementById('task-desc-input').value = task?.description || '';
  document.getElementById('task-status-input').value = task?.status || 'todo';
  document.getElementById('task-priority-input').value = task?.priority || 'medium';
  document.getElementById('task-due-input').value = task?.due_date ? task.due_date.split('T')[0] : '';
  hideError('task-modal-error');

  // Populate assignee dropdown
  const assigneeSelect = document.getElementById('task-assignee-input');
  assigneeSelect.innerHTML = '<option value="">Unassigned</option>' +
    allUsers.map(u => `<option value="${u.id}" ${task?.assignee_id == u.id ? 'selected' : ''}>${escHtml(u.name)}</option>`).join('');

  openModal('modal-task');
}

document.getElementById('save-task-btn').addEventListener('click', async () => {
  const id = document.getElementById('task-id-input').value;
  const title = document.getElementById('task-title-input').value.trim();
  const description = document.getElementById('task-desc-input').value.trim();
  const status = document.getElementById('task-status-input').value;
  const priority = document.getElementById('task-priority-input').value;
  const due_date = document.getElementById('task-due-input').value || null;
  const assignee_id = document.getElementById('task-assignee-input').value || null;

  if (!title) return showError('task-modal-error', 'Task title is required');

  try {
    if (id) {
      await apiFetch('/tasks/' + id, { method: 'PUT', body: { title, description, status, priority, due_date, assignee_id } });
      showToast('Task updated!');
    } else {
      await apiFetch('/tasks', { method: 'POST', body: { title, description, status, priority, due_date, assignee_id, project_id: currentProjectId } });
      showToast('Task created!');
    }
    closeModal('modal-task');
    openProjectDetail(currentProjectId);
  } catch (err) {
    showError('task-modal-error', err.message);
  }
});

// Member status update modal
function openStatusModal(task) {
  document.getElementById('status-task-title').textContent = task.title;
  document.getElementById('status-task-id').value = task.id;
  document.getElementById('status-select').value = task.status;
  openModal('modal-status');
}

document.getElementById('save-status-btn').addEventListener('click', async () => {
  const id = document.getElementById('status-task-id').value;
  const status = document.getElementById('status-select').value;
  try {
    await apiFetch('/tasks/' + id, { method: 'PUT', body: { status } });
    closeModal('modal-status');
    showToast('Status updated!');
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ——— TASK RENDERING ———

function renderTaskList(containerId, tasks) {
  const container = document.getElementById(containerId);
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">◻</div><div class="empty-state-text">No tasks here</div></div>`;
    return;
  }

  const isAdmin = currentUser?.role === 'admin';

  container.innerHTML = tasks.map(task => {
    const overdueClass = isOverdue(task) ? ' overdue' : '';
    const statusBadge = isOverdue(task)
      ? `<span class="task-badge badge-overdue">Overdue</span>`
      : `<span class="task-badge badge-${task.status}">${formatStatus(task.status)}</span>`;

    const adminActions = isAdmin ? `
      <button class="task-action-btn" data-action="edit" data-id="${task.id}">Edit</button>
      <button class="task-action-btn danger" data-action="delete" data-id="${task.id}">Delete</button>
    ` : `
      ${task.assignee_id == currentUser.id ? `<button class="task-action-btn" data-action="status" data-id="${task.id}">Update Status</button>` : ''}
    `;

    return `
      <div class="task-card${overdueClass}" data-task-id="${task.id}">
        <div class="task-priority-dot ${task.priority}"></div>
        <div class="task-main">
          <div class="task-title">${escHtml(task.title)}</div>
          <div class="task-meta">
            ${task.project_name ? `<span>◫ ${escHtml(task.project_name)}</span>` : ''}
            ${task.assignee_name ? `<span>◉ ${escHtml(task.assignee_name)}</span>` : '<span>Unassigned</span>'}
            ${task.due_date ? `<span>⊙ ${formatDate(task.due_date)}</span>` : ''}
          </div>
        </div>
        ${statusBadge}
        <div class="task-actions">${adminActions}</div>
      </div>
    `;
  }).join('');

  // Bind action buttons
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const task = tasks.find(t => t.id == btn.dataset.id);
      if (task) openTaskModal(task);
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Delete this task?')) return;
      try {
        await apiFetch('/tasks/' + btn.dataset.id, { method: 'DELETE' });
        showToast('Task deleted');
        if (currentProjectId) openProjectDetail(currentProjectId);
        else loadDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('[data-action="status"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const task = tasks.find(t => t.id == btn.dataset.id);
      if (task) openStatusModal(task);
    });
  });
}

function formatStatus(s) {
  return { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[s] || s;
}

// ——— USERS ———

async function loadUsers() {
  try {
    const users = await apiFetch('/users');
    const container = document.getElementById('users-list');
    container.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escHtml(u.name)}</td>
              <td>${escHtml(u.email)}</td>
              <td><span class="role-badge ${u.role}">${u.role}</span></td>
              <td>${formatDate(u.created_at)}</td>
              <td>
                ${u.id !== currentUser.id ? `
                  <button class="task-action-btn" data-action="toggle-role" data-id="${u.id}" data-role="${u.role}">
                    Make ${u.role === 'admin' ? 'Member' : 'Admin'}
                  </button>
                ` : '<span style="color:var(--text-muted);font-size:12px">You</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newRole = btn.dataset.role === 'admin' ? 'member' : 'admin';
        try {
          await apiFetch('/users/' + btn.dataset.id + '/role', { method: 'PUT', body: { role: newRole } });
          showToast('Role updated');
          loadUsers();
          allUsers = await apiFetch('/users');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast('Failed to load users', 'error');
  }
}

// ——— MODALS ———

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
    if (modalId) closeModal(modalId);
  });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ——— SECURITY: HTML ESCAPING ———
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ——— APP STARTUP ———

async function startup() {
  const token = getToken();
  if (!token) { showScreen('auth'); return; }

  try {
    // Verify token is still valid
    const me = await apiFetch('/users/me');
    currentUser = me;
    showScreen('app');
    initApp();
  } catch (_) {
    clearToken();
    showScreen('auth');
  }
}

startup();
