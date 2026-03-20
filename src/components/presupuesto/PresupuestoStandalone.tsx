"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator, AlertTriangle, Download, Share2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { generarPresupuestoMultiActPdf } from "@/lib/pdf/presupuestoPdf";
import { CompartirPresupuestoDialog } from "@/components/CompartirPresupuestoDialog";
import type { ActoFormState, PresupuestoMultiActResult } from "@/lib/presupuesto/types";
import { DEFAULTS, calcDiligenciamientos, calcEstudioTitulos } from "@/lib/presupuesto/types";
import { getRecipe, evaluateRecipe } from "@/lib/presupuesto/recipeEngine";
import type { RecipeResult } from "@/lib/presupuesto/recipeEngine";
import ActoPresupuestoItem from "@/components/presupuesto/ActoPresupuestoItem";
import ResumenPresupuesto from "@/components/presupuesto/ResumenPresupuesto";

// ─── Helpers ──────────────────────────────────────────────

function createBlankActo(): ActoFormState {
  return {
    id: crypto.randomUUID(),
    tipoActo: "COMPRAVENTA",
    codigoCesba: "100-00",
    fechaEscritura: "",
    cotizacionUsd: 1200,
    montoEscrituraArs: 0,
    montoEscrituraUsd: 0,
    valuacionFiscal: 0,
    valuacionFiscalAlActo: 0,
    montoRealArs: 0,
    montoRealUsd: 0,
    cantidadInmuebles: DEFAULTS.cantidadInmuebles,
    cantidadTransmitentes: DEFAULTS.cantidadTransmitentes,
    cantidadCertificadosRpi: DEFAULTS.cantidadCertificadosRpi,
    cantidadFojas: DEFAULTS.cantidadFojas,
    certificados: DEFAULTS.certificados,
    certAdministrativos: DEFAULTS.certAdministrativosPorInmueble,
    selladosEscMatriz: DEFAULTS.selladosEscMatriz,
    confeccionMatricula: DEFAULTS.confeccionMatriculaPorInmueble,
    diligenciamientos: calcDiligenciamientos(0),
    procuracion: DEFAULTS.procuracion,
    estudioTitulos: calcEstudioTitulos(0),
    agenteRetencion: DEFAULTS.agenteRetencion,
    tipoInmueble: "EDIFICADO",
    esViviendaUnica: false,
    jurisdiccion: "PBA",
    honorariosPct: DEFAULTS.honorariosPct,
    honorariosFijo: null,
    rubroOverrides: new Map(),
    overrides: new Set(),
  };
}

/** Convert recipe result to PresupuestoMultiActResult for display components */
function recipeToMultiActResult(
  actos: ActoFormState[],
  recipeResults: RecipeResult[]
): PresupuestoMultiActResult {
  const allExentos: { concepto: string; monto: number }[] = [];
  const allGravados: { concepto: string; monto: number }[] = [];
  let totalExentos = 0;
  let totalGravados = 0;
  let totalIva = 0;

  for (const rr of recipeResults) {
    for (const r of rr.rubros) {
      const entry = { concepto: r.label, monto: r.monto };
      if (r.iva_class === "exento") {
        allExentos.push(entry);
        totalExentos += r.monto;
      } else {
        allGravados.push(entry);
        totalGravados += r.monto;
      }
    }
    totalIva += rr.iva;
  }

  const totalConIva = totalExentos + totalGravados + totalIva;

  // Merge discrimination from all recipes
  const vendedorItems: { concepto: string; monto: number }[] = [];
  const compradorItems: { concepto: string; monto: number }[] = [];
  let vendedorTotal = 0;

  for (const rr of recipeResults) {
    vendedorItems.push(...rr.discriminacion.vendedor.items);
    compradorItems.push(...rr.discriminacion.comprador.items);
    vendedorTotal += rr.discriminacion.vendedor.total;
  }

  return {
    actosResults: actos.map((acto, i) => ({
      actoIndex: i,
      tipoActo: acto.tipoActo,
      codigoCesba: acto.codigoCesba,
      engineResult: {
        lineas: [],
        totales: { total: recipeResults[i].total, por_pagador: {}, por_categoria: {} },
        metadata: {
          codigo_acto: acto.codigoCesba,
          descripcion_acto: acto.tipoActo,
          base_imponible: acto.montoEscrituraArs,
          moneda_operacion: "ARS",
          cotizacion_usd: acto.cotizacionUsd,
          es_vivienda_unica: acto.esViviendaUnica,
          jurisdiccion: acto.jurisdiccion,
          fecha_calculo: new Date().toISOString(),
        },
        alertas: [],
      },
      lineasFormulario: [],
    })),
    lineas: [],
    ivaBreakdown: {
      exentos: allExentos,
      gravados: allGravados,
      subtotalExentos: totalExentos,
      subtotalGravados: totalGravados,
      ivaAmount: totalIva,
      totalConIva,
    },
    discriminacion: {
      vendedor: { items: vendedorItems, total: vendedorTotal },
      comprador: { items: compradorItems, total: totalConIva - vendedorTotal },
    },
    totalGeneral: totalConIva,
    alertas: [],
  };
}

