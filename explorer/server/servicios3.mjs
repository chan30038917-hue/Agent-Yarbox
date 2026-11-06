import express from 'express';
import OpenAI from 'openai';
import 'dotenv/config';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

router.post('/analizar-texto', cobrar("2000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ success: false, error: "Falta el texto a analizar" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un analista experto. Analiza el sentimiento del siguiente texto y devuelve un JSON con 'sentiment' (positivo/negativo/neutral) y 'reason' (breve explicación)." },
        { role: "user", content: texto }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error en OpenAI: " + e.message });
  }
});

router.post('/extraer-json', cobrar("2000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto) return res.status(400).json({ success: false, error: "Falta el texto para extraer datos" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un extractor de datos. Del texto del usuario, extrae los datos clave y devuélvelos en formato JSON. Si no hay datos claros, devuelve un JSON vacío." },
        { role: "user", content: texto }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: "Error en OpenAI: " + e.message });
  }
});

export default router;
