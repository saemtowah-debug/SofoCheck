import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'sofocheck.db');

let db = null;

export function getDb() {
  return db;
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys equivalent
  db.run('PRAGMA foreign_keys = ON');

  // Create members table
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      birthday TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Create admins table
  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      phone_number TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER DEFAULT 1
    )
  `);

  // Create attendance_sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create attendance_records table
  db.run(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      session_id TEXT,
      checked_in_at TEXT DEFAULT CURRENT_TIMESTAMP,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accuracy REAL,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (session_id) REFERENCES attendance_sessions(id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance_records(member_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(checked_in_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_members_phone ON members(phone_number)`);

  // Insert default admin if not exists
  const adminResult = db.exec(`SELECT id FROM admins WHERE phone_number = '+233000000000'`);
  if (adminResult.length === 0 || adminResult[0].values.length === 0) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    db.run(`
      INSERT INTO admins (id, phone_number, password_hash, full_name, role)
      VALUES (?, ?, ?, ?, ?)
    `, [crypto.randomUUID(), '+233000000000', hashedPassword, 'Super Admin', 'super_admin']);
    console.log('Default admin created: +233000000000 / admin123');
  }

  // Insert default attendance session if not exists
  const sessionResult = db.exec(`SELECT id FROM attendance_sessions LIMIT 1`);
  if (sessionResult.length === 0 || sessionResult[0].values.length === 0) {
    db.run(`
      INSERT INTO attendance_sessions (id, name, day_of_week, start_time, end_time, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [crypto.randomUUID(), 'Sunday Worship', 'Sunday', '07:00', '14:00', 1]);
    console.log('Default Sunday Worship session created');
  }

  // Save to file
  saveDatabase();

  console.log('Database initialized successfully');
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper to convert sql.js result to object array
export function resultToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Helper to get first result as object
export function resultToObject(result) {
  const objects = resultToObjects(result);
  return objects.length > 0 ? objects[0] : null;
}
