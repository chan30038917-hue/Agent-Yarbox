import express from 'express';
import cors from 'cors';
import db from '../indexer/db.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createPublicClient, http } from 'viem';
import { MandateSDK } from '@chan30/mandate-sdk';
import { Wallet, parseEther, keccak256, toUtf8Bytes, Contract } from 'ethers';
import { readFileSync } from 'fs';
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

const client = createPublicClient({ transport: http('https://rpc3.monad.xyz') });
const CONTRACT = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';



const SERVICE_DIRECTORY_ADDRESS = '0xCD9DdC0A0abB73a65F0AbF02Ec940F30661ca2AB';
const SERVICE_DIRECTORY_ABI = [
  { "inputs": [{"internalType": "address", "name": "_reputationNFT", "type": "address"}], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "getServicesCount", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "uint256", "name": "_serviceId", "type": "uint256"}], "name": "getService", "outputs": [{"components": [{"internalType": "address", "name": "provider", "type": "address"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "string", "name": "description", "type": "string"}, {"internalType": "uint256", "name": "price", "type": "uint256"}, {"internalType": "string", "name": "endpoint", "type": "string"}, {"internalType": "bool", "name": "active", "type": "bool"}, {"internalType": "uint256", "name": "reputationRequired", "type": "uint256"}], "internalType": "struct ServiceDirectory.Service", "name": "", "type": "tuple"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}, {"internalType": "uint256", "name": "_serviceId", "type": "uint256"}], "name": "canPurchase", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function" }
];

