import express from 'express';
const router = express.Router();

// Middleware x402 para cobrar
const cobrar = (precio, moneda) => (req, res, next) => {
  if (!req.headers['payment-signature']) {
    const paymentRequired = {
      x402Version: 2,
      accepts: [{
        scheme: "exact", network: "eip155:143", amount: precio, asset: moneda,
        payTo: "0xF6805F61820A860db4B7462Bc9940793fC8ed22A", maxTimeoutSeconds: 300
      }]
    };
    return res.status(402).set('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentRequired)).toString('base64')).json({ error: "Payment Required" });
  }
  next();
};

// 1. Precios DeFi
import { createPublicClient, http, parseAbi } from 'viem';

const client = createPublicClient({ transport: http('https://rpc3.monad.xyz') });
const POOL_ADDRESS = '0x18a9fc874581f3ba12b7898f80a683c66fd5877fd74b26a85ba9a3a79c549954';

router.get('/precio-mon', cobrar("10000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    // Usamos la API de GeckoTerminal (que indexa MonadScan) para obtener el precio real
    const poolAddress = '0x8b926a72640b5766c5daa65365c24009618a91cab560946b550e4aa5ce2ae5f2';
    const url = `https://api.geckoterminal.com/api/v2/networks/monad/pools/${poolAddress}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Extraer el precio de la respuesta
    const price = data.data.attributes.base_token_price_usd;
    
    res.json({ 
      success: true, 
      data: { 
        token: "MON", 
        price: "$" + price, 
        timestamp: Date.now(),
        source: "GeckoTerminal (Monad)"
      } 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "No se pudo obtener el precio: " + e.message });
  }
});

// 2. Alquiler de Cerebros (LLM Simulado)


// 3. El Detective (Validación de Wallet)
router.get('/validar-wallet/:address', cobrar("50000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    const address = req.params.address;
    const REPUTATION_NFT = '0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8';
    
    // Leer el balance de NFTs de reputación (dato real on-chain)
    const balance = await client.readContract({
      address: REPUTATION_NFT,
      abi: [{ "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }],
      functionName: 'balanceOf',
      args: [address],
    });

    const nftBalance = Number(balance);
    let reputation = "Sin reputación";
    let score = 0;
    if (nftBalance >= 10) { reputation = "Muy confiable"; score = 90; }
    else if (nftBalance >= 5) { reputation = "Confiable"; score = 70; }
    else if (nftBalance >= 1) { reputation = "Nuevo"; score = 30; }

    res.json({ 
      success: true, 
      data: { 
        address: address, 
        reputation: reputation, 
        score: score, 
        nfts: nftBalance,
        source: "ReputationNFT (Monad On-Chain)"
      } 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error al validar wallet: " + e.message });
  }
});

// 4. Chisme del Mercado (Sentimiento)
router.get('/sentimiento-mercado', cobrar("15000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    // Usamos la API de CoinGecko para obtener el Fear & Greed Index real
    const response = await fetch('https://api.alternative.me/fng/');
    const data = await response.json();
    
    if (!data.data || !data.data[0]) {
      return res.status(500).json({ success: false, error: "No se pudo obtener el sentimiento del mercado" });
    }

    const sentiment = data.data[0];
    // sentiment.value es un string (ej. "75"), sentiment.value_classification es "Greed", "Fear", etc.
    
    res.json({ 
      success: true, 
      data: { 
        sentiment: sentiment.value_classification,
        score: parseInt(sentiment.value),
        timestamp: Date.now(),
        source: "Alternative.me (Fear & Greed Index)"
      } 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error al conectar con CoinGecko: " + e.message });
  }
});

// 5. Relojero (Gas y Tiempo)
router.get('/mejor-momento', cobrar("5000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    // Usamos el RPC de Monad para obtener el gas price real
    const response = await fetch('https://rpc3.monad.xyz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: []
      })
    });

    const data = await response.json();
    const gasPriceWei = parseInt(data.result, 16);
    const gasPriceGwei = (gasPriceWei / 1e9).toFixed(2);

    res.json({ 
      success: true, 
      data: { 
        gas: gasPriceGwei + ' Gwei',
        recommendation: gasPriceGwei < 50 ? 'Buen momento para transaccionar' : 'Espera un mejor momento',
        timestamp: Date.now(),
        source: "Monad RPC"
      } 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error al obtener el gas: " + e.message });
  }
});

export default router;
