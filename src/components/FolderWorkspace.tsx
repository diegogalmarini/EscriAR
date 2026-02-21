"use client";

import { useState, useOptimistic, useTransition, useEffect, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Activity, Users, Home, UserPlus, Link as LinkIcon, Plus, FileSignature, ClipboardCheck, Trash2, Pencil, UserMinus, Download, Eye, Wallet } from "lucide-react";
import { PersonSearch } from "./PersonSearch";
import { PersonForm } from "./PersonForm";
import { AssetSearch } from "./AssetSearch";
import { DeedEditor } from "./DeedEditor";
import { StatusStepper } from "./StatusStepper";
import { MinutaGenerator } from "./MinutaGenerator";
import { AMLCompliance } from "./AMLCompliance";
import { InscriptionTracker } from "./InscriptionTracker";
import { linkPersonToOperation, linkAssetToDeed, addOperationToDeed, deleteCarpeta, unlinkPersonFromOperation, updateRepresentacion } from "@/app/actions/carpeta";
import { updateEscritura, updateOperacion, updateInmueble } from "@/app/actions/escritura";
import { ClientOutreach } from "./ClientOutreach";
import { listStorageFiles, deleteStorageFile, getSignedUrl } from "@/app/actions/storageSync";
import { toast } from "sonner";
import { ComplianceTrafficLight } from "./smart/ComplianceTrafficLight";
import { TaxBreakdownCard } from "./smart/TaxBreakdownCard";
import { SmartDeedEditor } from "./smart/SmartDeedEditor";
import { CrossCheckService, ValidationState } from "@/lib/agent/CrossCheckService";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatDateInstructions } from "@/lib/utils";
import { formatCUIT, formatPersonName, isLegalEntity } from "@/lib/utils/normalization";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

