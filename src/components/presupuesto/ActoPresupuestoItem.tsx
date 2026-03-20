"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { ActoFormState } from "@/lib/presupuesto/types";
import type { LineaConIVA } from "@/lib/presupuesto/types";
import ActoFormFields from "./ActoFormFields";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

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

interface ActoPresupuestoItemProps {
  index: number;
  acto: ActoFormState;
  engineLines?: LineaConIVA[];
  canDelete: boolean;
  onChange: (updates: Partial<ActoFormState>) => void;
  onDelete: () => void;
}

export default function ActoPresupuestoItem({
  index,
  acto,
  engineLines,
  canDelete,
  onChange,
  onDelete,
}: ActoPresupuestoItemProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="text-sm font-semibold text-foreground shrink-0">
          Acto {index + 1}
        </span>

        {/* Tipo de acto selector in header */}
        <div className="w-48" onClick={e => e.stopPropagation()}>
          <Select value={acto.tipoActo} onValueChange={v => onChange({ tipoActo: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS_ACTO.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Código CESBA — derived, read-only */}
        {acto.codigoCesba && (
          <Badge variant="outline" className="text-[10px] font-mono">
            {acto.codigoCesba}
          </Badge>
        )}

        <div className="flex-1" />

        {/* Quick summary when collapsed */}
        {!isOpen && acto.montoEscrituraArs > 0 && (
          <Badge variant="outline" className="text-[10px]">
            {fmt(acto.montoEscrituraArs)}
          </Badge>
        )}

        {/* Engine results badge */}
        {engineLines && engineLines.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {engineLines.length} items
          </Badge>
        )}

        {/* Delete button */}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-4 space-y-4">
          {/* 7-line form */}
          <ActoFormFields acto={acto} onChange={onChange} />

          {/* Engine-calculated items preview */}
          {engineLines && engineLines.length > 0 && (
            <div className="border-t pt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Items calculados por el motor:</p>
              {engineLines.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-2 py-1 rounded hover:bg-muted/30">
                  <span className="text-xs">{l.concepto}</span>
                  <span className="text-xs font-medium tabular-nums">{fmt(l.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
