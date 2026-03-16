"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabaseClient";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Activity, Edit3, Trash2, Plus, User, Info } from "lucide-react";

interface AuditLog {
    id: string;
    table_name: string;
    record_id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    changed_by: string | null;
    source: string | null;
    created_at: string;
}

interface TimelineAuditoriaProps {
    recordId: string;
    entityName?: string;
    triggerButton?: React.ReactNode;
}

export function TimelineAuditoria({ recordId, entityName = "Registro", triggerButton }: TimelineAuditoriaProps) {
    const [open, setOpen] = useState(false);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [userMap, setUserMap] = useState<Record<string, string>>({}); // Maps user ID to email/name

    useEffect(() => {
        if (open) {
            fetchLogs();
        }
    }, [open, recordId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('record_id', recordId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const fetchedLogs = data as AuditLog[];
            setLogs(fetchedLogs);

            // Fetch user emails for the 'changed_by' UUIDs
            // Normally this goes through an edge function or users table, 
            // but we'll try a public generic fetch if a profiles table exists, 
            // or simply fallback to the UUID for now given security restrictions on auth.users.
            // For now, we'll store the UUIDs.
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'INSERT': return <Plus size={16} className="text-emerald-500" />;
            case 'UPDATE': return <Edit3 size={16} className="text-amber-500" />;
            case 'DELETE': return <Trash2 size={16} className="text-red-500" />;
            default: return <Activity size={16} className="text-slate-500" />;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'INSERT': return "bg-emerald-50 border-emerald-200 text-emerald-700";
            case 'UPDATE': return "bg-amber-50 border-amber-200 text-amber-700";
            case 'DELETE': return "bg-red-50 border-red-200 text-red-700";
            default: return "bg-slate-50 border-slate-200 text-slate-700";
        }
    };

    const getActionLabel = (action: string) => {
        switch (action) {
            case 'INSERT': return "Creación";
            case 'UPDATE': return "Modificación";
            case 'DELETE': return "Eliminación";
            default: return action;
        }
    };

    // Helpet to render a clean diff
    const renderDiff = (oldData: any, newData: any) => {
        if (!oldData || !newData) return null;
        
        const changes: { key: string, old: any, new: any }[] = [];
        
        // Simple 1-level diff for visual representation
        Object.keys(newData).forEach(key => {
            // Ignore system/updated timestamps typically changing on every update
            if (key === 'updated_at' || key === 'created_at') return;
            
            // If values differ (basic comparison)
            if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
                changes.push({
                    key,
                    old: oldData[key],
                    new: newData[key]
                });
            }
        });

        if (changes.length === 0) return <div className="text-xs text-slate-500 italic mt-2">Sin cambios visibles en datos principales.</div>;

        return (
            <div className="mt-3 space-y-2 border rounded-md p-3 bg-slate-50/50">
                <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wider">Cambios Detectados</div>
                {changes.map((change, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 text-xs items-center">
                        <div className="font-medium text-slate-600 truncate" title={change.key}>
                            {change.key}
                        </div>
                        <div className="text-red-600/80 line-through truncate px-1 bg-red-50 rounded" title={String(change.old ?? 'Nulo')}>
                            {String(change.old ?? 'Nulo')}
                        </div>
                        <div className="text-emerald-600 truncate px-1 bg-emerald-50 rounded" title={String(change.new ?? 'Nulo')}>
                            {String(change.new ?? 'Nulo')}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-slate-900 bg-white">
                        <History size={16} />
                        <span className="hidden sm:inline">Historial</span>
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-0 overflow-hidden gap-0">
                <div className="p-6 pb-4 border-b bg-slate-50/50">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <History className="text-slate-500" size={24} />
                            Historial de Vida del Dato
                        </DialogTitle>
                        <DialogDescription>
                            Trazabilidad completa de {entityName}. Se muestra desde su origen hasta la última modificación.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-3">
                            <Info size={32} className="text-slate-300" />
                            <p>No hay registros de auditoría para este dato yet.</p>
                            <span className="text-xs text-slate-400">Los cambios futuros aparecerán aquí automáticamente.</span>
                        </div>
                    ) : (
                        <ScrollArea className="h-full px-6 py-6">
                            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                {logs.map((log, index) => (
                                    <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                        {/* Icon */}
                                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${log.action === 'INSERT' ? 'bg-emerald-100' : log.action === 'DELETE' ? 'bg-red-100' : 'bg-amber-100'}`}>
                                            {getActionIcon(log.action)}
                                        </div>
                                        
                                        {/* Card Content */}
                                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-wider", getActionColor(log.action))}>
                                                    {getActionLabel(log.action)}
                                                </Badge>
                                                <time className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                                                    {format(new Date(log.created_at), "d MMM, yyyy HH:mm", { locale: es })}
                                                </time>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-3 mb-2">
                                                <div className="p-1.5 bg-slate-100 rounded-md text-slate-500">
                                                    <User size={14} />
                                                </div>
                                                <div className="text-xs">
                                                    <p className="font-semibold text-slate-700">
                                                        {log.changed_by ? `Usuario (${log.changed_by.split('-')[0]}...)` : 'Sistema Automático'}
                                                    </p>
                                                    <p className="text-slate-500 font-mono text-[10px] mt-0.5 flex items-center gap-1">
                                                        <span className="uppercase font-bold tracking-wider text-slate-400">Origen:</span> 
                                                        {log.source || (log.action === 'INSERT' ? 'Manual' : 'Operación del sistema')}
                                                    </p>
                                                </div>
                                            </div>

                                            {log.action === 'UPDATE' && renderDiff(log.old_data, log.new_data)}
                                            
                                            {log.action === 'INSERT' && (
                                                <div className="mt-3 text-xs bg-slate-50 p-2 rounded text-slate-600 border border-slate-100 border-dashed">
                                                    Entidad registrada en la base de datos por primera vez.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// Utility for class merging locally if not imported
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}
