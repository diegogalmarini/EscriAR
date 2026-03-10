# Skill: Notary Cost Monitor

## Propósito
Optimizar y auditar el consumo de recursos de IA del SaaS EscriAR, garantizando la viabilidad económica del negocio mediante el monitoreo de tokens, la gestión de umbrales de gasto y el uso de Context Caching.

## Funcionalidades Core
1. **Interceptor de Telemetría**: Captura metadatos de uso (`usage_metadata`) de cada llamada a Gemini, incluyendo tokens de entrada, salida y razonamiento.
2. **Audit Log de Supabase**: Registra cada operación en `api_usage_logs` vinculando el costo estimado al folder del cliente.
3. **Escudo de Presupuesto (Daily Cap)**: Si el consumo diario supera el umbral configurado (ej: $10 USD), activa alertas preventivas.
4. **Context Caching Inteligente**: Detecta redundancia en documentos pesados (manuales, leyes) y aplica caché de contexto para reducir el costo de entrada en un 90%.

## Lógica de Costos (Estimación)
- **Modelos Pro (GOLD)**: ~$3.50 / 1M tokens (Input) | ~$10.50 / 1M tokens (Output).
- **Modelos Flash (SILVER)**: ~$0.10 / 1M tokens (Input) | ~$0.40 / 1M tokens (Output).

---
*Este componente es vital para el escalamiento del SaaS sin comprometer el margen operativo.*
