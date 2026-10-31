# Casos de uso de AgentYarbox

Tres ejemplos reales de cómo AgentYarbox resuelve problemas de accountability en agentes autónomos.

---

## Caso 1: Agente de trading que paga por datos de precios

### El problema

Un agente de trading autónomo necesita datos de precios en tiempo real para tomar decisiones. Paga 0.05 MON por cada consulta a una API de datos. El dueño del agente quiere saber:

- ¿Cuánto está gastando el agente?
- ¿Está pagando lo que prometió?
- ¿Hay algún pago duplicado?

Sin AgentYarbox, el dueño no tiene forma de verificarlo. El agente dice "pagué 0.05 MON" y hay que confiar en su palabra.

### La solución con AgentYarbox

1. El dueño registra un mandato en `MandateRegistry` con `maxPerTx = 0.10 MON` y `maxPerPeriod = 10 MON`.
2. El agente **commitea** su intención en `AgentYarbox`: *"Voy a pagar 0.05 MON con el mandato 0x123"*.
3. El agente **paga** vía `PaymentGate`.
4. El agente **liquida** la intención en `AgentYarbox` con el `paymentNonce` real.
5. El dueño consulta `getReceipt(intentId)` y ve el tiquete completo: agente, mandato, monto máximo, nonce, timestamp, `settled: true`.

### El resultado

El dueño puede auditar cada pago del agente sin confiar en su palabra. Si el agente intenta pagar más de lo prometido, el mandato lo bloquea. Si intenta pagar dos veces con el mismo nonce, `settleIntent` falla.

**Tiempo de integración:** 2 horas (usando `@chan30/agent-yarbox`).

---

## Caso 2: Agente de cómputo que paga por GPU

### El problema

Un agente de cómputo necesita alquilar GPU para entrenar modelos pequeños. Paga 0.50 MON por hora a un proveedor de cómputo. El proveedor quiere garantías de que el agente tiene fondos y que el pago se hará.

Sin AgentYarbox, el proveedor tiene que confiar en que el agente pagará después de usar la GPU. Si el agente no paga, el proveedor pierde.

### La solución con AgentYarbox

1. El agente **commitea** su intención en `AgentYarbox`: *"Voy a pagar 0.50 MON por 1 hora de GPU, con el mandato 0x456"*.
2. El proveedor verifica la intención en el explorador: ve el `maxAmount` y el `mandateId`.
3. El proveedor entrega la GPU.
4. El agente **paga** vía `PaymentGate`.
5. El agente **liquida** la intención.
6. El proveedor consulta `getReceipt(intentId)` y confirma que el pago se hizo.

### El resultado

El proveedor puede verificar **antes de entregar el servicio** que el agente tiene una intención commiteada y un mandato válido. Eso reduce el riesgo de impago. Si el agente no liquida, el proveedor lo sabe y puede marcarlo como no confiable.

**Tiempo de integración:** 1 día (el proveedor necesita leer el explorador o la API).

---

## Caso 3: Enjambre de agentes que pagan por APIs de investigación

### El problema

Un enjambre de 10 agentes de investigación paga por APIs de datos (noticias, papers, bases de datos). Cada agente hace 3 pagos de 0.05 MON al día. El coordinador del enjambre (AETHEL) necesita:

- Ejecutar los pagos en paralelo sin saturar el RPC.
- Verificar que cada pago corresponde a una intención.
- Guardar los tiquetes para auditoría.

Sin AgentYarbox, el coordinador no tiene forma de verificar que los 30 pagos diarios se hicieron correctamente.

### La solución con AgentYarbox

1. El coordinador (AETHEL) usa `aethel-autapon` para agrupar las intenciones por agente y planificar las capas del DAG.
2. Para cada capa, AETHEL hace `commitIntent` en `AgentYarbox`.
3. AETHEL ejecuta los pagos vía `mandate-sdk`.
4. AETHEL hace `settleIntent` para cerrar cada intención.
5. AETHEL guarda los tiquetes en formato JSONL para auditoría.
6. El dueño del enjambre consulta el explorador y ve los 30 pagos del día, con sus tiquetes completos.

### El resultado

El dueño del enjambre tiene un registro completo de cada pago, verificable on-chain. Si un agente falla, el tiquete lo muestra (`inconsistent: true`). Si un pago se duplica, `settleIntent` lo bloquea.

**Tiempo de integración:** 3 días (AETHEL ya está listo, solo hay que configurarlo).

---

## Resumen

| Caso | Problema | Solución | Tiempo |
|---|---|---|---|
| **Trading** | El dueño no puede auditar los pagos del agente | Tiquete completo on-chain | 2 horas |
| **Cómputo** | El proveedor no sabe si el agente pagará | Intención commiteada antes de entregar | 1 día |
| **Enjambre** | El coordinador no puede verificar 30 pagos/día | DAG + tiquetes JSONL | 3 días |

---

## Lo que todos los casos tienen en común

1. **Commit antes de pagar.** El agente promete lo que va a hacer.
2. **Verificación on-chain.** El pago se verifica contra el mandato.
3. **Tiquete completo.** Cada pago deja un recibo verificable.
4. **Sin confianza.** No hay que confiar en el agente, en el coordinador ni en el proveedor. Todo está on-chain.

---

*AgentYarbox. Cada pago. Verificado. Para siempre.*
