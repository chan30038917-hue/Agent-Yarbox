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

// Añadir tenant_id si la tabla ya existía sin esa columna
try {
  db.exec(`ALTER TABLE events ADD COLUMN tenant_id TEXT`);
} catch (e) {
  // La columna ya existe, no hacer nada
}

export default db;
