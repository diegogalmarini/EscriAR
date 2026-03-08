"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, ExternalLink, RefreshCw, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getPresupuesto } from "@/app/actions/presupuestos";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const ESTADO_BADGE: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: "Borrador", className: "bg-slate-100 text-slate-700" },
  ENVIADO: { label: "Enviado", className: "bg-blue-100 text-blue-700" },
  ACEPTADO: { label: "Aceptado", className: "bg-green-100 text-green-700" },
  VENCIDO: { label: "Vencido", className: "bg-red-100 text-red-700" },
};

interface LiquidacionResumenProps {
  carpetaId: string;
  onNavigateToPresupuesto: () => void;
}

export function LiquidacionResumen({ carpetaId, onNavigateToPresupuesto }: LiquidacionResumenProps) {
  const [presupuesto, setPresupuesto] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchPresupuesto = () => {
    startTransition(async () => {
      setLoading(true);
      const res = await getPresupuesto(carpetaId);
      setPresupuesto(res.success ? res.data : null);
      setLoading(false);
    });
  };

  useEffect(() => { fetchPresupuesto(); }, [carpetaId]);

  // ── Sin presupuesto: CTA vacío ──
  if (!loading && !presupuesto) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Liquidación y Honorarios
        </h3>
        <div className="border-2 border-dashed border-border rounded-lg py-8 px-4 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No hay presupuesto calculado para esta carpeta.
          </p>
          <Button variant="outline" size="sm" onClick={onNavigateToPresupuesto}>
            <Calculator className="h-4 w-4 mr-2" />
            Calcular Presupuesto
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Liquidación y Honorarios
        </h3>
        <div className="border border-border rounded-lg py-8 text-center text-sm text-muted-foreground animate-pulse">
          Cargando presupuesto...
        </div>
      </div>
    );
  }

  // ── Con presupuesto: resumen compacto ──
  const lineas = presupuesto.presupuesto_lineas?.sort((a: any, b: any) => a.orden - b.orden) ?? [];
  const estadoBadge = ESTADO_BADGE[presupuesto.estado] ?? ESTADO_BADGE.BORRADOR;

  // Agrupar por categoría para resumen rápido
  const porCategoria: Record<string, number> = {};
  for (const l of lineas) {
    porCategoria[l.categoria] = (porCategoria[l.categoria] || 0) + l.monto;
  }

  const CATEGORIA_LABELS: Record<string, string> = {
    IMPUESTO: "Impuestos",
    TASA: "Tasas",
    HONORARIO: "Honorarios",
    APORTE: "Aportes",
    CERTIFICADO: "Certificados",
    GASTO_ADMIN: "Gastos Admin",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Calculator className="h-4 w-4" /> Liquidación y Honorarios
        </h3>
        <div className="flex items-center gap-2">
          <Badge className={estadoBadge.className + " text-[10px]"}>
            {estadoBadge.label} v{presupuesto.version}
          </Badge>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPresupuesto} disabled={isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {presupuesto.alertas?.length > 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700">{presupuesto.alertas[0]}</p>
        </div>
      )}

      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-[11px] uppercase tracking-wider">Rubro</TableHead>
                <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(porCategoria).map(([cat, monto]) => (
                <TableRow key={cat}>
                  <TableCell className="text-sm">{CATEGORIA_LABELS[cat] ?? cat}</TableCell>
                  <TableCell className="text-right font-medium text-sm">{fmt(monto)}</TableCell>
                </TableRow>
              ))}

              <TableRow className="bg-blue-50/50 border-t-2 border-blue-200">
                <TableCell className="font-bold text-blue-900">TOTAL</TableCell>
                <TableCell className="text-right font-bold text-blue-900 text-base">
                  {fmt(presupuesto.total_ars)}
                </TableCell>
              </TableRow>

              {presupuesto.total_usd && (
                <TableRow className="bg-blue-100/30">
                  <TableCell className="text-xs text-blue-800 font-medium italic">Equiv. USD</TableCell>
                  <TableCell className="text-right text-xs text-blue-800 font-bold italic">
                    {new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(presupuesto.total_usd)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onNavigateToPresupuesto}>
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Ver Desglose Completo
        </Button>
        {presupuesto.estado === "ACEPTADO" && (
          <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Cliente Aceptó
          </Badge>
        )}
      </div>
    </div>
  );
}
