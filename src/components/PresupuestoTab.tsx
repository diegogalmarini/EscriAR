"use client";

import { useState, useMemo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Calculator, Save, Send, AlertTriangle, CheckCircle2, Info, DollarSign,
  FileText, Receipt, Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  calcularPresupuestoAction,
  guardarPresupuesto,
  cambiarEstadoPresupuesto,
} from "@/app/actions/presupuestos";
import type { PresupuestoInput, PresupuestoResult, LineaPresupuesto, Pagador } from "@/lib/services/PresupuestoEngine";
import { generarPresupuestoPdf } from "@/lib/pdf/presupuestoPdf";

// ─── Helpers ──────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const PAGADOR_COLORS: Record<Pagador, string> = {
  COMPRADOR: "bg-blue-100 text-blue-800",
  VENDEDOR: "bg-orange-100 text-orange-800",
  DEUDOR: "bg-blue-100 text-blue-800",
  ACREEDOR: "bg-purple-100 text-purple-800",
  NOTARIO: "bg-green-100 text-green-800",
  COMUN: "bg-slate-100 text-slate-700",
  ESCRIBANIA: "bg-emerald-100 text-emerald-800",
};

const CATEGORIA_ICONS: Record<string, typeof Calculator> = {
  IMPUESTO: Receipt,
  TASA: FileText,
  HONORARIO: DollarSign,
  APORTE: Receipt,
  CERTIFICADO: FileText,
  GASTO_ADMIN: FileText,
};

const HONORARIOS_OPCIONES = [
  { value: "0.01", label: "1%" },
  { value: "0.015", label: "1.5%" },
  { value: "0.02", label: "2% (Colegio)" },
  { value: "custom", label: "Monto fijo" },
];

const TIPOS_ACTO = [
  { value: "COMPRAVENTA", label: "Compraventa" },
  { value: "HIPOTECA", label: "Hipoteca" },
  { value: "DONACION", label: "Donación" },
  { value: "CESION", label: "Cesión" },
  { value: "PODER", label: "Poder" },
  { value: "ACTA", label: "Acta" },
  { value: "DIVISION_CONDOMINIO", label: "División de Condominio" },
  { value: "AFECTACION_BIEN_FAMILIA", label: "Afectación Bien de Familia" },
  { value: "USUFRUCTO", label: "Usufructo" },
  { value: "FIDEICOMISO", label: "Fideicomiso" },
  { value: "CANCELACION_HIPOTECA", label: "Cancelación de Hipoteca" },
];

// ─── Props ────────────────────────────────────────────────

interface PresupuestoTabProps {
  carpetaId: string;
  currentEscritura: any | null;
  savedPresupuesto?: any;
}

// ─── Component ────────────────────────────────────────────

