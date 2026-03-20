"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PresupuestoMultiActResult } from "@/lib/presupuesto/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

interface DiscriminacionPartesProps {
  discriminacion: PresupuestoMultiActResult["discriminacion"];
}

export default function DiscriminacionPartes({ discriminacion }: DiscriminacionPartesProps) {
  const { vendedor, comprador } = discriminacion;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Discriminación por Parte</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* VENDEDOR */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-orange-700 uppercase tracking-wider">Vendedor</h4>
            <p className="text-[10px] text-muted-foreground">50% Sellos + 50% Aportes</p>
            <div className="space-y-1">
              {vendedor.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-xs text-muted-foreground">{item.concepto}</span>
                  <span className="text-xs tabular-nums">{fmt(item.monto)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span className="text-sm">Total Vendedor</span>
              <span className="text-sm tabular-nums">{fmt(vendedor.total)}</span>
            </div>
          </div>

          {/* COMPRADOR */}
          <div className="border rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wider">Comprador</h4>
            <p className="text-[10px] text-muted-foreground">Todo lo demás (honorarios, certificados, gastos, etc.)</p>
            <div className="space-y-1">
              {comprador.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-xs text-muted-foreground">{item.concepto}</span>
                  <span className="text-xs tabular-nums">{fmt(item.monto)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span className="text-sm">Total Comprador</span>
              <span className="text-sm tabular-nums">{fmt(comprador.total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
