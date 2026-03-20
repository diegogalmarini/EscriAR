"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, ChevronRight, ChevronsUpDown, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActoFormState } from "@/lib/presupuesto/types";
import type { LineaConIVA } from "@/lib/presupuesto/types";
import { CESBA_ACTOS, cesbaCodeToTipoActo } from "@/lib/presupuesto/cesbaActos";
import ActoFormFields from "./ActoFormFields";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// Group CESBA actos by their group label for the combobox
const GROUPED_ACTOS = (() => {
  const groups = new Map<string, typeof CESBA_ACTOS>();
  for (const acto of CESBA_ACTOS) {
    const list = groups.get(acto.group) ?? [];
    list.push(acto);
    groups.set(acto.group, list);
  }
  return groups;
})();

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
  const [comboOpen, setComboOpen] = useState(false);

  // Find current CESBA acto for display
  const currentCesba = useMemo(
    () => CESBA_ACTOS.find(a => a.code === acto.codigoCesba),
    [acto.codigoCesba]
  );

  const displayLabel = currentCesba
    ? `${currentCesba.code} — ${currentCesba.label}`
    : acto.tipoActo;

  const handleSelectActo = (cesbaCode: string) => {
    const cesba = CESBA_ACTOS.find(a => a.code === cesbaCode);
    if (!cesba) return;
    onChange({
      codigoCesba: cesbaCode,
      tipoActo: cesbaCodeToTipoActo(cesbaCode),
    });
    setComboOpen(false);
  };

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

        {/* CESBA act combobox */}
        <div onClick={e => e.stopPropagation()}>
          <Popover open={comboOpen} onOpenChange={setComboOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboOpen}
                className="h-7 w-[280px] justify-between text-xs font-normal"
              >
                <span className="truncate">{displayLabel}</span>
                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar acto por código o nombre..." className="text-xs" />
                <CommandList>
                  <CommandEmpty>No se encontró el acto.</CommandEmpty>
                  {Array.from(GROUPED_ACTOS.entries()).map(([group, actos]) => (
                    <CommandGroup key={group} heading={group}>
                      {actos.map(a => (
                        <CommandItem
                          key={a.code}
                          value={`${a.code} ${a.label}`}
                          onSelect={() => handleSelectActo(a.code)}
                          className="text-xs"
                        >
                          <Check
                            className={cn(
                              "mr-1 h-3 w-3",
                              acto.codigoCesba === a.code ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-muted-foreground mr-2 shrink-0">{a.code}</span>
                          <span className="truncate">{a.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

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
