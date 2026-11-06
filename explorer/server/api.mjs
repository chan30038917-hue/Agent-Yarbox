import express from 'express';
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { fileURLToPath } from 'url';
import cors from 'cors';
import db from '../indexer/db.mjs';
import { dirname, join } from 'path';
import { createPublicClient, http } from 'viem';
import { SiweMessage } from 'siwe';
import { getIronSession } from 'iron-session';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { facilitator } from "@coinbase/x402";

// --- IMPORTAR LOS SERVICIOS ---
import serviciosRoutes from './servicios.mjs';
import servicios2Routes from './servicios2.mjs';
import servicios3Routes from './servicios3.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const SESSION_OPTIONS = {
  password: process.env.SESSION_PASSWORD || crypto.randomBytes(32).toString('hex'),
  cookieName: 'agent-yarbox-session',
  cookieOptions: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 },
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'web'), { dotfiles: 'allow' }));

// --- CONECTAR LOS SERVICIOS ---
app.use('/api', serviciosRoutes);
app.use('/api', servicios2Routes);
app.use('/api', servicios3Routes);

const client = createPublicClient({ transport: http('https://rpc3.monad.xyz') });
const CONTRACT = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';
const NFT_ADDRESS = '0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8';
const SERVICE_DIRECTORY_ADDRESS = '0xCD9DdC0A0abB73a65F0AbF02Ec940F30661ca2AB';

