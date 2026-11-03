import { spawn } from 'child_process';

// Usamos la ruta absoluta de node que ya conocemos
const nodePath = '/home/usuariochan/.nvm/versions/node/v20.20.2/bin/node';
const serverPath = '/home/usuariochan/agent-yarbox/mcp-server/server.js';

console.log('Iniciando servidor MCP...');
const p = spawn(nodePath, [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });

// Enviamos la petición para listar herramientas
p.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'tools/list', params: {}
}) + '\n');

// Enviamos la petición para ejecutar list_services
p.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_services', arguments: {} }
}) + '\n');

let out = '';
p.stdout.on('data', (d) => {
  out += d;
});

// Esperamos 3 segundos y mostramos el resultado
setTimeout(() => {
  console.log('\n--- RESPUESTA DEL SERVIDOR MCP ---');
  console.log(out);
  p.kill();
}, 3000);
