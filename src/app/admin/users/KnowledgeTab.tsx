"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Upload, Trash2, FileText, LayoutTemplate, Scale, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { getKnowledgeFiles, uploadKnowledgeFile, deleteKnowledgeFile } from "@/app/actions/knowledge";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function KnowledgeTab() {
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const res = await getKnowledgeFiles();
            if (res.success && res.data) {
                setFiles(res.data);
            } else if (res.success) {
                setFiles([]);
            } else {
                toast.error("Error al cargar archivos: " + res.error);
            }
        } catch (err) {
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
    }, []);

    const handleDeleteConfirm = async () => {
        if (!deleteTargetName) return;
        setDeleting(true);
        const res = await deleteKnowledgeFile(deleteTargetName);
        if (res.success) {
            toast.success("Archivo eliminado correctamente");
            loadFiles();
        } else {
            toast.error("Error al eliminar el archivo");
        }
        setDeleting(false);
        setDeleteTargetName(null);
    };

    const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        const file = formData.get('file') as File;
        if (!file || file.size === 0) {
            toast.error("Seleccione un archivo válido");
            return;
        }

        setUploading(true);
        try {
            const res = await uploadKnowledgeFile(formData);
            if (res.success) {
                toast.success(`Archivo "${file.name}" indexado correctamente (${res.chunks} fragmentos)`);
                setIsDialogOpen(false);
                loadFiles();
            } else {
                toast.error(res.error || "Error al subir el archivo");
            }
        } catch (err: any) {
            console.error("Index error:", err);
            toast.error(`Error en el proceso de indexación: ${err.message || 'Error desconocido'}`);
        } finally {
            setUploading(false);
        }
    };

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case 'SYSTEM_TAXONOMY': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><LayoutTemplate size={12} />TAXONOMÍA</Badge>;
            case 'VALIDATION_RULES': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1"><Scale size={12} />REGLAS</Badge>;
            case 'LEGAL_CONTEXT': return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 gap-1"><BookOpen size={12} />CONTEXTO</Badge>;
            default: return <Badge variant="outline">{category}</Badge>;
        }
    };

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <BookOpen className="text-blue-600" />
                        Base de Conocimiento
                    </CardTitle>
                    <CardDescription>
                        Gestiona los documentos que alimentan la inteligencia del asistente notarial (RAG).
                    </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-900 border-slate-700">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir Documento
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleUpload}>
                            <DialogHeader>
                                <DialogTitle>Indexar Nuevo Documento</DialogTitle>
                                <DialogDescription>
                                    El archivo será procesado, fragmentado y convertido en vectores para búsqueda semántica.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Categoría</Label>
                                    <Select name="category" defaultValue="SYSTEM_TAXONOMY">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="SYSTEM_TAXONOMY">Taxonomía del Sistema</SelectItem>
                                            <SelectItem value="VALIDATION_RULES">Reglas de Validación</SelectItem>
                                            <SelectItem value="LEGAL_CONTEXT">Contexto Legal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Archivo (PDF o DOCX)</Label>
                                    <Input
                                        name="file"
                                        type="file"
                                        accept=".pdf,.docx"
                                        required
                                        className="cursor-pointer"
                                    />
                                </div>
                                <div className="flex gap-2 p-3 bg-blue-50 rounded-md text-xs text-blue-700 border border-blue-100 italic">
                                    <Info className="h-4 w-4 shrink-0" />
                                    <span>Se recomienda subir archivos con texto legible. Los DOCX se procesan más rápido que los PDFs con OCR pesado.</span>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={uploading}>
                                    {uploading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Indexando...
                                        </>
                                    ) : "Subir e Indexar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : files.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-lg">
                        <FileText className="mx-auto h-16 w-16 text-slate-200 mb-4" />
                        <h3 className="font-medium text-slate-900 text-lg">No hay documentos indexados</h3>
                        <p className="text-muted-foreground">Sube leyes, manuales o modelos para entrenar al asistente.</p>
                    </div>
                ) : (
                    <div className="rounded-md border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                    <TableHead>Nombre del Archivo</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Vectores</TableHead>
                                    <TableHead>Indexado el</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {files.map((file) => (
                                    <TableRow key={file.name} className="group">
                                        <TableCell className="font-medium max-w-[350px] truncate">
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-slate-400" />
                                                {file.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getCategoryBadge(file.category)}</TableCell>
                                        <TableCell>
                                            <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">
                                                {file.chunks}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-slate-500">
                                            {new Date(file.indexedAt).toLocaleDateString(undefined, {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => setDeleteTargetName(file.name)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <ConfirmDeleteDialog
                open={!!deleteTargetName}
                onOpenChange={(open) => { if (!open) setDeleteTargetName(null); }}
                onConfirm={handleDeleteConfirm}
                loading={deleting}
                description={
                    deleteTargetName
                        ? `Se eliminará "${deleteTargetName}" y todos sus vectores de la base de conocimiento. Esta acción no se puede deshacer.`
                        : ""
                }
            />
        </Card>
    );
}