const ABI_GET_RECEIPT = [{ name: 'getReceipt', type: 'function', stateMutability: 'view', inputs: [{ name: '_id', type: 'uint256' }], outputs: [{ name: 'agent', type: 'address' }, { name: 'erc8004AgentId', type: 'uint64' }, { name: 'intentHash', type: 'bytes32' }, { name: 'conditionHash', type: 'bytes32' }, { name: 'mandateId', type: 'bytes32' }, { name: 'maxAmount', type: 'uint256' }, { name: 'paymentNonce', type: 'bytes32' }, { name: 'resultHash', type: 'bytes32' }, { name: 'timestamp', type: 'uint256' }, { name: 'settled', type: 'bool' }, { name: 'inconsistent', type: 'bool' }] }];
const NFT_ABI = [{ "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "receipts", "outputs": [{ "internalType": "uint256", "name": "intentId", "type": "uint256" }, { "internalType": "address", "name": "agent", "type": "address" }, { "internalType": "uint256", "name": "maxAmount", "type": "uint256" }, { "internalType": "bytes32", "name": "paymentNonce", "type": "bytes32" }, { "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "nextTokenId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }];
const SERVICE_DIRECTORY_ABI = [{ "inputs": [{ "internalType": "uint256", "name": "_serviceId", "type": "uint256" }], "name": "getService", "outputs": [{ "components": [{ "internalType": "address", "name": "provider", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "price", "type": "uint256" }, { "internalType": "string", "name": "endpoint", "type": "string" }, { "internalType": "bool", "name": "active", "type": "bool" }, { "internalType": "uint256", "name": "reputationRequired", "type": "uint256" }], "internalType": "struct ServiceDirectory.Service", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "getServicesCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_agent", "type": "address" }, { "internalType": "uint256", "name": "_serviceId", "type": "uint256" }], "name": "canPurchase", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }];

// Helper para leer mandatos sin romper por rutas absolutas
function obtenerMandatos() {
  const rutaLocal = join(__dirname, 'mandatos-agentes.json');
  if (existsSync(rutaLocal)) {
    return JSON.parse(readFileSync(rutaLocal, 'utf8'));
  }
  const rutaAbsoluta = '/home/usuariochan/aethel-autapon/integration/mandatos-agentes.json';
  if (existsSync(rutaAbsoluta)) {
    return JSON.parse(readFileSync(rutaAbsoluta, 'utf8'));
  }
  throw new Error('Archivo mandatos-agentes.json no encontrado');
}

async function getSession(req, res) { return await getIronSession(req, res, SESSION_OPTIONS); }

app.get('/api/auth/nonce', async (req, res) => { const session = await getSession(req, res); const nonce = crypto.randomBytes(16).toString('hex'); session.nonce = nonce; await session.save(); res.json({ nonce }); });

app.post('/api/auth/verify', async (req, res) => {
  try {
    const session = await getSession(req, res);
    const { message, signature } = req.body;
    const siwe = new SiweMessage(message);
    const { data: fields } = await siwe.verify({ signature, nonce: session.nonce });
    session.address = fields.address;
    session.tenantId = fields.address.toLowerCase();
    await session.save();
    res.json({ ok: true, address: fields.address, tenantId: session.tenantId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/auth/logout', async (req, res) => { const session = await getSession(req, res); session.destroy(); res.json({ ok: true }); });

app.get('/api/auth/me', async (req, res) => {
  const session = await getSession(req, res);
  if (!session.address) return res.json({ authenticated: false });
  res.json({ authenticated: true, address: session.address, tenantId: session.tenantId });
});

async function getTenant(req, res) { const session = await getSession(req, res); return session.tenantId || 'public'; }

app.get('/api/events', async (req, res) => {
  let tenantId = await getTenant(req, res);
  if (req.query.address) tenantId = req.query.address.toLowerCase();
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  let query = 'SELECT * FROM events WHERE (tenant_id = ? OR agent = ?)';
  const params = [tenantId, tenantId];
  query += ' ORDER BY block_number DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const events = db.prepare(query).all(...params);
  res.json({ events, limit, offset, tenantId });
});

app.get('/api/stats', async (req, res) => {
  let tenantId = await getTenant(req, res);
  if (req.query.address) tenantId = req.query.address.toLowerCase();
  const stats = db.prepare('SELECT eventName, COUNT(*) as count FROM events WHERE (tenant_id = ? OR agent = ?) GROUP BY eventName').all(tenantId, tenantId);
  const total = db.prepare('SELECT COUNT(*) as count FROM events WHERE (tenant_id = ? OR agent = ?)').get(tenantId, tenantId);
  const lastBlock = db.prepare('SELECT lastBlock FROM checkpoint WHERE id = 1').get();
  res.json({ stats, total: total.count, lastBlock: lastBlock.lastBlock, tenantId });
});

app.get('/api/receipt/:intentId', async (req, res) => {
  try {
    const raw = req.params.intentId;
    if (!/^[0-9]+$/.test(raw)) {
      return res.status(400).json({ error: "intentId debe ser un numero entero" });
    }
    const receipt = await client.readContract({ address: CONTRACT, abi: ABI_GET_RECEIPT, functionName: 'getReceipt', args: [BigInt(raw)] });
    res.json({ intentId: raw, agent: receipt[0], erc8004AgentId: receipt[1].toString(), intentHash: receipt[2], conditionHash: receipt[3], mandateId: receipt[4], maxAmount: receipt[5].toString(), paymentNonce: receipt[6], resultHash: receipt[7], timestamp: receipt[8].toString(), settled: receipt[9], inconsistent: receipt[10] });
  } catch (e) {
    console.error("ERROR REAL:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/nfts/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    const nfts = [];
    const totalSupply = await client.readContract({ address: NFT_ADDRESS, abi: NFT_ABI, functionName: 'nextTokenId' });
    const total = Number(totalSupply);
    const start = total > 100 ? total - 100 : 0;
    for (let i = start; i < total; i++) {
      try {
        const data = await client.readContract({ address: NFT_ADDRESS, abi: NFT_ABI, functionName: 'receipts', args: [i] });
        if (data[1].toLowerCase() === address) nfts.push({ tokenId: i.toString(), intentId: data[0].toString(), agent: data[1], maxAmount: data[2].toString(), paymentNonce: data[3], timestamp: data[4].toString() });
      } catch (e) {}
    }
    const totalNFTs = nfts.length;
    const totalVolume = nfts.reduce((acc, nft) => acc + Number(nft.maxAmount), 0) / 1e18;
    const inconsistentCount = db.prepare('SELECT COUNT(*) as count FROM events WHERE agent = ? AND inconsistent = 1').get(address)?.count || 0;
    let score = (totalNFTs * 10) + (totalVolume * 100) - (inconsistentCount * 20);
    if (score > 100) score = 100;
    if (score < 0) score = 0;
    score = Math.round(score);
    let tier = 'Sin nivel', tierIcon = '⚪';
    if (totalNFTs >= 200) { tier = 'Diamante'; tierIcon = '💎'; }
    else if (totalNFTs >= 51) { tier = 'Oro'; tierIcon = '🥇'; }
    else if (totalNFTs >= 11) { tier = 'Plata'; tierIcon = '🥈'; }
    else if (totalNFTs >= 1) { tier = 'Bronce'; tierIcon = '🥉'; }
    res.json({ address, total: totalNFTs, totalVolume: totalVolume.toFixed(4), inconsistent: inconsistentCount, score, tier, tierIcon, nfts });
  } catch (e) { console.error("ERROR REAL:", e); res.status(500).json({ error: e.message }); }
});

app.get('/api/services', async (req, res) => {
  // Parche: sustituir el endpoint falso del clima por el real
  const _originalReadContract = client.readContract.bind(client);
  client.readContract = async (args) => {
    const result = await _originalReadContract(args);
    if (args.functionName === 'getService' && result && result.endpoint === 'https://api.clima.com') {
      return { ...result, endpoint: '/api/clima' };
    }
    return result;
  };
  try {
    const count = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'getServicesCount' });
    const services = [];
    for (let i = 0; i < Number(count); i++) {
      const s = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'getService', args: [i] });
      services.push({ serviceId: i.toString(), provider: s.provider, name: s.name, description: s.description, price: s.price.toString(), endpoint: s.endpoint, active: s.active, reputationRequired: s.reputationRequired.toString() });
    }
    // Añadir servicios nuevos (no están en el contrato)
    services.push({
      serviceId: "10",
      provider: "0xA0f3bFCF1A0149F8B68e9CE533a4D5178e1684c0",
      name: "Búsqueda Web",
      description: "Búsqueda en Google en tiempo real para agentes",
      price: "5000000000000000",
      endpoint: "/api/buscar-web",
      active: true,
      reputationRequired: "0"
    });
    services.push({
      serviceId: "11",
      provider: "0xA0f3bFCF1A0149F8B68e9CE533a4D5178e1684c0",
      name: "Auditoría Token",
      description: "Auditoría de seguridad de tokens en Monad",
      price: "10000000000000000",
      endpoint: "/api/auditar-token",
      active: true,
      reputationRequired: "0"
    });
    services.push({
      serviceId: "12",
      provider: "0xA0f3bFCF1A0149F8B68e9CE533a4D5178e1684c0",
      name: "Gas Tracker",
      description: "Precio del gas y recomendación de timing en Monad",
      price: "2000000000000000",
      endpoint: "/api/gas-monad",
      active: true,
      reputationRequired: "0"
    });

    res.json({ services });
  } catch (e) { console.error("ERROR REAL:", e); res.status(500).json({ error: e.message }); }
});

app.get('/catalog', async (req, res) => {
  try {
    const count = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'getServicesCount' });
    const services = [];
    for (let i = 0; i < Number(count); i++) {
      const s = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'getService', args: [i] });
      if (s.active) services.push({ id: i.toString(), provider: s.provider, name: s.name, description: s.description, price: (Number(s.price) / 1e18).toFixed(4) + ' MON', endpoint: s.endpoint, reputation_required: s.reputationRequired.toString(), network: "monad-mainnet", chain_id: 143, contract: SERVICE_DIRECTORY_ADDRESS });
    }
    res.json({ name: "AgentYarbox Mall", description: "Centro comercial de agentes autónomos en Monad", services: services });
  } catch (e) { console.error("ERROR REAL:", e); res.status(500).json({ error: e.message }); }
});

