import express from 'express';
import OpenAI from 'openai';
import 'dotenv/config';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

router.post('/analizar-texto', cobrar("20000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
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

router.post('/extraer-json', cobrar("15000", "0x754704Bc059F8C67012fEd69BC8A327a5aafb603"), async (req, res) => {
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
