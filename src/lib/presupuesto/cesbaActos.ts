/**
 * Builds the full list of CESBA acts (with subcodes) from the taxonomy JSON.
 * Used by the presupuesto Combobox to let the user pick any act + variant.
 */
import actsData from "@/data/acts_taxonomy_2026.json";

export interface CesbaActo {
  /** Full code, e.g. "100-00" or "100-51" */
  code: string;
  /** Base code, e.g. "100" */
  baseCode: string;
  /** Description, e.g. "COMPRAVENTA" */
  label: string;
  /** REGISTRABLE | NON_REGISTRABLE */
  category: string;
  /** Group label for UI sections */
  group: string;
  /** Stamp duty rate from taxonomy */
  stampDutyRate: number;
  /** Whether this is a vivienda única variant */
  esViviendaUnica: boolean;
}

const GROUP_LABELS: Record<number, string> = {
  100: "Compraventas y Transmisiones",
  200: "Donaciones",
  300: "Hipotecas",
  400: "Usufructo / Servidumbre / Derechos Reales",
  500: "Afectaciones / Propiedad Horizontal",
  600: "Sociedades",
  700: "Cesiones / Registrales / Certificados",
  800: "Actos Varios / Contratos",
  900: "Otros",
};

/** Full list of all 822 CESBA acts with subcodes. */
export const CESBA_ACTOS: CesbaActo[] = (() => {
  const data = actsData as Record<string, {
    description: string;
    category: string;
    tax_variables: { stamp_duty_rate: number };
  }>;

  const result: CesbaActo[] = [];

  for (const fullCode of Object.keys(data)) {
    const entry = data[fullCode];
    const baseCode = fullCode.split("-")[0];
    const groupKey = Math.floor(parseInt(baseCode) / 100) * 100;

    result.push({
      code: fullCode,
      baseCode,
      label: entry.description,
      category: entry.category,
      group: GROUP_LABELS[groupKey] ?? "Otros",
      stampDutyRate: entry.tax_variables.stamp_duty_rate,
      esViviendaUnica: fullCode.endsWith("-51"),
    });
  }

  return result.sort((a, b) => {
    const baseA = parseInt(a.baseCode), baseB = parseInt(b.baseCode);
    if (baseA !== baseB) return baseA - baseB;
    return a.code.localeCompare(b.code);
  });
})();

/**
 * Reverse map: given a CESBA full code (e.g. "100-51"), return the engine's operation_type.
 * Uses the base code (first 3 digits) for mapping.
 */