app.post('/api/buy', async (req, res) => {
  try {
    const { serviceId, agentId } = req.body;
    if (!serviceId || !agentId) return res.status(400).json({ error: 'Faltan serviceId o agentId' });
    
    const mandatos = obtenerMandatos();
    const agente = mandatos.find(m => m.agentId === agentId);
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });
    
    const servicio = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'getService', args: [BigInt(serviceId)] });
    if (!servicio.active) return res.status(400).json({ error: 'Servicio cerrado' });

    const puedeComprar = await client.readContract({ address: SERVICE_DIRECTORY_ADDRESS, abi: SERVICE_DIRECTORY_ABI, functionName: 'canPurchase', args: [agente.address, BigInt(serviceId)] });
    if (!puedeComprar && Number(servicio.reputationRequired) > 0) {
      return res.status(403).json({ error: 'Reputación insuficiente' });
    }
    
    const { MandateSDK } = await import('@chan30/mandate-sdk');
    const { AgentYarbox } = await import('../../index.js');
    const { Wallet, keccak256, toUtf8Bytes, Contract, JsonRpcProvider } = await import('ethers');

    const provider = new JsonRpcProvider('https://rpc3.monad.xyz', 143);
    const sdk = new MandateSDK({ privateKey: agente.privateKey, rpcUrl: 'https://rpc3.monad.xyz', chainId: 143 });
    const yarbox = new AgentYarbox({ address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC', privateKey: agente.privateKey });

    const totalBefore = await client.readContract({ address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC', abi: [{ "inputs": [], "name": "totalIntents", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }], functionName: 'totalIntents' });
    const txCommit = await yarbox.commitIntent({ intentHash: keccak256(toUtf8Bytes('buy-' + Date.now())), conditionHash: keccak256(toUtf8Bytes('service-' + serviceId)), mandateId: agente.mandateId, maxAmount: servicio.price, erc8004AgentId: 0n });
    await new Promise(r => setTimeout(r, 5000));
    
    const intentId = Number(totalBefore);
    const payment = await sdk.pay({ mandateId: agente.mandateId, passkey: agente.passkey, amount: (Number(servicio.price) / 1e18).toString(), recipient: '0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3', gasLimit: 500000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const txSettle = await yarbox.settleIntent({ intentId, paymentNonce: payment.paymentNonce, resultHash: keccak256(toUtf8Bytes('result-' + payment.tx)) });
    await new Promise(r => setTimeout(r, 5000));
    
    const ownerKey = process.env.PRIVATE_KEY;
    if (!ownerKey) {
      return res.status(500).json({ error: 'Falta PRIVATE_KEY en las variables de entorno' });
    }
    
    const ownerWallet = new Wallet(ownerKey, provider);
    const nftContract = new Contract('0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8', [{ "inputs": [{ "internalType": "address", "name": "_agent", "type": "address" }, { "internalType": "uint256", "name": "_intentId", "type": "uint256" }, { "internalType": "uint256", "name": "_maxAmount", "type": "uint256" }, { "internalType": "bytes32", "name": "_paymentNonce", "type": "bytes32" }, { "internalType": "uint256", "name": "_timestamp", "type": "uint256" }], "name": "mintReceipt", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }], ownerWallet);
    const txMint = await nftContract.mintReceipt(agente.address, intentId, servicio.price, payment.paymentNonce, Math.floor(Date.now() / 1000));
    await txMint.wait();
    
    res.json({ ok: true, intentId, tx: payment.tx, nftTx: txMint.hash, comision: payment.fee });
  } catch (e) { res.status(500).json({ error: e.message.slice(0, 200) }); }
});

app.post('/register-service', async (req, res) => {
  try {
    const { name, description, price, endpoint, agentId } = req.body;
    if (!name || !description || !price || !endpoint || !agentId) return res.status(400).json({ error: 'Faltan campos obligatorios' });
    
    const mandatos = obtenerMandatos();
    const agente = mandatos.find(m => m.agentId === agentId);
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' });
    
    const provider = new (await import('ethers')).JsonRpcProvider('https://rpc3.monad.xyz', 143);
    const { Wallet, Contract, parseEther } = await import('ethers');
    const wallet = new Wallet(agente.privateKey, provider);
    const SERVICE_DIRECTORY_ABI_WRITE = [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }, { "internalType": "string", "name": "_description", "type": "string" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }, { "internalType": "string", "name": "_endpoint", "type": "string" }, { "internalType": "uint256", "name": "_reputationRequired", "type": "uint256" }], "name": "registerService", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }];
    const contract = new Contract('0xCD9DdC0A0abB73a65F0AbF02Ec940F30661ca2AB', SERVICE_DIRECTORY_ABI_WRITE, wallet);
    const tx = await contract.registerService(name, description, parseEther(price), endpoint, 0);
    await tx.wait();
    res.json({ ok: true, tx: tx.hash });
  } catch (e) { res.status(500).json({ error: e.message.slice(0, 200) }); }
});

