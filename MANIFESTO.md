# Manifiesto de Accountability

## El problema

Los agentes autónomos ya mueven dinero. Pagan APIs, compran datos, contratan servicios. Lo hacen solos, sin que un humano apruebe cada transacción.

Pero nadie les está pidiendo cuentas.

Un agente puede decir "voy a pagar X" y luego pagar Y. Puede prometer un límite y violarlo. Puede ejecutar mil pagos y no dejar rastro de ninguno. Y no hay forma de probarlo.

Eso no es autonomía. Es opacidad con esteroides.

## La tesis

**Cada intención debe comprometerse antes de ejecutar. Cada pago debe verificarse contra el mandato. Cada resultado debe quedar registrado on-chain.**

Eso es accountability. No como promesa, sino como **prueba criptográfica**.

## Lo que construimos

**AgentYarbox** es el notario on-chain que faltaba.

Un agente dice: *"Voy a pagar 0.5 MON con el mandato 0x123, y mi límite es 1 MON."* Eso queda registrado antes de que mueva un solo wei.

Luego paga. Y cuando liquida, el contrato verifica:
- Que el pago existe en PaymentGate.
- Que el mandato es del agente.
- Que no expiró.
- Que el nonce no se usó antes.

Si algo falla, la intención se marca como **inconsistente**. No se borra. No se oculta. Queda ahí, para siempre, como evidencia.

Y si todo cuadra, `getReceipt` devuelve el tiquete completo: agente, mandato, monto máximo, nonce, hash del resultado, timestamp, y el estado final.

Eso es un recibo. Pero no un recibo de papel. Un recibo **verificable por cualquiera, en cualquier momento, sin pedir permiso**.

## Por qué importa

Porque los agentes van a ser la infraestructura económica del futuro. Y la infraestructura no puede ser opaca.

Si un agente paga mal, alguien tiene que saberlo.
Si un agente cumple, alguien tiene que poder probarlo.
Si un agente miente, el registro debe contradecirlo.

Eso no es vigilancia. Es **accountability**. La diferencia es que la accountability se basa en pruebas, no en confianza.

## Lo que NO somos

No somos una plataforma. No somos un token. No somos un club exclusivo.

Somos una **primitiva**. Un contrato que cualquiera puede integrar. Un SDK que cualquiera puede instalar. Un tiquete que cualquiera puede verificar.

No pedimos confianza. La hacemos innecesaria.

## La visión

Un mundo donde cada agente autónomo deja un rastro verificable de sus intenciones y sus pagos. Donde la reputación no se declara, se demuestra. Donde la accountability no es un checkbox, es una propiedad criptográfica.

Eso no es utopía. Es ingeniería.

Y ya empezó.

---

*AgentYarbox. Cada pago. Verificado. Para siempre.*
