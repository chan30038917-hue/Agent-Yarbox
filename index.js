import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ABI = JSON.parse(readFileSync(join(__dirname, 'abi', 'AgentYarbox.json'), 'utf8'));

const MONAD_MAINNET = {
  id: 143,
  name: 'Monad',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
};

export class AgentYarbox {
  constructor({ address, privateKey, rpcUrl } = {}) {
    if (!address) throw new Error('Falta la dirección del contrato AgentYarbox');
    this.address = address;
    this.rpcUrl = rpcUrl || MONAD_MAINNET.rpcUrls.default.http[0];
    const chain = { ...MONAD_MAINNET, rpcUrls: { default: { http: [this.rpcUrl] } } };
    this.publicClient = createPublicClient({ chain, transport: http(this.rpcUrl) });
    if (privateKey) {
      this.account = privateKeyToAccount(privateKey);
      this.walletClient = createWalletClient({ account: this.account, chain, transport: http(this.rpcUrl) });
    }
  }

  async commitIntent({ intentHash, mandateId, maxAmount, erc8004AgentId }) {
    if (!this.walletClient) throw new Error('Se necesita privateKey para escribir');
    return await this.walletClient.writeContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'commitIntent',
      args: [intentHash, mandateId, maxAmount, erc8004AgentId],
    });
  }

  async settleIntent({ intentId, paymentNonce }) {
    if (!this.walletClient) throw new Error('Se necesita privateKey para escribir');
    return await this.walletClient.writeContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'settleIntent',
      args: [intentId, paymentNonce],
    });
  }

  async getReceipt(intentId) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'getReceipt',
      args: [intentId],
    });
  }

  async getMaxAmount(intentId) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'getMaxAmount',
      args: [intentId],
    });
  }

  async isPaymentNonceUsed(paymentNonce) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'isPaymentNonceUsed',
      args: [paymentNonce],
    });
  }

  async getIntentsByAgent(agent) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: ABI.abi,
      functionName: 'getIntentsByAgent',
      args: [agent],
    });
  }
}