// ─── Component ────────────────────────────────────────────

export default function PresupuestoStandalone() {
  const [actos, setActos] = useState<ActoFormState[]>([createBlankActo()]);
  const [jurisdiccion, setJurisdiccion] = useState<"PBA" | "CABA">("PBA");
  const [resultado, setResultado] = useState<PresupuestoMultiActResult | null>(null);
  const [recipeResults, setRecipeResults] = useState<RecipeResult[]>([]);
  const [shareOpen, setShareOpen] = useState(false);

  // ── Acto mutations ──

  const updateActo = useCallback((index: number, updates: Partial<ActoFormState>) => {
    setActos(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }, []);

  const addActo = () => setActos(prev => [...prev, createBlankActo()]);
  const removeActo = (index: number) => setActos(prev => prev.filter((_, i) => i !== index));

  // ── Calculate using recipe engine ──

  const handleCalcular = () => {
    try {
      const results: RecipeResult[] = [];

      for (const acto of actos) {
        const recipe = getRecipe(acto.tipoActo);
        if (!recipe) {
          toast.error(`No hay receta definida para "${acto.tipoActo}". Solo Compraventa disponible por ahora.`);
          return;
        }

        const result = evaluateRecipe(
          recipe,
          {
            jurisdiction: jurisdiccion,
            escritura_ars: acto.montoEscrituraArs,
            precio_real_usd: acto.montoRealUsd || (acto.montoRealArs / (acto.cotizacionUsd || 1)),
            cotizacion_bna: acto.cotizacionUsd,
            cant_inmuebles: acto.cantidadInmuebles,
            cant_certificados_rpi: acto.cantidadCertificadosRpi,
            cant_fojas: acto.cantidadFojas,
          },
          acto.rubroOverrides.size > 0 ? acto.rubroOverrides : undefined
        );
        results.push(result);
      }

      setRecipeResults(results);
      setResultado(recipeToMultiActResult(actos, results));
    } catch (e: any) {
      toast.error(e.message ?? "Error al calcular");
    }
  };

  const legacyResult = resultado?.actosResults[0]?.engineResult ?? null;

  // ─── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calculator className="h-5 w-5" /> Presupuesto Rápido
        </h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Calculá un presupuesto estimativo sin crear una carpeta. Ideal para consultas rápidas.
      </p>

      {/* Global config */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Jurisdicción</Label>
          <Select value={jurisdiccion} onValueChange={(v: "PBA" | "CABA") => setJurisdiccion(v)}>
            <SelectTrigger className="h-8 w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PBA">Prov. Buenos Aires</SelectItem>
              <SelectItem value="CABA">CABA</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actos list */}
      <div className="space-y-3">
        {actos.map((acto, i) => (
          <ActoPresupuestoItem
            key={acto.id}
            index={i}
            acto={acto}
            recipeResult={recipeResults[i]}
            canDelete={actos.length > 1}
            onChange={updates => updateActo(i, updates)}
            onDelete={() => removeActo(i)}
          />
        ))}

        <Button variant="outline" size="sm" onClick={addActo} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar Acto
        </Button>
      </div>

      {/* Calculate button */}
      <Button onClick={handleCalcular}>
        <Calculator className="h-4 w-4 mr-2" />
        Calcular Presupuesto ({actos.length} acto{actos.length > 1 ? "s" : ""})
      </Button>

      {/* ── Results ── */}
      {resultado && (
        <>
          {resultado.alertas.length > 0 && (
            <div className="space-y-2">
              {resultado.alertas.map((a, i) => (
                <div key={i} className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700">{a}</p>
                </div>
              ))}
            </div>
          )}

          <ResumenPresupuesto result={resultado} />

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => generarPresupuestoMultiActPdf({ result: resultado })}
            >
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>

            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" /> Compartir
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Valores según Ley Impositiva PBA 15.558, Tabla CESBA ENE 2026, RPI DTR 13/25.
            Presupuesto estimativo, sujeto a verificación de certificados y condiciones particulares.
          </p>

          {legacyResult && (
            <CompartirPresupuestoDialog
              open={shareOpen}
              onOpenChange={setShareOpen}
              resultado={legacyResult}
              multiActResult={resultado}
              participantes={[]}
            />
          )}
        </>
      )}
    </div>
  );
}
