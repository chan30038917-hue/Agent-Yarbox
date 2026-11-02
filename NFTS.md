# Tiquetes NFT de Reputación

## ¿Qué es?
Cada pago liquidado en `AgentYarbox` puede convertirse en un NFT ERC-721 que certifica la reputación del agente. Es como un "historial crediticio" on-chain: mientras más NFTs tenga un agente, más confiable es.

## Contrato desplegado
- **ReputationNFT**: `0xDE2153656df0dd9b370bc9796A5dd04Ad24BF4f8`
- **Red**: Monad Mainnet (Chain ID 143)
- **Estándar**: ERC-721
- **Nombre**: AgentYarbox Receipt (AYR)

## Metadatos del NFT
Cada NFT contiene:
- `intentId`: ID de la intención liquidada.
- `agent`: Dirección del agente.
- `maxAmount`: Monto máximo pagado.
- `paymentNonce`: Nonce del pago.
- `timestamp`: Fecha de liquidación.

## Cómo se acuña
Solo el `owner` del NFT (la Multisig) o el contrato `AgentYarbox` pueden acuñar NFTs. Por ahora, se acuñan manualmente desde AETHEL o desde el explorador.

## Próximos pasos
- Integrar la acuñación automática en AETHEL cuando se liquide una intención.
- Mostrar los NFTs en el explorador web.
