import { createPublicClient, http, parseAbiItem } from 'viem';
import db from './db.mjs';

const RPC_URL = 'https://rpc.monad.xyz';
const CONTRACT_ADDRESS = '0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC';
const START_BLOCK = 117502959n;
const BLOCK_CHUNK = 100n;

const client = createPublicClient({ transport: http(RPC_URL) });

const INTENT_COMMITTED = parseAbiItem(
  'event IntentCommitted(uint256 indexed id, address indexed agent, uint64 erc8004AgentId, bytes32 intentHash, bytes32 mandateId, uint256 maxAmount)'
);
const INTENT_SETTLED = parseAbiItem(
  'event IntentSettled(uint256 indexed id, bytes32 paymentNonce, bytes32 resultHash, uint256 timestamp)'
);
const INTENT_INCONSISTENT = parseAbiItem(
  'event IntentInconsistent(uint256 indexed id, string reason)'
);

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (
    eventName, intentId, agent, mandateId, maxAmount,
    paymentNonce, resultHash, timestamp, settled, inconsistent, reason,
    blockNumber, transactionHash
  ) VALUES (
    @eventName, @intentId, @agent, @mandateId, @maxAmount,
    @paymentNonce, @resultHash, @timestamp, @settled, @inconsistent, @reason,
    @blockNumber, @transactionHash
  )
`);

const updateCheckpoint = db.prepare('UPDATE checkpoint SET lastBlock = ? WHERE id = 1');
const getCheckpoint = db.prepare('SELECT lastBlock FROM checkpoint WHERE id = 1');

let lastBlock = BigInt(getCheckpoint.get().lastBlock);
const currentBlock = await client.getBlockNumber();
console.log(`Indexando desde bloque ${lastBlock} hasta ${currentBlock}`);

for (let from = lastBlock; from <= currentBlock; from += BLOCK_CHUNK) {
  const to = from + BLOCK_CHUNK - 1n > currentBlock ? currentBlock : from + BLOCK_CHUNK - 1n;
  console.log(`Leyendo bloques ${from} a ${to}`);

  const [committedLogs, settledLogs, inconsistentLogs] = await Promise.all([
    client.getLogs({ address: CONTRACT_ADDRESS, event: INTENT_COMMITTED, fromBlock: from, toBlock: to }),
    client.getLogs({ address: CONTRACT_ADDRESS, event: INTENT_SETTLED, fromBlock: from, toBlock: to }),
    client.getLogs({ address: CONTRACT_ADDRESS, event: INTENT_INCONSISTENT, fromBlock: from, toBlock: to }),
  ]);

  for (const log of committedLogs) {
    insertEvent.run({
      eventName: 'IntentCommitted',
      intentId: log.args.id.toString(),
      agent: log.args.agent,
      mandateId: log.args.mandateId,
      maxAmount: log.args.maxAmount.toString(),
      paymentNonce: null,
      resultHash: null,
      timestamp: null,
      settled: 0,
      inconsistent: 0,
      reason: null,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
    });
  }

  for (const log of settledLogs) {
    insertEvent.run({
      eventName: 'IntentSettled',
      intentId: log.args.id.toString(),
      agent: null,
      mandateId: null,
      maxAmount: null,
      paymentNonce: log.args.paymentNonce,
      resultHash: log.args.resultHash,
      timestamp: log.args.timestamp.toString(),
      settled: 1,
      inconsistent: 0,
      reason: null,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
    });
  }

  for (const log of inconsistentLogs) {
    insertEvent.run({
      eventName: 'IntentInconsistent',
      intentId: log.args.id.toString(),
      agent: null,
      mandateId: null,
      maxAmount: null,
      paymentNonce: null,
      resultHash: null,
      timestamp: null,
      settled: 0,
      inconsistent: 1,
      reason: log.args.reason,
      blockNumber: Number(log.blockNumber),
      transactionHash: log.transactionHash,
    });
  }

  updateCheckpoint.run(Number(to));
  lastBlock = to;
}

console.log('Indexación completada.');
