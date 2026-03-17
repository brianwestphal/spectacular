// Todo List — generated from Spectacular spec

class TodoApp {
  constructor() {
    this.currentUser = null;
    this.currentListId = 'inbox';
    this.lists = [];
    this.tasks = [];
    this.currentView = 'tasks';
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    this.searchQuery = '';
    this.focusedTaskId = null;
    this.autoSaveTimer = null;
    
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupOfflineHandling();
    
    // Check for existing auth token
    const token = this.getAuthToken();
    if (token && !this.isTokenExpired(token)) {
      await this.loadUserData();
      this.showMainApp();
    } else {
      this.showAuthScreen();
    }
  }

  // Authentication
  showAuthScreen() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-screen">
        <div class="auth-container">
          <h1>Todo List</h1>
          <form id="auth-form" class="auth-form">
            <input type="email" id="email" placeholder="Email" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit">Sign In</button>
          </form>
          <div class="oauth-options">
            <button id="google-auth" class="oauth-btn google">Sign in with Google</button>
            <button id="apple-auth" class="oauth-btn apple">Sign in with Apple</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('auth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEmailAuth();
    });

    document.getElementById('google-auth').addEventListener('click', () => {
      this.handleOAuthAuth('google');
    });

    document.getElementById('apple-auth').addEventListener('click', () => {
      this.handleOAuthAuth('apple');
    });
  }

  async handleEmailAuth() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
      // Simulate API call
      const response = await this.mockApiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      this.setAuthToken(response.token);
      this.currentUser = response.user;
      await this.loadUserData();
      this.showMainApp();
    } catch (error) {
      this.showError('Authentication failed. Please try again.');
    }
  }

  async handleOAuthAuth(provider) {
    try {
      // Simulate OAuth flow
      const response = await this.mockApiCall(`/auth/${provider}`, {
        method: 'POST'
      });
      
      this.setAuthToken(response.token);
      this.currentUser = response.user;
      await this.loadUserData();
      this.showMainApp();
    } catch (error) {
      this.showError(`${provider} authentication failed. Please try again.`);
    }
  }

  // Token management
  setAuthToken(token) {
    localStorage.setItem('todo_auth_token', JSON.stringify({
      token,
      expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }));
  }

  getAuthToken() {
    const stored = localStorage.getItem('todo_auth_token');
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  isTokenExpired(tokenData) {
    return Date.now() > tokenData.expires;
  }

  // Main app
  showMainApp() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="main-app">
        <header class="app-header">
          <h1 id="current-list-name">Inbox</h1>
          <button id="list-selector" class="list-selector-btn">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M7 10l5 5 5-5z" fill="currentColor"/>
            </svg>
          </button>
        </header>
        
        <main class="app-content">
          <div id="tasks-view" class="view active">
            <div class="search-container">
              <input type="text" id="search-input" placeholder="Search tasks..." class="search-input">
            </div>
            <div class="quick-add">
              <input type="text" id="quick-add-input" placeholder="Add a task..." maxlength="200">
            </div>
            <ul id="task-list" class="task-list" role="list"></ul>
            <button id="detailed-add-btn" class="detailed-add-btn">+ Add Task with Details</button>
          </div>
          
          <div id="lists-view" class="view">
            <div class="lists-header">
              <h2>Lists</h2>
              <button id="add-list-btn" class="add-list-btn">+ Add List</button>
            </div>
            <ul id="lists-list" class="lists-list"></ul>
          </div>
          
          <div id="settings-view" class="view">
            <h2>Settings</h2>
            <div class="settings-content">
              <div class="setting-group">
                <h3>Notifications</h3>
                <label class="setting-item">
                  <input type="checkbox" id="notifications-enabled" checked>
                  <span>Enable notifications</span>
                </label>
                <label class="setting-item">
                  <input type="checkbox" id="quiet-hours-enabled" checked>
                  <span>Quiet hours (10 PM - 7 AM)</span>
                </label>
              </div>
              <div class="setting-group">
                <h3>Account</h3>
                <button id="logout-btn" class="logout-btn">Sign Out</button>
              </div>
            </div>
          </div>
        </main>
        
        <nav class="bottom-nav">
          <button class="nav-item active" data-view="tasks">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" fill="currentColor"/>
            </svg>
            <span>Tasks</span>
          </button>
          <button class="nav-item" data-view="lists">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z" fill="currentColor"/>
            </svg>
            <span>Lists</span>
          </button>
          <button class="nav-item" data-view="settings">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" fill="currentColor"/>
            </svg>
            <span>Settings</span>
          </button>
        </nav>
      </div>
    `;

    this.setupMainAppEventListeners();
    this.loadCurrentList();
    this.renderTasks();
    this.renderLists();
    this.setupNotifications();
  }

  setupMainAppEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.trim();
      this.renderTasks();
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        this.searchQuery = '';
        this.renderTasks();
        e.target.blur();
      }
    });

    // Quick add
    const quickAddInput = document.getElementById('quick-add-input');
    quickAddInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        this.createQuickTask(e.target.value.trim());
        e.target.value = '';
      }
    });

    quickAddInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.target.value = '';
        e.target.blur();
      }
    });

    // Detailed add
    document.getElementById('detailed-add-btn').addEventListener('click', () => {
      this.showTaskForm();
    });

    // List selector
    document.getElementById('list-selector').addEventListener('click', () => {
      this.showListSelector();
    });

    // Add list
    document.getElementById('add-list-btn').addEventListener('click', () => {
      this.showListForm();
    });

    // Settings
    document.getElementById('notifications-enabled').addEventListener('change', (e) => {
      this.updateNotificationSettings('enabled', e.target.checked);
    });

    document.getElementById('quiet-hours-enabled').addEventListener('change', (e) => {
      this.updateNotificationSettings('quietHours', e.target.checked);
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
      this.logout();
    });
  }

  setupEventListeners() {
    // Online/offline handling
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Hash routing
    window.addEventListener('hashchange', () => {
      this.handleHashChange();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only trigger shortcuts when no input is focused
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA') {
        return;
      }

      // Check for Ctrl/Cmd+K for search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          const quickAdd = document.getElementById('quick-add-input');
          if (quickAdd) quickAdd.focus();
          break;
        case 'escape':
          this.handleEscape();
          break;
        case 'delete':
        case 'backspace':
          if (this.focusedTaskId) {
            e.preventDefault();
            this.deleteTask(this.focusedTaskId, true);
          }
          break;
      }
    });
  }

  handleEscape() {
    // Close modals first
    const hasModals = this.closeModals();
    if (hasModals) return;

    // Clear search if active
    const searchInput = document.getElementById('search-input');
    if (searchInput && searchInput.value) {
      searchInput.value = '';
      this.searchQuery = '';
      this.renderTasks();
      searchInput.blur();
      return;
    }

    // Clear quick add if focused
    const quickAddInput = document.getElementById('quick-add-input');
    if (quickAddInput && document.activeElement === quickAddInput) {
      quickAddInput.value = '';
      quickAddInput.blur();
    }
  }

  setupOfflineHandling() {
    // Load offline queue from localStorage
    const stored = localStorage.getItem('todo_offline_queue');
    if (stored) {
      try {
        this.offlineQueue = JSON.parse(stored);
      } catch (e) {
        this.offlineQueue = [];
      }
    }
  }

  // Data management
  async loadUserData() {
    try {
      const [listsResponse, tasksResponse] = await Promise.all([
        this.apiCall('/lists'),
        this.apiCall('/tasks')
      ]);

      this.lists = listsResponse.lists;
      this.tasks = tasksResponse.tasks;

      // Ensure user has inbox list
      if (!this.lists.find(list => list.id === 'inbox')) {
        this.lists.unshift({
          id: 'inbox',
          name: 'Inbox',
          isDefault: true,
          canDelete: false
        });
      }
    } catch (error) {
      // Load from localStorage if API fails
      this.loadFromLocalStorage();
    }
  }

  loadFromLocalStorage() {
    const stored = localStorage.getItem('todo_data');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.lists = data.lists || [{ id: 'inbox', name: 'Inbox', isDefault: true, canDelete: false }];
        this.tasks = data.tasks || [];
      } catch (e) {
        this.lists = [{ id: 'inbox', name: 'Inbox', isDefault: true, canDelete: false }];
        this.tasks = [];
      }
    } else {
      this.lists = [{ id: 'inbox', name: 'Inbox', isDefault: true, canDelete: false }];
      this.tasks = [];
    }
  }

  saveToLocalStorage() {
    localStorage.setItem('todo_data', JSON.stringify({
      lists: this.lists,
      tasks: this.tasks
    }));
  }

  // Navigation
  switchView(viewName) {
    this.currentView = viewName;
    
    // Update nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
    document.getElementById(`${viewName}-view`).classList.add('active');

    // Update hash
    window.location.hash = `#/${viewName}`;
  }

  handleHashChange() {
    const hash = window.location.hash.slice(2); // Remove #/
    const validViews = ['tasks', 'lists', 'settings'];
    
    if (validViews.includes(hash)) {
      this.switchView(hash);
    }
  }

  // Task management
  async createQuickTask(title) {
    const task = {
      id: this.generateId(),
      title,
      listId: this.currentListId,
      completed: false,
      priority: 'low',
      createdAt: new Date().toISOString()
    };

    this.tasks.unshift(task);
    this.renderTasks();
    this.saveToLocalStorage();

    if (this.isOnline) {
      try {
        await this.apiCall('/tasks', {
          method: 'POST',
          body: JSON.stringify(task)
        });
      } catch (error) {
        this.queueOfflineAction('create', 'task', task);
      }
    } else {
      this.queueOfflineAction('create', 'task', task);
    }

    // Add entrance animation
    const taskElement = document.querySelector(`[data-task-id="${task.id}"]`);
    if (taskElement) {
      taskElement.style.animation = 'slideInDown 0.3s ease-out';
    }
  }

  async toggleTaskCompletion(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    
    this.renderTasks();
    this.saveToLocalStorage();

    // Animate checkbox
    const checkbox = document.querySelector(`[data-task-id="${taskId}"] .task-checkbox`);
    if (checkbox && task.completed) {
      checkbox.style.animation = 'checkboxComplete 0.2s ease-out';
    }

    if (this.isOnline) {
      try {
        await this.apiCall(`/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ completed: task.completed, completedAt: task.completedAt })
        });
      } catch (error) {
        this.queueOfflineAction('update', 'task', task);
      }
    } else {
      this.queueOfflineAction('update', 'task', task);
    }
  }

  async deleteTask(taskId, requireConfirmation = false) {
    if (requireConfirmation) {
      if (!confirm('Are you sure you want to delete this task?')) {
        return;
      }
    }

    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.renderTasks();
    this.saveToLocalStorage();

    if (this.isOnline) {
      try {
        await this.apiCall(`/tasks/${taskId}`, { method: 'DELETE' });
      } catch (error) {
        this.queueOfflineAction('delete', 'task', { id: taskId });
      }
    } else {
      this.queueOfflineAction('delete', 'task', { id: taskId });
    }
  }

  showTaskForm(task = null) {
    const isEdit = !!task;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Task' : 'Add Task'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <form id="task-form" class="task-form">
          <input type="text" id="task-title" placeholder="Task title" required maxlength="200" value="${task ? this.escapeHtml(task.title) : ''}">
          <textarea id="task-notes" placeholder="Notes (optional)" maxlength="5000">${task ? this.escapeHtml(task.notes || '') : ''}</textarea>
          <input type="date" id="task-due-date" value="${task && task.dueDate ? task.dueDate.split('T')[0] : ''}">
          <select id="task-priority">
            <option value="low" ${!task || task.priority === 'low' ? 'selected' : ''}>Low Priority</option>
            <option value="medium" ${task && task.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
            <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High Priority</option>
          </select>
          <select id="task-list">
            ${this.lists.map(list => 
              `<option value="${list.id}" ${task && task.listId === list.id || (!task && list.id === this.currentListId) ? 'selected' : ''}>${this.escapeHtml(list.name)}</option>`
            ).join('')}
          </select>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancel-task">Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Create'} Task</button>
          </div>
          ${isEdit ? '<button type="button" class="btn-danger" id="delete-task">Delete Task</button>' : ''}
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('task-title').focus();

    // Auto-save setup for edit mode
    if (isEdit) {
      const inputs = modal.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        input.addEventListener('input', () => {
          this.scheduleAutoSave(task, modal);
        });
      });
    }

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      if (isEdit) this.saveTaskFromForm(task, modal, true);
      document.body.removeChild(modal);
    });

    document.getElementById('cancel-task').addEventListener('click', () => {
      if (isEdit) this.saveTaskFromForm(task, modal, true);
      document.body.removeChild(modal);
    });

    if (isEdit) {
      document.getElementById('delete-task').addEventListener('click', () => {
        this.deleteTask(task.id, true);
        document.body.removeChild(modal);
      });
    }

    document.getElementById('task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveTaskFromForm(task, modal);
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (isEdit) this.saveTaskFromForm(task, modal, true);
        document.body.removeChild(modal);
      }
    });

    // Handle navigation away
    window.addEventListener('beforeunload', () => {
      if (isEdit && document.body.contains(modal)) {
        this.saveTaskFromForm(task, modal, true);
      }
    });
  }

  scheduleAutoSave(task, modal) {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(() => {
      if (document.body.contains(modal)) {
        this.saveTaskFromForm(task, modal, true);
      }
    }, 500);
  }

  async saveTaskFromForm(existingTask = null, modal = null, skipClose = false) {
    const container = modal || document;
    const title = container.getElementById('task-title').value.trim();
    const notes = container.getElementById('task-notes').value.trim();
    const dueDate = container.getElementById('task-due-date').value;
    const priority = container.getElementById('task-priority').value;
    const listId = container.getElementById('task-list').value;

    if (!title) return;

    if (existingTask) {
      // Update existing task
      existingTask.title = title;
      existingTask.notes = notes || null;
      existingTask.dueDate = dueDate || null;
      existingTask.priority = priority;
      existingTask.listId = listId;
      existingTask.updatedAt = new Date().toISOString();
    } else {
      // Create new task
      const newTask = {
        id: this.generateId(),
        title,
        notes: notes || null,
        dueDate: dueDate || null,
        priority,
        listId,
        completed: false,
        createdAt: new Date().toISOString()
      };
      this.tasks.unshift(newTask);
    }

    this.renderTasks();
    this.renderLists(); // Update task counts
    this.saveToLocalStorage();

    // Request notification permission if this is first task with due date
    if (dueDate && !existingTask) {
      this.requestNotificationPermission();
    }

    // Sync with server
    if (this.isOnline) {
      try {
        if (existingTask) {
          await this.apiCall(`/tasks/${existingTask.id}`, {
            method: 'PATCH',
            body: JSON.stringify(existingTask)
          });
        } else {
          await this.apiCall('/tasks', {
            method: 'POST',
            body: JSON.stringify(this.tasks[0])
          });
        }
      } catch (error) {
        this.queueOfflineAction(existingTask ? 'update' : 'create', 'task', 
          existingTask || this.tasks[0]);
      }
    } else {
      this.queueOfflineAction(existingTask ? 'update' : 'create', 'task', 
        existingTask || this.tasks[0]);
    }
  }

  getTasksToDisplay() {
    let tasksToDisplay;
    
    if (this.searchQuery) {
      // When searching, show tasks from all lists
      const query = this.searchQuery.toLowerCase();
      tasksToDisplay = this.tasks.filter(task => {
        const titleMatch = task.title.toLowerCase().includes(query);
        const notesMatch = task.notes && task.notes.toLowerCase().includes(query);
        return titleMatch || notesMatch;
      });
    } else {
      // Normal view: show tasks from current list only
      tasksToDisplay = this.tasks.filter(task => task.listId === this.currentListId);
    }

    return tasksToDisplay;
  }

  renderTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const tasksToDisplay = this.getTasksToDisplay();
    
    // Sort tasks: incomplete first, then by priority, then by due date
    tasksToDisplay.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed - b.completed;
      }
      
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (a.priority !== b.priority) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate) - new Date(b.dueDate);
      } else if (a.dueDate) {
        return -1;
      } else if (b.dueDate) {
        return 1;
      }
      
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    taskList.innerHTML = tasksToDisplay.map(task => {
      const dueDateText = task.dueDate ? this.formatDueDate(task.dueDate) : '';
      const priorityDot = task.priority !== 'low' ? 
        `<span class="priority-dot priority-${task.priority}"></span>` : '';
      
      let taskTitle = this.escapeHtml(task.title);
      let taskNotes = task.notes ? this.escapeHtml(task.notes) : '';
      
      // Highlight search matches
      if (this.searchQuery) {
        const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
        taskTitle = taskTitle.replace(regex, '<mark>$1</mark>');
        if (taskNotes) {
          taskNotes = taskNotes.replace(regex, '<mark>$1</mark>');
        }
      }
      
      // Show list name when searching across all lists
      let listBadge = '';
      if (this.searchQuery) {
        const list = this.lists.find(l => l.id === task.listId);
        if (list) {
          listBadge = `<span class="task-list-badge">${this.escapeHtml(list.name)}</span>`;
        }
      }
      
      return `
        <li class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" tabindex="0">
          <button class="task-checkbox" data-task-id="${task.id}">
            <svg class="checkbox-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/>
            </svg>
          </button>
          <div class="task-content" data-task-id="${task.id}">
            <div class="task-title">${taskTitle}</div>
            ${taskNotes && this.searchQuery ? `<div class="task-notes-preview">${taskNotes.substring(0, 100)}${taskNotes.length > 100 ? '...' : ''}</div>` : ''}
            ${dueDateText ? `<div class="task-due-date">${dueDateText}</div>` : ''}
            ${listBadge}
          </div>
          ${priorityDot}
        </li>
      `;
    }).join('');

    // Add event listeners
    taskList.querySelectorAll('.task-checkbox').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = e.currentTarget.dataset.taskId;
        this.toggleTaskCompletion(taskId);
      });
    });

    taskList.querySelectorAll('.task-content').forEach(content => {
      content.addEventListener('click', () => {
        const taskId = content.dataset.taskId;
        const task = this.tasks.find(t => t.id === taskId);
        this.showTaskForm(task);
      });
    });

    // Keyboard navigation
    taskList.querySelectorAll('.task-item').forEach((item, index) => {
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const taskId = item.dataset.taskId;
          const task = this.tasks.find(t => t.id === taskId);
          this.showTaskForm(task);
        } else if (e.key === 'ArrowDown' && index < taskList.children.length - 1) {
          taskList.children[index + 1].focus();
        } else if (e.key === 'ArrowUp' && index > 0) {
          taskList.children[index - 1].focus();
        }
      });
      
      item.addEventListener('focus', () => {
        this.focusedTaskId = item.dataset.taskId;
      });
      
      item.addEventListener('blur', () => {
        if (this.focusedTaskId === item.dataset.taskId) {
          this.focusedTaskId = null;
        }
      });
    });
  }

  formatDueDate(dueDate) {
    const date = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    return date.toLocaleDateString();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // List management
  loadCurrentList() {
    const list = this.lists.find(l => l.id === this.currentListId);
    if (list) {
      document.getElementById('current-list-name').textContent = list.name;
    }
  }

  showListForm(list = null) {
    const isEdit = !!list;
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit List' : 'Add List'}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <form id="list-form" class="list-form">
          <input type="text" id="list-name" placeholder="List name" required maxlength="50" value="${list ? this.escapeHtml(list.name) : ''}">
          <div class="color-palette">
            <label>Color</label>
            <div class="color-options">
              ${this.getColorOptions().map(color => `
                <button type="button" class="color-option ${!list || list.color === color ? 'selected' : ''}" 
                        data-color="${color}" style="background-color: ${color}">
                  <span class="color-check">✓</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" id="cancel-list">Cancel</button>
            <button type="submit" class="btn-primary">${isEdit ? 'Update' : 'Create'} List</button>
          </div>
          ${isEdit && !list.isDefault ? '<button type="button" class="btn-danger" id="delete-list">Delete List</button>' : ''}
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('list-name').focus();

    // Color selection
    modal.querySelectorAll('.color-option').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    document.getElementById('cancel-list').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    if (isEdit && !list.isDefault) {
      document.getElementById('delete-list').addEventListener('click', () => {
        this.deleteList(list.id);
        document.body.removeChild(modal);
      });
    }

    document.getElementById('list-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveListFromForm(list);
      document.body.removeChild(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  getColorOptions() {
    return ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
  }

  async saveListFromForm(existingList = null) {
    const name = document.getElementById('list-name').value.trim();
    const selectedColorBtn = document.querySelector('.color-option.selected');
    const color = selectedColorBtn ? selectedColorBtn.dataset.color : '#667eea';

    if (!name) return;

    // Validate unique name (case-insensitive)
    const normalizedName = name.toLowerCase().trim();
    const duplicate = this.lists.find(list => 
      list.id !== (existingList?.id) && 
      list.name.toLowerCase().trim() === normalizedName
    );
    
    if (duplicate) {
      this.showError('A list with this name already exists.');
      return;
    }

    if (existingList) {
      // Update existing list
      existingList.name = name;
      existingList.color = color;
      existingList.updatedAt = new Date().toISOString();
    } else {
      // Create new list
      const newList = {
        id: this.generateId(),
        name,
        color,
        isDefault: false,
        canDelete: true,
        createdAt: new Date().toISOString()
      };
      this.lists.push(newList);
    }

    this.renderLists();
    this.loadCurrentList(); // Update header if current list was edited
    this.saveToLocalStorage();

    if (this.isOnline) {
      try {
        const endpoint = existingList ? `/lists/${existingList.id}` : '/lists';
        const method = existingList ? 'PATCH' : 'POST';
        await this.apiCall(endpoint, {
          method,
          body: JSON.stringify(existingList || this.lists[this.lists.length - 1])
        });
      } catch (error) {
        this.queueOfflineAction(existingList ? 'update' : 'create', 'list', 
          existingList || this.lists[this.lists.length - 1]);
      }
    } else {
      this.queueOfflineAction(existingList ? 'update' : 'create', 'list', 
        existingList || this.lists[this.lists.length - 1]);
    }
  }

  showListSelector() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Select List</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="list-selector">
          ${this.lists.map(list => {
            const taskCount = this.tasks.filter(t => t.listId === list.id && !t.completed).length;
            return `
              <button class="list-option ${list.id === this.currentListId ? 'active' : ''}" data-list-id="${list.id}">
                <span class="list-name" style="${list.color ? `color: ${list.color}` : ''}">${this.escapeHtml(list.name)}</span>
                ${taskCount > 0 ? `<span class="task-count">${taskCount}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelectorAll('.list-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const listId = btn.dataset.listId;
        this.switchToList(listId);
        document.body.removeChild(modal);
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  switchToList(listId) {
    this.currentListId = listId;
    this.searchQuery = ''; // Clear search when switching lists
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    
    this.loadCurrentList();
    this.renderTasks();
    
    // Crossfade transition
    const taskList = document.getElementById('task-list');
    if (taskList) {
      taskList.style.animation = 'crossfade 0.2s ease-out';
    }
  }

  renderLists() {
    const listsList = document.getElementById('lists-list');
    if (!listsList) return;

    listsList.innerHTML = this.lists.map(list => {
      const taskCount = this.tasks.filter(t => t.listId === list.id && !t.completed).length;
      return `
        <li class="list-item">
          <div class="list-info" data-list-id="${list.id}">
            <span class="list-name" style="${list.color ? `color: ${list.color}` : ''}">${this.escapeHtml(list.name)}</span>
            ${taskCount > 0 ? `<span class="task-count">${taskCount}</span>` : ''}
          </div>
          <div class="list-actions">
            ${!list.isDefault ? `<button class="list-edit" data-list-id="${list.id}" title="Edit list">Edit</button>` : ''}
            ${list.canDelete ? `<button class="list-delete" data-list-id="${list.id}" title="Delete list">Delete</button>` : ''}
          </div>
        </li>
      `;
    }).join('');

    // Add event listeners
    listsList.querySelectorAll('.list-info').forEach(info => {
      info.addEventListener('click', () => {
        const listId = info.dataset.listId;
        this.switchToList(listId);
        this.switchView('tasks');
      });
    });

    listsList.querySelectorAll('.list-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.dataset.listId;
        const list = this.lists.find(l => l.id === listId);
        this.showListForm(list);
      });
    });

    listsList.querySelectorAll('.list-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const listId = btn.dataset.listId;
        this.deleteList(listId);
      });
    });
  }

  async deleteList(listId) {
    const list = this.lists.find(l => l.id === listId);
    if (!list || list.isDefault || !list.canDelete) return;

    // Block destructive operations while offline
    if (!this.isOnline) {
      this.showError('Cannot delete a list while offline. Please try again when connected.');
      return;
    }

    if (!confirm(`Delete list "${list.name}"? All tasks will be moved to Inbox.`)) {
      return;
    }

    // Move all tasks to inbox
    this.tasks.forEach(task => {
      if (task.listId === listId) {
        task.listId = 'inbox';
      }
    });

    // Remove list
    this.lists = this.lists.filter(l => l.id !== listId);

    // Switch to inbox if current list was deleted
    if (this.currentListId === listId) {
      this.switchToList('inbox');
    }

    this.renderLists();
    this.renderTasks();
    this.saveToLocalStorage();

    try {
      await this.apiCall(`/lists/${listId}`, { method: 'DELETE' });
    } catch (error) {
      this.showError('Failed to delete list. Please try again.');
    }
  }

  // Notifications
  async setupNotifications() {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return;
    }

    // Check existing permission
    if (Notification.permission === 'granted') {
      this.scheduleNotifications();
    }
  }

  async requestNotificationPermission() {
    if (!('Notification' in window) || Notification.permission === 'granted') {
      return;
    }

    // Show banner before requesting permission
    this.showNotificationBanner();
  }

  showNotificationBanner() {
    const banner = document.createElement('div');
    banner.className = 'notification-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <p>Get reminded about your tasks with due dates</p>
        <div class="banner-actions">
          <button id="enable-notifications">Enable Notifications</button>
          <button id="dismiss-banner">Not Now</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('enable-notifications').addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.scheduleNotifications();
      }
      document.body.removeChild(banner);
    });

    document.getElementById('dismiss-banner').addEventListener('click', () => {
      document.body.removeChild(banner);
    });
  }

  scheduleNotifications() {
    // Clear existing timers
    this.clearNotificationTimers();

    const tasksWithDueDates = this.tasks.filter(task => 
      task.dueDate && !task.completed && this.isNotificationEnabled()
    );

    tasksWithDueDates.forEach(task => {
      this.scheduleTaskNotification(task);
    });
  }

  scheduleTaskNotification(task) {
    const dueDate = new Date(task.dueDate);
    const reminderTime = new Date(dueDate);
    reminderTime.setHours(9, 0, 0, 0); // 9 AM on due date

    const now = new Date();
    const timeUntilReminder = reminderTime.getTime() - now.getTime();

    if (timeUntilReminder > 0 && timeUntilReminder < 7 * 24 * 60 * 60 * 1000) { // Within 7 days
      setTimeout(() => {
        this.showNotification(task);
      }, timeUntilReminder);
    }
  }

  showNotification(task) {
    if (!this.isQuietHours() && this.isNotificationEnabled()) {
      const list = this.lists.find(l => l.id === task.listId);
      const notification = new Notification(task.title, {
        body: `Due today - ${list ? list.name : 'Unknown List'}`,
        icon: '/favicon.ico',
        tag: `task-${task.id}`
      });

      notification.onclick = () => {
        window.focus();
        this.showTaskForm(task);
        notification.close();
      };
    }
  }

  isNotificationEnabled() {
    const enabled = document.getElementById('notifications-enabled');
    return enabled ? enabled.checked : true;
  }

  isQuietHours() {
    const enabled = document.getElementById('quiet-hours-enabled');
    if (!enabled || !enabled.checked) return false;

    const now = new Date();
    const hour = now.getHours();
    return hour >= 22 || hour < 7; // 10 PM to 7 AM
  }

  updateNotificationSettings(setting, value) {
    // Save to localStorage
    const settings = JSON.parse(localStorage.getItem('todo_settings') || '{}');
    settings[setting] = value;
    localStorage.setItem('todo_settings', JSON.stringify(settings));

    if (setting === 'enabled' && value) {
      this.scheduleNotifications();
    } else if (setting === 'enabled' && !value) {
      this.clearNotificationTimers();
    }
  }

  clearNotificationTimers() {
    // This would clear any scheduled notification timers
    // For simplicity, we'll rely on the browser's built-in notification management
  }

  // Offline handling
  queueOfflineAction(action, type, data) {
    this.offlineQueue.push({
      id: this.generateId(),
      action,
      type,
      data,
      timestamp: Date.now()
    });
    
    localStorage.setItem('todo_offline_queue', JSON.stringify(this.offlineQueue));
  }

  async processOfflineQueue() {
    const queue = [...this.offlineQueue];
    this.offlineQueue = [];
    localStorage.setItem('todo_offline_queue', JSON.stringify([]));

    for (const item of queue) {
      try {
        await this.processOfflineAction(item);
      } catch (error) {
        console.error('Failed to process offline action:', error);
        // Re-queue if it fails
        this.offlineQueue.push(item);
      }
    }

    if (this.offlineQueue.length > 0) {
      localStorage.setItem('todo_offline_queue', JSON.stringify(this.offlineQueue));
    }
  }

  async processOfflineAction(item) {
    const { action, type, data } = item;
    const endpoint = type === 'task' ? '/tasks' : '/lists';

    switch (action) {
      case 'create':
        await this.apiCall(endpoint, {
          method: 'POST',
          body: JSON.stringify(data)
        });
        break;
      case 'update':
        await this.apiCall(`${endpoint}/${data.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        break;
      case 'delete':
        await this.apiCall(`${endpoint}/${data.id}`, {
          method: 'DELETE'
        });
        break;
    }
  }

  // API helpers
  async apiCall(endpoint, options = {}) {
    return this.mockApiCall(endpoint, options);
  }

  async mockApiCall(endpoint, options = {}) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate auth endpoints
    if (endpoint.startsWith('/auth/')) {
      return {
        token: 'mock-jwt-token',
        user: { id: '1', email: 'user@example.com', name: 'Test User' }
      };
    }

    // Simulate data endpoints
    if (endpoint === '/lists') {
      return { lists: this.lists };
    }
    
    if (endpoint === '/tasks') {
      return { tasks: this.tasks };
    }

    // For other endpoints, just return success
    return { success: true };
  }

  // Utility functions
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  }

  closeModals() {
    const modals = document.querySelectorAll('.modal');
    let hadModals = modals.length > 0;
    
    modals.forEach(modal => {
      if (document.body.contains(modal)) {
        document.body.removeChild(modal);
      }
    });
    
    return hadModals;
  }

  logout() {
    if (confirm('Are you sure you want to sign out?')) {
      localStorage.removeItem('todo_auth_token');
      localStorage.removeItem('todo_data');
      localStorage.removeItem('todo_settings');
      localStorage.removeItem('todo_offline_queue');
      window.location.reload();
    }
  }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TodoApp();
  });
} else {
  new TodoApp();
}