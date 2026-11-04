import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// La carpeta 'data' está al mismo nivel que 'indexer'
const dbDir = join(__dirname, '..', 'data');
mkdirSync(dbDir, { recursive: true });

const dbPath = join(dbDir, 'events.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intent_id TEXT,
    event_type TEXT,
    agent TEXT,
    amount TEXT,
    block_number INTEGER,
    tx_hash TEXT,
    timestamp INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;
