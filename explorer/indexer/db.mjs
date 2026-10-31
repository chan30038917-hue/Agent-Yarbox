import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, '..', 'data', 'events.db'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventName TEXT NOT NULL,
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
    blockNumber INTEGER NOT NULL,
    transactionHash TEXT NOT NULL,
    UNIQUE(transactionHash, eventName, intentId)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS checkpoint (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    lastBlock INTEGER NOT NULL DEFAULT 0
  )
`);

const checkpoint = db.prepare('SELECT lastBlock FROM checkpoint WHERE id = 1').get();
if (!checkpoint) {
  db.prepare('INSERT INTO checkpoint (id, lastBlock) VALUES (1, 0)').run();
}

export default db;
