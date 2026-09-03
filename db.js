const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('WARNING: DATABASE_URL is not set. Set it to your Render PostgreSQL connection string.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : (process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false })
});

const SEED_LISTS = {
  bands: ["Band A", "Band B", "Band C"],
  processes: ["Voice Support", "Email Support", "Chat Support", "Back Office", "Quality Check"],
  employees: [{ id: "E001", name: "Employee One" }, { id: "E002", name: "Employee Two" }]
};

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','user'))
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lists (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      submitted_by_username TEXT NOT NULL,
      date TEXT,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Seed default admin account if no admin exists yet
  const adminCheck = await pool.query(`SELECT 1 FROM users WHERE username = 'Mobius365'`);
  if (adminCheck.rowCount === 0) {
    await pool.query(
      `INSERT INTO users (username, password, name, role) VALUES ($1,$2,$3,$4)`,
      ['Mobius365', 'Mobius@123', 'Admin', 'admin']
    );
    console.log('Seeded default admin account: Mobius365 / Mobius@123');
  }

  // Seed default lists
  for (const key of ['bands', 'processes', 'employees']) {
    const check = await pool.query(`SELECT 1 FROM lists WHERE key = $1`, [key]);
    if (check.rowCount === 0) {
      await pool.query(`INSERT INTO lists (key, data) VALUES ($1,$2)`, [key, JSON.stringify(SEED_LISTS[key])]);
    }
  }
}

module.exports = { pool, initDb };
