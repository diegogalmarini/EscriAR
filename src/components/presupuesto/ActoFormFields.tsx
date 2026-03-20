"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RotateCcw } from "lucide-react";
import type { ActoFormState } from "@/lib/presupuesto/types";
import { DEFAULTS, calcDiligenciamientos, calcEstudioTitulos } from "@/lib/presupuesto/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

interface ActoFormFieldsProps {
  acto: ActoFormState;
  onChange: (updates: Partial<ActoFormState>) => void;
}

export default function ActoFormFields({ acto, onChange }: ActoFormFieldsProps) {
  const update = (field: keyof ActoFormState, value: any) => {
    const overrides = new Set(acto.overrides);
    overrides.add(field as string);
    onChange({ [field]: value, overrides });
  };

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

    update(field, val);
  };

  const resetField = (field: keyof ActoFormState, defaultValue: number) => {
    const overrides = new Set(acto.overrides);
    overrides.delete(field as string);
    onChange({ [field]: defaultValue, overrides });
  };

  const ResetBtn = ({ field, defaultValue }: { field: keyof ActoFormState; defaultValue: number }) => {
    if (!acto.overrides.has(field as string)) return null;
    return (
      <button
        type="button"
        onClick={() => resetField(field, defaultValue)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        title={`Reset a ${fmt(defaultValue)}`}
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    );
  };

  const defaultCertAdmin = DEFAULTS.certAdministrativosPorInmueble * acto.cantidadInmuebles;
  const defaultConfeccion = DEFAULTS.confeccionMatriculaPorInmueble * acto.cantidadInmuebles;
  const defaultDilig = calcDiligenciamientos(acto.montoEscrituraArs);
  const defaultEstudio = calcEstudioTitulos(acto.montoEscrituraArs);

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

      {/* Line 2: Valuación Fiscal, Val Fiscal al Acto, Monto Real $, Monto Real USD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Valuación Fiscal</Label>
          <Input
            type="number"
            value={acto.valuacionFiscal || ""}
            onChange={e => updateNum("valuacionFiscal", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Val. Fiscal al Acto</Label>
          <Input
            type="number"
            value={acto.valuacionFiscalAlActo || ""}
            onChange={e => updateNum("valuacionFiscalAlActo", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Monto Real $</Label>
          <Input
            type="number"
            value={acto.montoRealArs || ""}
            onChange={e => updateNum("montoRealArs", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Monto Real USD</Label>
          <Input
            type="number"
            value={acto.montoRealUsd || ""}
            onChange={e => updateNum("montoRealUsd", e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Line 3: Cant Inmuebles, Cant Transmitentes, Certificados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cant. Inmuebles</Label>
          <Input
            type="number"
            min={1}
            value={acto.cantidadInmuebles}
            onChange={e => update("cantidadInmuebles", parseInt(e.target.value) || 1)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cant. Transmitentes</Label>
          <Input
            type="number"
            min={1}
            value={acto.cantidadTransmitentes}
            onChange={e => update("cantidadTransmitentes", parseInt(e.target.value) || 2)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Certificados</Label>
          <Select value={acto.certificados} onValueChange={v => onChange({ certificados: v as any })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="en_el_dia">En el día</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div /> {/* empty col */}
      </div>

      {/* Line 4: Cert Administrativos, Sellados Esc Matriz */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Cert. Administrativos</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.certAdministrativos || ""}
              onChange={e => updateNum("certAdministrativos", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="certAdministrativos" defaultValue={defaultCertAdmin} />
          </div>
          <p className="text-[10px] text-muted-foreground">${fmt(DEFAULTS.certAdministrativosPorInmueble)} × {acto.cantidadInmuebles} inm.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Sellados Esc. Matriz + Test.</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.selladosEscMatriz || ""}
              onChange={e => updateNum("selladosEscMatriz", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="selladosEscMatriz" defaultValue={DEFAULTS.selladosEscMatriz} />
          </div>
          <p className="text-[10px] text-muted-foreground">$6.237 + $4.725</p>
        </div>
        <div /> <div />
      </div>

      {/* Line 5: Confección Matrícula, Diligenciamientos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Confección Matrícula</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.confeccionMatricula || ""}
              onChange={e => updateNum("confeccionMatricula", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="confeccionMatricula" defaultValue={defaultConfeccion} />
          </div>
          <p className="text-[10px] text-muted-foreground">${fmt(DEFAULTS.confeccionMatriculaPorInmueble)} × {acto.cantidadInmuebles} inm.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Diligenciamientos</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.diligenciamientos || ""}
              onChange={e => updateNum("diligenciamientos", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="diligenciamientos" defaultValue={defaultDilig} />
          </div>
          <p className="text-[10px] text-muted-foreground">Fórmula (max $1.234.926)</p>
        </div>
        <div /> <div />
      </div>

      {/* Line 6: Procuración */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Procuración</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.procuracion || ""}
              onChange={e => updateNum("procuracion", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="procuracion" defaultValue={DEFAULTS.procuracion} />
          </div>
        </div>
        <div /> <div /> <div />
      </div>

      {/* Line 7: Estudio de Títulos, Agente de Retención */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estudio de Títulos</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.estudioTitulos || ""}
              onChange={e => updateNum("estudioTitulos", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="estudioTitulos" defaultValue={defaultEstudio} />
          </div>
          <p className="text-[10px] text-muted-foreground">Fórmula (sin máximo)</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Agente de Retención</Label>
          <div className="relative">
            <Input
              type="number"
              value={acto.agenteRetencion || ""}
              onChange={e => updateNum("agenteRetencion", e.target.value)}
              className="h-8 text-sm pr-7"
            />
            <ResetBtn field="agenteRetencion" defaultValue={DEFAULTS.agenteRetencion} />
          </div>
        </div>
        <div /> <div />
      </div>

      {/* Engine config row */}
      <div className="border-t pt-3 mt-2">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo Inmueble</Label>
            <Select value={acto.tipoInmueble} onValueChange={v => onChange({ tipoInmueble: v as any })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EDIFICADO">Edificado</SelectItem>
                <SelectItem value="BALDIO">Baldío</SelectItem>
                <SelectItem value="RURAL">Rural</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Honorarios</Label>
            <Select
              value={acto.honorariosFijo !== null ? "custom" : acto.honorariosPct.toString()}
              onValueChange={v => {
                if (v === "custom") {
                  onChange({ honorariosFijo: 0, honorariosPct: 0.02 });
                } else {
                  onChange({ honorariosFijo: null, honorariosPct: parseFloat(v) });
                }
              }}
            >
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.01">1%</SelectItem>
                <SelectItem value="0.015">1.5%</SelectItem>
                <SelectItem value="0.02">2% (Colegio)</SelectItem>
                <SelectItem value="custom">Monto fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {acto.honorariosFijo !== null && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Honorarios fijo $</Label>
              <Input
                type="number"
                value={acto.honorariosFijo || ""}
                onChange={e => onChange({ honorariosFijo: parseFloat(e.target.value) || 0 })}
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
