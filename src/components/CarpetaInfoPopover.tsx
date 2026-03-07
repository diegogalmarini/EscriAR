"use client";

import { useState, useEffect } from "react";
import { Info, User, CalendarClock, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getAuditEventsForCarpeta, type AuditEventRow } from "@/app/actions/audit";

interface CarpetaInfoPopoverProps {
    carpetaId: string;
    createdAt: string;
}

function formatDateTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }) + " " + d.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
}

function formatRelative(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diffMs = now - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} días`;
    return formatDateTime(iso);
}

function emailToName(email: string | null): string {
    if (!email) return "Sistema";
    const local = email.split("@")[0];
    return local
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CarpetaInfoPopover({ carpetaId, createdAt }: CarpetaInfoPopoverProps) {
    const [events, setEvents] = useState<AuditEventRow[] | null>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open && events === null) {
            getAuditEventsForCarpeta(carpetaId, 15).then(setEvents).catch(() => setEvents([]));
        }
    }, [open, carpetaId, events]);

    const firstEvent = events?.find((e) => e.action === "FOLDER_CREATED") || events?.[events.length - 1];
    const lastEvent = events?.[0];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Información de la carpeta"
                >
                    <Info className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="p-4 space-y-4">
                    {/* Header */}
                    <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold">Información de la carpeta</h4>
                    </div>

                    {/* Creation */}
                    <div className="flex items-start gap-2.5 text-sm">
                        <CalendarClock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                            <p className="text-muted-foreground text-xs">Creada</p>
                            <p className="font-medium">{formatDateTime(createdAt)}</p>
                            {firstEvent && (
                                <p className="text-xs text-muted-foreground">
                                    por {emailToName(firstEvent.actor_email)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Last action */}
                    {lastEvent && lastEvent !== firstEvent && (
                        <div className="flex items-start gap-2.5 text-sm">
                            <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                                <p className="text-muted-foreground text-xs">Última acción</p>
                                <p className="font-medium">{lastEvent.summary}</p>
                                <p className="text-xs text-muted-foreground">
                                    {emailToName(lastEvent.actor_email)} · {formatRelative(lastEvent.created_at)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Activity log */}
                    <div className="border-t pt-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Actividad reciente
                            </p>
                        </div>

                        {events === null ? (
                            <p className="text-xs text-muted-foreground py-2">Cargando…</p>
                        ) : events.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Sin actividad registrada</p>
                        ) : (
                            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                {events.slice(0, 10).map((ev) => (
                                    <div key={ev.id} className="flex items-start gap-2 text-xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0 mt-1.5" />
                                        <div className="min-w-0">
                                            <span className="text-foreground">{ev.summary}</span>
                                            <span className="text-muted-foreground ml-1">
                                                · {formatRelative(ev.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