export default function PresupuestoTab({ carpetaId, currentEscritura, savedPresupuesto }: PresupuestoTabProps) {
  // Auto-seed from operación
  const op = currentEscritura?.operaciones?.[0];
  const inmueble = currentEscritura?.operaciones?.[0]?.inmuebles?.[0]
    ?? currentEscritura?.inmuebles?.[0];

  // ── Form State ──
  const [tipoActo, setTipoActo] = useState(op?.tipo_acto?.toUpperCase() || "COMPRAVENTA");
  const [monto, setMonto] = useState(op?.monto_operacion?.toString() || "");
  const [moneda, setMoneda] = useState<"ARS" | "USD">("USD");
  const [cotUsd, setCotUsd] = useState("1200");
  const [vf, setVf] = useState(inmueble?.valuacion_fiscal?.toString() || "");
  const [tipoInmueble, setTipoInmueble] = useState<"EDIFICADO" | "BALDIO" | "RURAL">("EDIFICADO");
  const [esVU, setEsVU] = useState(false);
  const [esBcoProv, setEsBcoProv] = useState(false);
  const [fechaAdq, setFechaAdq] = useState("");
  const [certNoRetencion, setCertNoRetencion] = useState(false);
  const [urgencia, setUrgencia] = useState<"simple" | "urgente">("simple");
  const [cantInmuebles, setCantInmuebles] = useState("1");
  const [cantPersonas, setCantPersonas] = useState("2");
  const [honorariosTipo, setHonorariosTipo] = useState("0.02");
  const [honorariosFijo, setHonorariosFijo] = useState("");
  const [cantLeg, setCantLeg] = useState("0");
  const [cantApo, setCantApo] = useState("0");

  // ── Results ──
  const [resultado, setResultado] = useState<PresupuestoResult | null>(null);
  const [presupuestoGuardado, setPresupuestoGuardado] = useState(savedPresupuesto ?? null);
  const [isPending, startTransition] = useTransition();

  const esHipoteca = tipoActo === "HIPOTECA";

  // ── Build input ──
  const buildInput = (): PresupuestoInput => ({
    tipo_acto: tipoActo,
    monto_operacion: parseFloat(monto) || 0,
    moneda,
    cotizacion_usd: moneda === "USD" ? parseFloat(cotUsd) || 1200 : undefined,
    valuacion_fiscal: parseFloat(vf) || 0,
    tipo_inmueble: tipoInmueble,
    es_vivienda_unica: esVU,
    es_banco_provincia: esBcoProv,
    fecha_adquisicion_vendedor: fechaAdq || undefined,
    tiene_cert_no_retencion_iti: certNoRetencion,
    urgencia_rpi: urgencia,
    cantidad_inmuebles: parseInt(cantInmuebles) || 1,
    cantidad_personas: parseInt(cantPersonas) || 2,
    honorarios_pct: honorariosTipo !== "custom" ? parseFloat(honorariosTipo) : undefined,
    honorarios_fijo: honorariosTipo === "custom" ? parseFloat(honorariosFijo) || 0 : undefined,
    cantidad_legalizaciones: parseInt(cantLeg) || 0,
    cantidad_apostillas: parseInt(cantApo) || 0,
  });

  // ── Actions ──
  const handleCalcular = () => {
    startTransition(async () => {
      const res = await calcularPresupuestoAction(buildInput());
      if (res.success && res.data) {
        setResultado(res.data);
      } else {
        toast.error(res.error ?? "Error al calcular");
      }
    });
  };

  const handleGuardar = () => {
    startTransition(async () => {
      const res = await guardarPresupuesto(carpetaId, buildInput());
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

  // ── Totals by pagador ──
  const totalesPorPagador = useMemo(() => {
    if (!resultado) return {};
    return resultado.totales.por_pagador;
  }, [resultado]);

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

      {/* ── Formulario ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Datos de la Operación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Tipo de Acto */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Acto</Label>
              <Select value={tipoActo} onValueChange={setTipoActo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_ACTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-xs">Monto de la Operación</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="100000" value={monto} onChange={e => setMonto(e.target.value)} className="h-9 flex-1" />
                <Select value={moneda} onValueChange={(v: "ARS" | "USD") => setMoneda(v)}>
                  <SelectTrigger className="w-[75px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="ARS">ARS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cotización */}
            {moneda === "USD" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Cotización USD</Label>
                <Input type="number" value={cotUsd} onChange={e => setCotUsd(e.target.value)} className="h-9" />
              </div>
            )}

            {/* Valuación Fiscal */}
            <div className="space-y-1.5">
              <Label className="text-xs">Valuación Fiscal (ARS)</Label>
              <Input type="number" value={vf} onChange={e => setVf(e.target.value)} placeholder="50000000" className="h-9" />
            </div>

            {/* Tipo Inmueble */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de Inmueble</Label>
              <Select value={tipoInmueble} onValueChange={(v: any) => setTipoInmueble(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EDIFICADO">Edificado</SelectItem>
                  <SelectItem value="BALDIO">Baldío</SelectItem>
                  <SelectItem value="RURAL">Rural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Honorarios */}
            <div className="space-y-1.5">
              <Label className="text-xs">Honorarios</Label>
              <Select value={honorariosTipo} onValueChange={setHonorariosTipo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HONORARIOS_OPCIONES.map(h => (
                    <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {honorariosTipo === "custom" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Honorarios fijo (ARS)</Label>
                <Input type="number" value={honorariosFijo} onChange={e => setHonorariosFijo(e.target.value)} className="h-9" />
              </div>
            )}

            {/* Urgencia / Cantidades */}
            <div className="space-y-1.5">
              <Label className="text-xs">Urgencia RPI</Label>
              <Select value={urgencia} onValueChange={(v: any) => setUrgencia(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cant. Inmuebles</Label>
              <Input type="number" min={1} value={cantInmuebles} onChange={e => setCantInmuebles(e.target.value)} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cant. Personas</Label>
              <Input type="number" min={1} value={cantPersonas} onChange={e => setCantPersonas(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Switches */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
            <div className="flex items-center gap-2">
              <Switch id="vu" checked={esVU} onCheckedChange={setEsVU} />
              <Label htmlFor="vu" className="text-xs">Vivienda Única</Label>
            </div>
            {esHipoteca && (
              <div className="flex items-center gap-2">
                <Switch id="bcoprov" checked={esBcoProv} onCheckedChange={setEsBcoProv} />
                <Label htmlFor="bcoprov" className="text-xs">Bco. Provincia</Label>
              </div>
            )}
            {!esHipoteca && (
              <>
                <div className="flex items-center gap-2">
                  <Switch id="certiti" checked={certNoRetencion} onCheckedChange={setCertNoRetencion} />
                  <Label htmlFor="certiti" className="text-xs">Cert. No Retención ITI</Label>
                </div>
              </>
            )}
          </div>

          {!esHipoteca && !certNoRetencion && (
            <div className="space-y-1.5 max-w-xs">
              <Label className="text-xs">Fecha adquisición vendedor</Label>
              <Input type="date" value={fechaAdq} onChange={e => setFechaAdq(e.target.value)} className="h-9" />
            </div>
          )}

          {/* Botón Calcular */}
          <Button onClick={handleCalcular} disabled={isPending} className="mt-2">
            <Calculator className="h-4 w-4 mr-2" />
            {isPending ? "Calculando..." : "Calcular Presupuesto"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Resultado ── */}
      {resultado && (
        <>
          {/* Alertas */}
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

          {/* Tabla de desglose */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Desglose — {resultado.metadata.descripcion_acto}
                  <span className="text-xs text-muted-foreground ml-2">({resultado.metadata.codigo_acto})</span>
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Base: {fmt(resultado.metadata.base_imponible)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Concepto</TableHead>
                    <TableHead className="text-right">Alícuota</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Pagador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.lineas.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        {l.concepto}
                        {l.notas && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{l.notas}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {l.alicuota ? `${(l.alicuota * 100).toFixed(2)}%` : "Fijo"}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm tabular-nums">
                        {fmt(l.monto)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[10px] ${PAGADOR_COLORS[l.pagador]}`}>
                          {l.pagador}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total row */}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={2} className="text-right">TOTAL ESTIMADO</TableCell>
                    <TableCell className="text-right text-base tabular-nums">
                      {fmt(resultado.totales.total)}
                    </TableCell>
                    <TableCell />
                  </TableRow>

                  {moneda === "USD" && cotUsd && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-right text-muted-foreground text-xs">
                        Equiv. USD (BNA {cotUsd})
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {fmtUsd(resultado.totales.total / (parseFloat(cotUsd) || 1))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Resumen por Pagador */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resumen por Pagador</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(totalesPorPagador).map(([pagador, monto]) => (
                  <div key={pagador} className="rounded-lg border p-3 space-y-1">
                    <Badge variant="secondary" className={`text-[10px] ${PAGADOR_COLORS[pagador as Pagador]}`}>
                      {pagador}
                    </Badge>
                    <p className="text-lg font-semibold tabular-nums">{fmt(monto as number)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button onClick={handleGuardar} disabled={isPending} variant="default">
              <Save className="h-4 w-4 mr-2" />
              {presupuestoGuardado ? "Guardar nueva versión" : "Guardar Presupuesto"}
            </Button>

            <Button
              variant="outline"
              onClick={() => generarPresupuestoPdf({
                result: resultado!,
                version: presupuestoGuardado?.version,
              })}
            >
              <Download className="h-4 w-4 mr-2" /> Descargar PDF
            </Button>

            {presupuestoGuardado && presupuestoGuardado.estado === "BORRADOR" && (
              <Button onClick={handleEnviar} disabled={isPending} variant="secondary">
                <Send className="h-4 w-4 mr-2" /> Marcar como Enviado
              </Button>
            )}

            {presupuestoGuardado && presupuestoGuardado.estado === "ENVIADO" && (
              <Button onClick={handleAceptar} disabled={isPending} variant="secondary">
                <CheckCircle2 className="h-4 w-4 mr-2" /> Cliente Aceptó
              </Button>
            )}
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground">
            Valores según Ley Impositiva PBA 15.558, Tabla CESBA ENE 2026, RPI DTR 13/25.
            Presupuesto estimativo, sujeto a verificación de certificados y condiciones particulares.
          </p>
        </>
      )}
    </div>
  );
}
