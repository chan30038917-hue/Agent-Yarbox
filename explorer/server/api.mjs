import express from 'express';
import cors from 'cors';
import db from '../indexer/db.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createPublicClient, http } from 'viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'web')));

// Cliente para leer el contrato
const client = createPublicClient({ transport: http('https://rpc.monad.xyz') });
const CONTRACT = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';

const ABI_GET_RECEIPT = [{
  name: 'getReceipt',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: '_id', type: 'uint256' }],
  outputs: [
    { name: 'agent', type: 'address' },
    { name: 'erc8004AgentId', type: 'uint64' },
    { name: 'intentHash', type: 'bytes32' },
    { name: 'conditionHash', type: 'bytes32' },
    { name: 'mandateId', type: 'bytes32' },
    { name: 'maxAmount', type: 'uint256' },
    { name: 'paymentNonce', type: 'bytes32' },
    { name: 'resultHash', type: 'bytes32' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'settled', type: 'bool' },
    { name: 'inconsistent', type: 'bool' },
  ],
}];

app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const eventName = req.query.eventName;
  let query = 'SELECT * FROM events';
  const params = [];
  if (eventName) {
    query += ' WHERE eventName = ?';
    params.push(eventName);
  }
  query += ' ORDER BY blockNumber DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const events = db.prepare(query).all(...params);
  res.json({ events, limit, offset });
});

app.get('/api/events/:intentId', (req, res) => {
  const events = db.prepare('SELECT * FROM events WHERE intentId = ? ORDER BY blockNumber ASC').all(req.params.intentId);
  if (events.length === 0) {
    return res.status(404).json({ error: 'Intención no encontrada' });
  }
  res.json({ intentId: req.params.intentId, events });
});

app.get('/api/stats', (req, res) => {
  const stats = db.prepare('SELECT eventName, COUNT(*) as count FROM events GROUP BY eventName').all();
  const total = db.prepare('SELECT COUNT(*) as count FROM events').get();
  const lastBlock = db.prepare('SELECT lastBlock FROM checkpoint WHERE id = 1').get();
  res.json({ stats, total: total.count, lastBlock: lastBlock.lastBlock });
});

app.get('/api/receipt/:intentId', async (req, res) => {
  try {
    const receipt = await client.readContract({
      address: CONTRACT,
      abi: ABI_GET_RECEIPT,
      functionName: 'getReceipt',
      args: [BigInt(req.params.intentId)],
    });
    res.json({
      intentId: req.params.intentId,
      agent: receipt[0],
      erc8004AgentId: receipt[1].toString(),
      intentHash: receipt[2],
      conditionHash: receipt[3],
      mandateId: receipt[4],
      maxAmount: receipt[5].toString(),
      paymentNonce: receipt[6],
      resultHash: receipt[7],
      timestamp: receipt[8].toString(),
      settled: receipt[9],
      inconsistent: receipt[10],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
