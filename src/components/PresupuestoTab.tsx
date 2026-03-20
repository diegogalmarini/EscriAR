"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator, Save, Send, AlertTriangle, CheckCircle2,
  Download, Share2, Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcularPresupuestoAction,
  guardarPresupuesto,
  cambiarEstadoPresupuesto,
  getPresupuesto,
} from "@/app/actions/presupuestos";
import type { PresupuestoInput, PresupuestoResult } from "@/lib/services/PresupuestoEngine";
import { generarPresupuestoMultiActPdf } from "@/lib/pdf/presupuestoPdf";
import { CompartirPresupuestoDialog } from "@/components/CompartirPresupuestoDialog";
import type { ActoFormState, PresupuestoMultiActResult, LineaConIVA } from "@/lib/presupuesto/types";
import { DEFAULTS, calcDiligenciamientos, calcEstudioTitulos, classifyIVA } from "@/lib/presupuesto/types";
import { aggregatePresupuesto, type ActoEngineResult } from "@/lib/presupuesto/actoAggregator";
import ActoPresupuestoItem from "@/components/presupuesto/ActoPresupuestoItem";
import ResumenPresupuesto from "@/components/presupuesto/ResumenPresupuesto";
import DiscriminacionPartes from "@/components/presupuesto/DiscriminacionPartes";

// ─── Helpers ──────────────────────────────────────────────

function createBlankActo(seed?: any): ActoFormState {
  const montoArs = seed?.monto_operacion
    ? (seed.moneda_operacion === "USD" && seed.cotizacion_usd
      ? seed.monto_operacion * seed.cotizacion_usd
      : seed.monto_operacion)
    : 0;

  return {
    id: crypto.randomUUID(),
    tipoActo: seed?.tipo_acto?.toUpperCase() ?? "COMPRAVENTA",
    codigoCesba: seed?.codigo_cesba ?? "100-00",
    fechaEscritura: "",
    cotizacionUsd: seed?.cotizacion_usd ?? 1200,
    montoEscrituraArs: montoArs,
    montoEscrituraUsd: seed?.moneda_operacion === "USD" ? (seed?.monto_operacion ?? 0) : 0,
    valuacionFiscal: seed?.inmuebles?.[0]?.valuacion_fiscal ?? 0,
    valuacionFiscalAlActo: 0,
    montoRealArs: montoArs,
    montoRealUsd: seed?.moneda_operacion === "USD" ? (seed?.monto_operacion ?? 0) : 0,
    cantidadInmuebles: seed?.inmuebles?.length ?? DEFAULTS.cantidadInmuebles,
    cantidadTransmitentes: seed?.participantes_operacion?.length ?? DEFAULTS.cantidadTransmitentes,
    certificados: DEFAULTS.certificados,
    certAdministrativos: DEFAULTS.certAdministrativosPorInmueble * (seed?.inmuebles?.length ?? 1),
    selladosEscMatriz: DEFAULTS.selladosEscMatriz,
    confeccionMatricula: DEFAULTS.confeccionMatriculaPorInmueble * (seed?.inmuebles?.length ?? 1),
    diligenciamientos: calcDiligenciamientos(montoArs),
    procuracion: DEFAULTS.procuracion,
    estudioTitulos: calcEstudioTitulos(montoArs),
    agenteRetencion: DEFAULTS.agenteRetencion,
    tipoInmueble: seed?.inmuebles?.[0]?.tipo_inmueble ?? "EDIFICADO",
    esViviendaUnica: !!seed?.es_vivienda_unica,
    jurisdiccion: "PBA",
    honorariosPct: DEFAULTS.honorariosPct,
    honorariosFijo: null,
    overrides: new Set(),
  };
}

function restoreActoFromJson(saved: any): ActoFormState {
  return {
    ...saved,
    overrides: new Set(saved.overrides ?? []),
  };
}

// ─── Props ────────────────────────────────────────────────

interface PresupuestoTabProps {
  carpetaId: string;
  currentEscritura: any | null;
  savedPresupuesto?: any;
}

// ─── Component ────────────────────────────────────────────

