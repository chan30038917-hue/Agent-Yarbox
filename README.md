# AgentYarbox

**Caja de accountability para agentes autónomos en Monad.**  
Cada intención se compromete antes de ejecutar. Cada pago se verifica contra el mandato. Cada resultado queda registrado on-chain.

---

## Índice

1. [Qué es](#qué-es)
2. [Por qué es único](#por-qué-es-único)
3. [Contratos desplegados en Monad Mainnet](#contratos-desplegados-en-monad-mainnet)
4. [Funciones principales](#funciones-principales)
5. [Flujo completo](#flujo-completo)
6. [Explorador de Accountability](#explorador-de-accountability)
7. [SDK de JavaScript](#sdk-de-javascript)
8. [Tests](#tests)
9. [Limitaciones conocidas](#limitaciones-conocidas)
10. [Instalación y despliegue](#instalación-y-despliegue)
11. [Integración con AETHEL-AUTAPON](#integración-con-aethel-autapon)
12. [Casos de uso](#casos-de-uso)
13. [Licencia](#licencia)

---

## Qué es

**AgentYarbox** es un contrato inteligente que registra compromisos de intención de agentes autónomos y verifica que los pagos reales coincidan con lo prometido. Se integra con **PaymentGate (Mandate)** y **MandateRegistry** para verificar pagos on-chain.

En términos simples: es un **notario on-chain para agentes**. El agente dice *"voy a pagar X con el mandato Y"*, y AgentYarbox verifica que el pago real sea exactamente ese.

---

## Por qué es único

| Otros proyectos | AgentYarbox |
|---|---|
| Registran intenciones, pero no verifican pagos | ✅ Verifica que el pago existe en PaymentGate |
| Verifican pagos, pero no registran intenciones | ✅ Registra la intención antes de pagar |
| No tienen tiquete de pago para auditorías | ✅ `getReceipt` devuelve el tiquete completo |
| No están integrados con Mandate | ✅ Integrado con PaymentGate y MandateRegistry |

> La combinación de **compromiso de intención + verificación on-chain + tiquete de pago** no existe en otro proyecto de Monad.

---

## Contratos desplegados en Monad Mainnet

| Contrato | Dirección | Verificación |
|---|---|---|
| **AgentYarbox** | `0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC` | ✅ `exact_match` |
| **PaymentGate (Mandate)** | `0xc8b31cc4E238905D96AAe66A06Ebc821b4E399aD` | ✅ `already_verified` |
| **MandateRegistry (Mandate)** | `0x7695Cf7a86d6D08b5283a69c10f94b014D421649` | ✅ `already_verified` |

---

## Funciones principales

| Función | Descripción |
|---|---|
| `commitIntent` | El agente registra su intención antes de pagar (hash de su lógica, condiciones, `mandateId`, `maxAmount`, `erc8004AgentId`). |
| `settleIntent` | El agente liquida con el `paymentNonce` real. El contrato verifica que el pago existe en PaymentGate, que el mandato es del agente y que no está expirado. Si algo falla, marca `inconsistent`. |
| `getReceipt` | Devuelve el tiquete de pago completo para auditorías (`intentId`, agente, `mandateId`, `maxAmount`, `paymentNonce`, `resultHash`, timestamp, `settled`, `inconsistent`). |
| `getMaxAmount` | Devuelve el `maxAmount` de una intención (para que AETHEL lo consulte antes de pagar). |
| `isPaymentNonceUsed` | Verifica si un `paymentNonce` ya fue usado (evita doble gasto). |

---

## Flujo completo

1. El agente **commitea** su intención en AgentYarbox.
2. **AETHEL** (coordinador de enjambres) verifica el monto contra `maxAmount` off-chain.
3. **AETHEL** ejecuta el pago vía Mandate SDK.
4. El agente **liquida** la intención con el `paymentNonce` real.
5. AgentYarbox **verifica** que el pago existe, que el mandato es del agente y que no expiró.
6. `getReceipt` devuelve el **tiquete de pago completo**.

---

## Explorador de Accountability

El explorador es una aplicación web que muestra, en tiempo real, todos los eventos del contrato `AgentYarbox`: intenciones commiteadas, pagos liquidados y casos inconsistentes. Cualquiera puede verificar on-chain lo que muestra.

### Qué muestra

- **Estadísticas**: total de eventos, commiteadas, liquidadas, inconsistentes.
- **Tabla de eventos**: intent ID, estado, agente, monto, bloque, transacción.
- **Tiquete de auditoría**: al hacer clic en "Ver tiquete", se muestra el `getReceipt` completo.

### Cómo ejecutarlo

```bash
cd explorer
npm install
node indexer/index.mjs    # indexa eventos
node server/api.mjs        # inicia la API y el frontend en http://localhost:3001