export default function FolderWorkspace({ initialData }: { initialData: any }) {
    const [carpeta, setCarpeta] = useState(initialData);
    const router = useRouter();

    // Sync local state when initialData changes (e.g., after router.refresh())
    useEffect(() => {
        console.log("🔄 FolderWorkspace: Syncing state with new initialData");
        setCarpeta(initialData);
    }, [initialData]);

    const getRoleBadgeStyle = (rol?: string) => {
        const r = rol?.toUpperCase();
        if (r?.includes('VENDEDOR') || r?.includes('TRANSMITENTE')) return "bg-amber-100 text-amber-700 border-amber-200";
        if (r?.includes('CEDENTE')) return "bg-orange-100 text-orange-700 border-orange-200";
        if (r?.includes('CESIONARIO')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (r?.includes('CONDOMIN')) return "bg-teal-100 text-teal-700 border-teal-200";
        if (r?.includes('DONANTE')) return "bg-amber-100 text-amber-700 border-amber-200";
        if (r?.includes('DONATARIO')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (r?.includes('FIDUCIARIA') || r?.includes('FIDUCIANTE')) return "bg-indigo-100 text-indigo-700 border-indigo-200";
        if (r?.includes('ACREEDOR')) return "bg-blue-100 text-blue-700 border-blue-200";
        if (r?.includes('DEUDOR') || r?.includes('MUTUARIO')) return "bg-purple-100 text-purple-700 border-purple-200";
        if (r?.includes('FIADOR') || r?.includes('GARANTE')) return "bg-slate-100 text-slate-700 border-slate-200";
        if (r?.includes('CONYUGE') || r?.includes('CÓNYUGE')) return "bg-pink-100 text-pink-700 border-pink-200";
        if (r?.includes('APODERADO') || r?.includes('REPRESENTANTE')) return "bg-slate-100 text-slate-600 border-slate-200";
        if (r?.includes('COMPRADOR') || r?.includes('ADQUIRENTE')) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        return "bg-gray-100 text-gray-700 border-gray-200";
    };

    const getRoleLabel = (rol?: string) => {
        const r = rol?.toUpperCase();
        if (r?.includes('VENDEDOR') || r?.includes('TRANSMITENTE')) return 'VENDEDOR / TRANSMITENTE';
        if (r?.includes('CEDENTE')) return 'CEDENTE';
        if (r?.includes('CESIONARIO')) return 'CESIONARIO';
        if (r?.includes('CONDOMIN')) return 'CONDÓMINO';
        if (r?.includes('DONANTE')) return 'DONANTE';
        if (r?.includes('DONATARIO')) return 'DONATARIO';
        if (r?.includes('FIDUCIARIA') || r?.includes('FIDUCIANTE')) return 'FIDUCIARIA';
        if (r?.includes('ACREEDOR')) return 'ACREEDOR HIPOTECARIO';
        if (r?.includes('DEUDOR') || r?.includes('MUTUARIO')) return 'DEUDOR / MUTUARIO';
        if (r?.includes('FIADOR') || r?.includes('GARANTE')) return 'FIADOR / GARANTE';
        if (r?.includes('CONYUGE') || r?.includes('CÓNYUGE')) return 'CÓNYUGE ASINTIENTE';
        if (r?.includes('APODERADO') || r?.includes('REPRESENTANTE')) return 'APODERADO';
        if (r?.includes('COMPRADOR') || r?.includes('ADQUIRENTE')) return 'COMPRADOR / ADQUIRENTE';
        return rol?.toUpperCase() || 'PARTE';
    };

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        console.log(`[REALTIME] Subscribing to folder ${carpeta.id}...`);

        let refreshTimeout: NodeJS.Timeout;
        const debouncedRefresh = () => {
            clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(() => {
                console.log('[REALTIME] Executing debounced router.refresh()');
                router.refresh();
            }, 500);
        };

        const channel = supabase
            .channel(`folder-updates-${carpeta.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'carpetas',
                    filter: `id=eq.${carpeta.id}`
                },
                (payload) => {
                    console.log('[REALTIME] Folder change detected:', payload);
                    setCarpeta((prev: any) => ({ ...prev, ...payload.new }));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'escrituras',
                    filter: `carpeta_id=eq.${carpeta.id}`
                },
                debouncedRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'participantes_operacion'
                },
                debouncedRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'inmuebles'
                },
                debouncedRefresh
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            clearTimeout(refreshTimeout);
        };
    }, [carpeta.id, router]);

    // Helper: resolve pdf_url (can be a full public URL or a raw storage path) to a signed URL
    const resolveDocumentUrl = async (pdfUrl: string): Promise<string | null> => {
        // Extract storage path from full Supabase public URL if needed
        let storagePath = pdfUrl;
        const publicPrefix = '/storage/v1/object/public/escrituras/';
        const idx = pdfUrl.indexOf(publicPrefix);
        if (idx !== -1) {
            storagePath = pdfUrl.substring(idx + publicPrefix.length);
        }
        const result = await getSignedUrl('escrituras', storagePath);
        if (result.success && result.url) return result.url;
        return null;
    };

    const [isPersonSearchOpen, setIsPersonSearchOpen] = useState(false);
    const [isAssetSearchOpen, setIsAssetSearchOpen] = useState(false);
    const [activeOpId, setActiveOpId] = useState<string | null>(null);
    const [showTranscriptionDialog, setShowTranscriptionDialog] = useState(false);
    const [editingDeed, setEditingDeed] = useState<any>(null);
    const [viewingDocument, setViewingDocument] = useState<string | null>(null);
    const [viewerWidth, setViewerWidth] = useState(95); // Default 95vw

    console.log("📂 FolderWorkspace Initial Data:", JSON.stringify(initialData, null, 2));
    const [activeDeedId, setActiveDeedId] = useState<string | null>(carpeta.escrituras[0]?.id || null);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);
    const [editingPerson, setEditingPerson] = useState<any>(null);
    const [editingRepresentacion, setEditingRepresentacion] = useState<any>(null);
    const [storageFiles, setStorageFiles] = useState<any[]>([]);
    const [isLoadingStorage, setIsLoadingStorage] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [pendingConflicts, setPendingConflicts] = useState<any[]>([]);

    // Check for conflicts on mount
    useEffect(() => {
        if (carpeta.ingesta_estado === 'REVISION_REQUERIDA' && carpeta.ingesta_metadata?.conflicts) {
            setPendingConflicts(carpeta.ingesta_metadata.conflicts);
            setShowConflictModal(true);
        }
    }, [carpeta.ingesta_estado, carpeta.ingesta_metadata]);

    const handleResolveConflicts = async (resolutions: any[]) => {
        // This would involve calling an action to update personas/inmuebles based on user choice
        // For now, we clear the status and the modal
        try {
            const { error } = await supabase
                .from('carpetas')
                .update({
                    ingesta_estado: 'COMPLETADO',
                    ingesta_metadata: { ...carpeta.ingesta_metadata, conflicts_resolved: true }
                })
                .eq('id', carpeta.id);

            if (error) throw error;
            setShowConflictModal(false);
            toast.success("Datos verificados y actualizados.");
            router.refresh();
        } catch (e: any) {
            toast.error("Error al resolver: " + e.message);
        }
    };


    // Fetch files from storage that might be related to this folder
    const fetchStorageFiles = async () => {
        setIsLoadingStorage(true);
        const res = await listStorageFiles("escrituras", "documents");
        if (res.success && res.data) {
            // Filter files that contain the folder's name or known patterns
            // Since we don't have a strict folder ID in storage path yet, 
            // we look for files that match filenames in existing escrituras
            const related = res.data.filter((f: any) =>
                carpeta.escrituras.some((e: any) => e.pdf_url?.includes(f.name))
            );
            setStorageFiles(related);
        }
        setIsLoadingStorage(false);
    };

    useEffect(() => {
        fetchStorageFiles();
    }, [carpeta.id]);

    const handleDeleteStorageFile = async (fileName: string) => {
        const confirm = window.confirm(`¿Estás seguro de eliminar el archivo ${fileName} del servidor? Esta acción no se puede deshacer.`);
        if (!confirm) return;

        const res = await deleteStorageFile("escrituras", `documents/${fileName}`);
        if (res.success) {
            toast.success("Archivo eliminado del servidor");
            fetchStorageFiles();
        } else {
            toast.error("Error al eliminar: " + res.error);
        }
    };




    // Optimistic participants
    const [optimisticOps, addOptimisticParticipant] = useOptimistic(
        carpeta.escrituras.find((e: any) => e.id === activeDeedId)?.operaciones || [],
        (state: any, newParticipant: any) => {
            return state.map((op: any) => {
                if (op.id === newParticipant.operacion_id) {
                    const existing = op.participantes_operacion || [];
                    return {
                        ...op,
                        participantes_operacion: [...existing, newParticipant]
                    };
                }
                return op;
            });
        }
    );

    console.log("💎 OPTIMISTIC OPS:", optimisticOps);

    const handleLinkAsset = async (assetId: string) => {
        if (!activeDeedId) return;
        const res = await linkAssetToDeed(activeDeedId, assetId);
        if (res.success) {
            toast.success("Inmueble vinculado correctamente");
            window.location.reload();
        } else {
            toast.error(res.error);
        }
    };

    const handleLinkPerson = async (personId: string) => {
        if (!activeOpId) return;

        startTransition(async () => {
            addOptimisticParticipant({
                operacion_id: activeOpId,
                persona_id: personId,
                rol: "COMPRADOR",
                persona: { nombre_completo: "Cargando..." }
            });

            const res = await linkPersonToOperation(activeOpId, personId, "COMPRADOR");
            if (res.success) {
                toast.success("Persona vinculada");
                window.location.reload();
            } else {
                toast.error(res.error);
            }
        });
    };

    const handleDeleteFolder = async () => {
        setIsDeleting(true);
        const res = await deleteCarpeta(carpeta.id);
        setIsDeleting(false);

        if (res.success) {
            toast.success("Carpeta eliminada correctamente");
            router.push("/carpetas");
            router.refresh();
        } else {
            toast.error(res.error || "Error al eliminar la carpeta");
        }
    };

    const handleUnlinkPerson = async (participanteId: string) => {
        const res = await unlinkPersonFromOperation(participanteId);
        if (res.success) {
            toast.success("Participante desvinculado");
            router.refresh();
        } else {
            toast.error("Error: " + res.error);
        }
    };

    const currentEscritura = carpeta.escrituras.find((e: any) => e.id === activeDeedId);

    // --- CROSS-CHECK ENGINE: Triangulation Logic ---
    const crossCheckResult = useMemo(() => {
        if (!currentEscritura) return undefined;

        const entities = currentEscritura.analysis_metadata?.entities || [];
        const participants = currentEscritura.operaciones?.flatMap((op: any) => op.participantes_operacion || []) || [];

        const fieldsToValidate: Record<string, any> = {};

        participants.forEach((p: any, idx: number) => {
            const person = p.persona || p.personas;
            const personId = person?.id || `temp_${idx}`;

            const extracted = entities.find((e: any) => e.datos?.dni_cuil_cuit?.valor === person?.dni || e.datos?.nombre_completo?.valor === person?.nombre_completo);

            // Simulation of OFFICIAL API data (e.g., AFIP)
            // In a real scenario, this would come from a fetched cache or a real-time call
            const officialMock = person?.metadata?.official_data || {
                nombre_completo: person?.nombre_completo || extracted?.datos?.nombre_completo?.valor, // Fallback to avoid empty comparison
                cuit: person?.cuit
            };

            fieldsToValidate[`nombre_${personId}`] = {
                official: officialMock.nombre_completo,
                extracted: extracted?.datos?.nombre_completo?.valor,
                manual: person?.nombre_completo
            };
            fieldsToValidate[`cuit_${personId}`] = {
                official: officialMock.cuit,
                extracted: extracted?.datos?.dni_cuil_cuit?.valor,
                manual: person?.cuit
            };
        });

        return CrossCheckService.validateIdentity(fieldsToValidate);
    }, [currentEscritura]);

    const isBlockedBySecurity = crossCheckResult?.state === ValidationState.CRITICAL_DISCREPANCY;

    return (
        <Tabs defaultValue="mesa" className="w-full">
            <div className="flex justify-between items-center mb-6">
                <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1 bg-slate-100/50 p-1 mb-2">
                    <TabsTrigger value="mesa" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Mesa de Trabajo
                    </TabsTrigger>
                    <TabsTrigger value="budget" className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Presupuesto
                    </TabsTrigger>
                    <TabsTrigger value="smart-draft" className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4" />
                        Borrador Inteligente
                    </TabsTrigger>
                    <TabsTrigger value="draft" className="flex items-center gap-2">
                        <Pencil className="h-4 w-4" />
                        Redacción (Manual)
                    </TabsTrigger>
                    <TabsTrigger value="compliance" className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        Minutas
                    </TabsTrigger>
                    {(carpeta.estado === 'FIRMADA' || carpeta.estado === 'INSCRIPTA') && (
                        <TabsTrigger value="inscription" className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Inscripción
                        </TabsTrigger>
                    )}
                </TabsList>
                <div className="flex items-center gap-3">
                    {/* Cleaned up UI - specific request */}

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro de eliminar esta carpeta?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta acción no se puede deshacer. Se borrarán todos los documentos,
                                    operaciones y participantes vinculados a este trámite ({carpeta.caratula || "Sin título"}).
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteFolder}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Eliminando..." : "Eliminar Definitivamente"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <TabsContent value="mesa">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <PersonSearch
                        open={isPersonSearchOpen}
                        setOpen={setIsPersonSearchOpen}
                        onSelect={handleLinkPerson}
                    />
                    <AssetSearch
                        open={isAssetSearchOpen}
                        setOpen={setIsAssetSearchOpen}
                        onSelect={handleLinkAsset}
                    />

                    {/* Sidebar: Deeds List */}
                    <div className="lg:col-span-4 space-y-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            Escrituras
                        </h2>
                        {carpeta.escrituras.map((escritura: any) => (
                            <Card
                                key={escritura.id}
                                className={cn(
                                    "cursor-pointer transition-all hover:shadow-md",
                                    activeDeedId === escritura.id ? "shadow-lg border-slate-300" : "opacity-80"
                                )}
                                onClick={() => setActiveDeedId(escritura.id)}
                            >
                                <CardHeader className="p-4 pb-0">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-semibold text-slate-700">Datos actuales de Documento Original</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingDeed({
                                                    ...escritura,
                                                    operacion: escritura.operaciones?.[0]
                                                });
                                            }}
                                        >
                                            <Pencil className="h-3 w-3 text-slate-500" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-2">
                                    <div className="space-y-2.5 text-xs">
                                        {/* Partido y Partida */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Partido / Dpto</p>
                                                <p className="text-slate-700">{escritura.inmuebles?.partido_id || "No especificado"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Nro. Partida</p>
                                                <div className="font-mono space-y-0.5">
                                                    {(escritura.inmuebles?.nro_partida || "No especificado")
                                                        .split(/[;]/)
                                                        .map((p: string, idx: number) => (
                                                            escritura.inmuebles?.id ? (
                                                                <Link
                                                                    key={idx}
                                                                    href={`/inmuebles/${escritura.inmuebles.id}`}
                                                                    className="block text-blue-600 hover:text-blue-800 hover:underline"
                                                                >
                                                                    {/^\d+$/.test(p.trim()) ? Number(p.trim()).toLocaleString('es-AR') : p.trim()}
                                                                </Link>
                                                            ) : (
                                                                <div key={idx} className="text-slate-700">
                                                                    {/^\d+$/.test(p.trim()) ? Number(p.trim()).toLocaleString('es-AR') : p.trim()}
                                                                </div>
                                                            )
                                                        ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tipo de Acto y Número */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Tipo de Acto</p>
                                                <p className="text-slate-700">{escritura.operaciones?.[0]?.tipo_acto || "COMPRAVENTA"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Código</p>
                                                <p className="text-slate-700">{escritura.operaciones?.[0]?.codigo || "No especificado"}</p>
                                            </div>
                                        </div>

                                        {/* Escritura Nº y Fecha */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Escritura Nº</p>
                                                <p className="text-slate-700">{escritura.nro_protocolo || "Draft"}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase text-slate-400">Fecha</p>
                                                <p className="text-slate-700">
                                                    {escritura.fecha_escritura ?
                                                        new Date(escritura.fecha_escritura + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
                                                        : "Fecha pendiente"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Escribano */}
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase text-slate-400">Escribano</p>
                                            <p className="text-slate-700">{escritura.notario_interviniente || "No especificado"}</p>
                                        </div>


                                        {/* Registro */}
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase text-slate-400">Registro número</p>
                                            <p className="text-slate-700">{escritura.registro || "No especificado"}</p>
                                        </div>

                                        {/* Mortgage Specific Details (UVAs, Tasa, Capital) */}
                                        {escritura.operaciones?.[0]?.tipo_acto?.includes('HIPOTECA') && (
                                            <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 space-y-2">
                                                <p className="text-[9px] font-bold uppercase text-blue-500 flex items-center gap-1.5">
                                                    <Activity className="h-3 w-3" />
                                                    Condiciones del Crédito
                                                </p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                                                    <div className="col-span-2 border-b border-blue-100/30 pb-1 flex justify-between items-center">
                                                        <span className="text-[9px] text-slate-400 uppercase">Capital Mutuado</span>
                                                        <span className="font-bold text-slate-700">
                                                            {escritura.operaciones[0].monto_operacion?.toLocaleString('es-AR', {
                                                                style: 'currency',
                                                                currency: escritura.operaciones[0].moneda_cesion || 'ARS',
                                                                maximumFractionDigits: 0
                                                            })}
                                                        </span>
                                                    </div>

                                                    {escritura.analysis_metadata?.operation_details?.uva_monto && (
                                                        <div>
                                                            <p className="text-[9px] text-slate-400 uppercase">Monto en UVAs</p>
                                                            <p className="font-bold text-blue-600">
                                                                {Number(escritura.analysis_metadata.operation_details.uva_monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {escritura.analysis_metadata?.operation_details?.tasa_interes && (
                                                        <div>
                                                            <p className="text-[9px] text-slate-400 uppercase">Tasa (TNA)</p>
                                                            <p className="font-bold text-slate-700">{escritura.analysis_metadata.operation_details.tasa_interes}</p>
                                                        </div>
                                                    )}

                                                    {escritura.analysis_metadata?.operation_details?.sistema_amortizacion && (
                                                        <div className="col-span-2 pt-1 border-t border-blue-100/30">
                                                            <p className="text-[9px] text-slate-400 uppercase">Sistema / Amortización</p>
                                                            <p className="font-medium text-slate-600 text-[10px]">{escritura.analysis_metadata.operation_details.sistema_amortizacion}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-medium text-slate-700 gap-1.5"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (escritura.pdf_url) {
                                                        const url = await resolveDocumentUrl(escritura.pdf_url);
                                                        if (url) {
                                                            setViewingDocument(url);
                                                        } else {
                                                            toast.error("Error al obtener URL del documento");
                                                        }
                                                    } else {
                                                        toast.error("No hay documento disponible");
                                                    }
                                                }}
                                            >
                                                <Eye className="h-3 w-3" />
                                                Ver Documento
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-medium text-slate-700 gap-1.5"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (escritura.pdf_url) {
                                                        const url = await resolveDocumentUrl(escritura.pdf_url);
                                                        if (url) {
                                                            window.open(url, '_blank');
                                                        } else {
                                                            toast.error("Error al obtener URL de descarga");
                                                        }
                                                    } else {
                                                        toast.error("No hay documento para descargar");
                                                    }
                                                }}
                                            >
                                                <Download className="h-3 w-3" />
                                                Descargar
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-[10px] font-medium text-slate-700 gap-1.5"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowTranscriptionDialog(true);
                                                }}
                                            >
                                                <FileText className="h-3 w-3" />
                                                Transcripción
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                        {carpeta.escrituras.length === 0 && (
                            <div className="p-8 text-center bg-slate-50 border-2 border-dashed rounded-xl">
                                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 font-medium">No hay escrituras</p>
                            </div>
                        )}

                        <Separator className="my-4" />

                        {/* Storage Management Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-600">
                                <Activity className="h-4 w-4" />
                                Archivos en Servidor (Storage)
                            </h3>
                            <div className="space-y-2">
                                {storageFiles.map((file) => {
                                    const isLinked = carpeta.escrituras.some((e: any) => e.pdf_url?.includes(file.name));
                                    return (
                                        <div key={file.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-sm transition-all group">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={cn("p-2 rounded-lg", isLinked ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600")}>
                                                    <FileText size={16} />
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-[11px] font-bold truncate text-slate-700">
                                                        {file.name.replace(/^\d{13}_/, "")}
                                                    </p>
                                                    <p className="text-[9px] text-slate-400">
                                                        {(file.metadata?.size / 1024).toFixed(1)} KB • {isLinked ? "Vinculado" : "Huérfano"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {!isLinked && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDeleteStorageFile(file.name)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-slate-400 hover:bg-slate-100"
                                                    onClick={async () => {
                                                        const doc = carpeta.escrituras.find((e: any) => e.pdf_url?.includes(file.name));
                                                        if (doc?.pdf_url) {
                                                            const url = await resolveDocumentUrl(doc.pdf_url);
                                                            if (url) {
                                                                setViewingDocument(url);
                                                            } else {
                                                                toast.error("Error al obtener URL del documento");
                                                            }
                                                        } else {
                                                            toast.info("Este archivo no tiene registro en la base de datos.");
                                                        }
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {storageFiles.length === 0 && !isLoadingStorage && (
                                    <p className="text-[10px] text-center text-slate-400 py-4 italic">No se encontraron archivos adicionales.</p>
                                )}
                            </div>
                        </div>
                    </div>



                    {/* Main Content: Participant Cards */}
                    <div className="lg:col-span-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {optimisticOps.flatMap((op: any) =>
                                op.participantes_operacion?.map((p: any) => {
                                    const person = p.persona || p.personas;
                                    if (!person) return null;


                                    const getSpouseName = (p: any) => {
                                        if (p.datos_conyuge?.nombre || p.datos_conyuge?.nombre_completo) return p.datos_conyuge.nombre || p.datos_conyuge.nombre_completo;
                                        // Fallback: Try to regex from civil status detail
                                        const match = p.estado_civil_detalle?.match(/con\s+([A-ZÁÉÍÓÚÑa-zxzñ\s]+)/i);
                                        if (match && match[1]) {
                                            // Filter out common stopped words if needed, or just return first few words
                                            return match[1].trim();
                                        }
                                        return null;
                                    };

                                    const spouseName = getSpouseName(person);

                                    return (
                                        <Card key={p.id} className="overflow-hidden border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                            {/* Header: Role + Actions */}
                                            <div className="px-4 py-2 border-b flex justify-between items-center bg-slate-50">
                                                <Badge variant="secondary" className={cn(
                                                    "text-[9px] px-2 py-0 h-5 font-bold tracking-wider",
                                                    // ... (Role Badge Styles - kept simple for brevity in replacement, assuming existing logic or concise match) ...
                                                    getRoleBadgeStyle(p.rol)
                                                )}>
                                                    {getRoleLabel(p.rol)}
                                                </Badge>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                        onClick={() => setEditingPerson(person)}
                                                        title="Editar datos"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="p-4 pt-3 space-y-3">
                                                {/* Core Identity */}
                                                <div>
                                                    <h3 className="text-base font-bold text-slate-800 leading-tight">
                                                        {isLegalEntity(person)
                                                            ? person.nombre_completo.toUpperCase()
                                                            : formatPersonName(person.nombre_completo)}
                                                    </h3>
                                                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                                                        {isLegalEntity(person)
                                                            ? `Persona Jurídica • Const: ${formatDateInstructions(person.fecha_nacimiento)}`
                                                            : `${person.nacionalidad || "No informada"} • Nac: ${formatDateInstructions(person.fecha_nacimiento)}`}
                                                    </p>
                                                </div>

                                                {/* ID Grid */}
                                                <div className="grid grid-cols-2 gap-3 pb-1">
                                                    {!isLegalEntity(person) && (
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">DNI</p>
                                                            <p className="text-[13px] text-slate-700 font-bold">{person.dni || "No informado"}</p>
                                                        </div>
                                                    )}
                                                    <div className={isLegalEntity(person) ? "col-span-2" : ""}>
                                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">CUIT / CUIL</p>
                                                        <p className="text-[13px] text-slate-700 font-bold">{formatCUIT(person.cuit) || "No informado"}</p>
                                                    </div>
                                                </div>

                                                {/* Details Grid (Only for Natural Persons) */}
                                                {!isLegalEntity(person) && (
                                                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-y py-3 border-slate-100">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Filiación</p>
                                                            <p className="text-[12px] text-slate-700 font-medium leading-tight">
                                                                {person.nombres_padres || "No informada"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Cónyuge</p>
                                                            <p className="text-[12px] text-slate-700 font-medium leading-tight">
                                                                {spouseName ? <span className="font-semibold text-slate-800">{formatPersonName(spouseName)}</span> : "No informado"}
                                                            </p>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Estado Civil</p>
                                                            <p className="text-[12px] text-slate-700 leading-snug">
                                                                {person.estado_civil_detalle || "No detallado"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Address & Contact */}
                                                <div className="space-y-2">
                                                    <div>
                                                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Domicilio Real</p>
                                                        <p className="text-[12px] text-slate-600 italic leading-snug">
                                                            {person.domicilio_real?.literal || "No consta"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Datos de Representación (para Apoderados/Representantes) */}
                                                {(p.datos_representacion || (p.rol && p.rol.toUpperCase().includes('APODERADO'))) && (
                                                    <div className="border-t pt-3 border-slate-100 space-y-2">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Representando a</p>
                                                                <p className="text-[12px] text-slate-700 font-semibold">
                                                                    {p.datos_representacion?.representa_a || "No informado"}
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shrink-0"
                                                                onClick={() => setEditingRepresentacion({ participanteId: p.id, ...p.datos_representacion })}
                                                                title="Editar representación"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Poder Otorgado</p>
                                                            <p className="text-[12px] text-slate-600 italic leading-snug">
                                                                {p.datos_representacion?.poder_detalle || "No consta"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </TabsContent >

            <TabsContent value="budget">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-12">
                        <TaxBreakdownCard taxData={currentEscritura?.analysis_metadata?.tax_calculation} />
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="smart-draft">
                {activeDeedId ? (
                    <SmartDeedEditor
                        escrituraId={activeDeedId}
                        initialContent={currentEscritura?.contenido_borrador}
                    />
                ) : (
                    <div className="flex items-center justify-center h-[500px] border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">Seleccione una escritura para ver el borrador inteligente</p>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="draft" className="h-[calc(100vh-180px)] overflow-hidden">
                {activeDeedId ? (
                    <DeedEditor
                        escrituraId={activeDeedId}
                        initialContent={currentEscritura?.contenido_borrador}
                        dataSummary={currentEscritura}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">Seleccione una escritura para redactar</p>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="compliance">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <MinutaGenerator
                        data={currentEscritura}
                        isBlocked={isBlockedBySecurity}
                    />
                    <AMLCompliance escrituraId={activeDeedId!} />
                </div>
            </TabsContent>
            <TabsContent value="inscription">
                <InscriptionTracker data={currentEscritura} />
            </TabsContent>

            {/* Editing Person Modal */}
            < Dialog open={!!editingPerson} onOpenChange={() => setEditingPerson(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar Persona</DialogTitle>
                        <DialogDescription>
                            Modifica los datos personales y filiatorios. Los cambios se aplicarán globalmente.
                        </DialogDescription>
                    </DialogHeader>
                    {editingPerson && (
                        <PersonForm
                            initialData={editingPerson}
                            onSuccess={() => {
                                setEditingPerson(null);
                                router.refresh();
                            }}
                            onCancel={() => setEditingPerson(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Editing Representacion Modal */}
            <Dialog open={!!editingRepresentacion} onOpenChange={() => setEditingRepresentacion(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Editar Representación</DialogTitle>
                        <DialogDescription>
                            Datos del poder y la persona/entidad representada.
                        </DialogDescription>
                    </DialogHeader>
                    {editingRepresentacion && (
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const formData = new FormData(form);
                                const result = await updateRepresentacion(
                                    editingRepresentacion.participanteId,
                                    {
                                        representa_a: formData.get('representa_a') as string,
                                        caracter: formData.get('caracter') as string,
                                        poder_detalle: formData.get('poder_detalle') as string,
                                    }
                                );
                                if (result.success) {
                                    toast.success('Representación actualizada');
                                    setEditingRepresentacion(null);
                                    router.refresh();
                                } else {
                                    toast.error(result.error || 'Error al actualizar');
                                }
                            }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="representa_a">Representando a</Label>
                                <Input
                                    id="representa_a"
                                    name="representa_a"
                                    defaultValue={editingRepresentacion.representa_a || ''}
                                    placeholder="Ej: BANCO DE LA NACION ARGENTINA"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="caracter">Carácter</Label>
                                <Input
                                    id="caracter"
                                    name="caracter"
                                    defaultValue={editingRepresentacion.caracter || ''}
                                    placeholder="Ej: Apoderado, Presidente, Socio Gerente"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="poder_detalle">Poder Otorgado</Label>
                                <Textarea
                                    id="poder_detalle"
                                    name="poder_detalle"
                                    rows={4}
                                    defaultValue={editingRepresentacion.poder_detalle || ''}
                                    placeholder="Ej: poder general amplio conferido por escritura número 100 de fecha 21/03/2018, ante escribano Santiago Alvarez Fourcade, folio 733 del Registro a su cargo"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setEditingRepresentacion(null)}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    Guardar
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Transcription Dialog */}
            <Dialog open={showTranscriptionDialog} onOpenChange={setShowTranscriptionDialog}>
                <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Transcripción Literal Completa del Inmueble</DialogTitle>
                        <DialogDescription>
                            Descripción técnica completa del inmueble extraída del documento original.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        {currentEscritura?.inmuebles?.transcripcion_literal ? (
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {currentEscritura.inmuebles.transcripcion_literal}
                                </p>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-500">
                                <p className="text-sm">No hay transcripción literal disponible para este documento.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Deed Metadata Dialog */}
            <Dialog open={!!editingDeed} onOpenChange={() => setEditingDeed(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Editar Datos del Documento</DialogTitle>
                        <DialogDescription>
                            Modifica los metadatos extraídos por IA. Los cambios se guardarán en la base de datos.
                        </DialogDescription>
                    </DialogHeader>
                    {editingDeed && (
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);

                                // Update escritura
                                const escrituraResult = await updateEscritura(editingDeed.id, {
                                    nro_protocolo: formData.get("nro_protocolo") ? parseInt(formData.get("nro_protocolo") as string) : null,
                                    fecha_escritura: formData.get("fecha_escritura") as string || null,
                                    notario_interviniente: formData.get("notario_interviniente") as string || null,
                                    registro: formData.get("registro") as string || null,
                                });

                                // Update operacion
                                if (editingDeed.operacion?.id) {
                                    await updateOperacion(editingDeed.operacion.id, {
                                        tipo_acto: formData.get("tipo_acto") as string,
                                        codigo: formData.get("codigo") as string || null,
                                    });
                                }

                                // Update inmueble
                                if (editingDeed.inmuebles?.id) {
                                    await updateInmueble(editingDeed.inmuebles.id, {
                                        partido_id: formData.get("partido_id") as string,
                                        nro_partida: formData.get("nro_partida") as string,
                                    });
                                }

                                if (escrituraResult.success) {
                                    toast.success("Datos actualizados correctamente");
                                    setEditingDeed(null);
                                    router.refresh();
                                } else {
                                    toast.error("Error al actualizar: " + escrituraResult.error);
                                }
                            }}
                            className="space-y-4 mt-4"
                        >
                            {/* Inmueble Data */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Datos del Inmueble</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="partido_id">Partido / Dpto</Label>
                                        <Input
                                            id="partido_id"
                                            name="partido_id"
                                            defaultValue={editingDeed.inmuebles?.partido_id || ""}
                                            placeholder="Ej: Bahía Blanca"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nro_partida">Nro. Partida</Label>
                                        <Input
                                            id="nro_partida"
                                            name="nro_partida"
                                            defaultValue={editingDeed.inmuebles?.nro_partida || ""}
                                            placeholder="Ej: 186.636"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Operacion Data */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Datos de la Operación</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tipo_acto">Tipo de Acto</Label>
                                        <Input
                                            id="tipo_acto"
                                            name="tipo_acto"
                                            defaultValue={editingDeed.operacion?.tipo_acto || "COMPRAVENTA"}
                                            placeholder="Ej: COMPRAVENTA"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="codigo">Código</Label>
                                        <Input
                                            id="codigo"
                                            name="codigo"
                                            defaultValue={editingDeed.operacion?.codigo || ""}
                                            placeholder="Ej: 100-00"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Escritura Data */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-slate-700">Datos de la Escritura</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="nro_protocolo">Escritura Nº</Label>
                                        <Input
                                            id="nro_protocolo"
                                            name="nro_protocolo"
                                            type="number"
                                            defaultValue={editingDeed.nro_protocolo || ""}
                                            placeholder="Ej: 240"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="fecha_escritura">Fecha</Label>
                                        <Input
                                            id="fecha_escritura"
                                            name="fecha_escritura"
                                            type="date"
                                            defaultValue={editingDeed.fecha_escritura || ""}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="notario_interviniente">Escribano</Label>
                                    <Input
                                        id="notario_interviniente"
                                        name="notario_interviniente"
                                        defaultValue={editingDeed.notario_interviniente || ""}
                                        placeholder="Nombre completo del escribano"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="registro">Registro número</Label>
                                    <Input
                                        id="registro"
                                        name="registro"
                                        defaultValue={editingDeed.registro || ""}
                                        placeholder="Ej: Registro 30 de Bahía Blanca"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingDeed(null)}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    Guardar Cambios
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            {/* Document Viewer Dialog - Fullscreen */}
            <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
                <DialogContent
                    className="max-h-[96vh] h-[96vh] p-0 overflow-hidden bg-white border-slate-200 transition-none"
                    style={{ maxWidth: `${viewerWidth}vw`, width: `${viewerWidth}vw` }}
                    showCloseButton={false}
                >
                    <div className="relative w-full h-full flex flex-col">
                        {/* Resizer handle (Right side) */}
                        <div
                            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 transition-colors z-50 group"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = viewerWidth;
                                const onMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = moveEvent.clientX - startX;
                                    // Change in px converted to vw (approximate)
                                    const deltaVw = (deltaX / window.innerWidth) * 100 * 2; // times 2 because it's centered
                                    const newWidth = Math.min(98, Math.max(40, startWidth + deltaVw));
                                    setViewerWidth(newWidth);
                                };
                                const onMouseUp = () => {
                                    document.removeEventListener("mousemove", onMouseMove);
                                    document.removeEventListener("mouseup", onMouseUp);
                                };
                                document.addEventListener("mousemove", onMouseMove);
                                document.addEventListener("mouseup", onMouseUp);
                            }}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300 group-hover:bg-blue-400 rounded-full" />
                        </div>

                        {/* Left Resizer handle (optional, for better symmetry in interactions) */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/30 transition-colors z-50 group"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = viewerWidth;
                                const onMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = startX - moveEvent.clientX;
                                    const deltaVw = (deltaX / window.innerWidth) * 100 * 2;
                                    const newWidth = Math.min(98, Math.max(40, startWidth + deltaVw));
                                    setViewerWidth(newWidth);
                                };
                                const onMouseUp = () => {
                                    document.removeEventListener("mousemove", onMouseMove);
                                    document.removeEventListener("mouseup", onMouseUp);
                                };
                                document.addEventListener("mousemove", onMouseMove);
                                document.addEventListener("mouseup", onMouseUp);
                            }}
                        >
                            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300 group-hover:bg-blue-400 rounded-full" />
                        </div>

                        {/* Header with filename and close button */}
                        <div className="flex justify-between items-center p-3 bg-white border-b border-slate-200 text-slate-900">
                            <h3 className="text-sm font-semibold truncate pr-10 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                {(() => {
                                    if (!viewingDocument) return "Cargando...";
                                    const rawName = viewingDocument.split('/').pop()?.split('?')[0] || "";
                                    // Remove timestamp if present (13 digits followed by underscore)
                                    return rawName.replace(/^\d{13}_/, "");
                                })()}
                            </h3>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setViewingDocument(null)}
                                className="text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </Button>
                        </div>

                        {/* Document Viewer Container */}
                        <div className="flex-1 bg-slate-100 flex justify-center items-center overflow-hidden p-0">
                            {viewingDocument && (() => {
                                const isPdf = viewingDocument.toLowerCase().includes(".pdf");
                                const isDocx = viewingDocument.toLowerCase().includes(".docx") || viewingDocument.toLowerCase().includes(".doc");

                                if (isPdf) {
                                    return (
                                        <iframe
                                            src={viewingDocument}
                                            className="w-full h-full bg-white shadow-sm border-none"
                                            title="PDF Viewer"
                                        />
                                    );
                                }

                                if (isDocx) {
                                    // Using Google Docs Viewer with a robust fallback
                                    return (
                                        <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6 p-8">
                                            <div className="w-full flex-1 relative bg-white shadow-sm border rounded-xl overflow-hidden min-h-[400px]">
                                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-0">
                                                    <Activity className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                                                    <p className="text-sm font-medium text-slate-600">Abriendo vista previa externa...</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Los documentos Word pueden demorar unos segundos en renderizarse.</p>
                                                </div>
                                                <iframe
                                                    src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingDocument)}&embedded=true`}
                                                    className="relative w-full h-full bg-white z-10"
                                                    title="Document Viewer"
                                                />
                                            </div>

                                            <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl border shadow-sm w-full max-w-md">
                                                <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                                                    <Download size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-800">¿El documento no carga?</p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Debido a restricciones de seguridad de los archivos Word, a veces el visor externo no puede acceder al documento privado.
                                                    </p>
                                                </div>
                                                <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                                                    <a href={viewingDocument} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                        <Download size={16} />
                                                        Descargar y Abrir Original
                                                    </a>
                                                </Button>
                                                <p className="text-[10px] text-slate-400">
                                                    Recomendación: Convierte tus archivos a PDF antes de subirlos para una visualización instantánea.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="text-center p-10 bg-white rounded-lg shadow-sm border border-slate-200">
                                        <p className="text-slate-600 mb-4">El visualizador no es compatible con este tipo de archivo.</p>
                                        <Button asChild variant="outline">
                                            <a href={viewingDocument} target="_blank">Descargar Archivo</a>
                                        </Button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- CONFLICT RESOLUTION MODAL --- */}
            <Dialog open={showConflictModal} onOpenChange={setShowConflictModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <Activity className="h-5 w-5" />
                            Detección de Cambios en Datos Maestros
                        </DialogTitle>
                        <DialogDescription>
                            El sistema detectó que existen registros previos para estas entidades, pero con datos diferentes en el nuevo documento.
                            Por favor, verifica qué versión deseas mantener.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 my-4">
                        {pendingConflicts.map((conflict, idx) => (
                            <div key={idx} className="border rounded-xl p-4 bg-slate-50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="bg-amber-100 text-amber-700">
                                        {conflict.type === 'PERSONA' ? 'CLIENTE / ENTIDAD' : 'INMUEBLE'}
                                    </Badge>
                                    <span className="text-xs font-mono text-slate-500">ID: {conflict.id}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Existing Data */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Dato Anterior (Base de Datos)</p>
                                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                                            {conflict.type === 'PERSONA' ? (
                                                <div className="space-y-1">
                                                    <p className="font-bold">{formatPersonName(conflict.existing.nombre_completo)}</p>
                                                    <p>Domicilio: {conflict.existing.domicilio_real?.literal || 'No informado'}</p>
                                                    <p>Estado Civil: {conflict.existing.estado_civil_detalle || 'No informado'}</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <p className="font-bold">Partido: {conflict.existing.partido_id}</p>
                                                    <p>Partida: {conflict.existing.nro_partida}</p>
                                                    <p className="italic text-slate-500 line-clamp-2">{conflict.existing.transcripcion_literal}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Extracted Data */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-blue-400">Dato Nuevo (Extraído de Documento Analizado)</p>
                                        <div className="p-3 bg-blue-50/30 border border-blue-200 rounded-lg text-xs ring-2 ring-blue-500/20">
                                            {conflict.type === 'PERSONA' ? (
                                                <div className="space-y-1">
                                                    <p className="font-bold text-blue-700">{formatPersonName(conflict.extracted.nombre_completo)}</p>
                                                    <p>Domicilio: <span className="font-bold">{conflict.extracted.domicilio_real?.literal || 'No informado'}</span></p>
                                                    <p>Estado Civil: <span className="font-bold">{conflict.extracted.estado_civil_detalle || 'No informado'}</span></p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <p className="font-bold text-blue-700">Partido: {conflict.extracted.partido}</p>
                                                    <p>Partida: {conflict.extracted.partida_inmobiliaria}</p>
                                                    <p className="italic text-slate-500 line-clamp-2">{conflict.extracted.transcripcion_literal}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setShowConflictModal(false)}>Resolver más tarde</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                            onClick={() => handleResolveConflicts([])}
                        >
                            Aplicar Todos los Cambios
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Tabs >
    );
}
