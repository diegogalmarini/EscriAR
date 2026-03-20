"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { PresupuestoMultiActResult } from "@/lib/presupuesto/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

interface ResumenPresupuestoProps {
  result: PresupuestoMultiActResult;
}

export default function ResumenPresupuesto({ result }: ResumenPresupuestoProps) {
  const { ivaBreakdown } = result;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resumen con IVA</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Concepto</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* EXENTOS */}
            <TableRow className="bg-muted/20">
              <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                Exentos de IVA
              </TableCell>
            </TableRow>
            {ivaBreakdown.exentos.map((item, i) => (
              <TableRow key={`ex-${i}`}>
                <TableCell className="text-sm pl-6">{item.concepto}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{fmt(item.monto)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t">
              <TableCell className="text-sm font-medium text-right">Subtotal Exentos</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">
                {fmt(ivaBreakdown.subtotalExentos)}
              </TableCell>
            </TableRow>

            {/* Separator */}
            <TableRow><TableCell colSpan={2} className="py-1" /></TableRow>

            {/* GRAVADOS */}
            <TableRow className="bg-muted/20">
              <TableCell colSpan={2} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                Gravados con IVA (21%)
              </TableCell>
            </TableRow>
            {ivaBreakdown.gravados.map((item, i) => (
              <TableRow key={`gr-${i}`}>
                <TableCell className="text-sm pl-6">{item.concepto}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{fmt(item.monto)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t">
              <TableCell className="text-sm font-medium text-right">Subtotal Gravados</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">
                {fmt(ivaBreakdown.subtotalGravados)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="text-sm text-right text-muted-foreground">IVA 21%</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                {fmt(ivaBreakdown.ivaAmount)}
              </TableCell>
            </TableRow>

            {/* TOTAL */}
            <TableRow className="font-bold border-t-2">
              <TableCell className="text-right text-base">TOTAL CON IVA</TableCell>
              <TableCell className="text-right text-base tabular-nums">
                {fmt(ivaBreakdown.totalConIva)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
