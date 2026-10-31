import { writeFileSync } from 'fs';

const capas = [
  ["agente-01", "agente-02", "agente-03", "agente-04", "agente-05"],
  ["agente-06", "agente-07", "agente-08", "agente-09", "agente-10"],
  ["agente-01", "agente-02", "agente-03"]
];

const resultados = [];
const ruta = '/home/usuariochan/agent-yarbox/explorer/web/dashboard-status.json';

function guardar(capaActual, agenteActual = null) {
  const estado = {
    timestamp: Date.now(),
    capasTotales: capas.length,
    capaActual,
    agenteActual,
    capas: capas.map((c, i) => ({
      numero: i + 1,
      pagos: c,
      estado: i < capaActual ? 'completada' : (i === capaActual ? 'en_progreso' : 'pendiente')
    })),
    resultados
  };
  writeFileSync(ruta, JSON.stringify(estado, null, 2));
}

async function simular() {
  console.log("Iniciando simulación visual...");
  for (let i = 0; i < capas.length; i++) {
    const capa = capas[i];
    console.log(`Ejecutando Capa ${i + 1}...`);
    
    for (const agente of capa) {
      guardar(i, agente);
      await new Promise(r => setTimeout(r, 1500)); // Pausa para ver al agente brillar
      resultados.push({ ok: true, agente });
      guardar(i, null); // Termina el agente
    }
    await new Promise(r => setTimeout(r, 1000)); // Pausa entre capas
  }
  guardar(capas.length, null);
  console.log("Simulación terminada.");
}

simular();
