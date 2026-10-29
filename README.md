# AgentYarbox

**Caja de accountability para agentes autónomos en Monad.** Cada intención se compromete antes de ejecutar. Cada pago se verifica contra el mandato. Cada resultado queda registrado on-chain.

---

## Qué es

AgentYarbox es un contrato inteligente que registra compromisos de intención de agentes autónomos y verifica que los pagos reales coincidan con lo prometido. Se integra con `PaymentGate` (Mandate) y `MandateRegistry` para verificar pagos on-chain.

**En términos simples:** es un notario on-chain para agentes. El agente dice "voy a pagar X con el mandato Y", y AgentYarbox verifica que el pago real sea exactamente ese.

---

## Por qué es único

| Otros proyectos | AgentYarbox |
|---|---|
| Registran intenciones, pero no verifican pagos | ✅ Verifica que el pago existe en `PaymentGate` |
| Verifican pagos, pero no registran intenciones | ✅ Registra la intención antes de pagar |
| No tienen tiquete de pago para auditorías | ✅ `getReceipt` devuelve el tiquete completo |
| No están integrados con Mandate | ✅ Integrado con `PaymentGate` y `MandateRegistry` |

**La combinación de compromiso de intención + verificación on-chain + tiquete de pago no existe en otro proyecto de Monad.**

---

## Contratos desplegados en Monad Mainnet

| Contrato | Dirección |
|---|---|
| **AgentYarbox** | `0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC` |
| **PaymentGate** (Mandate) | `0xc8b31cc4E238905D96AAe66A06Ebc821b4E399aD` |
| **MandateRegistry** (Mandate) | `0x7695Cf7a86d6D08b5283a69c10f94b014D421649` |

---

## Qué hace

- **`commitIntent`**: El agente registra su intención antes de pagar (hash de su lógica, condiciones, mandateId, maxAmount, erc8004AgentId).
- **`settleIntent`**: El agente liquida con el `paymentNonce` real. El contrato verifica que el pago existe en `PaymentGate`, que el mandato es del agente, y que no está expirado. Si algo falla, marca `inconsistent`.
- **`getReceipt`**: Devuelve el tiquete de pago completo para auditorías (intentId, agente, mandateId, maxAmount, paymentNonce, resultHash, timestamp, settled, inconsistent).
- **`getMaxAmount`**: Devuelve el `maxAmount` de una intención (para que AETHEL lo consulte antes de pagar).
- **`isPaymentNonceUsed`**: Verifica si un `paymentNonce` ya fue usado (evita doble gasto).

---

## Cómo funciona el flujo completo

1. El agente commitea su intención en AgentYarbox.
2. AETHEL (coordinador de enjambres) verifica el monto contra `maxAmount` off-chain.
3. AETHEL ejecuta el pago vía Mandate SDK.
4. El agente liquida la intención con el `paymentNonce` real.
5. AgentYarbox verifica que el pago existe, que el mandato es del agente, y que no expiró.
6. `getReceipt` devuelve el tiquete de pago completo.

---

## Tests

**13 tests unitarios, todos pasando:**

| Test | Qué verifica |
|---|---|
| `testCommitIntent` | Registra intención correctamente |
| `testCommitIntentEmptyHash` | Falla si hash vacío |
| `testCommitIntentEmptyMandate` | Falla si mandate vacío |
| `testCommitIntentEmptyAmount` | Falla si amount 0 |
| `testGetIntentsByAgent` | Devuelve IDs correctos |
| `testSettleIntentSuccess` | Liquida correctamente |
| `testSettleIntentNotAgent` | Falla si no es el agente |
| `testSettleIntentAlreadySettled` | Falla si ya liquidado |
| `testSettleIntentPaymentNotFound` | Marca inconsistente si no hay pago |
| `testSettleIntentMandateExpired` | Marca inconsistente si expiró |
| `testSettleIntentNonceAlreadyUsed` | Falla si nonce reusado |
| `testGetMaxAmount` | Devuelve maxAmount correcto |
| `testGetReceipt` | Devuelve tiquete completo |

---

## Limitaciones conocidas:

- **No verifica el monto real pagado vs `maxAmount` on-chain.** `PaymentGate` no expone el monto de un pago dado su `paymentNonce`. La verificación de monto se hace **off-chain en AETHEL** antes de pagar. Si confías en AETHEL, esto es suficiente.
- **No valida el destinatario (`recipient`) on-chain.** La lista blanca de destinatarios se gestiona off-chain en AETHEL. Tienes que validar tu destinatario.
- **No puede revertir pagos.** Una vez que `PaymentGate` autoriza un pago, es irreversible. AgentYarbox solo registra y verifica.

---

## Instalación y despliegue

```bash
git clone https://github.com/chan30038917-hue/Agent-Yarbox.git
cd Agent-Yarbox
forge install foundry-rs/forge-std
forge build
forge test
cp .env.example .env
# edita .env con tu PRIVATE_KEY, PAYMENT_GATE y MANDATE_REGISTRY
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.monad.xyz --broadcast

Integración con AETHEL-AUTAPON
AETHEL es el coordinador de enjambres que:

Commitea intenciones en AgentYarbox (commitIntent).

Ejecuta los pagos vía Mandate SDK (sdk.pay).

Obtiene el tiquete de pago (getReceipt).

Guarda los tiquetes en formato JSONL para auditorías.

Repositorio de AETHEL: github.com/chan30038917-hue/aethel-autapon

Licencia
MIT
