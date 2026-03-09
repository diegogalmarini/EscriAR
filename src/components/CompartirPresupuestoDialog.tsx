"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Mail, Copy, Check, Phone, User, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PresupuestoResult, Pagador } from "@/lib/services/PresupuestoEngine";

/** Title-case a "GARCIA LOPEZ, JUAN MARTIN" → "García López, Juan Martín" style name */
function formatPersonName(raw: string): string {
  return raw
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── Types ────────────────────────────────────────────────

interface Participante {
  nombre_completo: string;
  contacto?: { telefono?: string; email?: string };
  rol: string;
}

interface CompartirPresupuestoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultado: PresupuestoResult;
  participantes: Participante[];
  escribania?: string;
}

// ─── Helpers ──────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const PAGADOR_MAP: Record<string, string> = {
  COMPRADOR: "Comprador",
  VENDEDOR: "Vendedor",
  DEUDOR: "Deudor",
  ACREEDOR: "Acreedor",
  NOTARIO: "Escribanía",
  COMUN: "Ambas partes",
  ESCRIBANIA: "Escribanía",
};

function buildResumenTexto(r: PresupuestoResult, escribania?: string): string {
  const lines: string[] = [];

  if (escribania) lines.push(`*${escribania}*`);
  lines.push(`*PRESUPUESTO DE GASTOS — ${r.metadata.descripcion_acto}*`);
  lines.push("");

  // Resumen por pagador
  const pagadorEntries = Object.entries(r.totales.por_pagador).filter(([, v]) => v && v > 0);
  if (pagadorEntries.length > 0) {
    lines.push("📋 *Resumen por parte:*");
    for (const [p, v] of pagadorEntries) {
      lines.push(`  • ${PAGADOR_MAP[p] || p}: ${fmt(v!)}`);
    }
    lines.push("");
  }

  lines.push(`💰 *Total estimado: ${fmt(r.totales.total)}*`);

  if (r.metadata.moneda_operacion === "USD" && r.metadata.cotizacion_usd) {
    const usd = Math.round(r.totales.total / r.metadata.cotizacion_usd);
    lines.push(`   (≈ USD ${usd.toLocaleString("es-AR")} — TC BNA: ${r.metadata.cotizacion_usd})`);
  }

  lines.push("");
  lines.push("_Presupuesto orientativo sujeto a verificación. Fuentes: Ley Impositiva PBA 2026, DTR 13/25 (RPI), CESBA._");

  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────

export function CompartirPresupuestoDialog({
  open,
  onOpenChange,
  resultado,
  participantes,
  escribania,
}: CompartirPresupuestoDialogProps) {
  const [copied, setCopied] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const resumenTexto = buildResumenTexto(resultado, escribania);

  const contactos = participantes.filter(
    (p) => p.contacto?.telefono || p.contacto?.email
  );

  const shareWhatsApp = (persona?: Participante) => {
    const phoneNumber = persona?.contacto?.telefono?.replace(/[^0-9]/g, "") || "";
    const nombre = persona ? formatPersonName(persona.nombre_completo) : "";
    const greeting = nombre ? `Hola ${nombre}, ` : "";
    const text = `${greeting}le enviamos el presupuesto estimado de gastos escriturarios:\n\n${resumenTexto}`;

    const url = phoneNumber
      ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const shareEmail = (persona?: Participante) => {
    const email = persona?.contacto?.email || "";
    const subject = `Presupuesto de Gastos — ${resultado.metadata.descripcion_acto}`;
    // Email usa texto plano sin markdown
    const plainText = resumenTexto.replace(/\*/g, "").replace(/_/g, "");
    const body = `Estimado/a,\n\nLe enviamos el presupuesto estimado de gastos escriturarios:\n\n${plainText}\n\nQuedamos a disposición.\nSaludos cordiales.`;
    window.open(
      `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank"
    );
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resumenTexto.replace(/\*/g, "").replace(/_/g, ""));
    setCopied(true);
    toast.success("Presupuesto copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-slate-200 shadow-xl rounded-2xl bg-white">
        {/* Header */}
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                <Share2 size={20} />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Compartir Presupuesto
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 text-sm">
              Envía el resumen del presupuesto al cliente por WhatsApp o email.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          {/* Preview */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 max-h-48 overflow-y-auto">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
              {resumenTexto.replace(/\*/g, "").replace(/_/g, "")}
            </pre>
          </div>

          {/* Contactos disponibles */}
          {contactos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Destinatarios
              </p>
              <div className="space-y-2">
                {contactos.map((p, i) => {
                  const hasPhone = Boolean(p.contacto?.telefono);
                  const hasEmail = Boolean(p.contacto?.email);
                  const isSelected = selectedIdx === i;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedIdx(isSelected ? null : i)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        isSelected
                          ? "border-blue-300 bg-blue-50/50 shadow-sm"
                          : "border-slate-100 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="p-2 bg-white rounded-full border border-slate-200">
                        <User size={16} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {formatPersonName(p.nombre_completo)}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">{p.rol}</p>
                      </div>
                      <div className="flex gap-3 text-xs">
                        {hasPhone && (
                          <span className="flex items-center gap-1 text-green-600">
                            <Phone size={12} /> {p.contacto!.telefono}
                          </span>
                        )}
                        {hasEmail && (
                          <span className="flex items-center gap-1 text-blue-600 truncate max-w-[150px]">
                            <Mail size={12} /> {p.contacto!.email}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center gap-1 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl"
              onClick={() => shareWhatsApp(selectedIdx !== null ? contactos[selectedIdx] : undefined)}
            >
              <MessageCircle size={20} />
              <span className="text-[10px] font-semibold">WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center gap-1 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl"
              onClick={() => shareEmail(selectedIdx !== null ? contactos[selectedIdx] : undefined)}
            >
              <Mail size={20} />
              <span className="text-[10px] font-semibold">Email</span>
            </Button>
            <Button
              variant="outline"
              className={cn(
                "h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                copied
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              )}
              onClick={copyToClipboard}
            >
              {copied ? <Check size={20} /> : <Copy size={20} />}
              <span className="text-[10px] font-semibold">{copied ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>

          {contactos.length === 0 && (
            <p className="text-xs text-center text-amber-600 bg-amber-50 p-3 rounded-lg">
              No hay contactos con teléfono o email en esta carpeta. Podés copiar el texto y compartirlo manualmente.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
