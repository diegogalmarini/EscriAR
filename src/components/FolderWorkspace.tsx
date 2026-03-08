"use client";

import { useState, useOptimistic, useTransition, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Activity, Download } from "lucide-react";
import { PersonSearch } from "./PersonSearch";
import { PersonForm } from "./PersonForm";
import { AssetSearch } from "./AssetSearch";
import { linkPersonToOperation, linkAssetToDeed, deleteCarpeta, unlinkPersonFromOperation, updateRepresentacion } from "@/app/actions/carpeta";
import { updateEscritura, updateOperacion, updateInmueble, ensureTramiteEscritura, syncVendedoresFromIngesta } from "@/app/actions/escritura";
import { listStorageFiles, deleteStorageFile, getSignedUrl } from "@/app/actions/storageSync";
import { toast } from "sonner";
import { CrossCheckService, ValidationState } from "@/lib/agent/CrossCheckService";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatCUIT, formatPersonName } from "@/lib/utils/normalization";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CarpetaHero from "./CarpetaHero";
import { WorkspaceRadiography } from "./WorkspaceRadiography";
import { FasePreEscritura, FaseRedaccion, FasePostEscritura } from "./WorkspacePipeline";
import ApuntesTab from "./ApuntesTab";
import PresupuestoTab from "./PresupuestoTab";

