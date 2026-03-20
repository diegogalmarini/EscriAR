"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActoFormState } from "@/lib/presupuesto/types";

interface ActoFormFieldsProps {
  acto: ActoFormState;
  onChange: (updates: Partial<ActoFormState>) => void;
}

export default function ActoFormFields({ acto, onChange }: ActoFormFieldsProps) {
  const updateNum = (field: keyof ActoFormState, raw: string) => {
    const val = parseFloat(raw) || 0;

    // Auto-convert USD ↔ ARS
    if (field === "montoEscrituraUsd") {
      onChange({
        montoEscrituraUsd: val,
        montoEscrituraArs: Math.round(val * acto.cotizacionUsd),
      });
      return;
    }
    if (field === "montoRealUsd") {
      onChange({
        montoRealUsd: val,
        montoRealArs: Math.round(val * acto.cotizacionUsd),
      });
      return;
    }
    if (field === "cotizacionUsd") {
      const updates: Partial<ActoFormState> = { cotizacionUsd: val };
      if (acto.montoEscrituraUsd > 0)
        updates.montoEscrituraArs = Math.round(acto.montoEscrituraUsd * val);
      if (acto.montoRealUsd > 0)
        updates.montoRealArs = Math.round(acto.montoRealUsd * val);
      onChange(updates);
      return;
    }

    onChange({ [field]: val });
  };

  return (
    <div className="space-y-3">
      {/* Line 1: Fecha, Cotización, Monto Escritura $, Monto Escritura USD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fecha Escritura</Label>
          <Input
            type="date"
            value={acto.fechaEscritura}
            onChange={e => onChange({ fechaEscritura: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cotización USD</Label>
          <Input
            type="number"
            value={acto.cotizacionUsd || ""}
            onChange={e => updateNum("cotizacionUsd", e.target.value)}
            className="h-8 text-sm"
            placeholder="1200"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Monto Escritura $</Label>
          <Input
            type="number"
            value={acto.montoEscrituraArs || ""}
            onChange={e => updateNum("montoEscrituraArs", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Monto Escritura USD</Label>
          <Input
            type="number"
            value={acto.montoEscrituraUsd || ""}
            onChange={e => updateNum("montoEscrituraUsd", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Line 2: Precio Real USD/ARS (base para honorarios) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Precio Real USD</Label>
          <Input
            type="number"
            value={acto.montoRealUsd || ""}
            onChange={e => updateNum("montoRealUsd", e.target.value)}
            className="h-8 text-sm"
            placeholder="Para honorarios"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Precio Real $</Label>
          <Input
            type="number"
            value={acto.montoRealArs || ""}
            onChange={e => updateNum("montoRealArs", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div /> <div />
      </div>

      {/* Line 3: Cantidades */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cant. Inmuebles</Label>
          <Input
            type="number"
            min={1}
            value={acto.cantidadInmuebles}
            onChange={e => onChange({ cantidadInmuebles: parseInt(e.target.value) || 1 })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cant. Certificados RPI</Label>
          <Input
            type="number"
            min={0}
            value={acto.cantidadCertificadosRpi}
            onChange={e => onChange({ cantidadCertificadosRpi: parseInt(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cant. Fojas</Label>
          <Input
            type="number"
            min={1}
            value={acto.cantidadFojas}
            onChange={e => onChange({ cantidadFojas: parseInt(e.target.value) || 1 })}
            className="h-8 text-sm"
          />
        </div>
        <div /> {/* empty col */}
      </div>
    </div>
  );
}
