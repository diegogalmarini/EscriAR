/**
 * PresupuestoEngine — Motor de cálculo de presupuesto notarial
 *
 * Recibe datos de la operación (acto, monto, jurisdicción, VF, flags)
 * y devuelve un presupuesto desglosado con distribución por parte.
 *
 * Fuentes de datos:
 *  - fiscal_config_2026.json (tasas generales)
 *  - acts_taxonomy_2026.json (via TaxonomyService)
 *  - rpi_tasas_2026.json (tasas registrales)
 *  - distribucion_costos_2026.json (distribución por parte)
 */

import fiscalConfig from "@/data/fiscal_config_2026.json";
import rpiTasas from "@/data/rpi_tasas_2026.json";
import distribucionCostos from "@/data/distribucion_costos_2026.json";
import otrasTasas from "@/data/otras_tasas_colesba_2026.json";
import { taxonomyService } from "@/lib/services/TaxonomyService";

// ─── Types ────────────────────────────────────────────────

export type Pagador = "COMPRADOR" | "VENDEDOR" | "DEUDOR" | "ACREEDOR" | "NOTARIO" | "COMUN" | "ESCRIBANIA";

export interface LineaPresupuesto {
  rubro: string;
  concepto: string;
  baseCalculo: number;
  alicuota: number | null;      // null = monto fijo
  monto: number;
  pagador: Pagador;
  categoria: "IMPUESTO" | "TASA" | "HONORARIO" | "APORTE" | "CERTIFICADO" | "GASTO_ADMIN";
  notas?: string;
}

export interface PresupuestoResult {
  lineas: LineaPresupuesto[];
  totales: {
    total: number;
    por_pagador: Partial<Record<Pagador, number>>;
    por_categoria: Partial<Record<LineaPresupuesto["categoria"], number>>;
  };
  metadata: {
    codigo_acto: string;
    descripcion_acto: string;
    base_imponible: number;
    moneda_operacion: "ARS" | "USD";
    cotizacion_usd: number | null;
    es_vivienda_unica: boolean;
    jurisdiccion: string;
    fecha_calculo: string;
  };
  alertas: string[];
}

export interface PresupuestoInput {
  // Acto
  tipo_acto: string;              // e.g. "COMPRAVENTA", "HIPOTECA"
  codigo_cesba?: string;          // e.g. "100-00" — if known

  // Montos
  monto_operacion: number;
  moneda: "ARS" | "USD";
  cotizacion_usd?: number;        // Required if moneda = "USD"
  valuacion_fiscal: number;

  // Inmueble
  tipo_inmueble: "EDIFICADO" | "BALDIO" | "RURAL";
  es_vivienda_unica: boolean;

  // Hipoteca
  es_banco_provincia?: boolean;
  monto_hipoteca?: number;

  // Vendedor
  fecha_adquisicion_vendedor?: string;  // YYYY-MM-DD para verificar Ganancias Cedular
  es_empresario_habitualista?: boolean; // Habilita retención 3% Ganancias Global

  // Certificados RPI
  urgencia_rpi?: "simple" | "urgente" | "en_el_dia";
  cantidad_inmuebles?: number;
  cantidad_personas?: number;

  // Jurisdicción
  jurisdiccion?: "PBA" | "CABA";
  partido?: string;

  // Honorarios
  honorarios_pct?: number;         // 0.01 | 0.015 | 0.02
  honorarios_fijo?: number;        // Monto fijo override

  // Extras opcionales
  cantidad_legalizaciones?: number;
  cantidad_apostillas?: number;
  cantidad_folios?: number;          // Folios de protocolo elaborados
  cantidad_testimonios?: number;     // Testimonios particulares (1-5 fojas)

  // ITG (Donaciones/Herencias)
  parentesco_itg?: "FAMILIA" | "OTROS_ASC_DESC" | "COLATERALES_2DO" | "COLATERALES_3_4";
}

// ─── Helpers ──────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toArs(monto: number, moneda: "ARS" | "USD", cotizacion?: number): number {
  if (moneda === "USD" && cotizacion) return monto * cotizacion;
  return monto;
}

// ─── Engine ───────────────────────────────────────────────

