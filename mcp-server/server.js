import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.API_URL || "http://localhost:3001/api";

const server = new Server(
  { name: "agent-yarbox-mall", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_services",
        description: "Lista todos los servicios activos disponibles en el Agent Mall de AgentYarbox.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "buy_service",
        description: "Compra un servicio del Mall usando el ID del servicio y el ID del agente (ej. agente-03).",
        inputSchema: {
          type: "object",
          properties: {
            serviceId: { type: "string", description: "ID del servicio a comprar" },
            agentId: { type: "string", description: "ID del agente comprador (ej. agente-03)" },
          },
          required: ["serviceId", "agentId"],
        },
      },
      {
        name: "register_service",
        description: "Registra un nuevo servicio (tienda) en el Agent Mall. Requiere nombre, descripción, precio, endpoint y el ID del agente vendedor.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nombre del servicio (ej. API de Clima)" },
            description: { type: "string", description: "Descripción breve del servicio" },
            price: { type: "string", description: "Precio en MON (ej. 0.05)" },
            endpoint: { type: "string", description: "URL del servicio o endpoint de la API" },
            agentId: { type: "string", description: "ID del agente vendedor (ej. agente-01)" },
          },
          required: ["name", "description", "price", "endpoint", "agentId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_services") {
    try {
      const res = await fetch(`${API_URL}/services`);
      const data = await res.json();
      const activeServices = data.services.filter(s => s.active);
      if (activeServices.length === 0) {
        return { content: [{ type: "text", text: "No hay servicios activos en este momento." }] };
      }
      const list = activeServices.map(s => 
        `- ID: ${s.serviceId} | Nombre: ${s.name} | Precio: ${(Number(s.price)/1e18).toFixed(4)} MON | Reputación mínima: ${s.reputationRequired} NFTs`
      ).join("\n");
      return { content: [{ type: "text", text: `Servicios disponibles en el Agent Mall:\n${list}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error al conectar con el Mall: ${e.message}` }] };
    }
  }

  if (name === "buy_service") {
    const { serviceId, agentId } = args;
    try {
      const res = await fetch(`${API_URL}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, agentId }),
      });
      const data = await res.json();
      if (data.ok) {
        return { content: [{ type: "text", text: `✅ Compra exitosa!\nIntent ID: ${data.intentId}\nNFT Tx: ${data.nftTx}\nComisión: ${data.comision} MON` }] };
      } else {
        return { content: [{ type: "text", text: `❌ Error en la compra: ${data.error}` }] };
      }
    } catch (e) {
      return { content: [{ type: "text", text: `Error de conexión: ${e.message}` }] };
    }
  }

  if (name === "register_service") {
    const { name: serviceName, description, price, endpoint, agentId } = args;
    try {
      const res = await fetch(`${API_URL}/register-service`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: serviceName, description, price, endpoint, agentId }),
      });
      const data = await res.json();
      if (data.ok) {
        return { content: [{ type: "text", text: `✅ Servicio registrado exitosamente!\nID del servicio: ${data.serviceId}\nTx: ${data.tx}` }] };
      } else {
        return { content: [{ type: "text", text: `❌ Error al registrar: ${data.error}` }] };
      }
    } catch (e) {
      return { content: [{ type: "text", text: `Error de conexión: ${e.message}` }] };
    }
  }

  throw new Error(`Herramienta desconocida: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MCP Server para Agent Mall corriendo en stdio");