// --- CONFIGURACIÓN X402 (Monad Mainnet) ---
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402-facilitator.molandak.org"
});

const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("eip155:143", new ExactEvmScheme())
  .register("eip155:8453", new ExactEvmScheme());

app.use(
  paymentMiddleware(
    {
            "GET /api/validar-wallet": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Valida la reputacion de una wallet",
      },
      "GET /api/riesgo-token": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Analiza si un token es seguro o una estafa",
      },
            "GET /api/clima": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Datos del clima en tiempo real",
      },
      "GET /api/premium-data": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.001",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Acceso a datos premium de AgentYarbox",
      },
            "GET /api/buscar-web": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.005",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.005",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Busqueda web en Google para agentes (Serper)",
      },
            "GET /api/auditar-token": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.01",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Auditoria de seguridad de token en Monad (GoPlus + IA)",
      },
            "GET /api/gas-monad": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:143",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USDC", version: "2" }
          },
          {
            scheme: "exact",
            price: "$0.002",
            network: "eip155:8453",
            payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
            extra: { name: "USD Coin", version: "2" }
          }
        ],
        description: "Gas tracker y recomendacion de timing para Monad",
      },
      "GET /api/buy/:serviceId": {
        accepts: {
          scheme: "exact",
          network: "eip155:143",
          payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3",
          extra: { name: "USDC", version: "2" },
          price: async (context) => {
            const serviceId = context.adapter.getPath().split('/').pop();
            const s = await client.readContract({
              address: SERVICE_DIRECTORY_ADDRESS,
              abi: SERVICE_DIRECTORY_ABI,
              functionName: "getService",
              args: [BigInt(serviceId)]
            });
            const precioMON = Number(s.price) / 1e18;
            const precioUSDC = precioMON * 0.02;
            return `$${precioUSDC.toFixed(6)}`;
          },
        },
        description: "Servicio del Agent Mall",
      },
    },
    resourceServer
  )
);

