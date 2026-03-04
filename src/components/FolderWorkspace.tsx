"use client";

import { useState, useOptimistic, useTransition, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PersonSearch } from "./PersonSearch";
import { AssetSearch } from "./AssetSearch";
import { linkPersonToOperation, linkAssetToDeed, deleteCarpeta, unlinkPersonFromOperation } from "@/app/actions/carpeta";
import { listStorageFiles, deleteStorageFile } from "@/app/actions/storageSync";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CarpetaHero from "./CarpetaHero";
import { WorkspaceRadiography } from "./WorkspaceRadiography";
import { FasePreEscritura, FaseRedaccion, FasePostEscritura } from "./WorkspacePipeline";
import { useCarpetaState } from "@/hooks/useCarpetaState";
import {
    EditPersonDialog,
    EditRepresentacionDialog,
    TranscriptionDialog,
    EditDeedDialog,
    DocumentViewerDialog,
    ConflictResolutionDialog,
} from "./CarpetaDialogs";

export default function FolderWorkspace({ initialData }: { initialData: any }) {
    const {
        carpeta,
        setCarpeta,
        refreshCarpeta,
        activeDeedId,
        currentEscritura,
        isBlockedBySecurity,
        resolveDocumentUrl,
        router,
    } = useCarpetaState(initialData);

    // --- UI State ---
    const [isPersonSearchOpen, setIsPersonSearchOpen] = useState(false);
    const [isAssetSearchOpen, setIsAssetSearchOpen] = useState(false);
    const [activeOpId, setActiveOpId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [isDeleting, setIsDeleting] = useState(false);

    // Dialog state
    const [editingPerson, setEditingPerson] = useState<any>(null);
    const [editingRepresentacion, setEditingRepresentacion] = useState<any>(null);
    const [showTranscriptionDialog, setShowTranscriptionDialog] = useState(false);
    const [editingDeed, setEditingDeed] = useState<any>(null);
    const [viewingDocument, setViewingDocument] = useState<string | null>(null);

    // Conflict state
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [pendingConflicts, setPendingConflicts] = useState<any[]>([]);

    // Storage files
    const [storageFiles, setStorageFiles] = useState<any[]>([]);
    const [isLoadingStorage, setIsLoadingStorage] = useState(false);

    // Check for conflicts on mount
    useEffect(() => {
        if (carpeta.ingesta_estado === 'REVISION_REQUERIDA' && carpeta.ingesta_metadata?.conflicts) {
            setPendingConflicts(carpeta.ingesta_metadata.conflicts);
            setShowConflictModal(true);
        }
    }, [carpeta.ingesta_estado, carpeta.ingesta_metadata]);

    const handleResolveConflicts = async (resolutions: any[]) => {
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
            refreshCarpeta();
        } catch (e: any) {
            toast.error("Error al resolver: " + e.message);
        }
    };

    // Fetch storage files
    const fetchStorageFiles = async () => {
        setIsLoadingStorage(true);
        const res = await listStorageFiles("escrituras", "documents");
        if (res.success && res.data) {
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

    const handleLinkAsset = async (assetId: string) => {
        if (!activeDeedId) return;
        const res = await linkAssetToDeed(activeDeedId, assetId);
        if (res.success) {
            toast.success("Inmueble vinculado correctamente");
            refreshCarpeta();
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
                refreshCarpeta();
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
            refreshCarpeta();
        } else {
            toast.error("Error: " + res.error);
        }
    };

    return (
        <div className="px-6 md:px-10 pb-10">
            <Tabs defaultValue="mesa-trabajo" className="w-full">
            <CarpetaHero carpeta={carpeta} onDelete={handleDeleteFolder} isDeleting={isDeleting}>
                <TabsList>
                    <TabsTrigger value="mesa-trabajo">Mesa de Trabajo</TabsTrigger>
                    <TabsTrigger value="antecedentes">Antecedentes</TabsTrigger>
                    <TabsTrigger value="pre-escritura">Pre-Escriturario</TabsTrigger>
                    <TabsTrigger value="post-escritura">Post-Firma</TabsTrigger>
                </TabsList>
            </CarpetaHero>

            <PersonSearch open={isPersonSearchOpen} setOpen={setIsPersonSearchOpen} onSelect={handleLinkPerson} />
            <AssetSearch open={isAssetSearchOpen} setOpen={setIsAssetSearchOpen} onSelect={handleLinkAsset} />

                <TabsContent value="mesa-trabajo" className="mt-6">
                    <FaseRedaccion
                        currentEscritura={currentEscritura}
                        activeDeedId={activeDeedId}
                        carpeta={carpeta}
                        onTipoActoChange={(val) => {
                            setCarpeta((prev: any) => {
                                const updated = { ...prev };
                                if (updated.escrituras?.[0]?.operaciones?.[0]) {
                                    updated.escrituras = [...updated.escrituras];
                                    updated.escrituras[0] = { ...updated.escrituras[0] };
                                    updated.escrituras[0].operaciones = [...updated.escrituras[0].operaciones];
                                    updated.escrituras[0].operaciones[0] = {
                                        ...updated.escrituras[0].operaciones[0],
                                        tipo_acto: val,
                                    };
                                }
                                return updated;
                            });
                        }}
                    />
                </TabsContent>

                <TabsContent value="antecedentes" className="mt-6">
                    <WorkspaceRadiography
                        currentEscritura={currentEscritura}
                        optimisticOps={optimisticOps}
                        storageFiles={storageFiles}
                        isLoadingStorage={isLoadingStorage}
                        carpetaEscrituras={carpeta.escrituras || []}
                        onEditDeed={(deed) => setEditingDeed({ ...deed, operacion: deed.operaciones?.[0] })}
                        onEditPerson={setEditingPerson}
                        onEditRepresentacion={(data) => setEditingRepresentacion(data)}
                        onViewDocument={setViewingDocument}
                        onDeleteStorageFile={handleDeleteStorageFile}
                        resolveDocumentUrl={resolveDocumentUrl}
                    />
                </TabsContent>

                <TabsContent value="pre-escritura" className="mt-6">
                    <FasePreEscritura currentEscritura={currentEscritura} carpetaId={carpeta.id} carpeta={carpeta} />
                </TabsContent>

                <TabsContent value="post-escritura" className="mt-6">
                    <FasePostEscritura
                        currentEscritura={currentEscritura}
                        activeDeedId={activeDeedId}
                        carpetaEstado={carpeta.estado}
                        isBlockedBySecurity={isBlockedBySecurity}
                    />
                </TabsContent>
            </Tabs>

            {/* --- Dialogs (extracted to CarpetaDialogs.tsx) --- */}
            <EditPersonDialog
                editingPerson={editingPerson}
                onClose={() => setEditingPerson(null)}
                onSaved={refreshCarpeta}
            />

            <EditRepresentacionDialog
                editingRepresentacion={editingRepresentacion}
                onClose={() => setEditingRepresentacion(null)}
                onSaved={refreshCarpeta}
            />

            <TranscriptionDialog
                open={showTranscriptionDialog}
                onOpenChange={setShowTranscriptionDialog}
                transcripcion={currentEscritura?.inmuebles?.transcripcion_literal}
            />

            <EditDeedDialog
                editingDeed={editingDeed}
                onClose={() => setEditingDeed(null)}
                onSaved={refreshCarpeta}
            />

            <DocumentViewerDialog
                viewingDocument={viewingDocument}
                onClose={() => setViewingDocument(null)}
            />

            <ConflictResolutionDialog
                open={showConflictModal}
                onOpenChange={setShowConflictModal}
                conflicts={pendingConflicts}
                onResolve={handleResolveConflicts}
            />
        </div>
    );
}