export function calcularPresupuesto(input: PresupuestoInput): PresupuestoResult {
  const lineas: LineaPresupuesto[] = [];
  const alertas: string[] = [];

  const cotUsd = input.cotizacion_usd ?? null;
  const montoArs = toArs(input.monto_operacion, input.moneda, cotUsd ?? undefined);
  const vf = input.valuacion_fiscal;
  const baseImponible = Math.max(montoArs, vf);
  const urgencia = input.urgencia_rpi ?? "simple";
  const cantInmuebles = input.cantidad_inmuebles ?? 1;
  const cantPersonas = input.cantidad_personas ?? 2;
  const esHipoteca = input.tipo_acto === "HIPOTECA";

  // ─── 1. Código CESBA ───
  let codigoCesba = input.codigo_cesba ?? "";
  let actData = codigoCesba ? taxonomyService.getActByCode(codigoCesba) : null;
  if (!actData) {
    actData = taxonomyService.findActByIntent({
      operation_type: input.tipo_acto as any,
      is_family_home: input.es_vivienda_unica,
      transaction_amount: montoArs,
      property_type: input.tipo_inmueble === "EDIFICADO" ? "VIVIENDA" : input.tipo_inmueble === "BALDIO" ? "TERRENO" : "RURAL",
    });
    if (actData) codigoCesba = actData.code;
  }

  if (!actData) {
    alertas.push(`No se encontró código CESBA para ${input.tipo_acto}. Cálculo parcial.`);
  }

  // ─── 2. Impuesto de Sellos ───
  const calcSellos = () => {
    if (input.jurisdiccion === "CABA") return calcSellosCaba();
    calcSellosPba();
  };

  // ─── 2a. Sellos CABA ───
  const calcSellosCaba = () => {
    const conf = (distribucionCostos as any).sellos_caba;
    if (!conf) { alertas.push("Sin datos de Sellos CABA"); return; }

    const base = baseImponible;
    let monto = 0;
    let label = "";

    if (esHipoteca) {
      // Hipoteca CABA: bancos Ley 21.526 para vivienda = EXENTO
      if (input.es_banco_provincia) {
        label = "Sellos CABA — Hipoteca bancaria vivienda (EXENTO)";
        monto = 0;
      } else {
        monto = round2(base * conf.alicuota_general);
        label = `Sellos CABA (${(conf.alicuota_general * 100).toFixed(1)}%)`;
      }
    } else if (input.tipo_acto === "COMPRAVENTA" || input.tipo_acto === "DONACION") {
      const td = conf.transmision_dominio;
      if (input.es_vivienda_unica) {
        const vu = conf.vivienda_unica_caba;
        if (base <= vu.vf_exencion_tope) {
          return; // Exento total
        }
        monto = round2(base * vu.alicuota_excedente);
        label = `Sellos CABA VU (${(vu.alicuota_excedente * 100).toFixed(1)}% s/ total — VF > tope)`;
      } else if (base <= td.tope_alicuota_baja) {
        monto = round2(base * td.alicuota_hasta_tope);
        label = `Sellos CABA (${(td.alicuota_hasta_tope * 100).toFixed(1)}%)`;
      } else {
        monto = round2(base * td.alicuota_sobre_tope);
        label = `Sellos CABA (${(td.alicuota_sobre_tope * 100).toFixed(1)}%)`;
      }
    } else {
      monto = round2(base * conf.alicuota_general);
      label = `Sellos CABA (${(conf.alicuota_general * 100).toFixed(1)}%)`;
    }

    if (monto > 0) {
      lineas.push({
        rubro: "SELLOS_CABA",
        concepto: label,
        baseCalculo: base,
        alicuota: monto / base,
        monto,
        pagador: "COMUN",
        categoria: "IMPUESTO",
        notas: "50% cada parte",
      });
    }
  };

  // ─── 2b. Sellos PBA ───
  const calcSellosPba = () => {
    if (!actData) return;
    const rate = actData.tax_variables.stamp_duty_rate;
    if (rate === 0) return;

    let base = baseImponible;
    let montoSellos = 0;

    if (input.es_vivienda_unica) {
      const tope = input.tipo_inmueble === "BALDIO"
        ? fiscalConfig.sellos.tope_vu_baldio
        : fiscalConfig.sellos.tope_vu_edificado;
      if (vf <= tope) {
        // Exento total
        return;
      }
      // Paga sobre total si VF > tope
      montoSellos = base * rate;
      alertas.push(`VU: VF ($${vf.toLocaleString()}) supera tope ($${tope.toLocaleString()}). Se aplica sellos sobre total.`);
    } else {
      montoSellos = base * rate;
    }

    // Distribución por parte
    const dist = getDistribucionSellos(codigoCesba, input);
    if (dist) {
      const sellosComprador = round2(base * dist.comprador_permil / 1000);
      const sellosVendedor = round2(base * dist.vendedor_permil / 1000);

      if (sellosComprador > 0) {
        lineas.push({
          rubro: "SELLOS_PBA",
          concepto: `Imp. Sellos PBA (${dist.comprador_permil}‰)`,
          baseCalculo: base,
          alicuota: dist.comprador_permil / 1000,
          monto: sellosComprador,
          pagador: esHipoteca ? "DEUDOR" : "COMPRADOR",
          categoria: "IMPUESTO",
        });
      }
      if (sellosVendedor > 0) {
        lineas.push({
          rubro: "SELLOS_PBA",
          concepto: `Imp. Sellos PBA (${dist.vendedor_permil}‰)`,
          baseCalculo: base,
          alicuota: dist.vendedor_permil / 1000,
          monto: sellosVendedor,
          pagador: esHipoteca ? "ACREEDOR" : "VENDEDOR",
          categoria: "IMPUESTO",
        });
      }
    } else {
      // Sin distribución: línea única
      lineas.push({
        rubro: "SELLOS_PBA",
        concepto: `Imp. Sellos PBA (${(rate * 100).toFixed(1)}%)`,
        baseCalculo: base,
        alicuota: rate,
        monto: round2(montoSellos),
        pagador: "COMUN",
        categoria: "IMPUESTO",
      });
    }
  };
  calcSellos();

  // ─── 3. Impuesto a las Ganancias (Transferencia Inmuebles) ───
  if (!esHipoteca && montoArs > 0) {
    // El ITI (1.5%) fue derogado en su totalidad por Ley 27.743 (Julio 2024).
    if (input.es_empresario_habitualista) {
      lineas.push({
        rubro: "GANANCIAS_GLOBAL",
        concepto: "Impuesto a las Ganancias Global — 3%",
        baseCalculo: montoArs,
        alicuota: fiscalConfig.ganancias_global.rate,
        monto: round2(montoArs * fiscalConfig.ganancias_global.rate),
        pagador: "VENDEDOR",
        categoria: "IMPUESTO",
        notas: "Retención a cuenta (Sujetos colectivos / Habitualistas).",
      });
    } else {
      if (input.fecha_adquisicion_vendedor) {
        const pre2018 = new Date(input.fecha_adquisicion_vendedor) < new Date(fiscalConfig.ganancias_cedular.cutoff_date);
        if (!pre2018) {
          alertas.push("El vendedor (persona humana) adquirió post-2018. Sujeto a Ganancias Cedular (15%). El escribano NO retiene, es a cargo del contribuyente.");
        } else {
          // pre-2018, persona humana => No ITI, No Ganancias
        }
      } else {
        alertas.push("Adquisición del vendedor no informada. Al tratarse de persona humana, asume exención (ITI derogado en pre-2018 / Cedular post-2018 no retenible).");
      }
    }
  }

  // ─── 4. Honorarios ───
  const calcHonorarios = () => {
    let honorarios: number;
    if (input.honorarios_fijo != null && input.honorarios_fijo > 0) {
      honorarios = input.honorarios_fijo;
    } else {
      const pct = input.honorarios_pct ?? fiscalConfig.honorarios.suggested_rate;
      honorarios = round2(montoArs * pct);
    }

    // Check against minimum
    if (actData) {
      const fees = actData.tax_variables.fees_extracted;
      const minHonorario = typeof fees[0] === "number" ? fees[0] : 0;
      if (honorarios < minHonorario) {
        alertas.push(`Honorario ($${honorarios.toLocaleString()}) por debajo del mínimo CESBA ($${minHonorario.toLocaleString()}).`);
      }
    }

    lineas.push({
      rubro: "HONORARIOS",
      concepto: `Honorarios Notariales`,
      baseCalculo: montoArs,
      alicuota: input.honorarios_fijo ? null : (input.honorarios_pct ?? fiscalConfig.honorarios.suggested_rate),
      monto: honorarios,
      pagador: "COMUN",
      categoria: "HONORARIO",
      notas: "Según pacto entre partes.",
    });

    // IVA sobre honorarios
    const iva = round2(honorarios * fiscalConfig.iva.rate);
    lineas.push({
      rubro: "IVA_HONORARIOS",
      concepto: `IVA 21% s/ Honorarios`,
      baseCalculo: honorarios,
      alicuota: fiscalConfig.iva.rate,
      monto: iva,
      pagador: "COMUN",
      categoria: "IMPUESTO",
    });

    return honorarios;
  };
  const honorariosCalc = calcHonorarios();

  // ─── 5. Aportes notariales ───
  const aporteDistrib = getDistribucionAportes(codigoCesba, input);

  if (aporteDistrib) {
    // Con distribución detallada
    const parties = esHipoteca
      ? [
        { role: "DEUDOR" as Pagador, permil: aporteDistrib.deudor_permil ?? 0 },
        { role: "ACREEDOR" as Pagador, permil: aporteDistrib.acreedor_permil ?? 0 },
        { role: "NOTARIO" as Pagador, permil: aporteDistrib.notario_permil ?? 0 },
      ]
      : [
        { role: "COMPRADOR" as Pagador, permil: aporteDistrib.comprador_permil ?? 0 },
        { role: "VENDEDOR" as Pagador, permil: aporteDistrib.vendedor_permil ?? 0 },
        { role: "NOTARIO" as Pagador, permil: aporteDistrib.notario_permil ?? 0 },
      ];

    for (const p of parties) {
      if (p.permil > 0) {
        lineas.push({
          rubro: "APORTE_NOTARIAL",
          concepto: `Aporte notarial (${p.permil}‰) — ${p.role}`,
          baseCalculo: baseImponible,
          alicuota: p.permil / 1000,
          monto: round2(baseImponible * p.permil / 1000),
          pagador: p.role,
          categoria: "APORTE",
        });
      }
    }
  } else {
    // Fallback: aportes genéricos de fiscal_config
    const aporteCaja = round2(baseImponible * fiscalConfig.aportes.caja_notarial);
    const aporteColegio = round2(baseImponible * fiscalConfig.aportes.colegio);
    lineas.push({
      rubro: "APORTE_CAJA",
      concepto: "Aporte Caja Notarial (0.6%)",
      baseCalculo: baseImponible,
      alicuota: fiscalConfig.aportes.caja_notarial,
      monto: aporteCaja,
      pagador: "ESCRIBANIA",
      categoria: "APORTE",
    });
    lineas.push({
      rubro: "APORTE_COLEGIO",
      concepto: "Aporte Colegio (0.1%)",
      baseCalculo: baseImponible,
      alicuota: fiscalConfig.aportes.colegio,
      monto: aporteColegio,
      pagador: "ESCRIBANIA",
      categoria: "APORTE",
    });
  }

  // ─── 5b. Validación aporte mínimo ───
  const totalAportes = round2(lineas.filter(l => l.categoria === "APORTE").reduce((s, l) => s + l.monto, 0));
  if (totalAportes > 0 && totalAportes < fiscalConfig.aporte_min_notarial) {
    const diff = round2(fiscalConfig.aporte_min_notarial - totalAportes);
    lineas.push({
      rubro: "APORTE_AJUSTE_MINIMO",
      concepto: `Ajuste al aporte mínimo CESBA`,
      baseCalculo: fiscalConfig.aporte_min_notarial,
      alicuota: null,
      monto: diff,
      pagador: "ESCRIBANIA",
      categoria: "APORTE",
      notas: `Aportes calculados ($${totalAportes.toLocaleString()}) por debajo del mínimo ($${fiscalConfig.aporte_min_notarial.toLocaleString()}).`,
    });
    alertas.push(`Aportes ajustados al mínimo CESBA ($${fiscalConfig.aporte_min_notarial.toLocaleString()}).`);
  }

  // ─── 6. Certificados RPI ───
  const addCertificado = (key: keyof typeof rpiTasas.publicidad, cantidad: number, label?: string) => {
    const cert = rpiTasas.publicidad[key];
    if (!cert) return;
    const precio = cert[urgencia] ?? cert.simple;
    if (precio && cantidad > 0) {
      lineas.push({
        rubro: `CERT_RPI_${key.toUpperCase()}`,
        concepto: label ?? cert.descripcion,
        baseCalculo: precio,
        alicuota: null,
        monto: round2(precio * cantidad),
        pagador: "COMUN",
        categoria: "CERTIFICADO",
        notas: cantidad > 1 ? `${cantidad} × $${precio.toLocaleString()}` : undefined,
      });
    }
  };

  // Certificados estándar para escrituras con inmueble
  if (actData?.category === "REGISTRABLE" || !actData) {
    addCertificado("certificado_dominio", cantInmuebles);
    addCertificado("certificado_anotaciones_personales", cantPersonas);
    addCertificado("informe_dominio", cantInmuebles);
  }

  // ─── 7. Tasa registración RPI (2‰) ───
  if (actData?.category === "REGISTRABLE") {
    const coefCorrector = input.tipo_inmueble === "RURAL"
      ? fiscalConfig.coeficientes_correctores.rural_tierra_libre
      : fiscalConfig.coeficientes_correctores.urbano_edificado;

    const vfAjustada = vf * coefCorrector;
    const baseRpi = Math.max(vfAjustada, montoArs);
    const tasaPermil = rpiTasas.registracion.transmision_dominio.tasa_permil;
    let tasaRegistracion = round2(baseRpi * tasaPermil / 1000);

    // Mínimos
    const minKey = input.es_vivienda_unica ? "min_fee_vu_simple" : "min_fee_simple";
    const minFee = urgencia === "urgente"
      ? (input.es_vivienda_unica ? fiscalConfig.rpi.min_fee_vu_urgente : fiscalConfig.rpi.min_fee_urgente)
      : (fiscalConfig.rpi as any)[minKey];

    tasaRegistracion = Math.max(tasaRegistracion, minFee) * cantInmuebles;

    lineas.push({
      rubro: "TASA_REGISTRACION_RPI",
      concepto: `Tasa registración RPI (${tasaPermil}‰)`,
      baseCalculo: baseRpi,
      alicuota: tasaPermil / 1000,
      monto: round2(tasaRegistracion),
      pagador: "COMUN",
      categoria: "TASA",
      notas: `Base: mayor(VF×${coefCorrector}, monto). Mín $${minFee.toLocaleString()}/inm.`,
    });
  }

  // ─── 8. Gastos administrativos opcionales ───
  if (input.cantidad_legalizaciones && input.cantidad_legalizaciones > 0) {
    const precioLeg = 21000;
    lineas.push({
      rubro: "LEGALIZACION",
      concepto: "Sellos de legalización + QR",
      baseCalculo: precioLeg,
      alicuota: null,
      monto: round2(precioLeg * input.cantidad_legalizaciones),
      pagador: "COMUN",
      categoria: "GASTO_ADMIN",
      notas: `${input.cantidad_legalizaciones} × $${precioLeg.toLocaleString()}`,
    });
  }

  if (input.cantidad_apostillas && input.cantidad_apostillas > 0) {
    const precioApo = 28000;
    lineas.push({
      rubro: "APOSTILLA",
      concepto: "Apostilla",
      baseCalculo: precioApo,
      alicuota: null,
      monto: round2(precioApo * input.cantidad_apostillas),
      pagador: "COMUN",
      categoria: "GASTO_ADMIN",
      notas: `${input.cantidad_apostillas} × $${precioApo.toLocaleString()}`,
    });
  }

  // ─── 9. Folio de protocolo elaborado ───
  if (input.cantidad_folios && input.cantidad_folios > 0) {
    const precioFolio = fiscalConfig.protocolo.folio_elaborado;
    lineas.push({
      rubro: "FOLIO_ELABORADO",
      concepto: "Folio de protocolo elaborado",
      baseCalculo: precioFolio,
      alicuota: null,
      monto: round2(precioFolio * input.cantidad_folios),
      pagador: "ESCRIBANIA",
      categoria: "GASTO_ADMIN",
      notas: `${input.cantidad_folios} × $${precioFolio.toLocaleString()}`,
    });
  }

  // ─── 10. Testimonios ───
  if (input.cantidad_testimonios && input.cantidad_testimonios > 0) {
    const precioTest = otrasTasas.archivo_actuaciones_notariales.testimonio_particular.normal_1a5;
    lineas.push({
      rubro: "TESTIMONIO",
      concepto: "Testimonio particular (1-5 fojas)",
      baseCalculo: precioTest,
      alicuota: null,
      monto: round2(precioTest * input.cantidad_testimonios),
      pagador: "COMUN",
      categoria: "GASTO_ADMIN",
      notas: `${input.cantidad_testimonios} × $${precioTest.toLocaleString()}`,
    });
  }

  // ─── 11. ITG (Impuesto Transmisión Gratuita — donaciones/herencias) ───
  if (input.tipo_acto === "DONACION" && input.parentesco_itg && montoArs > 0) {
    const itgResult = calcITG(montoArs, input.parentesco_itg);
    if (itgResult.monto > 0) {
      lineas.push({
        rubro: "ITG_PBA",
        concepto: `Imp. Transmisión Gratuita PBA (${itgResult.parentescoLabel})`,
        baseCalculo: itgResult.baseGravada,
        alicuota: itgResult.alicuotaEfectiva,
        monto: itgResult.monto,
        pagador: "COMPRADOR",
        categoria: "IMPUESTO",
        notas: `Base gravada: $${itgResult.baseGravada.toLocaleString()} (mín. no imp. $${itgResult.minimoNoImponible.toLocaleString()})`,
      });
    }
  }

  // ─── UIF Alert ───
  const uifCompraventa = (distribucionCostos as any).uif_reportes?.compraventa_inmueble_efectivo?.monto;
  if (uifCompraventa && montoArs > uifCompraventa) {
    alertas.push(`Operación supera umbral UIF ($${uifCompraventa.toLocaleString()}). Requiere Reporte Sistemático Mensual + DDJ prevención lavado.`);
  }

  // ─── Totales ───
  const total = round2(lineas.reduce((s, l) => s + l.monto, 0));

  const por_pagador: Partial<Record<Pagador, number>> = {};
  const por_categoria: Partial<Record<LineaPresupuesto["categoria"], number>> = {};
  for (const l of lineas) {
    por_pagador[l.pagador] = round2((por_pagador[l.pagador] ?? 0) + l.monto);
    por_categoria[l.categoria] = round2((por_categoria[l.categoria] ?? 0) + l.monto);
  }

  return {
    lineas,
    totales: { total, por_pagador, por_categoria },
    metadata: {
      codigo_acto: codigoCesba,
      descripcion_acto: actData?.description ?? input.tipo_acto,
      base_imponible: baseImponible,
      moneda_operacion: input.moneda,
      cotizacion_usd: cotUsd,
      es_vivienda_unica: input.es_vivienda_unica,
      jurisdiccion: input.jurisdiccion === "CABA" ? "CABA" : (input.partido ?? "PBA"),
      fecha_calculo: new Date().toISOString(),
    },
    alertas,
  };
}

