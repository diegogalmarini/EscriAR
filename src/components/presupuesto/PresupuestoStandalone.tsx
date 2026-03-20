"use client";

import { useState, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator, AlertTriangle, Download, Share2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { calcularPresupuestoAction } from "@/app/actions/presupuestos";
import type { PresupuestoInput } from "@/lib/services/PresupuestoEngine";
import { generarPresupuestoMultiActPdf } from "@/lib/pdf/presupuestoPdf";
import { CompartirPresupuestoDialog } from "@/components/CompartirPresupuestoDialog";
import type { ActoFormState, PresupuestoMultiActResult, LineaConIVA } from "@/lib/presupuesto/types";
import { DEFAULTS, calcDiligenciamientos, calcEstudioTitulos, classifyIVA } from "@/lib/presupuesto/types";
import { aggregatePresupuesto, type ActoEngineResult } from "@/lib/presupuesto/actoAggregator";
import ActoPresupuestoItem from "@/components/presupuesto/ActoPresupuestoItem";
import ResumenPresupuesto from "@/components/presupuesto/ResumenPresupuesto";
import DiscriminacionPartes from "@/components/presupuesto/DiscriminacionPartes";

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
    overrides: new Set(),
  };
}

// ─── Component ────────────────────────────────────────────

export default function PresupuestoStandalone() {
  const [actos, setActos] = useState<ActoFormState[]>([createBlankActo()]);
  const [jurisdiccion, setJurisdiccion] = useState<"PBA" | "CABA">("PBA");
  const [resultado, setResultado] = useState<PresupuestoMultiActResult | null>(null);
  const [engineLinesByActo, setEngineLinesByActo] = useState<Map<number, LineaConIVA[]>>(new Map());
  const [isPending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);

  // ── Acto mutations ──

  const updateActo = useCallback((index: number, updates: Partial<ActoFormState>) => {
    setActos(prev => {
      const next = [...prev];
      const merged = { ...next[index], ...updates };

      if ("montoEscrituraArs" in updates || "cantidadInmuebles" in updates) {
        const ov = merged.overrides;
        if (!ov.has("certAdministrativos"))
          merged.certAdministrativos = DEFAULTS.certAdministrativosPorInmueble * merged.cantidadInmuebles;
        if (!ov.has("confeccionMatricula"))
          merged.confeccionMatricula = DEFAULTS.confeccionMatriculaPorInmueble * merged.cantidadInmuebles;
        if (!ov.has("diligenciamientos"))
          merged.diligenciamientos = calcDiligenciamientos(merged.montoEscrituraArs);
        if (!ov.has("estudioTitulos"))
          merged.estudioTitulos = calcEstudioTitulos(merged.montoEscrituraArs);
      }

      next[index] = merged;
      return next;
    });
  }, []);

  const addActo = () => setActos(prev => [...prev, createBlankActo()]);
  const removeActo = (index: number) => setActos(prev => prev.filter((_, i) => i !== index));

  // ── Build engine input ──

  const buildEngineInput = (acto: ActoFormState): PresupuestoInput => ({
    tipo_acto: acto.tipoActo,
    codigo_cesba: acto.codigoCesba || undefined,
    monto_operacion: acto.montoRealArs || acto.montoEscrituraArs,
    moneda: "ARS",
    valuacion_fiscal: acto.valuacionFiscal,
    tipo_inmueble: acto.tipoInmueble,
    es_vivienda_unica: acto.esViviendaUnica,
    jurisdiccion,
    urgencia_rpi: acto.certificados,
    cantidad_inmuebles: acto.cantidadInmuebles,
    cantidad_personas: acto.cantidadTransmitentes,
    honorarios_pct: acto.honorariosFijo === null ? acto.honorariosPct : undefined,
    honorarios_fijo: acto.honorariosFijo ?? undefined,
  });

  // ── Calculate ──

  const handleCalcular = () => {
    startTransition(async () => {
      try {
        const actosResults: ActoEngineResult[] = [];
        const linesByActo = new Map<number, LineaConIVA[]>();

        for (let i = 0; i < actos.length; i++) {
          const input = buildEngineInput(actos[i]);
          const res = await calcularPresupuestoAction(input);
          if (!res.success || !res.data) {
            toast.error(`Error en Acto ${i + 1}: ${res.error}`);
            return;
          }
          actosResults.push({ actoIndex: i, acto: actos[i], engineResult: res.data });

          const tagged: LineaConIVA[] = res.data.lineas.map(l => ({
            ...l,
            iva: classifyIVA(l.rubro),
            actoIndex: i,
          }));
          linesByActo.set(i, tagged);
        }

        setResultado(aggregatePresupuesto(actosResults));
        setEngineLinesByActo(linesByActo);
      } catch (e: any) {
        toast.error(e.message ?? "Error al calcular");
      }
    });
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
            engineLines={engineLinesByActo.get(i)}
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
      <Button onClick={handleCalcular} disabled={isPending}>
        <Calculator className="h-4 w-4 mr-2" />
        {isPending ? "Calculando..." : `Calcular Presupuesto (${actos.length} acto${actos.length > 1 ? "s" : ""})`}
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
          <DiscriminacionPartes discriminacion={resultado.discriminacion} />

          {/* Action buttons — no save/send for standalone */}
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
