# Skill: Notary Engine Optimizer (Internal)

## Propósito
Garantizar que el sistema EscriAR siempre utilice el modelo de inteligencia artificial más potente y preciso disponible, evitando caídas del servicio (SaaS "muerto") ante cambios inesperados en la API de Google Gemini.

## Lógica de Funcionamiento (Escudo de Fidelidad)
Este sistema opera mediante una jerarquía determinista y validación estricta:

1. **Strict JSON Enforcement:** Todas las extracciones utilizan `response_mime_type: "application/json"` y opcionalmente un `response_schema` para garantizar la estructura.
2. **Evidencia de Origen:** Cada dato extraído debe incluir un objeto `{ valor, evidencia_origen }`, obligando al modelo a citar el snippet literal del documento. Esto elimina alucinaciones al forzar la conexión con la fuente.
3. **Jerarquía Escalonada (C-Level):**
12.    - **GOLD:** `gemini-3.1-pro` (Razonamiento Sistémico + Thinking Mode).
13.    - **SILVER:** `gemini-3.1-flash` (Velocidad para OCR masivo).
14.    - **BRONZE:** `gemini-3.1-flash-lite` (Eficiencia fallback).
15. 
16. > [!WARNING]
17. > **REGLA DE NO DEGRADACIÓN:** Si un modelo falla (ej. *Model Not Found*), los agentes **NUNCA DEBEN hacer rollback** a versiones antiguas (como 2.5). Deben investigar la documentación vigente de Google y actualizar a la versión estable actual (ej. 3.1). Degradaciones rompen el sistema y causan bucles infinitos.
4. **Auto-Corrección con Reintento:** Si una extracción falla la validación estructural, el sistema realiza un reintento automático enviando el error exacto al modelo para que lo corrija usando su capacidad de "Thinking".
5. **Caché y Latencia:** Se han eliminado los pings previos a favor de un manejo de excepciones reactivo, optimizando la velocidad de respuesta.

## Beneficios para el Cliente
- **Integridad de Datos:** Prioriza siempre el modelo con menor margen de error para la extracción de partes y medidas.
- **Continuidad Total:** El SaaS nunca se detiene por cambios en las versiones de Google.
- **Transparencia:** Registra logs internos cuando ocurre un cambio de motor para auditoría técnica.

---
*Implementado en `src/lib/aiConfig.ts` como el núcleo de fiabilidad de EscriAR.*
