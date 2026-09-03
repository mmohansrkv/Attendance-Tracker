let CURRENT_USER = null;
let LISTS = { bands: [], processes: [], employees: [] };
let ACTIVE_TAB = 'entry';

async function api(path, options = {}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(s) { return escapeHtml(s); }

/* ---------- LOGIN ---------- */
document.getElementById('login-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  try {
    CURRENT_USER = await api('/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    err.style.display = 'none';
    await enterApp();
  } catch (e2) {
    err.textContent = e2.message || 'Incorrect username or password.';
    err.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async function () {
  await api('/logout', { method: 'POST' });
  CURRENT_USER = null;
  document.getElementById('shell').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-form').reset();
});

async function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  document.getElementById('who-name').textContent = CURRENT_USER.name;
  document.getElementById('who-role').textContent = CURRENT_USER.role === 'admin' ? 'ADMIN' : 'USER';
  LISTS = await api('/lists');
  ACTIVE_TAB = 'entry';
  renderNav();
  renderTab();
}

// Try to resume an existing session on page load
(async function tryResumeSession() {
  try {
    CURRENT_USER = await api('/session');
    await enterApp();
  } catch (e) {
    // not logged in - stay on login screen
  }
})();

/* ---------- NAV ---------- */
function renderNav() {
  const nav = document.getElementById('side-nav');
  const isAdmin = CURRENT_USER.role === 'admin';
  const tabs = [
    ['entry', 'New Entry'],
    ['records', isAdmin ? 'All Records' : 'My Records'],
  ];
  if (isAdmin) { tabs.push(['users', 'Users']); tabs.push(['lists', 'Master Lists']); }
  nav.innerHTML = tabs.map(([key, label]) => `<button data-tab="${key}" class="${ACTIVE_TAB === key ? 'active' : ''}">${label}</button>`).join('');
  nav.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => { ACTIVE_TAB = b.dataset.tab; renderNav(); renderTab(); });
  });
}

async function renderTab() {
  const main = document.getElementById('main-content');
  if (ACTIVE_TAB === 'entry') return renderEntryTab(main);
  if (ACTIVE_TAB === 'records') return renderRecordsTab(main);
  if (ACTIVE_TAB === 'users') return renderUsersTab(main);
  if (ACTIVE_TAB === 'lists') return renderListsTab(main);
}