// ─── ITG Calculator ──────────────────────────────────────

interface ITGResult {
  monto: number;
  baseGravada: number;
  minimoNoImponible: number;
  alicuotaEfectiva: number | null;
  parentescoLabel: string;
}

type ParentescoITG = NonNullable<PresupuestoInput["parentesco_itg"]>;

const ITG_LABELS: Record<ParentescoITG, string> = {
  FAMILIA: "Padres/Hijos/Cónyuge",
  OTROS_ASC_DESC: "Otros asc./desc.",
  COLATERALES_2DO: "Colaterales 2° grado",
  COLATERALES_3_4: "Colaterales 3°/4° y extraños",
};

const ITG_PCT_KEY: Record<ParentescoITG, string> = {
  FAMILIA: "familia_pct",
  OTROS_ASC_DESC: "otros_asc_desc_pct",
  COLATERALES_2DO: "colaterales_2do_pct",
  COLATERALES_3_4: "colaterales_3_4_extraños_pct",
};

const ITG_CUOTA_KEY: Record<ParentescoITG, string> = {
  FAMILIA: "cuota_fija_familia",
  OTROS_ASC_DESC: "cuota_fija_otros",
  COLATERALES_2DO: "cuota_fija_col2",
  COLATERALES_3_4: "cuota_fija_col34",
};

