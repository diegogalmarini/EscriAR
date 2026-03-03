/**
 * Converts a number to its Spanish word representation.
 * Handles integers and decimals (for currency: pesos + centavos).
 *
 * Examples:
 *   numberToSpanishWords(1_500_000) → "un millón quinientos mil"
 *   numberToSpanishWords(2_350_000.50) → "dos millones trescientos cincuenta mil con 50/100"
 *   priceToSpanishWords(1_500_000, "DÓLARES ESTADOUNIDENSES") → "PESOS UN MILLÓN QUINIENTOS MIL (USD 1.500.000,00)"
 */

const UNIDADES = [
  "", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
  "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis",
  "diecisiete", "dieciocho", "diecinueve", "veinte",
  "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco",
  "veintiséis", "veintisiete", "veintiocho", "veintinueve",
];

const DECENAS = [
  "", "", "", "treinta", "cuarenta", "cincuenta",
  "sesenta", "setenta", "ochenta", "noventa",
];

const CENTENAS = [
  "", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
  "seiscientos", "setecientos", "ochocientos", "novecientos",
];

function convertGroup(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";

  let result = "";
  const centena = Math.floor(n / 100);
  const resto = n % 100;

  if (centena > 0) {
    result += CENTENAS[centena];
    if (resto > 0) result += " ";
  }

  if (resto > 0) {
    if (resto < 30) {
      result += UNIDADES[resto];
    } else {
      const decena = Math.floor(resto / 10);
      const unidad = resto % 10;
      result += DECENAS[decena];
      if (unidad > 0) result += " y " + UNIDADES[unidad];
    }
  }

  return result;
}

/**
 * Converts an integer to Spanish words (up to 999,999,999,999).
 */
export function numberToSpanishWords(n: number): string {
  if (!Number.isFinite(n)) return "";

  const integer = Math.floor(Math.abs(n));
  if (integer === 0) return "cero";

  const parts: string[] = [];

  // Billones (10^12) – not needed for notarial but safe
  const billones = Math.floor(integer / 1_000_000_000_000);
  const remainder12 = integer % 1_000_000_000_000;

  // Mil millones
  const milMillones = Math.floor(remainder12 / 1_000_000_000);
  const remainder9 = remainder12 % 1_000_000_000;

  // Millones
  const millones = Math.floor(remainder9 / 1_000_000);
  const remainder6 = remainder9 % 1_000_000;

  // Miles
  const miles = Math.floor(remainder6 / 1_000);
  const remainder3 = remainder6 % 1_000;

  // Unidades
  const unidades = remainder3;

  if (billones > 0) {
    parts.push(
      billones === 1
        ? "un billón"
        : convertGroup(billones) + " billones"
    );
  }

  if (milMillones > 0) {
    // "mil millones" pattern
    if (milMillones === 1) {
      parts.push("mil");
    } else {
      parts.push(convertGroup(milMillones) + " mil");
    }
    // the "millones" word will be appended if there are also millones
    if (millones === 0) {
      parts.push("millones");
    }
  }

  if (millones > 0 || milMillones > 0) {
    if (millones > 0) {
      if (milMillones > 0) {
        // Already have "X mil" — append "Y millones"
        parts.push(
          millones === 1 && milMillones === 0
            ? "un millón"
            : convertGroup(millones) + " millones"
        );
      } else {
        parts.push(
          millones === 1
            ? "un millón"
            : convertGroup(millones) + " millones"
        );
      }
    }
  }

  if (miles > 0) {
    if (miles === 1) {
      parts.push("mil");
    } else {
      parts.push(convertGroup(miles) + " mil");
    }
  }

  if (unidades > 0) {
    parts.push(convertGroup(unidades));
  }

  return parts.join(" ");
}

/**
 * Formats a price in the notarial style:
 *   "PESOS UN MILLÓN QUINIENTOS MIL ($ 1.500.000,00)"
 *
 * @param amount  - numeric amount
 * @param currency - "PESOS" | "DÓLARES ESTADOUNIDENSES" | etc.
 * @param symbol  - "$" | "USD" | "U$S" | etc.
 */
export function priceToSpanishWords(
  amount: number,
  currency: string = "PESOS",
  symbol: string = "$"
): string {
  if (!Number.isFinite(amount) || amount === 0) return "";

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  // Words (uppercase for notarial style)
  let words = numberToSpanishWords(integerPart).toUpperCase();

  // Decimal suffix
  if (decimalPart > 0) {
    words += ` CON ${String(decimalPart).padStart(2, "0")}/100`;
  }

  // Formatted number: 1.500.000,00 (Argentine style)
  const formatted =
    integerPart.toLocaleString("es-AR") +
    "," +
    String(decimalPart).padStart(2, "0");

  return `${currency.toUpperCase()} ${words} (${symbol} ${formatted})`;
}

/**
 * Simple number-to-words without currency wrapper.
 * Useful for "precio_letras" fields that just need the words.
 */
export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "";
  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  let words = numberToSpanishWords(integerPart).toUpperCase();
  if (decimalPart > 0) {
    words += ` CON ${String(decimalPart).padStart(2, "0")}/100`;
  }
  return words;
}