// --- RUTA DE COMPRA CON X402 PARA SERVICIOS REALES ---
app.get('/api/buy/:serviceId', async (req, res) => {
  try {
    const serviceId = parseInt(req.params.serviceId);

    const s = await client.readContract({
      address: SERVICE_DIRECTORY_ADDRESS,
      abi: SERVICE_DIRECTORY_ABI,
      functionName: 'getService',
      args: [BigInt(serviceId)]
    });

    if (!s.active) {
      return res.status(404).json({ error: "Servicio no disponible" });
    }

    res.json({
      ok: true,
      service: {
        id: serviceId,
        provider: s.provider,
        name: s.name,
        description: s.description,
        priceMON: (Number(s.price) / 1e18).toFixed(6),
        endpoint: s.endpoint === 'https://api.clima.com' ? '/api/clima' : s.endpoint,
        reputationRequired: s.reputationRequired.toString(),
        network: "monad-mainnet",
        chainId: 143,
        contract: SERVICE_DIRECTORY_ADDRESS,
      },
      paidAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("ERROR REAL:", e);
    res.status(500).json({ error: e.message });
  }
});

const serverPort = process.env.PORT || 3001;

// ============ ENDPOINTS FALTANTES ============

app.post('/api/analizar-texto', async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ error: "Falta texto" });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Analiza este texto y devuelve JSON con sentimiento (positivo/negativo/neutro) y resumen breve: " + texto }],
      response_format: { type: "json_object" }
    });
    res.json({ ok: true, analisis: JSON.parse(completion.choices[0].message.content) });
  } catch (e) { console.error("ERROR analizar-texto:", e); res.status(500).json({ error: e.message }); }
});

app.get('/api/validar-wallet', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Falta address" });
    const nfts = await client.readContract({
      address: NFT_ADDRESS,
      abi: NFT_ABI,
      functionName: 'balanceOf',
      args: [address]
    });
    res.json({ ok: true, address, nfts: nfts.toString(), reputacion: Number(nfts) > 0 ? "Con NFTs" : "Sin NFTs" });
  } catch (e) { console.error("ERROR validar-wallet:", e); res.status(500).json({ error: e.message }); }
});

