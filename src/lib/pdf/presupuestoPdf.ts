/**
 * Generador de PDF profesional para presupuestos notariales.
 * Usa jsPDF + jspdf-autotable para renderizar un documento
 * con membrete, desglose por rubro, resumen por pagador y disclaimers legales.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PresupuestoResult, Pagador } from "@/lib/services/PresupuestoEngine";

// ─── Helpers ──────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const PAGADOR_LABELS: Record<Pagador, string> = {
  COMPRADOR: "Comprador",
  VENDEDOR: "Vendedor",
  DEUDOR: "Deudor",
  ACREEDOR: "Acreedor",
  NOTARIO: "Escribanía",
  COMUN: "Común (partes)",
  ESCRIBANIA: "Escribanía",
};

const CATEGORIA_LABELS: Record<string, string> = {
  IMPUESTO: "Impuestos",
  TASA: "Tasas",
  HONORARIO: "Honorarios",
  APORTE: "Aportes",
  CERTIFICADO: "Certificados",
  GASTO_ADMIN: "Gastos Administrativos",
};

// ─── Multi-act types ─────────────────────────────────────

import type { PresupuestoMultiActResult } from "@/lib/presupuesto/types";

// ─── Main Export (legacy single-act) ─────────────────────

interface PresupuestoPdfOptions {
  result: PresupuestoResult;
  escribania?: string;
  cliente?: string;
  carpetaLabel?: string;
  version?: number;
}

export function generarPresupuestoPdf(opts: PresupuestoPdfOptions): void {
  const { result, escribania = "Escribanía", cliente, carpetaLabel, version } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(escribania, margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("PRESUPUESTO DE GASTOS ESCRITURARIOS", margin, y);
  y += 5;

  // Línea decorativa
  doc.setDrawColor(41, 98, 255);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Datos de la operación ──
  doc.setTextColor(0);
  doc.setFontSize(9);

  const meta = result.metadata;
  const infoLines = [
    ["Acto:", `${meta.descripcion_acto} (${meta.codigo_acto})`],
    ["Jurisdicción:", meta.jurisdiccion],
    ["Base imponible:", fmt(meta.base_imponible)],
    ["Moneda:", meta.moneda_operacion + (meta.cotizacion_usd ? ` (TC: ${meta.cotizacion_usd})` : "")],
    ["Vivienda única:", meta.es_vivienda_unica ? "Sí" : "No"],
    ["Fecha cálculo:", meta.fecha_calculo],
  ];

  if (cliente) infoLines.unshift(["Cliente:", cliente]);
  if (carpetaLabel) infoLines.unshift(["Carpeta:", carpetaLabel]);
  if (version) infoLines.push(["Versión:", `v${version}`]);

  for (const [label, value] of infoLines) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 30, y);
    y += 4.5;
  }
  y += 4;

  // ── Alertas ──
  if (result.alertas.length > 0) {
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(255, 193, 7);
    const alertH = result.alertas.length * 5 + 4;
    doc.roundedRect(margin, y, pageW - 2 * margin, alertH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(150, 100, 0);
    for (const alerta of result.alertas) {
      y += 4.5;
      doc.text("⚠ " + alerta, margin + 3, y);
    }
    y += 6;
    doc.setTextColor(0);
  }

  // ── Tabla de desglose ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DESGLOSE DE GASTOS", margin, y);
  y += 2;

  const tableBody = result.lineas.map(l => [
    l.concepto,
    l.alicuota != null ? `${(l.alicuota * 100).toFixed(2)}%` : "Fijo",
    fmt(l.monto),
    PAGADOR_LABELS[l.pagador] || l.pagador,
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Concepto", "Alícuota", "Monto", "A cargo de"]],
    body: tableBody,
    foot: [["TOTAL", "", fmt(result.totales.total), ""]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [230, 240, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "right", cellWidth: 30 },
      3: { cellWidth: 30 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Resumen por pagador ──
  const pagadorEntries = Object.entries(result.totales.por_pagador).filter(([, v]) => v && v > 0);
  if (pagadorEntries.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN POR PARTE", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Parte", "Total"]],
      body: pagadorEntries.map(([p, v]) => [PAGADOR_LABELS[p as Pagador] || p, fmt(v!)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Resumen por categoría ──
  const catEntries = Object.entries(result.totales.por_categoria).filter(([, v]) => v && v > 0);
  if (catEntries.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN POR RUBRO", margin, y);
    y += 2;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Rubro", "Total"]],
      body: catEntries.map(([c, v]) => [CATEGORIA_LABELS[c] || c, fmt(v!)]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" } },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── USD equiv ──
  if (meta.cotizacion_usd && meta.moneda_operacion === "USD") {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(60);
    const totalUsd = Math.round(result.totales.total / meta.cotizacion_usd);
    doc.text(`Total equivalente: USD ${totalUsd.toLocaleString("es-AR")} (TC BNA Vendedor: ${meta.cotizacion_usd})`, margin, y);
    y += 8;
    doc.setTextColor(0);
  }

  // ── Disclaimer ──
  const maxY = doc.internal.pageSize.getHeight() - 25;
  if (y > maxY) { doc.addPage(); y = margin; }

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  const disclaimer = [
    "Este presupuesto es de carácter orientativo y no constituye liquidación definitiva.",
    "Los montos pueden variar según la cotización del día de firma, tasas vigentes al momento de registración,",
    "y la situación fiscal particular de las partes. Fuentes: Ley Impositiva PBA 2026, DTR 13/25 (RPI),",
    "Tabla de Aranceles COLESBA, AFIP (Ganancias Global/Cedular). Válido por 30 días desde la fecha de emisión.",
  ];
  for (const line of disclaimer) {
    doc.text(line, margin, y);
    y += 3.5;
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} — Generado por EscriAr`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  // ── Save ──
  const filename = `presupuesto_${meta.codigo_acto.replace(/-/g, "_")}_${meta.fecha_calculo}.pdf`;
  doc.save(filename);
}

// ─── Multi-Act PDF ───────────────────────────────────────

interface PresupuestoMultiActPdfOptions {
  result: PresupuestoMultiActResult;
  escribania?: string;
  cliente?: string;
  carpetaLabel?: string;
  version?: number;
}

export function generarPresupuestoMultiActPdf(opts: PresupuestoMultiActPdfOptions): void {
  const { result, escribania = "Escribanía", cliente, carpetaLabel, version } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 20) { doc.addPage(); y = margin; }
  };

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(escribania, margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("PRESUPUESTO DE GASTOS ESCRITURARIOS", margin, y);
  y += 5;
  doc.setDrawColor(41, 98, 255);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Info ──
  doc.setTextColor(0);
  doc.setFontSize(9);
  const infoLines: string[][] = [];
  if (carpetaLabel) infoLines.push(["Carpeta:", carpetaLabel]);
  if (cliente) infoLines.push(["Cliente:", cliente]);
  infoLines.push(["Actos:", `${result.actosResults.length}`]);
  if (version) infoLines.push(["Versión:", `v${version}`]);

  for (const [label, value] of infoLines) {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 30, y);
    y += 4.5;
  }
  y += 4;

  // ── Alertas ──
  if (result.alertas.length > 0) {
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(255, 193, 7);
    const alertH = result.alertas.length * 5 + 4;
    ensureSpace(alertH);
    doc.roundedRect(margin, y, pageW - 2 * margin, alertH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(150, 100, 0);
    for (const alerta of result.alertas) {
      y += 4.5;
      doc.text("! " + alerta, margin + 3, y);
    }
    y += 6;
    doc.setTextColor(0);
  }

  // ── Per-act breakdown ──
  for (const actoRes of result.actosResults) {
    ensureSpace(30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(
      `ACTO ${actoRes.actoIndex + 1}: ${actoRes.tipoActo}${actoRes.codigoCesba ? ` (${actoRes.codigoCesba})` : ""}`,
      margin, y
    );
    y += 2;

    const engineLines = actoRes.engineResult.lineas.map(l => [
      l.concepto,
      l.alicuota != null ? `${(l.alicuota * 100).toFixed(2)}%` : "Fijo",
      fmt(l.monto),
      PAGADOR_LABELS[l.pagador] || l.pagador,
    ]);
    const formLines = actoRes.lineasFormulario.map(l => [
      l.concepto,
      "Fijo",
      fmt(l.monto),
      PAGADOR_LABELS[l.pagador] || l.pagador,
    ]);
    const allLines = [...engineLines, ...formLines];
    const actoTotal = actoRes.engineResult.totales.total +
      actoRes.lineasFormulario.reduce((s, l) => s + l.monto, 0);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Concepto", "Alícuota", "Monto", "A cargo de"]],
      body: allLines,
      foot: [[`Subtotal Acto ${actoRes.actoIndex + 1}`, "", fmt(actoTotal), ""]],
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [230, 240, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "right", cellWidth: 28 },
        3: { cellWidth: 28 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── IVA Breakdown ──
  ensureSpace(30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN IVA", margin, y);
  y += 2;

  const ivaBody: string[][] = [];
  if (result.ivaBreakdown.exentos.length > 0) {
    ivaBody.push(["EXENTOS DE IVA", "", ""]);
    for (const item of result.ivaBreakdown.exentos) {
      ivaBody.push(["  " + item.concepto, "", fmt(item.monto)]);
    }
    ivaBody.push(["Subtotal Exentos", "", fmt(result.ivaBreakdown.subtotalExentos)]);
  }
  if (result.ivaBreakdown.gravados.length > 0) {
    ivaBody.push(["GRAVADOS (21%)", "", ""]);
    for (const item of result.ivaBreakdown.gravados) {
      ivaBody.push(["  " + item.concepto, "", fmt(item.monto)]);
    }
    ivaBody.push(["Subtotal Gravados", "", fmt(result.ivaBreakdown.subtotalGravados)]);
    ivaBody.push(["IVA 21%", "", fmt(result.ivaBreakdown.ivaAmount)]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: ivaBody,
    foot: [["TOTAL CON IVA", "", fmt(result.ivaBreakdown.totalConIva)]],
    styles: { fontSize: 8, cellPadding: 2 },
    footStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: "bold", fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      2: { halign: "right", cellWidth: 35 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ── Discriminación Vendedor / Comprador ──
  ensureSpace(30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DISTRIBUCIÓN ECONÓMICA", margin, y);
  y += 2;

  const discBody: string[][] = [];
  discBody.push(["VENDEDOR (50% Sellos + 50% Aportes)", ""]);
  for (const item of result.discriminacion.vendedor.items) {
    discBody.push(["  " + item.concepto, fmt(item.monto)]);
  }
  discBody.push(["Total Vendedor", fmt(result.discriminacion.vendedor.total)]);
  discBody.push(["", ""]);
  discBody.push(["COMPRADOR (resto)", ""]);
  for (const item of result.discriminacion.comprador.items) {
    discBody.push(["  " + item.concepto, fmt(item.monto)]);
  }
  discBody.push(["Total Comprador", fmt(result.discriminacion.comprador.total)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: discBody,
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { halign: "right", cellWidth: 35 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── Disclaimer ──
  ensureSpace(25);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  const disclaimer = [
    "Este presupuesto es de carácter orientativo y no constituye liquidación definitiva.",
    "Los montos pueden variar según la cotización del día de firma, tasas vigentes al momento de registración,",
    "y la situación fiscal particular de las partes. Fuentes: Ley Impositiva PBA 2026, DTR 13/25 (RPI),",
    "Tabla de Aranceles COLESBA, AFIP (Ganancias Global/Cedular). Válido por 30 días desde la fecha de emisión.",
  ];
  for (const line of disclaimer) {
    doc.text(line, margin, y);
    y += 3.5;
  }

  // ── Page footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} — Generado por EscriAr`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  // ── Save ──
  const fecha = new Date().toISOString().slice(0, 10);
  doc.save(`presupuesto_multi_${result.actosResults.length}_actos_${fecha}.pdf`);
}