/* ---------- ENTRY TAB ---------- */
function renderEntryTab(main) {
  const procOptions = LISTS.processes.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  const bandOptions = LISTS.bands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
  const empOptions = LISTS.employees.map(e => `<option value="${escapeHtml(e.id)}">${escapeHtml(e.id)} — ${escapeHtml(e.name)}</option>`).join('');

  main.innerHTML = `
    <h2>New productivity entry</h2>
    <div class="subtext">Logged in as ${escapeHtml(CURRENT_USER.name)}. Fill in today's work log below.</div>
    <div class="card">
      <form id="entry-form">
        <div class="grid3">
          <div class="field"><label>Date</label><input type="date" id="f-date" required></div>
          <div class="field"><label>Band</label><select id="f-band" required><option value="">Select band</option>${bandOptions}</select></div>
          <div class="field"><label>Employee</label><select id="f-empid" required><option value="">Select employee</option>${empOptions}</select></div>
        </div>
        <div class="proc-block">
          <div class="proc-title">Process</div>
          <div class="grid2">
            <div class="field"><label>Process</label><select id="f-process"><option value="">None</option>${procOptions}</select></div>
            <div class="field"><label>Description</label><input type="text" id="f-desc" placeholder="What was done"></div>
          </div>
        </div>
        <div class="proc-block">
          <div class="proc-title">Process 1</div>
          <div class="grid2">
            <div class="field"><label>Process 1</label><select id="f-process1"><option value="">None</option>${procOptions}</select></div>
            <div class="field"><label>Description 1</label><input type="text" id="f-desc1" placeholder="What was done"></div>
          </div>
        </div>
        <div class="proc-block">
          <div class="proc-title">Process 2</div>
          <div class="grid2">
            <div class="field"><label>Process 2</label><select id="f-process2"><option value="">None</option>${procOptions}</select></div>
            <div class="field"><label>Description 2</label><input type="text" id="f-desc2" placeholder="What was done"></div>
          </div>
        </div>
        <div class="proc-block">
          <div class="proc-title">Other</div>
          <div class="grid3">
            <div class="field"><label>Other</label><input type="text" id="f-other" placeholder="Other activity"></div>
            <div class="field"><label>Hr</label><input type="number" id="f-hr" min="0" step="0.25" placeholder="Hours"></div>
            <div class="field"><label>Description</label><input type="text" id="f-other-desc" placeholder="Details"></div>
          </div>
        </div>
        <button class="btn btn-primary" style="width:auto;padding:10px 22px;" type="submit">Save entry</button>
      </form>
    </div>
  `;

  document.getElementById('entry-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const empSel = document.getElementById('f-empid').value;
    const emp = LISTS.employees.find(x => x.id === empSel);
    const rec = {
      date: document.getElementById('f-date').value,
      band: document.getElementById('f-band').value,
      empId: emp ? emp.id : '',
      empName: emp ? emp.name : '',
      process: document.getElementById('f-process').value,
      description: document.getElementById('f-desc').value.trim(),
      process1: document.getElementById('f-process1').value,
      description1: document.getElementById('f-desc1').value.trim(),
      process2: document.getElementById('f-process2').value,
      description2: document.getElementById('f-desc2').value.trim(),
      other: document.getElementById('f-other').value.trim(),
      hr: document.getElementById('f-hr').value,
      otherDescription: document.getElementById('f-other-desc').value.trim()
    };
    try {
      await api('/records', { method: 'POST', body: JSON.stringify(rec) });
      showToast('Entry saved.');
      e.target.reset();
    } catch (err) {
      showToast(err.message || 'Could not save entry.');
    }
  });
}

