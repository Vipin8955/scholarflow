/**
 * ScholarFlow Standalone Single-Page Application (SPA)
 * 100% Native Publishing Platform Logic (Zero OJS Dependency)
 */

const App = {
  state: {
    token: localStorage.getItem('sf_access_token') || null,
    user: JSON.parse(localStorage.getItem('sf_user') || 'null'),
    currentManuscript: null,
    selectedColor: 'yellow',
    selectedRange: null,
    selectedText: '',
    selectedParagraphId: null,
    activeReaderTab: 'annotations',
  },

  apiBase: '/api/v2',

  init() {
    this.bindEvents();
    if (this.state.token && this.state.user) {
      this.verifyAuth();
    } else {
      this.showView('landing');
      this.renderNav();
    }
  },

  bindEvents() {
    // Navigation brand click
    document.getElementById('nav-brand')?.addEventListener('click', () => {
      if (this.state.user) {
        this.showView('dashboard');
        this.loadDashboardData();
      } else {
        this.showView('landing');
      }
    });

    // Color picker
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.selectedColor = btn.dataset.color || 'yellow';
      });
    });

    // Document selection listener for reader annotations
    const docContainer = document.getElementById('doc-content-body');
    if (docContainer) {
      docContainer.addEventListener('mouseup', () => this.handleTextSelection());
    }
  },

  // ── Views Management ──
  showView(viewName) {
    document.querySelectorAll('.sf-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active');
    }
    this.renderNav();
  },

  renderNav() {
    const nav = document.getElementById('nav-actions');
    if (!nav) return;

    if (this.state.user) {
      const primaryRole = (this.state.user.roles && this.state.user.roles[0]) ? this.state.user.roles[0].role_name : 'author';
      nav.innerHTML = `
        <span class="sf-role-pill">${primaryRole.replace('_', ' ')}</span>
        <span style="font-size:13.5px; font-weight:600; color:#e2e8f0;">${this.escapeHtml(this.state.user.full_name)}</span>
        <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.handleLogout()">Sign Out</button>
      `;
    } else {
      nav.innerHTML = `
        <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.openAuthModal('login')">Sign In</button>
        <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.openAuthModal('register')">Create Account</button>
      `;
    }
  },

  toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerText = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // ── API Wrapper ──
  async api(endpoint, method = 'GET', data = null, isFormData = false) {
    const headers = {};
    if (this.state.token) {
      headers['Authorization'] = `Bearer ${this.state.token}`;
    }
    if (!isFormData && data) {
      headers['Content-Type'] = 'application/json';
    }

    const options = {
      method,
      headers
    };

    if (data) {
      options.body = isFormData ? data : JSON.stringify(data);
    }

    try {
      const res = await fetch(`${this.apiBase}${endpoint}`, options);
      if (res.status === 401) {
        this.handleLogout();
        throw new Error('Session expired. Please log in again.');
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || json.message || 'API request failed');
      }
      return json;
    } catch (err) {
      this.toast(err.message, 'error');
      throw err;
    }
  },

  // ── Authentication ──
  async verifyAuth() {
    try {
      const user = await this.api('/auth/me');
      this.state.user = user;
      localStorage.setItem('sf_user', JSON.stringify(user));
      this.showView('dashboard');
      this.loadDashboardData();
    } catch {
      this.handleLogout();
    }
  },

  openAuthModal(tab = 'login') {
    this.switchAuthTab(tab);
    document.getElementById('modal-auth')?.classList.add('active');
  },

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    document.getElementById(`tab-${tab}-btn`)?.classList.add('active');
    document.getElementById(`form-${tab}`)?.classList.add('active');
  },

  prefillLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const res = await this.api('/auth/login', 'POST', { username, password });
      this.state.token = res.access_token;
      this.state.user = res.user;
      localStorage.setItem('sf_access_token', res.access_token);
      localStorage.setItem('sf_user', JSON.stringify(res.user));

      this.closeModals();
      this.toast(`Authenticated successfully as ${res.user.full_name}`);
      this.showView('dashboard');
      this.loadDashboardData();
    } catch {}
  },

  async handleRegister(e) {
    e.preventDefault();
    const data = {
      username: document.getElementById('reg-username').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      full_name: document.getElementById('reg-fullname').value.trim(),
      affiliation: document.getElementById('reg-affiliation').value.trim(),
      role: document.getElementById('reg-role').value,
      interests: document.getElementById('reg-interests').value.trim()
    };

    try {
      await this.api('/auth/register', 'POST', data);
      this.toast('Account registered! You may now sign in.');
      this.switchAuthTab('login');
      this.prefillLogin(data.username, data.password);
    } catch {}
  },

  handleLogout() {
    this.state.token = null;
    this.state.user = null;
    localStorage.removeItem('sf_access_token');
    localStorage.removeItem('sf_user');
    this.showView('landing');
    this.toast('Signed out from ScholarFlow.');
  },

  closeModals() {
    document.querySelectorAll('.sf-modal-overlay').forEach(m => m.classList.remove('active'));
  },

  // ── Dashboards ──
  async loadDashboardData() {
    if (!this.state.user) return;
    const roles = (this.state.user.roles || []).map(r => r.role_name);
    const primaryRole = roles[0] || 'author';

    const roleBadge = document.getElementById('dash-user-role-badge');
    const welcome = document.getElementById('dash-welcome-text');
    const desc = document.getElementById('dash-role-description');
    const actions = document.getElementById('dash-primary-actions');
    const content = document.getElementById('dash-role-content');

    roleBadge.innerText = primaryRole.replace('_', ' ').toUpperCase();
    welcome.innerText = `Welcome, ${this.state.user.full_name}`;

    if (roles.includes('super_admin')) {
      desc.innerText = 'Platform Administrator: Manage hosted journals, user privileges, and editorial workflows.';
      actions.innerHTML = `
        <button class="sf-btn sf-btn-primary" onclick="App.openCreateJournalModal()">+ Establish New Journal</button>
      `;
      await this.renderSuperAdminDashboard(content);
    } else if (roles.includes('associate_editor')) {
      desc.innerText = 'Associate Editor: Manage editorial submissions, AI triage, peer reviewer assignments, and publication decisions.';
      actions.innerHTML = `
        <span class="sf-role-pill">Editorial Authority</span>
      `;
      await this.renderEditorDashboard(content);
    } else if (roles.includes('reviewer')) {
      desc.innerText = 'Peer Reviewer: Evaluate assigned manuscripts, annotate drafts, and submit academic feedback.';
      actions.innerHTML = `
        <span class="sf-role-pill">Active Reviewer</span>
      `;
      await this.renderReviewerDashboard(content);
    } else {
      // Author
      desc.innerText = 'Author Portal: Track your research submissions through editorial triage and double-blind peer review.';
      actions.innerHTML = `
        <button class="sf-btn sf-btn-primary" onclick="App.openSubmissionModal()">+ Submit New Manuscript</button>
      `;
      await this.renderAuthorDashboard(content);
    }
  },

  // 1. Super Admin Dashboard
  async renderSuperAdminDashboard(container) {
    container.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Loading platform metrics...</p></div>`;
    try {
      const [journals, manuscripts, users] = await Promise.all([
        this.api('/journals'),
        this.api('/manuscripts'),
        this.api('/auth/users')
      ]);

      container.innerHTML = `
        <div class="sf-stats-row">
          <div class="sf-stat-card">
            <div class="sf-stat-icon">🏛️</div>
            <div>
              <div class="sf-stat-val">${journals.length}</div>
              <div class="sf-stat-label">Hosted Journals</div>
            </div>
          </div>
          <div class="sf-stat-card">
            <div class="sf-stat-icon">📄</div>
            <div>
              <div class="sf-stat-val">${manuscripts.length}</div>
              <div class="sf-stat-label">Total Manuscripts</div>
            </div>
          </div>
          <div class="sf-stat-card">
            <div class="sf-stat-icon">👥</div>
            <div>
              <div class="sf-stat-val">${users.length}</div>
              <div class="sf-stat-label">Registered Scholars</div>
            </div>
          </div>
        </div>

        <div class="sf-panel">
          <div class="sf-panel-header">
            <h3>Hosted Academic Journals</h3>
            <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.openCreateJournalModal()">+ New Journal</button>
          </div>
          <table class="sf-table">
            <thead>
              <tr>
                <th>Acronym</th>
                <th>Journal Name</th>
                <th>Path</th>
                <th>ISSN</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${journals.map(j => `
                <tr>
                  <td><strong>${this.escapeHtml(j.acronym)}</strong></td>
                  <td>${this.escapeHtml(j.title)}</td>
                  <td><code>/${this.escapeHtml(j.path)}</code></td>
                  <td>${this.escapeHtml(j.issn || 'N/A')}</td>
                  <td><span class="sf-status-tag status-accepted">Active</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="sf-panel">
          <div class="sf-panel-header">
            <h3>All Platform Submissions</h3>
          </div>
          ${this.renderManuscriptsTable(manuscripts, true)}
        </div>
      `;
    } catch {}
  },

  // 2. Associate Editor Dashboard
  async renderEditorDashboard(container) {
    container.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Loading editorial queue...</p></div>`;
    try {
      const manuscripts = await this.api('/manuscripts');
      container.innerHTML = `
        <div class="sf-panel">
          <div class="sf-panel-header">
            <h3>Active Editorial Queue (${manuscripts.length})</h3>
          </div>
          ${this.renderManuscriptsTable(manuscripts, true)}
        </div>
      `;
    } catch {}
  },

  // 3. Author Dashboard (Strict Isolation!)
  async renderAuthorDashboard(container) {
    container.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Loading your submissions...</p></div>`;
    try {
      const manuscripts = await this.api('/manuscripts');
      if (manuscripts.length === 0) {
        container.innerHTML = `
          <div class="sf-panel" style="text-align:center; padding: 60px 20px;">
            <div style="font-size:48px; margin-bottom:14px;">📝</div>
            <h3 style="font-size:20px; font-weight:800; color:#fff; margin-bottom:8px;">No Manuscripts Submitted Yet</h3>
            <p style="color:#94a3b8; font-size:14px; max-width:500px; margin:0 auto 24px auto;">
              Begin your academic publication journey by submitting your research paper to one of our hosted peer-reviewed journals.
            </p>
            <button class="sf-btn sf-btn-primary sf-btn-lg" onclick="App.openSubmissionModal()">+ Submit First Manuscript</button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="sf-panel">
            <div class="sf-panel-header">
              <h3>My Submitted Manuscripts (${manuscripts.length})</h3>
              <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.openSubmissionModal()">+ Start New Submission</button>
            </div>
            ${this.renderManuscriptsTable(manuscripts, false)}
          </div>
        `;
      }
    } catch {}
  },

  // 4. Reviewer Dashboard
  async renderReviewerDashboard(container) {
    container.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Loading assigned reviews...</p></div>`;
    try {
      const assignments = await this.api('/reviews/my-assignments');
      if (assignments.length === 0) {
        container.innerHTML = `
          <div class="sf-panel" style="text-align:center; padding: 60px 20px;">
            <div style="font-size:48px; margin-bottom:14px;">🎯</div>
            <h3 style="font-size:20px; font-weight:800; color:#fff; margin-bottom:8px;">No Pending Review Invitations</h3>
            <p style="color:#94a3b8; font-size:14px; max-width:500px; margin:0 auto;">
              When associate editors match your declared research expertise to a new submission, peer review invitations will appear here.
            </p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="sf-panel">
            <div class="sf-panel-header">
              <h3>Manuscripts Assigned for Review (${assignments.length})</h3>
            </div>
            <table class="sf-table">
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Journal</th>
                  <th>Assignment Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${assignments.map(a => `
                  <tr>
                    <td>
                      <strong>${this.escapeHtml(a.manuscript_title)}</strong>
                    </td>
                    <td>${this.escapeHtml(a.journal_title)}</td>
                    <td><span class="sf-status-tag status-${a.status}">${a.status}</span></td>
                    <td>
                      ${a.status === 'assigned' ? `
                        <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.respondReview(${a.id}, 'accepted')">Accept</button>
                        <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.respondReview(${a.id}, 'declined')">Decline</button>
                      ` : `
                        <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.openReader(${a.manuscript_id})">Open Reader &amp; Annotate</button>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch {}
  },

  renderManuscriptsTable(manuscripts, isEditorial = false) {
    if (!manuscripts || manuscripts.length === 0) {
      return `<p style="padding:20px; color:#94a3b8;">No manuscripts found in this view.</p>`;
    }

    return `
      <table class="sf-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Journal</th>
            ${isEditorial ? '<th>Author</th>' : ''}
            <th>Status</th>
            <th>Files</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${manuscripts.map(m => `
            <tr>
              <td><code>#${m.id}</code></td>
              <td><strong>${this.escapeHtml(m.title)}</strong></td>
              <td>${this.escapeHtml(m.journal_title || 'General')}</td>
              ${isEditorial ? `<td>${this.escapeHtml(m.author_name || 'Anonymous')}</td>` : ''}
              <td><span class="sf-status-tag status-${m.status}">${m.status.replace('_', ' ')}</span></td>
              <td>${m.files_count > 0 ? `📄 ${m.files_count} file(s)` : 'None'}</td>
              <td>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                  <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.openReader(${m.id})">Read &amp; Annotate</button>
                  ${isEditorial ? `
                    <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.openAiScreenModal(${m.id}, '${this.escapeHtml(m.title)}')">🤖 Pre-Screen</button>
                    <button class="sf-btn sf-btn-sm sf-btn-secondary" onclick="App.openReviewerMatchModal(${m.id}, '${this.escapeHtml(m.title)}')">🎯 Match Reviewers</button>
                    <button class="sf-btn sf-btn-sm sf-btn-primary" onclick="App.openDecisionModal(${m.id}, '${this.escapeHtml(m.title)}')">⚖️ Decision</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  // ── Author Submission Wizard ──
  async openSubmissionModal() {
    const modal = document.getElementById('modal-submission');
    const select = document.getElementById('sub-journal');
    select.innerHTML = '<option value="">Loading journals...</option>';

    try {
      const journals = await this.api('/journals');
      select.innerHTML = journals.map(j => `
        <option value="${j.id}">${this.escapeHtml(j.title)} (${j.acronym})</option>
      `).join('');
      modal.classList.add('active');
    } catch {}
  },

  async handleSubmitManuscript(e) {
    e.preventDefault();
    const journalId = parseInt(document.getElementById('sub-journal').value);
    const title = document.getElementById('sub-title').value.trim();
    const abstract = document.getElementById('sub-abstract').value.trim();
    const keywords = document.getElementById('sub-keywords').value.trim();
    const fileInput = document.getElementById('sub-file');

    if (!fileInput.files || fileInput.files.length === 0) {
      this.toast('Please select a PDF or DOCX file to upload.', 'error');
      return;
    }

    try {
      // 1. Create Manuscript record
      const mRes = await this.api('/manuscripts', 'POST', {
        journal_id: journalId,
        title,
        abstract,
        keywords,
        co_authors: []
      });

      const manuscriptId = mRes.manuscript_id;

      // 2. Upload primary file
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);

      await this.api(`/manuscripts/${manuscriptId}/files`, 'POST', formData, true);

      this.closeModals();
      this.toast(`Manuscript #${manuscriptId} successfully submitted!`);
      this.loadDashboardData();
    } catch (err) {
      this.toast(`Submission failed: ${err.message}`, 'error');
    }
  },

  // ── Document Reader & Annotations ──
  async openReader(manuscriptId) {
    this.state.currentManuscript = manuscriptId;
    this.showView('reader');

    const titleEl = document.getElementById('reader-paper-title');
    const idEl = document.getElementById('reader-paper-id');
    const bodyEl = document.getElementById('doc-content-body');

    idEl.innerText = `#${manuscriptId}`;
    titleEl.innerText = 'Loading manuscript...';
    bodyEl.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Rendering document with paragraph tags...</p></div>`;

    try {
      const doc = await this.api(`/manuscripts/${manuscriptId}/document`);
      titleEl.innerText = doc.title;
      bodyEl.innerHTML = doc.rendered.html || '<p>No content available for this manuscript.</p>';
      
      // Render existing annotations
      this.renderAnnotations(doc.annotations || []);
    } catch (err) {
      bodyEl.innerHTML = `<p style="color:#ef4444; padding:20px;">Failed to load document: ${err.message}</p>`;
    }
  },

  closeReader() {
    this.state.currentManuscript = null;
    this.showView('dashboard');
    this.loadDashboardData();
  },

  switchReaderTab(tab) {
    this.state.activeReaderTab = tab;
    document.querySelectorAll('.sf-sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sf-sidebar-tab-content').forEach(c => c.classList.remove('active'));

    const btn = Array.from(document.querySelectorAll('.sf-sidebar-tabs .tab-btn')).find(b => b.innerText.toLowerCase().includes(tab));
    btn?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.add('active');
  },

  handleTextSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;

    const text = sel.toString().trim();
    if (text.length < 2) return;

    this.state.selectedText = text;
    this.state.selectedRange = sel.getRangeAt(0);

    // Find closest paragraph ID
    let node = sel.anchorNode;
    let pid = null;
    while (node && node !== document.getElementById('doc-content-body')) {
      if (node.getAttribute && node.getAttribute('data-pid')) {
        pid = node.getAttribute('data-pid');
        break;
      }
      node = node.parentNode;
    }
    this.state.selectedParagraphId = pid;

    const preview = document.getElementById('selected-text-preview');
    if (preview) {
      preview.innerText = `"${text.length > 100 ? text.substring(0, 100) + '...' : text}"`;
    }
    this.switchReaderTab('annotations');
  },

  async saveAnnotation() {
    if (!this.state.currentManuscript) return;
    const comment = document.getElementById('comment-input').value.trim();
    if (!comment) {
      this.toast('Please write a comment or critique note.', 'error');
      return;
    }

    const isConfidential = document.getElementById('confidential-check')?.checked || false;

    try {
      const res = await this.api(`/manuscripts/${this.state.currentManuscript}/annotations`, 'POST', {
        selected_text: this.state.selectedText || 'General Paragraph Note',
        comment,
        color: this.state.selectedColor,
        paragraph_id: this.state.selectedParagraphId,
        confidential_to_editor: isConfidential
      });

      // Highlight in document if range available
      if (this.state.selectedRange) {
        const span = document.createElement('span');
        span.className = `highlight-${this.state.selectedColor}`;
        try {
          this.state.selectedRange.surroundContents(span);
        } catch {}
      }

      document.getElementById('comment-input').value = '';
      this.toast('Annotation saved.');

      // Refresh annotations list
      const annots = await this.api(`/manuscripts/${this.state.currentManuscript}/annotations`);
      this.renderAnnotations(annots);
    } catch {}
  },

  renderAnnotations(annots) {
    const container = document.getElementById('annots-list-container');
    const countEl = document.getElementById('annots-count');
    if (countEl) countEl.innerText = annots.length;

    if (!container) return;

    if (annots.length === 0) {
      container.innerHTML = `<p style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No annotations yet on this paper.</p>`;
      return;
    }

    container.innerHTML = annots.map(a => `
      <div class="sf-annot-card">
        <div class="sf-annot-card-header">
          <span class="sf-annot-user">${this.escapeHtml(a.user_name)}</span>
          <span class="sf-annot-role">${a.user_role}</span>
        </div>
        <div class="sf-annot-quote" style="border-left-color:${a.color};">
          "${this.escapeHtml(a.selected_text)}"
        </div>
        <div class="sf-annot-comment">
          ${this.escapeHtml(a.comment)}
        </div>
        ${(this.state.user && (this.state.user.id === a.user_id || this.state.user.roles.some(r => ['super_admin', 'associate_editor'].includes(r.role_name)))) ? `
          <button class="sf-annot-delete" onclick="App.deleteAnnotation(${a.id})">Delete Note</button>
        ` : ''}
      </div>
    `).join('');
  },

  async deleteAnnotation(annotId) {
    if (!this.state.currentManuscript) return;
    try {
      await this.api(`/manuscripts/${this.state.currentManuscript}/annotations/${annotId}`, 'DELETE');
      this.toast('Annotation deleted.');
      const annots = await this.api(`/manuscripts/${this.state.currentManuscript}/annotations`);
      this.renderAnnotations(annots);
    } catch {}
  },

  exportAnnotations() {
    window.print();
  },

  // ── AI Pre-Screening Modal ──
  async openAiScreenModal(manuscriptId, title) {
    const modal = document.getElementById('modal-ai-screen');
    const titleSub = document.getElementById('screen-paper-title');
    const body = document.getElementById('screen-report-body');
    const statusPill = document.getElementById('screen-status-pill');

    titleSub.innerText = `Manuscript #${manuscriptId}: ${title}`;
    body.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Evaluating scope, methodological rigor, and academic novelty with local Ollama...</p></div>`;
    modal.classList.add('active');

    document.getElementById('btn-screen-match-reviewers').onclick = () => {
      this.closeModals();
      this.openReviewerMatchModal(manuscriptId, title);
    };

    try {
      const res = await this.api(`/manuscripts/${manuscriptId}/screen`, 'POST');
      statusPill.innerText = res.recommendation || 'PROCEED TO PEER REVIEW';
      body.innerHTML = `
        <div style="background:#1e293b; border-radius:10px; padding:20px; line-height:1.7; font-size:14px; color:#e2e8f0; white-space:pre-wrap;">${this.escapeHtml(res.report)}</div>
      `;
    } catch (err) {
      body.innerHTML = `<p style="color:#ef4444; padding:20px;">AI pre-screening failed: ${err.message}</p>`;
    }
  },

  async triggerAiScreeningFromReader() {
    if (!this.state.currentManuscript) return;
    this.openAiScreenModal(this.state.currentManuscript, 'Current Manuscript');
  },

  // ── AI Reviewer Matchmaker ──
  async openReviewerMatchModal(manuscriptId, title) {
    const modal = document.getElementById('modal-ai-match');
    const titleSub = document.getElementById('match-paper-title');
    const body = document.getElementById('match-reviewers-body');

    titleSub.innerText = `Manuscript #${manuscriptId}: ${title}`;
    body.innerHTML = `<div class="sf-loading-state"><div class="sf-spinner"></div><p>Ollama is evaluating candidate reviewers against manuscript abstract...</p></div>`;
    modal.classList.add('active');

    try {
      const res = await this.api(`/manuscripts/${manuscriptId}/recommend-reviewers`, 'POST');
      if (!res.recommendations || res.recommendations.length === 0) {
        body.innerHTML = `<p style="padding:20px; color:#94a3b8;">No registered reviewers available for matchmaking.</p>`;
        return;
      }

      body.innerHTML = res.recommendations.map(r => `
        <div class="reviewer-card">
          <div class="rev-info">
            <h4>${this.escapeHtml(r.name)}</h4>
            <div class="rev-affil">${this.escapeHtml(r.affiliation || 'Academic Institution')} &bull; Active Reviews: ${r.active_reviews}</div>
            <div class="rev-reason">"${this.escapeHtml(r.reason)}"</div>
          </div>
          <div class="rev-score-badge">
            <div class="score-num">${r.score}%</div>
            <div class="score-label">Compatibility</div>
            <button class="sf-btn sf-btn-sm sf-btn-primary" style="margin-top:8px;" onclick="App.assignReviewer(${manuscriptId}, ${r.id})">
              Assign Reviewer
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      body.innerHTML = `<p style="color:#ef4444; padding:20px;">Matchmaking failed: ${err.message}</p>`;
    }
  },

  async assignReviewer(manuscriptId, reviewerId) {
    try {
      await this.api('/reviews/assign', 'POST', {
        manuscript_id: manuscriptId,
        reviewer_id: reviewerId,
        days_to_complete: 21
      });
      this.toast('Reviewer assigned successfully!');
      this.closeModals();
      this.loadDashboardData();
    } catch {}
  },

  async respondReview(assignmentId, decision) {
    try {
      await this.api(`/reviews/${assignmentId}/respond`, 'POST', { decision });
      this.toast(`Review invitation ${decision}.`);
      this.loadDashboardData();
    } catch {}
  },

  async submitPeerReview() {
    if (!this.state.currentManuscript) return;
    const score = parseInt(document.getElementById('review-score').value);
    const recommendation = document.getElementById('review-rec').value;
    const commentsForAuthor = document.getElementById('review-author-comments').value.trim();
    const confidentialComments = document.getElementById('review-editor-comments').value.trim();

    // Look up assignment for current user
    try {
      const myAssignments = await this.api('/reviews/my-assignments');
      const assign = myAssignments.find(a => a.manuscript_id === this.state.currentManuscript);
      if (!assign) {
        throw new Error('No active assignment found for this manuscript.');
      }

      await this.api(`/reviews/${assign.id}/submit`, 'POST', {
        score,
        recommendation,
        comments_for_author: commentsForAuthor,
        confidential_comments: confidentialComments
      });

      this.toast('Review successfully submitted to editorial board!');
      this.closeReader();
    } catch (err) {
      this.toast(`Failed to submit review: ${err.message}`, 'error');
    }
  },

  // ── Editorial Decision Modal ──
  openDecisionModal(manuscriptId, title) {
    const modal = document.getElementById('modal-decision');
    const titleSub = document.getElementById('decision-paper-title');
    titleSub.innerText = `Manuscript #${manuscriptId}: ${title}`;
    modal.dataset.manuscriptId = manuscriptId;
    modal.classList.add('active');
  },

  async handleRecordDecision(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-decision');
    const manuscriptId = parseInt(modal.dataset.manuscriptId);
    const decision = document.getElementById('dec-decision').value;
    const comments = document.getElementById('dec-comments').value.trim();

    try {
      await this.api('/reviews/decision', 'POST', {
        manuscript_id: manuscriptId,
        decision,
        comments
      });
      this.closeModals();
      this.toast('Editorial decision recorded and author notified.');
      this.loadDashboardData();
    } catch {}
  },

  // ── Super Admin Journal Creation ──
  openCreateJournalModal() {
    document.getElementById('modal-journal')?.classList.add('active');
  },

  async handleCreateJournal(e) {
    e.preventDefault();
    const data = {
      title: document.getElementById('j-title').value.trim(),
      path: document.getElementById('j-path').value.trim(),
      acronym: document.getElementById('j-acronym').value.trim(),
      issn: document.getElementById('j-issn').value.trim(),
      description: document.getElementById('j-desc').value.trim()
    };

    try {
      await this.api('/journals', 'POST', data);
      this.closeModals();
      this.toast(`Journal "${data.title}" successfully created!`);
      this.loadDashboardData();
    } catch {}
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
