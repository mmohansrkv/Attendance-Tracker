const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const { pool, initDb } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // needed on Render so secure cookies work

app.use(session({
  store: new pgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

/* ---------- AUTH ---------- */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const result = await pool.query(
    `SELECT username, password, name, role FROM users WHERE lower(username) = lower($1)`,
    [username]
  );
  const user = result.rows[0];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  req.session.user = { username: user.username, name: user.name, role: user.role };
  res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

/* ---------- LISTS ---------- */
app.get('/api/lists', requireLogin, async (req, res) => {
  const result = await pool.query(`SELECT key, data FROM lists`);
  const out = { bands: [], processes: [], employees: [] };
  result.rows.forEach(r => { out[r.key] = r.data; });
  res.json(out);
});

app.post('/api/lists/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  if (!['bands', 'processes', 'employees'].includes(key)) return res.status(400).json({ error: 'Invalid list' });
  const { item } = req.body || {};
  if (!item) return res.status(400).json({ error: 'Missing item' });
  const result = await pool.query(`SELECT data FROM lists WHERE key = $1`, [key]);
  const data = result.rows[0] ? result.rows[0].data : [];
  data.push(item);
  await pool.query(
    `INSERT INTO lists (key, data) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET data = $2`,
    [key, JSON.stringify(data)]
  );
  res.json(data);
});

app.delete('/api/lists/:key/:index', requireAdmin, async (req, res) => {
  const { key, index } = req.params;
  if (!['bands', 'processes', 'employees'].includes(key)) return res.status(400).json({ error: 'Invalid list' });
  const result = await pool.query(`SELECT data FROM lists WHERE key = $1`, [key]);
  const data = result.rows[0] ? result.rows[0].data : [];
  const i = parseInt(index, 10);
  if (i < 0 || i >= data.length) return res.status(404).json({ error: 'Not found' });
  data.splice(i, 1);
  await pool.query(`UPDATE lists SET data = $2 WHERE key = $1`, [key, JSON.stringify(data)]);
  res.json(data);
});

/* ---------- RECORDS ---------- */
app.get('/api/records', requireLogin, async (req, res) => {
  let result;
  if (req.session.user.role === 'admin') {
    result = await pool.query(`SELECT id, data FROM records ORDER BY date DESC NULLS LAST`);
  } else {
    result = await pool.query(
      `SELECT id, data FROM records WHERE submitted_by_username = $1 ORDER BY date DESC NULLS LAST`,
      [req.session.user.username]
    );
  }
  res.json(result.rows.map(r => ({ id: r.id, ...r.data })));
});

app.post('/api/records', requireLogin, async (req, res) => {
  const rec = req.body || {};
  const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const fullRec = {
    ...rec,
    submittedBy: req.session.user.name,
    submittedByUsername: req.session.user.username,
    submittedAt: new Date().toISOString()
  };
  await pool.query(
    `INSERT INTO records (id, submitted_by_username, date, data) VALUES ($1,$2,$3,$4)`,
    [id, req.session.user.username, rec.date || null, JSON.stringify(fullRec)]
  );
  res.json({ id, ...fullRec });
});

app.put('/api/records/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const rec = req.body || {};
  const result = await pool.query(`UPDATE records SET data = $2, date = $3 WHERE id = $1 RETURNING id, data`,
    [id, JSON.stringify(rec), rec.date || null]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ id: result.rows[0].id, ...result.rows[0].data });
});

app.delete('/api/records/:id', requireAdmin, async (req, res) => {
  await pool.query(`DELETE FROM records WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/records/export.csv', requireAdmin, async (req, res) => {
  const result = await pool.query(`SELECT data FROM records ORDER BY date DESC NULLS LAST`);
  const headers = ["Date","Band","Emp_Id","Emp_Name","Process","Description","Process_1","Description_1","Process_2","Description_2","Other","Hr","Description","Submitted By"];
  const csvCell = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(',')];
  result.rows.forEach(({ data: r }) => {
    lines.push([r.date, r.band, r.empId, r.empName, r.process, r.description, r.process1, r.description1, r.process2, r.description2, r.other, r.hr, r.otherDescription, r.submittedBy].map(csvCell).join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="productivity_tracker_export_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(lines.join('\n'));
});

/* ---------- USERS (admin only) ---------- */
app.get('/api/users', requireAdmin, async (req, res) => {
  const result = await pool.query(`SELECT username, name, role FROM users ORDER BY username`);
  res.json(result.rows);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !name || !password) return res.status(400).json({ error: 'Missing fields' });
  const check = await pool.query(`SELECT 1 FROM users WHERE lower(username) = lower($1)`, [username]);
  if (check.rowCount > 0) return res.status(409).json({ error: 'Username already exists' });
  await pool.query(`INSERT INTO users (username, password, name, role) VALUES ($1,$2,$3,'user')`, [username, password, name]);
  res.json({ username, name, role: 'user' });
});

app.put('/api/users/:username', requireAdmin, async (req, res) => {
  const { username } = req.params;
  const { name, password } = req.body || {};
  await pool.query(`UPDATE users SET name = $2, password = $3 WHERE username = $1`, [username, name, password]);
  res.json({ ok: true });
});

app.delete('/api/users/:username', requireAdmin, async (req, res) => {
  if (req.params.username === 'Mobius365') return res.status(400).json({ error: 'Cannot delete the default admin' });
  await pool.query(`DELETE FROM users WHERE username = $1`, [req.params.username]);
  res.json({ ok: true });
});

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Mobius365 Productivity Tracker running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