/* ---------- RECORDS TAB ---------- */
async function renderRecordsTab(main) {
  const isAdmin = CURRENT_USER.role === 'admin';
  main.innerHTML = `<div class="subtext">Loading records…</div>`;
  const rows = await api('/records');

  main.innerHTML = `
    <h2>${isAdmin ? 'All records' : 'My records'}</h2>
    <div class="subtext">${isAdmin ? 'Admin can edit, delete, and export records.' : 'View only — contact your admin for corrections.'}</div>
    <div class="toolbar">
      <span class="pill">${rows.length} record${rows.length === 1 ? '' : 's'}</span>
      ${isAdmin ? `<button class="btn btn-primary" style="width:auto;" id="export-csv">Download CSV</button>` : ``}
    </div>
    ${rows.length === 0 ? `<div class="empty-state">No records yet. Entries submitted from "New Entry" will show up here.</div>` : `
    <div class="table-scroll"><table>
      <thead><tr>
        <th>Date</th><th>Band</th><th>Emp ID</th><th>Emp Name</th>
        <th>Process</th><th>Description</th>
        <th>Process 1</th><th>Description 1</th>
        <th>Process 2</th><th>Description 2</th>
        <th>Other</th><th>Hr</th><th>Description</th>
        <th>Submitted By</th>
        ${isAdmin ? '<th>Actions</th>' : ''}
      </tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr data-id="${r.id}">
            <td>${escapeHtml(r.date || '')}</td>
            <td>${escapeHtml(r.band || '')}</td>
            <td>${escapeHtml(r.empId || '')}</td>
            <td>${escapeHtml(r.empName || '')}</td>
            <td>${escapeHtml(r.process || '')}</td>
            <td>${escapeHtml(r.description || '')}</td>
            <td>${escapeHtml(r.process1 || '')}</td>
            <td>${escapeHtml(r.description1 || '')}</td>
            <td>${escapeHtml(r.process2 || '')}</td>
            <td>${escapeHtml(r.description2 || '')}</td>
            <td>${escapeHtml(r.other || '')}</td>
            <td>${escapeHtml(r.hr || '')}</td>
            <td>${escapeHtml(r.otherDescription || '')}</td>
            <td>${escapeHtml(r.submittedBy || '')}</td>
            ${isAdmin ? `<td class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del="${r.id}">Delete</button>
            </td>` : ''}
          </tr>
        `).join('')}
      </tbody>
    </table></div>`}
  `;

  if (isAdmin) {
    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', () => { window.location.href = '/api/records/export.csv'; });
    main.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openEditRecordModal(rows.find(r => r.id === b.dataset.edit))));
    main.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this record? This cannot be undone.')) return;
      await api('/records/' + b.dataset.del, { method: 'DELETE' });
      showToast('Record deleted.');
      renderTab();
    }));
  }
}

function openEditRecordModal(r) {
  if (!r) return;
  const procOptions = val => LISTS.processes.map(p => `<option value="${escapeHtml(p)}" ${p === val ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('');
  const bandOptions = val => LISTS.bands.map(b => `<option value="${escapeHtml(b)}" ${b === val ? 'selected' : ''}>${escapeHtml(b)}</option>`).join('');
  const empOptions = val => LISTS.employees.map(e => `<option value="${escapeHtml(e.id)}" ${e.id === val ? 'selected' : ''}>${escapeHtml(e.id)} — ${escapeHtml(e.name)}</option>`).join('');

  openModal(`
    <h3>Edit record</h3>
    <form id="edit-record-form">
      <div class="grid3">
        <div class="field"><label>Date</label><input type="date" id="e-date" value="${escapeAttr(r.date || '')}" required></div>
        <div class="field"><label>Band</label><select id="e-band">${bandOptions(r.band)}</select></div>
        <div class="field"><label>Employee</label><select id="e-empid">${empOptions(r.empId)}</select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Process</label><select id="e-process"><option value="">None</option>${procOptions(r.process)}</select></div>
        <div class="field"><label>Description</label><input type="text" id="e-desc" value="${escapeAttr(r.description || '')}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Process 1</label><select id="e-process1"><option value="">None</option>${procOptions(r.process1)}</select></div>
        <div class="field"><label>Description 1</label><input type="text" id="e-desc1" value="${escapeAttr(r.description1 || '')}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Process 2</label><select id="e-process2"><option value="">None</option>${procOptions(r.process2)}</select></div>
        <div class="field"><label>Description 2</label><input type="text" id="e-desc2" value="${escapeAttr(r.description2 || '')}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label>Other</label><input type="text" id="e-other" value="${escapeAttr(r.other || '')}"></div>
        <div class="field"><label>Hr</label><input type="number" step="0.25" id="e-hr" value="${escapeAttr(r.hr || '')}"></div>
        <div class="field"><label>Description</label><input type="text" id="e-other-desc" value="${escapeAttr(r.otherDescription || '')}"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;">
        <button class="btn btn-primary" style="width:auto;" type="submit">Save changes</button>
        <button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>
      </div>
    </form>
  `);

  document.getElementById('cancel-edit').addEventListener('click', closeModal);
  document.getElementById('edit-record-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const empSel = document.getElementById('e-empid').value;
    const emp = LISTS.employees.find(x => x.id === empSel);
    const updated = {
      date: document.getElementById('e-date').value,
      band: document.getElementById('e-band').value,
      empId: emp ? emp.id : '',
      empName: emp ? emp.name : '',
      process: document.getElementById('e-process').value,
      description: document.getElementById('e-desc').value.trim(),
      process1: document.getElementById('e-process1').value,
      description1: document.getElementById('e-desc1').value.trim(),
      process2: document.getElementById('e-process2').value,
      description2: document.getElementById('e-desc2').value.trim(),
      other: document.getElementById('e-other').value.trim(),
      hr: document.getElementById('e-hr').value,
      otherDescription: document.getElementById('e-other-desc').value.trim(),
      submittedBy: r.submittedBy,
      submittedByUsername: r.submittedByUsername,
      submittedAt: r.submittedAt
    };
    await api('/records/' + r.id, { method: 'PUT', body: JSON.stringify(updated) });
    closeModal();
    showToast('Record updated.');
    renderTab();
  });
}