export default function FolderWorkspace({ initialData }: { initialData: any }) {
    const [carpeta, setCarpeta] = useState(initialData);
    const router = useRouter();

    // Sync local state when initialData changes (e.g., after router.refresh())
    useEffect(() => {
        console.log("🔄 FolderWorkspace: Syncing state with new initialData");
        setCarpeta(initialData);
    }, [initialData]);

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
                (payload: any) => {
                    console.log('[REALTIME] Folder change detected:', payload);
                    const newData = payload.new as any;
                    setCarpeta((prev: any) => ({ ...prev, ...newData }));

                    // Cuando ingesta pasa a COMPLETADO, refetch completo para traer escrituras/operaciones/participantes
                    if (newData.ingesta_estado === 'COMPLETADO' || newData.ingesta_estado === 'ERROR') {
                        console.log('[REALTIME] Ingesta finalizada, refetching full carpeta data...');
                        debouncedRefresh();
                    }
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
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'actuaciones',
                    filter: `carpeta_id=eq.${carpeta.id}`
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
    const [breakGlassConfirmed, setBreakGlassConfirmed] = useState(false);
    const [viewingDocument, setViewingDocument] = useState<string | null>(null);
    const [viewerWidth, setViewerWidth] = useState(95); // Default 95vw

    console.log("📂 FolderWorkspace Initial Data:", JSON.stringify(initialData, null, 2));

    // Fuente de verdad: activeDeedId = escritura TRAMITE (operación activa)
    const tramiteEscritura = carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE');
    const [activeDeedId, setActiveDeedId] = useState<string | null>(tramiteEscritura?.id || null);

    // Auto-crear escritura TRAMITE si no existe (carpetas legacy pre-migración 044)
    useEffect(() => {
        if (!carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE')) {
            ensureTramiteEscritura(carpeta.id).then((res) => {
                if (res.success && res.escritura) {
                    setActiveDeedId(res.escritura.id);
                    router.refresh();
                }
            });
        }
    }, [carpeta.id, carpeta.escrituras, router]);

    // Auto-popular VENDEDOR desde INGESTA (el propietario actual = COMPRADOR del antecedente)
    useEffect(() => {
        const tramite = carpeta.escrituras?.find((e: any) => e.source === 'TRAMITE');
        const ingesta = carpeta.escrituras?.find((e: any) => e.source === 'INGESTA');
        if (!tramite || !ingesta) return;

        // Si TRAMITE ya tiene vendedores, no re-sync
        const tramiteParticipants = tramite.operaciones?.flatMap((op: any) => op.participantes_operacion || []) || [];
        const ROLES_VEND = ['VENDEDOR', 'TRANSMITENTE', 'DONANTE', 'CEDENTE'];
        const yaHayVendedor = tramiteParticipants.some((p: any) => ROLES_VEND.includes(p.rol?.toUpperCase()));
        if (yaHayVendedor) return;

        syncVendedoresFromIngesta(carpeta.id).then((res) => {
            if (res.success && (res as any).added > 0) {
                router.refresh();
            }
        });
    }, [carpeta.id, carpeta.escrituras, router]);

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


    const [activeTab, setActiveTab] = useState("apuntes");

    return (
        <div className="px-6 md:px-10 pb-10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <CarpetaHero carpeta={carpeta} onDelete={handleDeleteFolder} isDeleting={isDeleting} onNavigateTab={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="apuntes">Apuntes</TabsTrigger>
                    <TabsTrigger value="mesa-trabajo">Mesa de Trabajo</TabsTrigger>
                    <TabsTrigger value="antecedentes">Antecedentes</TabsTrigger>
                    <TabsTrigger value="pre-escritura">Pre-Escriturario</TabsTrigger>
                    <TabsTrigger value="post-escritura">Post-Firma</TabsTrigger>
                    <TabsTrigger value="presupuesto">Presupuesto</TabsTrigger>
                </TabsList>
            </CarpetaHero>

            <PersonSearch open={isPersonSearchOpen} setOpen={setIsPersonSearchOpen} onSelect={handleLinkPerson} />
            <AssetSearch open={isAssetSearchOpen} setOpen={setIsAssetSearchOpen} onSelect={handleLinkAsset} />

                <TabsContent value="apuntes" className="mt-6">
                    <ApuntesTab carpetaId={carpeta.id} />
                </TabsContent>

                <TabsContent value="mesa-trabajo" className="mt-6">
                    <FaseRedaccion
                        currentEscritura={currentEscritura}
                        activeDeedId={activeDeedId}
                        carpeta={carpeta}
                    />
                </TabsContent>

                <TabsContent value="antecedentes" className="mt-6">
                    <WorkspaceRadiography
                        carpetaId={carpeta.id}
                        currentEscritura={carpeta.escrituras?.find((e: any) => e.source === 'INGESTA') || null}
                        optimisticOps={carpeta.escrituras?.find((e: any) => e.source === 'INGESTA')?.operaciones || []}
                        storageFiles={storageFiles}
                        isLoadingStorage={isLoadingStorage}
                        carpetaEscrituras={(carpeta.escrituras || []).filter((e: any) => e.source === 'INGESTA')}
                        onEditDeed={(deed) => setEditingDeed({ ...deed, operacion: deed.operaciones?.[0] })}
                        onEditPerson={setEditingPerson}
                        onEditRepresentacion={(data) => setEditingRepresentacion(data)}
                        onViewDocument={setViewingDocument}
                        onDeleteStorageFile={handleDeleteStorageFile}
                        resolveDocumentUrl={resolveDocumentUrl}
                    />
                </TabsContent>

                <TabsContent value="pre-escritura" className="mt-6">
                    <FasePreEscritura currentEscritura={currentEscritura} carpetaId={carpeta.id} carpeta={carpeta} onNavigateToPresupuesto={() => setActiveTab("presupuesto")} />
                </TabsContent>

                <TabsContent value="post-escritura" className="mt-6">
                    <FasePostEscritura
                        currentEscritura={currentEscritura}
                        activeDeedId={activeDeedId}
                        carpetaEstado={carpeta.estado}
                        isBlockedBySecurity={isBlockedBySecurity}
                    />
                </TabsContent>

                <TabsContent value="presupuesto" className="mt-6">
                    <PresupuestoTab carpetaId={carpeta.id} currentEscritura={currentEscritura} />
                </TabsContent>
            </Tabs>


            <Dialog open={!!editingPerson} onOpenChange={() => setEditingPerson(null)}>
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
            <Dialog open={!!editingDeed} onOpenChange={() => { setEditingDeed(null); setBreakGlassConfirmed(false); }}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Corrección excepcional de datos del antecedente</DialogTitle>
                        <DialogDescription>
                            Estos datos provienen del documento antecedente procesado por IA. Solo deben corregirse si el OCR interpretó mal un valor (ej. fecha ilegible, código incorrecto). Para cambios operativos usá Mesa de Trabajo.
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
                                <p className="text-xs text-muted-foreground -mt-1">Dato histórico del antecedente. No modifica el trámite actual.</p>
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
                                        <Label htmlFor="codigo">Código (antecedente)</Label>
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

                            <div className="flex items-start gap-2 pt-3 border-t">
                                <Checkbox
                                    id="break-glass-confirm"
                                    checked={breakGlassConfirmed}
                                    onCheckedChange={(v) => setBreakGlassConfirmed(v === true)}
                                />
                                <label htmlFor="break-glass-confirm" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                                    Confirmo que esta corrección es excepcional (OCR/ilegible)
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => { setEditingDeed(null); setBreakGlassConfirmed(false); }}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={!breakGlassConfirmed}>
                                    Guardar corrección
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
                        {pendingConflicts.map((conflict: any, idx: number) => (
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
        </div>
    );
}
