/**
 * actoAggregator — Aggregates per-act engine results + form items
 * into a consolidated multi-act presupuesto with IVA and discrimination.
 */

import type { PresupuestoResult, LineaPresupuesto } from "@/lib/services/PresupuestoEngine";
import type {
  ActoFormState,
  LineaConIVA,
  PresupuestoMultiActResult,
} from "./types";
import { classifyIVA } from "./types";

// ─── Form-originated lines (not from engine) ────────────

function buildFormLines(acto: ActoFormState, actoIndex: number): LineaConIVA[] {
  const lines: LineaConIVA[] = [];

  if (acto.certAdministrativos > 0) {
    lines.push({
      rubro: "CERT_ADMIN",
      concepto: "Certificados Administrativos",
      baseCalculo: acto.cantidadInmuebles,
      alicuota: null,
      monto: acto.certAdministrativos,
      pagador: "COMPRADOR",
      categoria: "CERTIFICADO",
      iva: "EXENTO",
      actoIndex,
    });
  }

  if (acto.selladosEscMatriz > 0) {
    lines.push({
      rubro: "SELLADOS_ESC_MATRIZ",
      concepto: "Sellados Escritura Matriz y Testimonios",
      baseCalculo: 0,
      alicuota: null,
      monto: acto.selladosEscMatriz,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  if (acto.confeccionMatricula > 0) {
    lines.push({
      rubro: "CONFECCION_MATRICULA",
      concepto: "Confección Matrícula y Rogatoria",
      baseCalculo: acto.cantidadInmuebles,
      alicuota: null,
      monto: acto.confeccionMatricula,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  if (acto.diligenciamientos > 0) {
    lines.push({
      rubro: "DILIGENCIAMIENTOS",
      concepto: "Diligenciamientos",
      baseCalculo: acto.montoEscrituraArs,
      alicuota: null,
      monto: acto.diligenciamientos,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  if (acto.procuracion > 0) {
    lines.push({
      rubro: "PROCURACION",
      concepto: "Procuración / Gastos Administrativos",
      baseCalculo: 0,
      alicuota: null,
      monto: acto.procuracion,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  if (acto.estudioTitulos > 0) {
    lines.push({
      rubro: "ESTUDIO_TITULOS",
      concepto: "Estudio de Títulos",
      baseCalculo: acto.montoEscrituraArs,
      alicuota: null,
      monto: acto.estudioTitulos,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  if (acto.agenteRetencion > 0) {
    lines.push({
      rubro: "AGENTE_RETENCION",
      concepto: "Agente de Retención",
      baseCalculo: 0,
      alicuota: null,
      monto: acto.agenteRetencion,
      pagador: "COMPRADOR",
      categoria: "GASTO_ADMIN",
      iva: "GRAVADO",
      actoIndex,
    });
  }

  return lines;
}

// ─── Convert engine lines to LineaConIVA ─────────────────

function tagEngineLines(
  engineResult: PresupuestoResult,
  actoIndex: number
): LineaConIVA[] {
  return engineResult.lineas.map((l) => ({
    ...l,
    iva: classifyIVA(l.rubro),
    actoIndex,
  }));
}

// ─── Discrimination: vendedor vs comprador ───────────────

function isSellosLine(rubro: string): boolean {
  return rubro.startsWith("SELLOS_");
}

function isAporteLine(rubro: string): boolean {
  return rubro.startsWith("APORTE_");
}

function buildDiscriminacion(lineas: LineaConIVA[]) {
  const vendedorItems: { concepto: string; monto: number }[] = [];
  const compradorItems: { concepto: string; monto: number }[] = [];

  for (const l of lineas) {
    if (isSellosLine(l.rubro)) {
      // Vendedor pays 50% sellos
      const vendPart = l.monto * 0.5;
      const compPart = l.monto * 0.5;
      if (vendPart > 0) vendedorItems.push({ concepto: l.concepto + " (50%)", monto: vendPart });
      if (compPart > 0) compradorItems.push({ concepto: l.concepto + " (50%)", monto: compPart });
    } else if (isAporteLine(l.rubro)) {
      // Vendedor pays 50% aportes
      const vendPart = l.monto * 0.5;
      const compPart = l.monto * 0.5;
      if (vendPart > 0) vendedorItems.push({ concepto: l.concepto + " (50%)", monto: vendPart });
      if (compPart > 0) compradorItems.push({ concepto: l.concepto + " (50%)", monto: compPart });
    } else {
      // Comprador pays everything else
      compradorItems.push({ concepto: l.concepto, monto: l.monto });
    }
  }

  const vendedorTotal = vendedorItems.reduce((s, i) => s + i.monto, 0);
  const compradorTotal = compradorItems.reduce((s, i) => s + i.monto, 0);

  return {
    vendedor: { items: vendedorItems, total: vendedorTotal },
    comprador: { items: compradorItems, total: compradorTotal },
  };
}

// ─── IVA Breakdown ───────────────────────────────────────

function buildIvaBreakdown(lineas: LineaConIVA[]) {
  const exentos: { concepto: string; monto: number }[] = [];
  const gravados: { concepto: string; monto: number }[] = [];

  for (const l of lineas) {
    const entry = { concepto: l.concepto, monto: l.monto };
    if (l.iva === "EXENTO") {
      exentos.push(entry);
    } else {
      gravados.push(entry);
    }
  }

  const subtotalExentos = exentos.reduce((s, e) => s + e.monto, 0);
  const subtotalGravados = gravados.reduce((s, e) => s + e.monto, 0);
  const ivaAmount = Math.round(subtotalGravados * 0.21 * 100) / 100;
  const totalConIva = subtotalExentos + subtotalGravados + ivaAmount;

  return {
    exentos,
    gravados,
    subtotalExentos,
    subtotalGravados,
    ivaAmount,
    totalConIva,
  };
}

// ─── Main Aggregator ─────────────────────────────────────

export interface ActoEngineResult {
  actoIndex: number;
  acto: ActoFormState;
  engineResult: PresupuestoResult;
}

export function aggregatePresupuesto(
  actosResults: ActoEngineResult[]
): PresupuestoMultiActResult {
  const allLineas: LineaConIVA[] = [];
  const actosOutput: PresupuestoMultiActResult["actosResults"] = [];
  const alertas: string[] = [];

  for (const { actoIndex, acto, engineResult } of actosResults) {
    // Engine lines (sellos, aportes, honorarios, tasa RPI, etc.)
    const engineLines = tagEngineLines(engineResult, actoIndex);

    // Form lines (cert admin, sellados esc, confección, etc.)
    const formLines = buildFormLines(acto, actoIndex);

    const allActoLines = [...engineLines, ...formLines];

    actosOutput.push({
      actoIndex,
      tipoActo: acto.tipoActo,
      codigoCesba: acto.codigoCesba,
      engineResult,
      lineasFormulario: formLines,
    });

    allLineas.push(...allActoLines);
    alertas.push(...engineResult.alertas);
  }

  const ivaBreakdown = buildIvaBreakdown(allLineas);
  const discriminacion = buildDiscriminacion(allLineas);

  return {
    actosResults: actosOutput,
    lineas: allLineas,
    ivaBreakdown,
    discriminacion,
    totalGeneral: ivaBreakdown.totalConIva,
    alertas,
  };
}
