import { AgentYarbox } from './index.js';
import { readFileSync } from 'fs';

// Leer el agente-01 de los mandatos
const mandatos = JSON.parse(readFileSync('/home/usuariochan/aethel-autapon/integration/mandatos-agentes.json', 'utf8'));
const agente = mandatos[0];

const yarbox = new AgentYarbox({
  address: '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC',
  privateKey: agente.privateKey,
});

console.log('Agente:', agente.agentId);
console.log('Dirección:', agente.address);

// 1. Commit Intent (con los 5 argumentos: intentHash, conditionHash, mandateId, maxAmount, erc8004AgentId)
const intentHash = '0x' + '1'.repeat(64);
const conditionHash = '0x' + '2'.repeat(64);
const mandateId = agente.mandateId;
const maxAmount = 50000000000000000n; // 0.05 MON
const erc8004AgentId = 0n; // <-- Este faltaba

console.log('1. Commiteando intención...');
const txCommit = await yarbox.commitIntent({ intentHash, conditionHash, mandateId, maxAmount, erc8004AgentId });
console.log('   Tx:', txCommit);

// 2. Ver el tiquete (aún no liquidado)
await new Promise(r => setTimeout(r, 3000));
const receipt = await yarbox.getReceipt(1);
console.log('2. Tiquete:', receipt);
