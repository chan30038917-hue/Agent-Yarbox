import { spawn } from 'child_process';

const nodePath = '/home/usuariochan/.nvm/versions/node/v20.20.2/bin/node';
const serverPath = '/home/usuariochan/agent-yarbox/mcp-server/server.js';

console.log('Iniciando servidor MCP...');
const p = spawn(nodePath, [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });

// 1. Pedir la lista de herramientas
p.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
}) + '\n');

// 2. Ejecutar list_services (para ver si conecta con la API del Mall)
p.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} }
}) + '\n');

let out = '';
p.stdout.on('data', (d) => { out += d; });

setTimeout(() => {
  console.log('\n--- RESPUESTA DEL SERVIDOR MCP ---');
  console.log(out);
  p.kill();
}, 3000);