app.post('/api/leer-web', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "Falta url" });
    const response = await fetch(url);
    const html = await response.text();
    const markdown = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
    res.json({ ok: true, url, markdown });
  } catch (e) { console.error("ERROR leer-web:", e); res.status(500).json({ error: e.message }); }
});

app.get('/api/riesgo-token', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Falta token" });
    const esValida = token.startsWith('0x') && token.length === 42;
    res.json({ ok: true, token, riesgo: esValida ? "bajo" : "alto", recomendacion: esValida ? "Token con formato valido" : "Direccion invalida" });
  } catch (e) { console.error("ERROR riesgo-token:", e); res.status(500).json({ error: e.message }); }
});

app.post('/api/extraer-json', async (req, res) => {
  try {
    const { texto, esquema } = req.body;
    if (!texto) return res.status(400).json({ error: "Falta texto" });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Extrae datos estructurados de este texto. Esquema deseado: " + JSON.stringify(esquema || {}) + ". Texto: " + texto }],
      response_format: { type: "json_object" }
    });
    res.json({ ok: true, datos: JSON.parse(completion.choices[0].message.content) });
  } catch (e) { console.error("ERROR extraer-json:", e); res.status(500).json({ error: e.message }); }
});

// ============================================


// Ruta de clima (proxy a OpenWeatherMap)
app.get('/api/clima', async (req, res) => {
  try {
    const { ciudad } = req.query;
    if (!ciudad) return res.status(400).json({ error: "Falta el parametro ciudad" });

    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta OPENWEATHER_API_KEY en el servidor" });

    const url = "https://api.openweathermap.org/data/2.5/weather?q=" + encodeURIComponent(ciudad) + "&units=metric&lang=es&appid=" + apiKey;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.message });
    }

    const data = await response.json();
    res.json({
      ok: true,
      ciudad: data.name,
      temperatura: Math.round(data.main.temp),
      descripcion: data.weather[0].description,
      humedad: data.main.humidity,
      viento: Math.round(data.wind.speed)
    });
  } catch (e) {
    console.error("ERROR clima:", e);
    res.status(500).json({ error: e.message });
  }
});




// Lanzar el indexador en segundo plano (no bloquea la API)
import { fork } from 'child_process';
try {
  const indexerPath = join(__dirname, '..', 'indexer', 'index.mjs');
  const child = fork(indexerPath, [], { stdio: 'inherit' });
  child.on('error', (err) => console.error('Error indexador:', err));
  console.log('Indexador lanzado en segundo plano (PID:', child.pid, ')');
} catch (e) {
  console.error('No se pudo lanzar el indexador:', e.message);
}


// Ruta de Búsqueda Web (proxy a Serper)
app.get('/api/buscar-web', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Falta el parámetro 'query'" });

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta SERPER_API_KEY en el servidor" });

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 10 }) // num: 10 resultados
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ error: errorData.message || "Error en Serper" });
    }

    const data = await response.json();
    res.json({
      ok: true,
      query: query,
      answer: data.answerBox?.answer || data.answerBox?.snippet || data.knowledgeGraph?.description || null,
      results: (data.organic || []).map(r => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet
      }))
    });
  } catch (e) {
    console.error("ERROR buscar-web:", e);
    res.status(500).json({ error: e.message });
  }
});