function calcITG(monto: number, parentesco: ParentescoITG): ITGResult {
  const itg = (distribucionCostos as any).impuesto_transmision_gratuita;
  if (!itg) return { monto: 0, baseGravada: 0, minimoNoImponible: 0, alicuotaEfectiva: null, parentescoLabel: ITG_LABELS[parentesco] };

  const minNoImp = parentesco === "FAMILIA"
    ? itg.minimo_no_imponible.padres_hijos_conyuge
    : itg.minimo_no_imponible.resto_beneficiarios;

  const baseGravada = Math.max(0, monto - minNoImp);
  if (baseGravada <= 0) {
    return { monto: 0, baseGravada: 0, minimoNoImponible: minNoImp, alicuotaEfectiva: null, parentescoLabel: ITG_LABELS[parentesco] };
  }

  const pctKey = ITG_PCT_KEY[parentesco];
  const cuotaKey = ITG_CUOTA_KEY[parentesco];
  const escala = itg.escala as any[];

  let impuesto = 0;
  for (let i = escala.length - 1; i >= 0; i--) {
    const tramo = escala[i];
    if (baseGravada > tramo.desde) {
      const cuotaFija = tramo[cuotaKey] ?? 0;
      const alicuota = (tramo[pctKey] ?? 0) / 100;
      const excedente = baseGravada - tramo.desde;
      impuesto = round2(cuotaFija + excedente * alicuota);
      break;
    }
  }

  return {
    monto: impuesto,
    baseGravada,
    minimoNoImponible: minNoImp,
    alicuotaEfectiva: impuesto / baseGravada,
    parentescoLabel: ITG_LABELS[parentesco],
  };
}

