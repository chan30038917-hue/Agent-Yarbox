import { AgentYarbox } from './index.js';
import { readFileSync } from 'fs';
import { MandateSDK } from '@chan30/mandate-sdk';
import { JsonRpcProvider, Contract, parseEther, keccak256, toUtf8Bytes, Wallet } from 'ethers';

const provider = new JsonRpcProvider('https://rpc3.monad.xyz', 143);
const mandatos = JSON.parse(readFileSync('/home/usuariochan/aethel-autapon/integration/mandatos-agentes.json', 'utf8'));

// Usamos el agente-05
const agente = mandatos[4];
// Usamos la clave del owner (tuya) para acuñar el NFT
const ownerKey = readFileSync('/home/usuariochan/agent-yarbox/.env', 'utf8').match(/PRIVATE_KEY=(.*)/)[1].trim();

const yarbox = new AgentYarbox({
  address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC',
  privateKey: agente.privateKey,
});

const sdk = new MandateSDK({
  privateKey: agente.privateKey,
  rpcUrl: 'https://rpc3.monad.xyz',
  chainId: 143,
});

const NFT_ADDRESS = '0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8';
const NFT_ABI = [
  { "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}, {"internalType": "uint256", "name": "_intentId", "type": "uint256"}, {"internalType": "uint256", "name": "_maxAmount", "type": "uint256"}, {"internalType": "bytes32", "name": "_paymentNonce", "type": "bytes32"}, {"internalType": "uint256", "name": "_timestamp", "type": "uint256"}], "name": "mintReceipt", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType": "address", "name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }
];

const ownerWallet = new Wallet(ownerKey, provider);
const nftContract = new Contract(NFT_ADDRESS, NFT_ABI, ownerWallet);
const nftReadOnly = new Contract(NFT_ADDRESS, NFT_ABI, provider);

console.log('=== PRUEBA REAL COMPLETA ===');
console.log('Agente:', agente.agentId);
console.log('Dirección:', agente.address);

// Verificar saldo del agente
const balance = await provider.getBalance(agente.address);
console.log('Saldo agente:', (Number(balance) / 1e18).toFixed(4), 'MON');
console.log('Owner para NFT:', ownerWallet.address);

// 1. Commit Intent
console.log('\n1. Commiteando intención...');
const intentHash = keccak256(toUtf8Bytes('real-' + Date.now()));
const conditionHash = keccak256(toUtf8Bytes('condition-real'));
const maxAmount = parseEther('0.05');

const totalBefore = await yarbox.publicClient.readContract({
  address: yarbox.address,
  abi: [{ "inputs": [], "name": "totalIntents", "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}], "stateMutability": "view", "type": "function" }],
  functionName: 'totalIntents',
});

const txCommit = await yarbox.commitIntent({ intentHash, conditionHash, mandateId: agente.mandateId, maxAmount, erc8004AgentId: 0n });
console.log('   Tx Commit:', txCommit);
await new Promise(r => setTimeout(r, 5000));

const intentId = Number(totalBefore);
console.log('   Intent ID creado:', intentId);

// 2. Pay
console.log('\n2. Pagando...');
const payment = await sdk.pay({
  mandateId: agente.mandateId,
  passkey: agente.passkey,
  amount: '0.05',
  recipient: '0xF6805F61820A860db4B7462Bc9940793fC8ed22A',
  gasLimit: 500000,
});
console.log('   Tx Pay:', payment.tx);
console.log('   Payment Nonce:', payment.paymentNonce);
await new Promise(r => setTimeout(r, 5000));

// 3. Settle
console.log('\n3. Liquidando intención...');
const resultHash = keccak256(toUtf8Bytes('result-' + payment.tx));
const txSettle = await yarbox.settleIntent({ intentId, paymentNonce: payment.paymentNonce, resultHash });
console.log('   Tx Settle:', txSettle);
await new Promise(r => setTimeout(r, 5000));

// 4. Ver tiquete final
console.log('\n4. Tiquete final:');
const receipt = await yarbox.getReceipt(intentId);
console.log('   Agente:', receipt[0]);
console.log('   Settled:', receipt[9]);
console.log('   Inconsistent:', receipt[10]);

// 5. Acuñar NFT (desde el owner)
console.log('\n5. Acuñando NFT de reputación...');
const txMint = await nftContract.mintReceipt(
  agente.address,
  intentId,
  maxAmount,
  payment.paymentNonce,
  Math.floor(Date.now() / 1000)
);
console.log('   Tx Mint:', txMint.hash);
await txMint.wait();
console.log('   ✅ NFT acuñado!');

// 6. Ver NFTs del agente
console.log('\n6. NFTs del agente:');
const nftBalance = await nftReadOnly.balanceOf(agente.address);
console.log('   Total NFTs:', nftBalance.toString());

console.log('\n✅ PRUEBA REAL COMPLETA EXITOSA!');