// Ruta de Auditoría de Token (GoPlus + OpenAI)
app.get('/api/auditar-token', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Falta el parámetro 'address'" });

    // 1. Consultar GoPlus para Monad (chainId 143)
    const goplusUrl = `https://api.gopluslabs.io/api/v1/token_security/143?contract_addresses=${address}`;
    const goplusRes = await fetch(goplusUrl);
    if (!goplusRes.ok) {
      return res.status(500).json({ error: "Error consultando GoPlus" });
    }
    const goplusData = await goplusRes.json();
    const tokenData = goplusData.result?.[address.toLowerCase()];

    if (!tokenData) {
      return res.status(404).json({ error: "Token no encontrado en GoPlus (puede no estar en Monad o no ser un contrato)" });
    }

    // 2. Extraer señales clave
    const señales = {
      honeypot: tokenData.is_honeypot === "1",
      mintable: tokenData.is_mintable === "1",
      proxy: tokenData.is_proxy === "1",
      open_source: tokenData.is_open_source === "1",
      buy_tax: tokenData.buy_tax || "0",
      sell_tax: tokenData.sell_tax || "0",
      holder_count: tokenData.holder_count || "0",
      lp_holders: tokenData.lp_holders?.length || 0,
      owner_address: tokenData.owner_address || null,
    };

    // 3. Generar veredicto con OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Analiza estos datos de seguridad de un token en Monad y devuelve un veredicto en JSON con: "riesgo" (bajo/medio/alto), "resumen" (1-2 frases), y "recomendacion" (1 frase). Datos: ${JSON.stringify(señales)}`
      }],
      response_format: { type: "json_object" }
    });

    const veredicto = JSON.parse(completion.choices[0].message.content);

    res.json({
      ok: true,
      address,
      señales,
      veredicto
    });
  } catch (e) {
    console.error("ERROR auditar-token:", e);
    res.status(500).json({ error: e.message });
  }
});


// Ruta de Gas Tracker para Monad
app.get('/api/gas-monad', async (req, res) => {
  try {
    // 1. Obtener el gas price actual del RPC de Monad
    const gasPriceHex = await client.request({ method: 'eth_gasPrice' });
    const gasPriceWei = BigInt(gasPriceHex);
    const gasPriceGwei = Number(gasPriceWei) / 1e9;

    // 2. Obtener el precio de MON en USD (de la misma fuente que /api/precio-mon)
    let precioMON = 0.01724; // Fallback (precio aproximado de CoinMarketCap)
    try {
      const poolAddress = '0x8b926a72640b5766c5daa65365c24009618a91cab560946b550e4aa5ce2ae5f2';
      const url = `https://api.geckoterminal.com/api/v2/networks/monad/pools/${poolAddress}`;
      const response = await fetch(url);
      const data = await response.json();
      precioMON = Number(data.data.attributes.base_token_price_usd) || precioMON;
    } catch (e) {
      console.warn("No se pudo obtener el precio de MON, usando fallback:", precioMON);
    }

    // 3. Calcular costes estimados
    const gasLimitTransfer = 21000n; // Transferencia estándar
    const gasLimitSwap = 150000n;    // Swap aproximado
    const costeTransferWei = gasPriceWei * gasLimitTransfer;
    const costeSwapWei = gasPriceWei * gasLimitSwap;
    const costeTransferMON = Number(costeTransferWei) / 1e18;
    const costeSwapMON = Number(costeSwapWei) / 1e18;
    const costeTransferUSD = costeTransferMON * precioMON;
    const costeSwapUSD = costeSwapMON * precioMON;

    // 4. Recomendación (ventana barata: 02:00 - 06:00 UTC)
    const horaUTC = new Date().getUTCHours();
    let recomendacion = "Gas estable. Puedes ejecutar ahora.";
    if (horaUTC >= 2 && horaUTC <= 6) {
      recomendacion = "Ventana barata detectada (02:00-06:00 UTC). Buen momento para ejecutar.";
    } else if (gasPriceGwei > 100) {
      recomendacion = "Gas alto. Considera esperar a la ventana 02:00-06:00 UTC.";
    }

    res.json({
      ok: true,
      gasPriceGwei: gasPriceGwei.toFixed(4),
      precioMON: precioMON.toFixed(6),
      costeTransferencia: {
        mon: costeTransferMON.toFixed(8),
        usd: costeTransferUSD.toFixed(6)
      },
      costeSwap: {
        mon: costeSwapMON.toFixed(8),
        usd: costeSwapUSD.toFixed(6)
      },
      recomendacion: recomendacion,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("ERROR gas-monad:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(serverPort, "0.0.0.0", () => {
  console.log(`Servidor AgentYarbox listo y escuchando en el puerto ${serverPort}`);
});
// rebuild Thu Nov  5 23:33:42 CST 2026