/* ---------- USERS TAB ---------- */
async function renderUsersTab(main) {
  main.innerHTML = `<div class="subtext">Loading users…</div>`;
  const users = await api('/users');
  main.innerHTML = `
    <h2>Users</h2>
    <div class="subtext">Create a login for each employee. They'll sign in with the email/username and password you set here.</div>
    <div class="toolbar">
      <span class="pill">${users.length} user${users.length === 1 ? '' : 's'}</span>
      <button class="btn btn-primary" style="width:auto;" id="add-user-btn">Add user</button>
    </div>
    <div class="table-scroll"><table>
      <thead><tr><th>Username / Email</th><th>Display name</th><th>Role</th><th>Actions</th></tr></thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.name)}</td>
            <td>${u.role === 'admin' ? '<span class="pill">Admin</span>' : '<span class="pill">User</span>'}</td>
            <td class="row-actions">
              <button class="btn btn-ghost btn-sm" data-edit-user="${escapeAttr(u.username)}">Edit</button>
              ${u.username === 'Mobius365' ? '' : `<button class="btn btn-danger btn-sm" data-del-user="${escapeAttr(u.username)}">Delete</button>`}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>
  `;
  document.getElementById('add-user-btn').addEventListener('click', () => openUserModal(null, users));
  main.querySelectorAll('[data-edit-user]').forEach(b => b.addEventListener('click', () => openUserModal(users.find(u => u.username === b.dataset.editUser), users)));
  main.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Remove this user? They will no longer be able to log in.')) return;
    await api('/users/' + encodeURIComponent(b.dataset.delUser), { method: 'DELETE' });
    showToast('User removed.');
    renderTab();
  }));
}

function openUserModal(existing) {
  openModal(`
    <h3>${existing ? 'Edit user' : 'Add user'}</h3>
    <form id="user-form">
      <div class="field">
        <label>Username / Email</label>
        <input type="text" id="u-username" value="${escapeAttr(existing ? existing.username : '')}" placeholder="name@company.mobius365.com" ${existing ? 'readonly' : ''} required>
      </div>
      <div class="field">
        <label>Display name</label>
        <input type="text" id="u-name" value="${escapeAttr(existing ? existing.name : '')}" placeholder="e.g. Mohankumar" required>
        <div class="helptext">This is the name shown in the app and on records — it doesn't need to match the email exactly.</div>
      </div>
      <div class="field">
        <label>Password</label>
        <input type="text" id="u-password" value="" placeholder="${existing ? 'Enter a new password to change it' : 'Set a password'}" ${existing ? '' : 'required'}>
      </div>
      <div style="display:flex;gap:10px;margin-top:6px;">
        <button class="btn btn-primary" style="width:auto;" type="submit">Save</button>
        <button class="btn btn-ghost" type="button" id="cancel-user">Cancel</button>
      </div>
    </form>
  `);
  document.getElementById('cancel-user').addEventListener('click', closeModal);
  document.getElementById('user-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const username = document.getElementById('u-username').value.trim();
    const name = document.getElementById('u-name').value.trim();
    const password = document.getElementById('u-password').value;
    try {
      if (existing) {
        await api('/users/' + encodeURIComponent(existing.username), { method: 'PUT', body: JSON.stringify({ name, password: password || existing.password }) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify({ username, name, password }) });
      }
      closeModal();
      showToast('User saved.');
      renderTab();
    } catch (err) {
      showToast(err.message || 'Could not save user.');
    }
  });
}

