import express from 'express';
import axios from 'axios';
import * as cheerioModule from 'cheerio';
const cheerio = cheerioModule.default || cheerioModule;

const router = express.Router();

const cobrar = (precio, moneda) => (req, res, next) => {
  if (!req.headers['payment-signature']) {
    const paymentRequired = {
      x402Version: 2,
      accepts: [
        {
          scheme: "exact", network: "eip155:143", amount: precio, asset: moneda,
          payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3", maxTimeoutSeconds: 300,
          extra: { name: "USDC", version: "2" }
        },
        {
          scheme: "exact", network: "eip155:8453", amount: precio, asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo: "0x38EfF524dd22E036836b43fF0992D4A75CE0e9C3", maxTimeoutSeconds: 300,
          extra: { name: "USD Coin", version: "2" }
        }
      ]
    };
    return res.status(402).set('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentRequired)).toString('base64')).json({ error: "Payment Required" });
  }
  next();
};

// 1. Lector de Páginas Web (REAL con cheerio)
router.post('/leer-web', cobrar("1000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: "Falta la URL" });
    
    const response = await axios.get(url, { timeout: 10000 });
    const html = response.data;
    
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, ads, iframe').remove();
    
    const title = $('title').text().trim() || 'Sin título';
    const markdown = $('body').text().replace(/\s+/g, ' ').trim();

    res.json({ success: true, data: { url, title, markdown: markdown.slice(0, 5000) } });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error al leer la web: " + e.message });
  }
});

// 2. Detective de Seguridad (REAL con GeckoTerminal)
router.get('/riesgo-token/:address', cobrar("2000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    const tokenAddress = req.params.address;
    const url = `https://api.geckoterminal.com/api/v2/networks/monad/tokens/${tokenAddress}`;
    const response = await axios.get(url);
    
    if (response.status !== 200) return res.status(404).json({ success: false, error: "Token no encontrado" });

    const attributes = response.data.data.attributes;
    const liquidity = parseFloat(attributes.total_reserve_in_usd || 0);
    const volume = parseFloat(attributes.volume_usd?.h24 || 0);
    
    let riskScore = "Bajo";
    let isHoneypot = false;
    if (liquidity < 10000) { riskScore = "Alto"; isHoneypot = true; }
    else if (liquidity < 50000) { riskScore = "Medio"; }

    res.json({ success: true, data: { token: tokenAddress, riskScore, isHoneypot, liquidity, volume24h: volume, recommendation: riskScore === "Alto" ? "No invertir" : "Seguro para operar", source: "GeckoTerminal (Monad)" } });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error al analizar token: " + e.message });
  }
});



export default router;
