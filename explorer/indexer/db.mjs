import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Si existe DATABASE_PATH (Railway volumen), usarlo; si no, ruta local
const dbPath = process.env.DATABASE_PATH || join(__dirname, '..', 'data', 'events.db');
const dbDir = dirname(dbPath);
mkdirSync(dbDir, { recursive: true, mode: 0o777 });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventName TEXT,
    intentId TEXT,
    agent TEXT,
    mandateId TEXT,
    maxAmount TEXT,
    paymentNonce TEXT,
    resultHash TEXT,
    timestamp TEXT,
    settled INTEGER DEFAULT 0,
    inconsistent INTEGER DEFAULT 0,
    reason TEXT,
    block_number INTEGER,
    transactionHash TEXT,
    tenant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);



// Añadir tenant_id si no existe
try {
  db.exec(`ALTER TABLE events ADD COLUMN tenant_id TEXT`);
} catch (e) {}

// Añadir block_number si no existe
try {
  db.exec(`ALTER TABLE events ADD COLUMN block_number INTEGER`);
} catch (e) {}

// Tabla de checkpoint
db.exec(`
  CREATE TABLE IF NOT EXISTS checkpoint (
    id INTEGER PRIMARY KEY,
    lastBlock INTEGER
  )
`);

try {
  db.prepare('INSERT OR IGNORE INTO checkpoint (id, lastBlock) VALUES (1, 117502959)').run();
} catch (e) {}

export default db;
