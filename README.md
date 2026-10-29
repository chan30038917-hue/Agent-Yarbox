# AgentYarbox

Caja de accountability para agentes autónomos en Monad. Cada intención se compromete antes de ejecutar. Cada pago se verifica contra el mandato. Cada resultado queda registrado on-chain.

## Qué es

AgentYarbox es un contrato inteligente que registra compromisos de intención de agentes autónomos y verifica que los pagos reales coincidan con lo prometido. Se integra con `PaymentGate` (Mandate) y `MandateRegistry` para verificar pagos on-chain.

## Contratos desplegados en Monad Mainnet

| Contrato | Dirección |
|---|---|
| **AgentYarbox** | `0x4D0D993e6FF19279dF0E69d9cd9cC946480973dC` |
| **PaymentGate** (Mandate) | `0xc8b31cc4E238905D96AAe66A06Ebc821b4E399aD` |
| **MandateRegistry** (Mandate) | `0x7695Cf7a86d6D08b5283a69c10f94b014D421649` |

## Qué hace

- **`commitIntent`**: El agente registra su intención antes de pagar (hash de su lógica, condiciones, mandateId, maxAmount, erc8004AgentId).
- **`settleIntent`**: El agente liquida con el `paymentNonce` real. El contrato verifica que el pago existe en `PaymentGate`, que el mandato es del agente, y que no está expirado. Si algo falla, marca `inconsistent`.
- **`getReceipt`**: Devuelve el tiquete de pago completo para auditorías.
- **`getMaxAmount`**: Devuelve el `maxAmount` de una intención (para que AETHEL lo consulte).
- **`isPaymentNonceUsed`**: Verifica si un `paymentNonce` ya fue usado.

## Qué NO hace (limitaciones conocidas)

- **No verifica el monto real pagado vs `maxAmount` on-chain.** `PaymentGate` no expone el monto de un pago dado su `paymentNonce`. La verificación de monto se hace **off-chain en AETHEL** (el coordinador) antes de pagar.
- **No valida el destinatario (`recipient`) on-chain.** La lista blanca de destinatarios se gestiona off-chain en AETHEL.
- **No puede revertir pagos.** Una vez que `PaymentGate` autoriza un pago, es irreversible. AgentYarbox solo registra y verifica.

## Tests

13 tests unitarios, todos pasando:

```bash
forge test