export default function PresupuestoTab({ carpetaId, currentEscritura, savedPresupuesto }: PresupuestoTabProps) {
  const ops = currentEscritura?.operaciones ?? [];

  const [actos, setActos] = useState<ActoFormState[]>(() => {
    if (ops.length > 0) return ops.map((op: any) => createBlankActo(op));
    return [createBlankActo()];
  });

  const [jurisdiccion, setJurisdiccion] = useState<"PBA" | "CABA">("PBA");
  const [resultado, setResultado] = useState<PresupuestoMultiActResult | null>(null);
  const [engineLinesByActo, setEngineLinesByActo] = useState<Map<number, LineaConIVA[]>>(new Map());
  const [presupuestoGuardado, setPresupuestoGuardado] = useState(savedPresupuesto ?? null);
  const [isPending, startTransition] = useTransition();
  const [shareOpen, setShareOpen] = useState(false);

  // ── Load saved presupuesto on mount ──
  useEffect(() => {
    getPresupuesto(carpetaId).then(res => {
      if (res.success && res.data) {
        setPresupuestoGuardado(res.data);
        // Restore actos from actos_json if available
        const savedActos = res.data.actos_json;
        if (Array.isArray(savedActos) && savedActos.length > 0) {
          setActos(savedActos.map(restoreActoFromJson));
        }
      }
    });
  }, [carpetaId]);

  // ── Acto mutations ──

  const updateActo = useCallback((index: number, updates: Partial<ActoFormState>) => {
    setActos(prev => {
      const next = [...prev];
      const merged = { ...next[index], ...updates };

      // Auto-recalc formulas when monto or cantidadInmuebles change
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

  // ── Save ──

  const handleGuardar = () => {
    startTransition(async () => {
      const input = buildEngineInput(actos[0]);
      // Serialize actos for multi-act persistence (strip Set for JSON compat)
      const actosJson = actos.map(a => ({ ...a, overrides: [...a.overrides] }));
      const res = await guardarPresupuesto(carpetaId, input, actosJson);
      if (res.success) {
        toast.success(`Presupuesto v${presupuestoGuardado ? (presupuestoGuardado.version ?? 0) + 1 : 1} guardado`);
        setPresupuestoGuardado({ id: res.presupuestoId, estado: "BORRADOR" });
      } else {
        toast.error(res.error ?? "Error al guardar");
      }
    });
  };

  const handleEnviar = () => {
    if (!presupuestoGuardado?.id) return;
    startTransition(async () => {
      const res = await cambiarEstadoPresupuesto(presupuestoGuardado.id, "ENVIADO", carpetaId);
      if (res.success) {
        toast.success("Presupuesto marcado como ENVIADO");
        setPresupuestoGuardado((p: any) => ({ ...p, estado: "ENVIADO" }));
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  };

  const handleAceptar = () => {
    if (!presupuestoGuardado?.id) return;
    startTransition(async () => {
      const res = await cambiarEstadoPresupuesto(presupuestoGuardado.id, "ACEPTADO", carpetaId);
      if (res.success) {
        toast.success("Presupuesto ACEPTADO por el cliente");
        setPresupuestoGuardado((p: any) => ({ ...p, estado: "ACEPTADO" }));
      } else {
        toast.error(res.error ?? "Error");
      }
    });
  };

  // Legacy PresupuestoResult for PDF/share backward compat
  const legacyResult = resultado?.actosResults[0]?.engineResult ?? null;

  // ─── RENDER ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Presupuesto Notarial
        </h3>
        {presupuestoGuardado && (
          <Badge variant={
            presupuestoGuardado.estado === "ACEPTADO" ? "default" :
            presupuestoGuardado.estado === "ENVIADO" ? "secondary" : "outline"
          }>
            {presupuestoGuardado.estado}
          </Badge>
        )}
      </div>

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

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleGuardar} disabled={isPending} variant="default">
              <Save className="h-4 w-4 mr-2" />
              {presupuestoGuardado ? "Guardar nueva versión" : "Guardar Presupuesto"}
            </Button>

            <Button
              variant="outline"
              onClick={() => generarPresupuestoMultiActPdf({
                result: resultado,
                version: presupuestoGuardado?.version,
              })}
            >
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>

            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 className="h-4 w-4 mr-2" /> Compartir
            </Button>

            {presupuestoGuardado?.estado === "BORRADOR" && (
              <Button onClick={handleEnviar} disabled={isPending} variant="secondary">
                <Send className="h-4 w-4 mr-2" /> Marcar como Enviado
              </Button>
            )}

            {presupuestoGuardado?.estado === "ENVIADO" && (
              <Button onClick={handleAceptar} disabled={isPending} variant="secondary">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Cliente Aceptó
              </Button>
            )}
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
              participantes={
                (currentEscritura?.operaciones ?? []).flatMap((op: any) =>
                  (op.participantes_operacion ?? []).map((po: any) => {
                    const persona = po.persona ?? po.personas;
                    return {
                      nombre_completo: persona?.nombre_completo ?? "Sin nombre",
                      contacto: persona?.contacto,
                      rol: po.rol ?? "PARTE",
                    };
                  })
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}