const NFT_ADDRESS = '0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8';
const NFT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}, {"internalType": "uint256", "name": "index", "type": "uint256"}],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "name": "receipts",
    "outputs": [
      {"internalType": "uint256", "name": "intentId", "type": "uint256"},
      {"internalType": "address", "name": "agent", "type": "address"},
      {"internalType": "uint256", "name": "maxAmount", "type": "uint256"},
      {"internalType": "bytes32", "name": "paymentNonce", "type": "bytes32"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

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


app.get('/api/nfts/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const nfts = [];
    
    const totalSupply = await client.readContract({
      address: NFT_ADDRESS,
      abi: [{ "inputs": [], "name": "nextTokenId", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }],
      functionName: 'nextTokenId',
    });
    
    const total = Number(totalSupply);
    const start = total > 100 ? total - 100 : 0;
    
    for (let i = start; i < total; i++) {
      try {
        const data = await client.readContract({
          address: NFT_ADDRESS,
          abi: NFT_ABI,
          functionName: 'receipts',
          args: [i],
        });
        if (data[1].toLowerCase() === address) {
          nfts.push({
            tokenId: i.toString(),
            intentId: data[0].toString(),
            agent: data[1],
            maxAmount: data[2].toString(),
            paymentNonce: data[3],
            timestamp: data[4].toString(),
          });
        }
      } catch (e) { /* saltar */ }
    }

    // Calcular Score y Tier
    const totalNFTs = nfts.length;
    const totalVolume = nfts.reduce((acc, nft) => acc + Number(nft.maxAmount), 0) / 1e18;
    
    // Contar inconsistentes (intentos fallidos)
    const inconsistentCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE agent = ? AND inconsistent = 1').get(address)?.count || 0;
    
    // Fórmula del score
    let score = (totalNFTs * 10) + (totalVolume * 100) - (inconsistentCount * 20);
    if (score > 100) score = 100;
    if (score < 0) score = 0;
    score = Math.round(score);

    // Determinar Tier
    let tier = 'Sin nivel';
    let tierIcon = '⚪';
    if (totalNFTs >= 200) { tier = 'Diamante'; tierIcon = '💎'; }
    else if (totalNFTs >= 51) { tier = 'Oro'; tierIcon = '🥇'; }
    else if (totalNFTs >= 11) { tier = 'Plata'; tierIcon = '🥈'; }
    else if (totalNFTs >= 1) { tier = 'Bronce'; tierIcon = '🥉'; }

    res.json({ 
      address, 
      total: totalNFTs, 
      totalVolume: totalVolume.toFixed(4),
      inconsistent: inconsistentCount,
      score,
      tier,
      tierIcon,
      nfts 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/services', async (req, res) => {
  try {
    const count = await client.readContract({
      address: SERVICE_DIRECTORY_ADDRESS,
      abi: SERVICE_DIRECTORY_ABI,
      functionName: 'getServicesCount',
    });
    
    const services = [];
    for (let i = 0; i < Number(count); i++) {
      try {
        const s = await client.readContract({
          address: SERVICE_DIRECTORY_ADDRESS,
          abi: SERVICE_DIRECTORY_ABI,
          functionName: 'getService',
          args: [i],
        });
        // s es un objeto con las propiedades: provider, name, description, price, endpoint, active, reputationRequired
        services.push({
          serviceId: i.toString(),
          provider: s.provider,
          name: s.name,
          description: s.description,
          price: s.price.toString(),
          endpoint: s.endpoint,
          active: s.active,
          reputationRequired: s.reputationRequired.toString(),
        });
      } catch (e) {
        console.log('Error leyendo servicio ' + i + ': ' + e.message.slice(0, 80));
      }
    }
    res.json({ services });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.post('/api/buy', async (req, res) => {
  try {
    const { serviceId, agentId } = req.body;
    if (!serviceId || !agentId) return res.status(400).json({ error: 'Faltan serviceId o agentId' });

    // Leer mandatos y buscar el agente
    const mandatos = JSON.parse(readFileSync('/home/usuariochan/aethel-autapon/integration/mandatos-agentes.json', 'utf8'));
    const agente = mandatos.find(m => m.agentId === agentId);
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });

    // Leer el servicio del contrato
    const servicio = await client.readContract({
      address: SERVICE_DIRECTORY_ADDRESS,
      abi: SERVICE_DIRECTORY_ABI,
      functionName: 'getService',
      args: [BigInt(serviceId)],
    });

    if (!servicio.active) return res.status(400).json({ error: 'Servicio cerrado' });

    // Verificar reputación
    const puedeComprar = await client.readContract({
      address: SERVICE_DIRECTORY_ADDRESS,
      abi: SERVICE_DIRECTORY_ABI,
      functionName: 'canPurchase',
      args: [agente.address, BigInt(serviceId)],
    });
    if (!puedeComprar) return res.status(403).json({ error: 'Reputación insuficiente' });

    // Crear SDK y AgentYarbox
    const provider = new (await import('ethers')).JsonRpcProvider('https://rpc3.monad.xyz', 143);
    const sdk = new MandateSDK({ privateKey: agente.privateKey, rpcUrl: 'https://rpc3.monad.xyz', chainId: 143 });
    
    const { AgentYarbox } = await import('../../index.js');
    const yarbox = new AgentYarbox({ address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC', privateKey: agente.privateKey });

    // 1. Commit Intent
    const totalBefore = await client.readContract({
      address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC',
      abi: [{ "inputs": [], "name": "totalIntents", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }],
      functionName: 'totalIntents',
    });

    const txCommit = await yarbox.commitIntent({
      intentHash: keccak256(toUtf8Bytes('buy-' + Date.now())),
      conditionHash: keccak256(toUtf8Bytes('service-' + serviceId)),
      mandateId: agente.mandateId,
      maxAmount: servicio.price,
      erc8004AgentId: 0n,
    });

    // Esperar confirmación
    await new Promise(r => setTimeout(r, 5000));
    const intentId = Number(totalBefore);

    // 2. Pay con SDK
    const payment = await sdk.pay({
      mandateId: agente.mandateId,
      passkey: agente.passkey,
      amount: (Number(servicio.price) / 1e18).toString(),
      recipient: '0xF6805F61820A860db4B7462Bc9940793fC8ed22A',
      gasLimit: 500000,
    });

    await new Promise(r => setTimeout(r, 5000));

    // 3. Settle
    const txSettle = await yarbox.settleIntent({
      intentId,
      paymentNonce: payment.paymentNonce,
      resultHash: keccak256(toUtf8Bytes('result-' + payment.tx)),
    });

    await new Promise(r => setTimeout(r, 5000));

    // 4. Acuñar NFT
    const ownerKey = process.env.PRIVATE_KEY || readFileSync('/home/usuariochan/agent-yarbox/.env', 'utf8').match(/PRIVATE_KEY=(.*)/)[1].trim();
    const ownerWallet = new Wallet(ownerKey, provider);
    const nftContract = new Contract('0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8', [{ "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}, {"internalType": "uint256", "name": "_intentId", "type": "uint256"}, {"internalType": "uint256", "name": "_maxAmount", "type": "uint256"}, {"internalType": "bytes32", "name": "_paymentNonce", "type": "bytes32"}, {"internalType": "uint256", "name": "_timestamp", "type": "uint256"}], "name": "mintReceipt", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function" }], ownerWallet);
    
    const txMint = await nftContract.mintReceipt(agente.address, intentId, servicio.price, payment.paymentNonce, Math.floor(Date.now() / 1000));
    await txMint.wait();

    res.json({ ok: true, intentId, tx: payment.tx, nftTx: txMint.hash, comision: payment.fee });
  } catch (e) {
    res.status(500).json({ error: e.message.slice(0, 200) });
  }
});

app.listen(PORT, () => {
  console.log(`API corriendo en http://localhost:${PORT}`);
});
