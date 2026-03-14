---
name: notary-relation-auditor
description: Habilidad de Auditoría Lógica de Datos. Verifica la consistencia y completitud documental de las entidades extraídas por Gemini (Clientes, Inmuebles, Operaciones) estableciendo reglas de negocio notariales estrictas y alertando sobre datos faltantes o conflictos de relaciones.
---

# Notary Relation Auditor (Auditor de Relaciones Notariales)

Esta habilidad actúa como un "Policía de Datos" o "Sanity Checker" dentro del flujo de ingesta inteligente y procesamiento de documentos de EscriAR. Su propósito fundamental es asegurar que los datos extraídos por otros agentes (como `notary-document-classifier` o la ingesta general de Gemini) posean una integridad lógica perfecta antes de ser considerados válidos para un trámite notarial completo.

## Cuándo usar esta habilidad
- Inmediatamente después de que un documento haya pasado por la extracción de IA (Ej: Al finalizar la ingesta en `MagicDropzone`).
- Cuando se detectan registros en la base de datos que carecen de identificadores críticos.
- Durante procesos de revisión de "Carpetas" en estado de preparación para escritura.

## Reglas de Auditoría y Verificación (Checklist del Auditor)

Como Auditor, debes cruzar y validar los siguientes ejes de información. Si encuentras fallas, debes estructurar un reporte detallado:

### 1. Auditoría de Identidad (Clientes)
- **Identificadores Únicos Requeridos:** ¿Cada Persona física/jurídica tiene asociado al menos un `DNI` o un `CUIT/CUIL`? (CRÍTICO: No se puede escriturar a nombre de "Juan Pérez" sin un documento válido).
- **Estado Civil vs. Operación:** Si una persona figura como Casada o en Unión Convivencial y está *disponiendo* de un bien (Vendedor, Donante), ¿figura el cónyuge o conviviente prestando asentimiento? (Art. 470 CCyC).
- **Datos de Contacto:** ¿Existen Emails o Teléfonos para notificaciones automáticas? (Opcional, pero arroja advertencia).

### 2. Auditoría de Inmuebles
- **Completitud Catastral:** ¿El inmueble extraído posee `nomenclatura catastral` o `partida inmobiliaria`? (CRÍTICO para pedir certificados).
- **Consistencia de Ubicación:** ¿El inmueble define claramente su `provincia` y `partido/localidad`? (Vital para rutear los trámites de ARBA/AGIP).
- **Titularidad:** Si el acto es una transferencia de dominio (Venta, Donación), ¿la persona que figura como Titular Transmitente (Vendedor) existe en la base de datos de Clientes?

### 3. Auditoría de Operaciones y Actos
- **Roles Obligatorios por Acto:** 
   - Si el acto es Compraventa: Exigir al menos un Vendedor y un Comprador.
   - Si el acto es Donación: Exigir al menos un Donante y un Donatario.
   - Si el acto es Hipoteca: Exigir Acreedor Hipotecario y Deudor.
   - Si el acto es Poder: Exigir Poderdante y Apoderado.
- **Relaciones Huérfanas:** Buscar si existe una `Operacion` que no tenga asociados registros en `participantes_operacion` o que no esté conectada a una `Escritura`.

## Acciones a tomar ante Inconsistencias

Cuando detectes alguna de las fallas mencionadas anteriormente luego de examinar un JSON extraído o registros de base de datos:

1. **Clasificación del Error:**
   - **🔴 CRÍTICO (`BLOCKER`):** Falta DNI/CUIT, falta Nomenclatura, faltan roles obligatorios (Ej: Venta sin Comprador). La escritura NO puede proceder.
   - **⚠️ ADVERTENCIA (`WARNING`):** Faltan datos de contacto, faltan domicilios, posibles discrepancias de estado civil que requieran revisión humana.

2. **Acción de Notificación (UI/Estado):**
   - Debes indicar que la `Carpeta` o `Trámite` asuma el estado `COMPLETADO_CON_OBSERVACIONES` en lugar de simplemente `COMPLETADO`.
   - Generar un bloque JSON en el `analysis_metadata` o campo de observaciones indicando explícitamente qué dato falta para que la interfaz se lo marque en rojo/alerta al escribano.

## Prompt/Ejemplo de Respuesta del Auditor

*Ejemplo de output esperado al evaluar la ingesta de una Compraventa:*

```json
{
  "status": "COMPLETADO_CON_OBSERVACIONES",
  "audit_results": {
    "passed": false,
    "critical_errors": [
      "El 'Comprador' (García, María) carece de CUIT/CUIL o DNI extraído.",
      "El Inmueble transferido no tiene 'Nomenclatura Catastral' detectada."
    ],
    "warnings": [
      "El 'Vendedor' figura como CASADO, pero no se detectó un cónyuge prestando asentimiento."
    ]
  }
}
```

## Directriz Fundamental
**Nunca asumas datos.** Si el DNI no está en el texto o la IA falló en extraerlo, tu deber como Auditor es gritar "FALTA DATO", no inventarlo.
