import { AgentYarbox } from './index.js';
import { readFileSync } from 'fs';
import { MandateSDK } from '@chan30/mandate-sdk';
import { JsonRpcProvider, Contract, Wallet, parseEther, keccak256, toUtf8Bytes } from 'ethers';

const provider = new JsonRpcProvider('https://rpc3.monad.xyz', 143);
const mandatos = JSON.parse(readFileSync('/home/usuariochan/aethel-autapon/integration/mandatos-agentes.json', 'utf8'));

// Agente que compra en el Mall
const agente = mandatos[2]; // agente-03

// Tu wallet (donde llega la comisión)
const TU_WALLET = '0xF6805F61820A860db4B7462Bc9940793fC8ed22A';
const PRECIO_SERVICIO = parseEther('0.05');

// Contratos
const AGENT_YARBOX = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';
const REPUTATION_NFT = '0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8';
const SERVICE_DIRECTORY = '0xCD9DdC0A0abB73a65F0AbF02Ec940F30661ca2AB';

const NFT_ABI = [
  { "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}, {"internalType": "uint256", "name": "_intentId", "type": "uint256"}, {"internalType": "uint256", "name": "_maxAmount", "type": "uint256"}, {"internalType": "bytes32", "name": "_paymentNonce", "type": "bytes32"}, {"internalType": "uint256", "name": "_timestamp", "type": "uint256"}], "name": "mintReceipt", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType": "address", "name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }
];

const SERVICE_ABI = [
  { "inputs": [{"internalType": "uint256", "name": "_serviceId", "type": "uint256"}], "name": "getService", "outputs": [{"components": [{"internalType": "address", "name": "provider", "type": "address"}, {"internalType": "string", "name": "name", "type": "string"}, {"internalType": "string", "name": "description", "type": "string"}, {"internalType": "uint256", "name": "price", "type": "uint256"}, {"internalType": "string", "name": "endpoint", "type": "string"}, {"internalType": "bool", "name": "active", "type": "bool"}, {"internalType": "uint256", "name": "reputationRequired", "type": "uint256"}], "internalType": "struct ServiceDirectory.Service", "name": "", "type": "tuple"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}, {"internalType": "uint256", "name": "_serviceId", "type": "uint256"}], "name": "canPurchase", "outputs": [{"internalType": "bool", "name": "", "type": "bool"}], "stateMutability": "view", "type": "function" }
];

const yarbox = new AgentYarbox({ address: AGENT_YARBOX, privateKey: agente.privateKey });
const sdk = new MandateSDK({ privateKey: agente.privateKey, rpcUrl: 'https://rpc3.monad.xyz', chainId: 143 });
const nftContract = new Contract(REPUTATION_NFT, NFT_ABI, provider);
const serviceContract = new Contract(SERVICE_DIRECTORY, SERVICE_ABI, provider);

const ownerKey = readFileSync('/home/usuariochan/agent-yarbox/.env', 'utf8').match(/PRIVATE_KEY=(.*)/)[1].trim();
const ownerWallet = new Wallet(ownerKey, provider);

async function main() {
  console.log('=== COMPRA EN EL MALL (ECOSISTEMA COMPLETO) ===\n');
  console.log('Agente:', agente.agentId);
  console.log('Wallet:', agente.address);

  // 1. Verificar que el agente puede comprar (reputación)
  console.log('\n1. Verificando reputación del agente...');
  const puedeComprar = await serviceContract.canPurchase(agente.address, 0);
  console.log('   ¿Puede comprar?', puedeComprar ? 'Sí ✅' : 'No ❌');
  if (!puedeComprar) { console.log('   El agente no tiene reputación suficiente. Abortando.'); return; }

  // 2. Ver el servicio del Mall
  console.log('\n2. Consultando el servicio en el Mall...');
  const servicio = await serviceContract.getService(0);
  console.log('   Servicio:', servicio[1]);
  console.log('   Precio:', (Number(servicio[3]) / 1e18).toFixed(4), 'MON');
  console.log('   Proveedor:', servicio[0]);

  // 3. Commit Intent
  console.log('\n3. Registrando intención de compra...');
  const totalBefore = await yarbox.publicClient.readContract({
    address: yarbox.address,
    abi: [{ "inputs": [], "name": "totalIntents", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }],
    functionName: 'totalIntents',
  });

  const txCommit = await yarbox.commitIntent({
    intentHash: keccak256(toUtf8Bytes('compra-mall-' + Date.now())),
    conditionHash: keccak256(toUtf8Bytes('servicio-api-datos')),
    mandateId: agente.mandateId,
    maxAmount: servicio[3],
    erc8004AgentId: 0n
  });
  console.log('   Tx Commit:', txCommit);
  await new Promise(r => setTimeout(r, 5000));
  const intentId = Number(totalBefore);
  console.log('   Intent ID:', intentId);

  // 4. Pay con Mandate SDK
  console.log('\n4. Pagando con Mandate SDK...');
  const payment = await sdk.pay({
    mandateId: agente.mandateId,
    passkey: agente.passkey,
    amount: '0.05',
    recipient: TU_WALLET,
    gasLimit: 500000,
  });
  console.log('   Tx Pay:', payment.tx);
  console.log('   Payment Nonce:', payment.paymentNonce);
  console.log('   Comisión (0.5%):', (Number(payment.fee)).toFixed(6), 'MON');
  await new Promise(r => setTimeout(r, 5000));

  // 5. Settle
  console.log('\n5. Liquidando intención...');
  const txSettle = await yarbox.settleIntent({
    intentId,
    paymentNonce: payment.paymentNonce,
    resultHash: keccak256(toUtf8Bytes('result-' + payment.tx))
  });
  console.log('   Tx Settle:', txSettle);
  await new Promise(r => setTimeout(r, 5000));

  // 6. Acuñar NFT
  console.log('\n6. Acuñando NFT de reputación...');
  const txMint = await nftContract.connect(ownerWallet).mintReceipt(
    agente.address,
    intentId,
    servicio[3],
    payment.paymentNonce,
    Math.floor(Date.now() / 1000)
  );
  console.log('   Tx Mint:', txMint.hash);
  await txMint.wait();
  console.log('   ✅ NFT acuñado!');

  // 7. Resumen final
  console.log('\n=== RESUMEN FINAL ===');
  console.log('✅ Compra en el Mall: exitosa');
  console.log('✅ Pago vía Mandate SDK: exitoso');
  console.log('✅ Intención liquidada: exitosa');
  console.log('✅ NFT de reputación: acuñado');
  console.log('💰 Comisión para ti:', (Number(payment.fee)).toFixed(6), 'MON');
  console.log('\n🎉 EL ECOSISTEMA COMPLETO FUNCIONA!');
}

main().catch(console.error);