// ─── Distribution helpers ────────────────────────────────

interface DistribSellos {
  comprador_permil: number;
  vendedor_permil: number;
}

interface DistribAportes {
  comprador_permil?: number;
  vendedor_permil?: number;
  deudor_permil?: number;
  acreedor_permil?: number;
  notario_permil: number;
}

function getDistribucionSellos(codigo: string, input: PresupuestoInput): DistribSellos | null {
  const dist = distribucionCostos as any;

  // Compraventa
  if (codigo.startsWith("100")) {
    const entry = dist.compraventa?.[codigo];
    if (entry) {
      return {
        comprador_permil: entry.sellos_comprador_permil ?? 0,
        vendedor_permil: entry.sellos_vendedor_permil ?? 0,
      };
    }
  }

  // Hipoteca
  if (codigo.startsWith("300") || codigo.startsWith("323")) {
    const section = input.es_banco_provincia ? dist.hipoteca_bco_provincia : dist.hipoteca_otros_bancos;
    const entry = section?.[codigo];
    if (entry) {
      return {
        comprador_permil: entry.sellos_deudor_permil ?? 0,
        vendedor_permil: entry.sellos_acreedor_permil ?? 0,
      };
    }
  }

  return null;
}

function getDistribucionAportes(codigo: string, input: PresupuestoInput): DistribAportes | null {
  const dist = distribucionCostos as any;

  // Compraventa
  if (codigo.startsWith("100")) {
    const entry = dist.compraventa?.[codigo];
    if (entry) {
      return {
        comprador_permil: entry.aporte_comprador_permil ?? 0,
        vendedor_permil: entry.aporte_vendedor_permil ?? 0,
        notario_permil: entry.aporte_notario_permil ?? 0,
      };
    }
  }

  // Hipoteca
  if (codigo.startsWith("300") || codigo.startsWith("323")) {
    const section = input.es_banco_provincia ? dist.hipoteca_bco_provincia : dist.hipoteca_otros_bancos;
    const entry = section?.[codigo];
    if (entry) {
      return {
        deudor_permil: entry.aporte_deudor_permil ?? 0,
        acreedor_permil: entry.aporte_acreedor_permil ?? 0,
        notario_permil: entry.aporte_notario_permil ?? 0,
      };
    }
  }

  return null;
}