/* ---------- MASTER LISTS TAB ---------- */
function renderListsTab(main) {
  main.innerHTML = `
    <h2>Master lists</h2>
    <div class="subtext">These options populate the dropdowns on the entry form.</div>
    <div class="card">
      <h3 style="margin-top:0;">Bands</h3>
      <div id="bands-chips"></div>
      <form id="band-form" style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="new-band" placeholder="Add a band, e.g. Band D" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:3px;">
        <button class="btn btn-primary" style="width:auto;" type="submit">Add</button>
      </form>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Processes</h3>
      <div id="proc-chips"></div>
      <form id="proc-form" style="display:flex;gap:8px;margin-top:8px;">
        <input type="text" id="new-proc" placeholder="Add a process, e.g. Onboarding" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:3px;">
        <button class="btn btn-primary" style="width:auto;" type="submit">Add</button>
      </form>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Employee roster</h3>
      <div class="table-scroll"><table>
        <thead><tr><th>Emp ID</th><th>Emp Name</th><th></th></tr></thead>
        <tbody id="emp-rows"></tbody>
      </table></div>
      <form id="emp-form" style="display:flex;gap:8px;margin-top:12px;">
        <input type="text" id="new-emp-id" placeholder="Emp ID e.g. E003" style="width:140px;padding:8px 10px;border:1px solid var(--line);border-radius:3px;">
        <input type="text" id="new-emp-name" placeholder="Emp Name" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:3px;">
        <button class="btn btn-primary" style="width:auto;" type="submit">Add</button>
      </form>
    </div>
  `;

  function renderChips() {
    document.getElementById('bands-chips').innerHTML = LISTS.bands.map((b, i) => `<span class="list-chip">${escapeHtml(b)}<button data-band-del="${i}">×</button></span>`).join('') || '<span class="helptext">No bands yet.</span>';
    document.getElementById('proc-chips').innerHTML = LISTS.processes.map((p, i) => `<span class="list-chip">${escapeHtml(p)}<button data-proc-del="${i}">×</button></span>`).join('') || '<span class="helptext">No processes yet.</span>';
    document.getElementById('emp-rows').innerHTML = LISTS.employees.map((e, i) => `<tr><td>${escapeHtml(e.id)}</td><td>${escapeHtml(e.name)}</td><td><button class="btn btn-danger btn-sm" data-emp-del="${i}">Delete</button></td></tr>`).join('') || `<tr><td colspan="3" class="helptext">No employees yet.</td></tr>`;

    document.querySelectorAll('[data-band-del]').forEach(b => b.addEventListener('click', async () => { await api('/lists/bands/' + b.dataset.bandDel, { method: 'DELETE' }); LISTS = await api('/lists'); renderChips(); }));
    document.querySelectorAll('[data-proc-del]').forEach(b => b.addEventListener('click', async () => { await api('/lists/processes/' + b.dataset.procDel, { method: 'DELETE' }); LISTS = await api('/lists'); renderChips(); }));
    document.querySelectorAll('[data-emp-del]').forEach(b => b.addEventListener('click', async () => { await api('/lists/employees/' + b.dataset.empDel, { method: 'DELETE' }); LISTS = await api('/lists'); renderChips(); }));
  }
  renderChips();

  document.getElementById('band-form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = document.getElementById('new-band').value.trim();
    if (v) { await api('/lists/bands', { method: 'POST', body: JSON.stringify({ item: v }) }); LISTS = await api('/lists'); renderChips(); e.target.reset(); }
  });
  document.getElementById('proc-form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = document.getElementById('new-proc').value.trim();
    if (v) { await api('/lists/processes', { method: 'POST', body: JSON.stringify({ item: v }) }); LISTS = await api('/lists'); renderChips(); e.target.reset(); }
  });
  document.getElementById('emp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('new-emp-id').value.trim();
    const name = document.getElementById('new-emp-name').value.trim();
    if (id && name) { await api('/lists/employees', { method: 'POST', body: JSON.stringify({ item: { id, name } }) }); LISTS = await api('/lists'); renderChips(); e.target.reset(); }
  });
}

/* ---------- MODAL ---------- */
function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-bg').style.display = 'flex';
}
function closeModal() { document.getElementById('modal-bg').style.display = 'none'; }
document.getElementById('modal-bg').addEventListener('click', function (e) { if (e.target === this) closeModal(); });
