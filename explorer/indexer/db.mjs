import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, '..', 'data');
mkdirSync(dbDir, { recursive: true, mode: 0o777 });

const dbPath = join(dbDir, 'events.db');
const db = new Database(dbPath);

// Esquema que coincide con lo que el indexador espera
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
    blockNumber INTEGER,
    transactionHash TEXT,
    tenant_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabla de checkpoint (el indexador también la usa)
db.exec(`
  CREATE TABLE IF NOT EXISTS checkpoint (
    id INTEGER PRIMARY KEY,
    lastBlock INTEGER
  )
`);

// Insertar checkpoint inicial si no existe
try {
  db.prepare('INSERT OR IGNORE INTO checkpoint (id, lastBlock) VALUES (1, 117502959)').run();
} catch (e) {
  // Ya existe
}

export default db;
