/**
 * Types for multi-act presupuesto system
 */

import type { LineaPresupuesto, Pagador, PresupuestoResult } from "@/lib/services/PresupuestoEngine";

// ─── Per-Act Form State ───────────────────────────────────

export interface ActoFormState {
  id: string; // uuid for React key

  // Header
  tipoActo: string;         // "COMPRAVENTA", "HIPOTECA", etc.
  codigoCesba: string;       // "100-00"

  // Inputs
  fechaEscritura: string;    // YYYY-MM-DD
  cotizacionUsd: number;
  montoEscrituraArs: number;
  montoEscrituraUsd: number;
  valuacionFiscal: number;
  valuacionFiscalAlActo: number;
  montoRealArs: number;
  montoRealUsd: number;
  cantidadInmuebles: number;       // default 1
  cantidadTransmitentes: number;   // default 2
  cantidadCertificadosRpi: number; // default 3
  cantidadFojas: number;           // default 7
  certificados: "simple" | "urgente" | "en_el_dia"; // default "urgente"

  // Legacy form-level costs (used by old engine fallback)
  certAdministrativos: number;
  selladosEscMatriz: number;
  confeccionMatricula: number;
  diligenciamientos: number;
  procuracion: number;
  estudioTitulos: number;
  agenteRetencion: number;

  // Engine-related fields
  tipoInmueble: "EDIFICADO" | "BALDIO" | "RURAL";
  esViviendaUnica: boolean;
  jurisdiccion: "PBA" | "CABA";
  honorariosPct: number;           // 0.01, 0.015, 0.02
  honorariosFijo: number | null;   // fixed amount override

  // Recipe rubro overrides (rubro_id → fixed amount)
  rubroOverrides: Map<string, number>;

  // Overrides tracking (which fields were manually edited)
  overrides: Set<string>;
}

// ─── IVA-classified line ──────────────────────────────────

export interface LineaConIVA extends LineaPresupuesto {
  iva: "EXENTO" | "GRAVADO";
  actoIndex: number;
}

// ─── Multi-Act Result ─────────────────────────────────────

export interface PresupuestoMultiActResult {
  actosResults: {
    actoIndex: number;
    tipoActo: string;
    codigoCesba: string;
    engineResult: PresupuestoResult;
    lineasFormulario: LineaConIVA[];  // items from form (cert admin, sellados, etc.)
  }[];

  // All lines consolidated
  lineas: LineaConIVA[];

  // IVA breakdown
  ivaBreakdown: {
    exentos: { concepto: string; monto: number }[];
    gravados: { concepto: string; monto: number }[];
    subtotalExentos: number;
    subtotalGravados: number;
    ivaAmount: number;            // 21% on gravados
    totalConIva: number;
  };

  // Vendedor/Comprador discrimination
  discriminacion: {
    vendedor: { items: { concepto: string; monto: number }[]; total: number };
    comprador: { items: { concepto: string; monto: number }[]; total: number };
  };

  // Grand total
  totalGeneral: number;
  alertas: string[];
}

// ─── Defaults & Formulas ──────────────────────────────────

export const DEFAULTS = {
  cantidadInmuebles: 1,
  cantidadTransmitentes: 2,
  cantidadCertificadosRpi: 3,
  cantidadFojas: 7,
  certificados: "urgente" as const,
  certAdministrativosPorInmueble: 90000,
  selladosEscMatriz: 10962,  // $6,237 + $4,725
  confeccionMatriculaPorInmueble: 125000,
  procuracion: 150000,
  agenteRetencion: 334125,
  honorariosPct: 0.02,
};

export function calcDiligenciamientos(montoEscrituraArs: number): number {
  const base = (montoEscrituraArs - 2079000) * 0.002 + 89100;
  return Math.max(0, Math.min(base, 1234926));
}

export function calcEstudioTitulos(montoEscrituraArs: number): number {
  return Math.max(0, (montoEscrituraArs - 2079000) * 0.002 + 89100);
}

// ─── IVA Classification ───────────────────────────────────

const IVA_EXENTO_RUBROS = new Set([
  "SELLOS_PBA",
  "SELLOS_CABA",
  "SELLOS_VU_PBA",
  "SELLOS_VU_CABA",
  "CERT_ADMIN",
  "CERT_RPI_DOMINIO",
  "CERT_RPI_ANOT_PERS",
  "CERT_RPI_INFORME",
  "TASA_REGISTRACION_RPI",
  "APORTE_CAJA",
  "APORTE_COLEGIO",
  "APORTE_NOTARIAL",
  "APORTE_AJUSTE_MINIMO",
]);

export function classifyIVA(rubro: string): "EXENTO" | "GRAVADO" {
  if (IVA_EXENTO_RUBROS.has(rubro)) return "EXENTO";
  // Any rubro starting with SELLOS_, CERT_RPI_, APORTE_ is exento
  if (rubro.startsWith("SELLOS_")) return "EXENTO";
  if (rubro.startsWith("CERT_RPI_")) return "EXENTO";
  if (rubro.startsWith("APORTE_")) return "EXENTO";
  if (rubro === "TASA_REGISTRACION_RPI") return "EXENTO";
  return "GRAVADO";
}
