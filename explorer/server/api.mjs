import express from 'express';
import cors from 'cors';
import db from '../indexer/db.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createPublicClient, http } from 'viem';
import { SiweMessage } from 'siwe';
import { getIronSession } from 'iron-session';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

const SESSION_OPTIONS = {
  password: crypto.randomBytes(32).toString('hex'),
  cookieName: 'agent-yarbox-session',
  cookieOptions: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 },
};

app.use(cors({ origin: 'http://localhost:3001', credentials: true }));
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'web')));

const client = createPublicClient({ transport: http('https://rpc.monad.xyz') });
const CONTRACT = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';

const ABI_GET_RECEIPT = [{
  name: 'getReceipt', type: 'function', stateMutability: 'view',
  inputs: [{ name: '_id', type: 'uint256' }],
  outputs: [
    { name: 'agent', type: 'address' }, { name: 'erc8004AgentId', type: 'uint64' },
    { name: 'intentHash', type: 'bytes32' }, { name: 'conditionHash', type: 'bytes32' },
    { name: 'mandateId', type: 'bytes32' }, { name: 'maxAmount', type: 'uint256' },
    { name: 'paymentNonce', type: 'bytes32' }, { name: 'resultHash', type: 'bytes32' },
    { name: 'timestamp', type: 'uint256' }, { name: 'settled', type: 'bool' },
    { name: 'inconsistent', type: 'bool' },
  ],
}];

// Middleware para leer la sesión
async function getSession(req, res) {
  return await getIronSession(req, res, SESSION_OPTIONS);
}

// Auth: genera nonce
app.get('/api/auth/nonce', async (req, res) => {
  const session = await getSession(req, res);
  const nonce = crypto.randomBytes(16).toString('hex');
  session.nonce = nonce;
  await session.save();
  res.json({ nonce });
});

// Auth: verifica firma
app.post('/api/auth/verify', async (req, res) => {
  try {
    const session = await getSession(req, res);
    const { message, signature } = req.body;
    const siwe = new SiweMessage(message);
    const { data: fields } = await siwe.verify({ signature, nonce: session.nonce });
    session.address = fields.address;
    session.tenantId = fields.address.toLowerCase(); // por ahora todos van a public
    await session.save();
    res.json({ ok: true, address: fields.address, tenantId: session.tenantId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Auth: logout
app.post('/api/auth/logout', async (req, res) => {
  const session = await getSession(req, res);
  session.destroy();
  res.json({ ok: true });
});

// Auth: estado actual
app.get('/api/auth/me', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.address) return res.json({ authenticated: false });
  res.json({ authenticated: true, address: session.address, tenantId: session.tenantId });
});

// Registrar empresa (tenant)
app.post('/api/tenants', async (req, res) => {
  try {
    const session = await getSession(req, res);
    if (!session.address) return res.status(401).json({ error: 'No autenticado' });
    const { tenantId, name } = req.body;
    if (!tenantId || !name) return res.status(400).json({ error: 'tenantId y name son obligatorios' });
    db.prepare('INSERT INTO tenants (tenant_id, name, wallet) VALUES (?, ?, ?)').run(tenantId, name, session.address.toLowerCase());
    session.tenantId = tenantId;
    await session.save();
    res.json({ ok: true, tenantId, name });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Esa wallet o tenantId ya está registrado' });
    res.status(500).json({ error: e.message });
  }
});

// Obtener mi tenant
app.get('/api/tenants/me', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.address) return res.status(401).json({ error: 'No autenticado' });
  const tenant = db.prepare('SELECT * FROM tenants WHERE wallet = ?').get(session.address.toLowerCase());
  if (!tenant) return res.status(404).json({ error: 'No tienes empresa registrada' });
  res.json(tenant);
});

// Helper para obtener tenant (público si no hay sesión)
async function getTenant(req, res) {
  const session = await getSession(req, res);
  return session.tenantId || 'public';
}


// GET /api/events
app.get('/api/events', async (req, res) => {
  let tenantId = await getTenant(req, res);
  if (req.query.address) tenantId = req.query.address.toLowerCase();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const eventName = req.query.eventName;
  let query = 'SELECT * FROM events WHERE (tenant_id = ? OR agent = ?)';
  const params = [tenantId, tenantId];
  if (eventName) { query += ' AND eventName = ?'; params.push(eventName); }
  query += ' ORDER BY blockNumber DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const events = db.prepare(query).all(...params);
  res.json({ events, limit, offset, tenantId });
});

// GET /api/events/:intentId
app.get('/api/events/:intentId', async (req, res) => {
  const tenantId = await getTenant(req, res);
  const events = db.prepare('SELECT * FROM events WHERE intentId = ? AND tenant_id = ? ORDER BY blockNumber ASC').all(req.params.intentId, tenantId);
  if (events.length === 0) return res.status(404).json({ error: 'Intención no encontrada' });
  res.json({ intentId: req.params.intentId, events });
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
  let tenantId = await getTenant(req, res);
  if (req.query.address) tenantId = req.query.address.toLowerCase();
  const stats = db.prepare('SELECT eventName, COUNT(*) as count FROM events WHERE (tenant_id = ? OR agent = ?) GROUP BY eventName').all(tenantId, tenantId);
  const total = db.prepare('SELECT COUNT(*) as count FROM events WHERE (tenant_id = ? OR agent = ?)').get(tenantId, tenantId);
  const lastBlock = db.prepare('SELECT lastBlock FROM checkpoint WHERE id = 1').get();
  res.json({ stats, total: total.count, lastBlock: lastBlock.lastBlock, tenantId });
});

// GET /api/receipt/:intentId
app.get('/api/receipt/:intentId', async (req, res) => {
  try {
    const receipt = await client.readContract({
      address: CONTRACT, abi: ABI_GET_RECEIPT, functionName: 'getReceipt',
      args: [BigInt(req.params.intentId)],
    });
    res.json({
      intentId: req.params.intentId, agent: receipt[0], erc8004AgentId: receipt[1].toString(),
      intentHash: receipt[2], conditionHash: receipt[3], mandateId: receipt[4],
      maxAmount: receipt[5].toString(), paymentNonce: receipt[6], resultHash: receipt[7],
      timestamp: receipt[8].toString(), settled: receipt[9], inconsistent: receipt[10],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