const CODE_TO_TIPO: Record<string, string> = {
  "100": "COMPRAVENTA", "102": "COMPRAVENTA", "103": "COMPRAVENTA",
  "104": "COMPRAVENTA", "105": "COMPRAVENTA", "106": "COMPRAVENTA",
  "107": "COMPRAVENTA", "108": "COMPRAVENTA", "109": "COMPRAVENTA",
  "110": "COMPRAVENTA", "112": "COMPRAVENTA", "116": "COMPRAVENTA",
  "117": "COMPRAVENTA", "118": "COMPRAVENTA", "119": "COMPRAVENTA",
  "120": "COMPRAVENTA", "121": "FIDEICOMISO", "122": "COMPRAVENTA",
  "200": "DONACION", "201": "DONACION", "202": "DONACION",
  "203": "DONACION", "204": "DONACION", "205": "DONACION", "206": "DONACION",
  "300": "HIPOTECA", "301": "HIPOTECA", "302": "HIPOTECA",
  "303": "HIPOTECA", "304": "HIPOTECA", "305": "HIPOTECA",
  "306": "HIPOTECA", "307": "HIPOTECA", "308": "CESION",
  "310": "HIPOTECA", "311": "CANCELACION_HIPOTECA", "312": "CANCELACION_HIPOTECA",
  "313": "CANCELACION_HIPOTECA", "314": "HIPOTECA", "315": "HIPOTECA",
  "316": "HIPOTECA", "317": "HIPOTECA", "318": "HIPOTECA",
  "319": "CESION", "320": "CESION", "321": "HIPOTECA",
  "322": "CESION", "323": "HIPOTECA", "324": "CANCELACION_HIPOTECA",
  "325": "HIPOTECA", "326": "HIPOTECA", "327": "HIPOTECA",
  "328": "CANCELACION_HIPOTECA", "329": "HIPOTECA", "330": "HIPOTECA",
  "331": "HIPOTECA", "332": "CANCELACION_HIPOTECA", "333": "CANCELACION_HIPOTECA",
  "334": "HIPOTECA", "335": "HIPOTECA", "336": "HIPOTECA",
  "400": "USUFRUCTO", "401": "USUFRUCTO", "402": "USUFRUCTO",
  "403": "USUFRUCTO", "404": "USUFRUCTO", "405": "USUFRUCTO",
  "406": "USUFRUCTO", "407": "USUFRUCTO", "408": "USUFRUCTO",
  "409": "USUFRUCTO", "410": "USUFRUCTO", "411": "USUFRUCTO",
  "412": "USUFRUCTO", "413": "USUFRUCTO", "414": "USUFRUCTO",
  "415": "USUFRUCTO", "416": "USUFRUCTO", "417": "USUFRUCTO",
  "418": "USUFRUCTO", "419": "USUFRUCTO",
  "500": "AFECTACION_BIEN_FAMILIA", "501": "AFECTACION_BIEN_FAMILIA",
  "502": "AFECTACION_BIEN_FAMILIA", "503": "COMPRAVENTA",
  "504": "CESION", "505": "OTRO", "506": "OTRO",
  "507": "OTRO", "508": "COMPRAVENTA", "509": "CESION",
  "510": "OTRO", "511": "OTRO",
  "512": "DIVISION_CONDOMINIO", "513": "OTRO", "514": "OTRO",
  "515": "OTRO", "516": "OTRO", "517": "OTRO", "518": "OTRO",
  "519": "OTRO", "520": "OTRO",
  "530": "OTRO", "531": "OTRO", "532": "OTRO",
  "540": "OTRO", "541": "OTRO", "542": "OTRO",
  "550": "OTRO", "551": "OTRO", "552": "OTRO",
  "560": "AFECTACION_BIEN_FAMILIA", "561": "AFECTACION_BIEN_FAMILIA",
  "600": "CONSTITUCION_SOCIEDAD", "601": "CONSTITUCION_SOCIEDAD",
  "602": "CONSTITUCION_SOCIEDAD", "603": "CONSTITUCION_SOCIEDAD",
  "604": "CONSTITUCION_SOCIEDAD", "605": "CONSTITUCION_SOCIEDAD",
  "606": "CONSTITUCION_SOCIEDAD", "607": "CONSTITUCION_SOCIEDAD",
  "608": "CONSTITUCION_SOCIEDAD",
  "700": "CESION", "701": "OTRO", "702": "OTRO", "703": "OTRO",
  "704": "OTRO", "705": "DIVISION_CONDOMINIO", "706": "OTRO",
  "707": "OTRO", "708": "OTRO", "709": "DIVISION_CONDOMINIO",
  "710": "OTRO", "711": "OTRO", "712": "COMPRAVENTA",
  "713": "COMPRAVENTA", "714": "OTRO", "715": "OTRO",
  "716": "DIVISION_CONDOMINIO", "717": "OTRO", "718": "OTRO",
  "719": "OTRO", "720": "CESION", "721": "CESION",
  "722": "CESION", "723": "COMPRAVENTA", "724": "OTRO",
  "725": "OTRO", "726": "OTRO", "727": "CESION",
  "728": "COMPRAVENTA", "729": "OTRO", "730": "DIVISION_CONDOMINIO",
  "731": "USUFRUCTO", "732": "USUFRUCTO", "733": "USUFRUCTO",
  "734": "OTRO", "749": "OTRO",
  "750": "OTRO", "751": "OTRO", "752": "OTRO", "753": "OTRO",
  "754": "OTRO", "755": "OTRO", "756": "OTRO", "757": "OTRO",
  "758": "OTRO", "759": "OTRO", "760": "OTRO", "761": "OTRO", "762": "OTRO",
  "800": "OTRO", "801": "OTRO", "802": "OTRO", "803": "OTRO",
  "804": "OTRO", "805": "OTRO", "806": "OTRO", "809": "OTRO",
  "813": "COMPRAVENTA", "814": "COMPRAVENTA",
  "824": "COMPRAVENTA", "825": "CESION",
  "834": "CESION", "837": "COMPRAVENTA",
  "848": "OTRO", "857": "OTRO", "859": "OTRO", "860": "OTRO",
  "861": "OTRO", "862": "OTRO", "863": "OTRO", "864": "OTRO",
  "866": "OTRO", "868": "OTRO", "869": "OTRO", "875": "OTRO",
  "879": "OTRO", "893": "COMPRAVENTA", "894": "DONACION",
  "895": "OTRO", "896": "OTRO", "897": "OTRO", "898": "DIVISION_CONDOMINIO",
  "900": "OTRO", "901": "OTRO", "902": "CESION", "903": "CESION",
  "904": "CESION", "999": "OTRO",
};

export function cesbaCodeToTipoActo(fullCode: string): string {
  const base = fullCode.split("-")[0];
  return CODE_TO_TIPO[base] ?? "OTRO";
}
