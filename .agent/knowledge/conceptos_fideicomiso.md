# Conceptos de Fideicomiso e Ingesta de Datos (EscriAR)

Este documento sirve como base de conocimiento experto para la IA de EscriAR sobre cómo extraer datos de contratos de Fideicomiso y Cesiones de Beneficiario en Argentina.

## 1. Relación Fideicomiso - Fiduciaria

Es el error más común de la IA. Un Fideicomiso NO es una persona jurídica en sentido estricto, sino un patrimonio separado. La **Fiduciaria** es la empresa que lo administra.

- **Fideicomiso**: El "Vehículo" (ej: "FIDEICOMISO G-4"). Suele tener un CUIT independiente (30-...).
- **Fiduciaria**: La "Empresa Administradora" (ej: "SOMAJOFA S.A."). Tiene su propio CUIT.

### Regla de Extracción:
Si el texto dice "FIDEICOMISO G-4, administrado por SOMAJOFA S.A.", se deben extraer **DOS** entidades:
1. Nombre: "FIDEICOMISO G-4" | Rol: "VENDEDOR" | Tipo: "FIDEICOMISO"
2. Nombre: "SOMAJOFA S.A." | Rol: "FIDUCIARIA" | Tipo: "JURIDICA"

## 2. Cesión de Beneficiario (El acto de Venta)

En un fideicomiso "al costo", el dueño original del derecho (Cedente) le vende su posición a un nuevo dueño (Cesionario).

- **CEDENTE**: El que vende. Suele aparecer en el "Anexo" o "Constancias Notariales" de la escritura actual. **DEBE** extraerse con rol `CEDENTE`.
- **CESIONARIO**: El que compra. Es el que comparece en la escritura. **DEBE** extraerse con rol `CESIONARIO`.

### El precio de Cesión
Suele ser en Dólares (USD) y es mucho más alto que el "Precio de Construcción" (ARS).
- **SIEMPRE** priorizar el precio de Cesión para el valor total de la operación.

## 3. Identificación de Roles en 103.pdf (Caso de Prueba)

Para este documento específico, los roles **IRRENUNCIABLES** son:
1. **SOMAJOFA S.A.**: Debe ser `FIDUCIARIA`.
2. **Claudio Jorge WAGNER**: Debe ser `CEDENTE`.
3. **Juan Francisco MORAN**: Debe ser `CESIONARIO`.
4. **FIDEICOMISO G-4**: Debe ser `VENDEDOR`.
5. **Pablo Alejandro LAURA**: Debe ser `APODERADO/REPRESENTANTE`.

## 4. Patrones de Texto Críticos

- "en el carácter de fiduciaria": Indica que la empresa que sigue es la **Fiduciaria**.
- "cede la condición de beneficiario": Indica una operación de **Cesión**. El nombre que precede es el **Cedente**, el que sigue es el **Cesionario**.
- "importe correspondiente al costo de construcción": Es el precio histórico (ARS).
- "por la suma de Dólares...": Es el precio real de mercado (USD).
