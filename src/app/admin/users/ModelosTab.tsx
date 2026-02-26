"use client";

import { useState, useEffect } from "react";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Upload, Trash2, FileText, Loader2, Info, Eye, Archive,
    RotateCcw, Package, ChevronDown, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
    getModelos, uploadModeloZip, deleteModelo, toggleModeloActive,
} from "@/app/actions/modelos";
import { type ModeloActo, SUPPORTED_ACT_TYPES } from "@/app/actions/modelos-types";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

// ---------------------------------------------------------------------------
// Variable Detail View
// ---------------------------------------------------------------------------

function VariableDetail({ modelo }: { modelo: ModeloActo }) {
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
    const variables: any[] = modelo.metadata?.required_variables || [];

    // Group by category
    const grouped = variables.reduce((acc: Record<string, any[]>, v: any) => {
        const cat = v.category || "otros";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(v);
        return acc;
    }, {} as Record<string, any[]>);

    const toggleCat = (cat: string) => {
        setExpandedCats((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    return (
        <div className="space-y-2">
            {Object.entries(grouped).map(([cat, vars]) => (
                <div key={cat} className="border border-slate-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => toggleCat(cat)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            {expandedCats.has(cat) ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="font-medium text-sm">{vars[0]?.category_label || cat}</span>
                            <Badge variant="secondary" className="text-xs">
                                {vars.length}
                            </Badge>
                        </div>
                    </button>
                    {expandedCats.has(cat) && (
                        <div className="divide-y divide-slate-100">
                            {vars.map((v: any, i: number) => (
                                <div key={i} className="px-4 py-2 flex items-start gap-4 text-sm">
                                    <code className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 shrink-0">
                                        {v.jinja_tag}
                                    </code>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-600">{v.description}</p>
                                        {v.example && (
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Ej: {v.example}
                                            </p>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                        {v.type}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ModelosTab() {
    const [modelos, setModelos] = useState<ModeloActo[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedActType, setSelectedActType] = useState("");
    const [needsActType, setNeedsActType] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // Detail view
    const [detailModelo, setDetailModelo] = useState<ModeloActo | null>(null);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<ModeloActo | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadModelos = async () => {
        setLoading(true);
        try {
            const res = await getModelos();
            if (res.success && res.data) {
                setModelos(res.data);
            }
        } catch {
            toast.error("Error al cargar modelos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadModelos();
    }, []);

    // ------ Upload flow ------

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".zip")) {
            toast.error("Solo se aceptan archivos .zip");
            return;
        }

        setPendingFile(file);
        setNeedsActType(false);
        setSelectedActType("");
    };

    const handleUpload = async () => {
        if (!pendingFile) {
            toast.error("Seleccione un archivo ZIP");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.set("file", pendingFile);
            if (selectedActType) {
                formData.set("act_type", selectedActType);
            }

            const res = await uploadModeloZip(formData);

            if (!res.success && res.error?.includes("act_type")) {
                // Backend couldn't determine act_type — ask user
                setNeedsActType(true);
                toast.info("Selecciona el tipo de acto para este template");
                setUploading(false);
                return;
            }

            if (res.success) {
                toast.success(
                    `Modelo "${res.data?.act_type}" v${res.data?.version} subido — ${res.data?.total_variables} variables`
                );
                setIsUploadOpen(false);
                setPendingFile(null);
                setSelectedActType("");
                setNeedsActType(false);
                loadModelos();
            } else {
                toast.error(res.error || "Error al subir modelo");
            }
        } catch (err: any) {
            toast.error(`Error: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    // ------ Actions ------

    const handleToggle = async (modelo: ModeloActo) => {
        const activate = !modelo.is_active;
        const res = await toggleModeloActive(modelo.id, activate);
        if (res.success) {
            toast.success(activate ? "Modelo activado" : "Modelo archivado");
            loadModelos();
        } else {
            toast.error(res.error || "Error");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const res = await deleteModelo(deleteTarget.id);
        if (res.success) {
            toast.success("Modelo eliminado");
            if (detailModelo?.id === deleteTarget.id) setDetailModelo(null);
            loadModelos();
        } else {
            toast.error(res.error || "Error al eliminar");
        }
        setDeleting(false);
        setDeleteTarget(null);
    };

    // ------ Detail dialog ------

    if (detailModelo) {
        return (
            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Package className="text-blue-600" />
                            {detailModelo.label || detailModelo.act_type} — v{detailModelo.version}
                            {detailModelo.metadata?.schema_version && (
                                <span className="text-sm font-normal text-slate-400">
                                    (schema {detailModelo.metadata.schema_version})
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            {detailModelo.total_variables} variables en{" "}
                            {detailModelo.categories.length} categorías —{" "}
                            {detailModelo.metadata?.template_name}
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => setDetailModelo(null)}>
                        Volver
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {detailModelo.categories.map((cat) => (
                            <Badge key={cat} variant="outline" className="text-xs">
                                {cat}
                            </Badge>
                        ))}
                    </div>
                    <VariableDetail modelo={detailModelo} />
                </CardContent>
            </Card>
        );
    }

    // ------ Main view ------

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Package className="text-blue-600" />
                        Modelos de Actos
                    </CardTitle>
                    <CardDescription>
                        Plantillas DOCX para generación documental. Generadas por el Template Builder.
                    </CardDescription>
                </div>
                <Dialog open={isUploadOpen} onOpenChange={(open) => {
                    setIsUploadOpen(open);
                    if (!open) {
                        setPendingFile(null);
                        setSelectedActType("");
                        setNeedsActType(false);
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 border-slate-700">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Modelo
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Subir Modelo de Acto</DialogTitle>
                            <DialogDescription>
                                Sube un archivo ZIP generado por el Template Builder (contiene template.docx + metadata.json).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Archivo ZIP</Label>
                                <Input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleFileChange}
                                    className="cursor-pointer"
                                />
                            </div>

                            {needsActType && (
                                <div className="grid gap-2">
                                    <Label>Tipo de Acto</Label>
                                    <Select value={selectedActType} onValueChange={setSelectedActType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar tipo de acto" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUPPORTED_ACT_TYPES.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-amber-600">
                                        El template no especifica tipo de acto. Seleccionalo manualmente.
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-2 p-3 bg-blue-50 rounded-md text-xs text-blue-700 border border-blue-100 italic">
                                <Info className="h-4 w-4 shrink-0" />
                                <span>
                                    El ZIP debe contener template.docx y metadata.json. Si ya existe un modelo activo del mismo tipo, se archivará automáticamente.
                                </span>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={uploading || !pendingFile || (needsActType && !selectedActType)}
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Subiendo...
                                    </>
                                ) : (
                                    "Subir Modelo"
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : modelos.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-lg">
                        <Package className="mx-auto h-16 w-16 text-slate-200 mb-4" />
                        <h3 className="font-medium text-slate-900 text-lg">No hay modelos cargados</h3>
                        <p className="text-muted-foreground">
                            Sube un ZIP del Template Builder para empezar a generar escrituras.
                        </p>
                    </div>
                ) : (
                    <div className="rounded-md border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                    <TableHead>Tipo de Acto</TableHead>
                                    <TableHead>Versión</TableHead>
                                    <TableHead>Variables</TableHead>
                                    <TableHead>Categorías</TableHead>
                                    <TableHead>Subido el</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {modelos.map((m) => (
                                    <TableRow key={m.id} className="group">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-slate-400" />
                                                {m.label || m.act_type}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                                    v{m.version}
                                                </span>
                                                {m.metadata?.schema_version && (
                                                    <span className="text-xs text-slate-400" title="Schema version del metadata">
                                                        schema {m.metadata.schema_version}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                                {m.total_variables}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {m.categories.slice(0, 3).map((cat) => (
                                                    <Badge key={cat} variant="outline" className="text-xs">
                                                        {cat}
                                                    </Badge>
                                                ))}
                                                {m.categories.length > 3 && (
                                                    <Badge variant="outline" className="text-xs text-slate-400">
                                                        +{m.categories.length - 3}
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500">
                                            {new Date(m.created_at).toLocaleDateString("es-AR", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            {m.is_active ? (
                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                    Activo
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400">
                                                    Archivado
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => setDetailModelo(m)}
                                                    title="Ver detalle"
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                                    onClick={() => handleToggle(m)}
                                                    title={m.is_active ? "Archivar" : "Activar"}
                                                >
                                                    {m.is_active ? <Archive size={16} /> : <RotateCcw size={16} />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => setDeleteTarget(m)}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                onConfirm={handleDeleteConfirm}
                loading={deleting}
                description={
                    deleteTarget
                        ? `Se eliminará "${deleteTarget.label || deleteTarget.act_type}" v${deleteTarget.version} junto con su template DOCX del almacenamiento. Esta acción no se puede deshacer.`
                        : ""
                }
            />
        </Card>
    );
}
