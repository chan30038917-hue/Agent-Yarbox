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
router.get('/precio-mon', cobrar("10000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), (req, res) => {
  res.json({ success: true, data: { token: "MON", price: "$0.0191", timestamp: Date.now() } });
});

// 2. Alquiler de Cerebros (LLM Simulado)
router.post('/analizar-texto', cobrar("20000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), (req, res) => {
  res.json({ success: true, data: { analysis: "El texto es positivo y sugiere una oportunidad de arbitraje.", confidence: 0.92 } });
});

// 3. El Detective (Validación de Wallet)
router.get('/validar-wallet/:address', cobrar("50000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), (req, res) => {
  res.json({ success: true, data: { address: req.params.address, reputation: "Trusted", score: 85, nfts: 12 } });
});

// 4. Chisme del Mercado (Sentimiento)
router.get('/sentimiento-mercado', cobrar("15000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), (req, res) => {
  res.json({ success: true, data: { sentiment: "Bullish", score: 78, mentions: 1250 } });
});

// 5. Relojero (Gas y Tiempo)
router.get('/mejor-momento', cobrar("5000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), (req, res) => {
  res.json({ success: true, data: { gas: "102 Gwei", recommendation: "Wait 5 minutes for lower fees" } });
});

export default router;
