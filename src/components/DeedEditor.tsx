"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Wand2, Save, Copy, Loader2, FileDown, FileText, Award } from "lucide-react";
import { generateDeedDraft, saveDeedDraft } from "@/app/actions/draft";
import { getEscribanos, Escribano } from "@/app/actions/escribanos";
import { exportToDocx } from "@/lib/utils/export";
import { formatCUIT, formatPersonName } from "@/lib/utils/normalization";
import { toast } from "sonner";

interface DeedEditorProps {
    escrituraId: string;
    initialContent?: string;
    dataSummary: any;
}

export function DeedEditor({ escrituraId, initialContent, dataSummary }: DeedEditorProps) {
    const [content, setContent] = useState(initialContent || "");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [escribanos, setEscribanos] = useState<Escribano[]>([]);
    const [selectedEscribano, setSelectedEscribano] = useState<string>("");

    useEffect(() => {
        const loadEscribanos = async () => {
            const res = await getEscribanos();
            if (res.success && res.data) {
                setEscribanos(res.data);
                // Pre-select default
                const defaultEsc = res.data.find((e: Escribano) => e.is_default);
                if (defaultEsc) {
                    setSelectedEscribano(defaultEsc.id);
                }
            }
        };
        loadEscribanos();
    }, []);

    const handleGenerate = async () => {
        setIsGenerating(true);
        const res = await generateDeedDraft(escrituraId, selectedEscribano);
        setIsGenerating(false);

        if (res.success && res.draft) {
            setContent(res.draft);
            toast.success("Borrador generado con éxito con el escribano seleccionado");
        } else {
            toast.error(res.error || "Error al generar el borrador");
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await saveDeedDraft(escrituraId, content);
        setIsSaving(false);

        if (res.success) {
            toast.success("Borrador guardado");
        } else {
            toast.error(res.error || "Error al guardar");
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        toast.success("Copiado al portapapeles");
    };

    const handleExportDocx = async () => {
        if (!content) return toast.error("No hay contenido para exportar");

        await exportToDocx("Borrador_Escritura", content);
        toast.success("Archivo Word generado");

        toast("Archivo descargado", {
            description: "¿Deseas marcar la carpeta como 'PARA FIRMA'?",
            action: {
                label: "Mira la barra de estados",
                onClick: () => { },
            },
        });
    };

    const handlePrintPdf = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full space-y-4">
            <div className="flex flex-wrap justify-between items-center bg-background py-3 border-b sticky top-0 z-10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200">
                        <Award size={16} className="text-slate-600" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Escribano Autorizante:</span>
                        <Select value={selectedEscribano} onValueChange={setSelectedEscribano}>
                            <SelectTrigger className="h-8 w-[220px] bg-white border-slate-300 text-xs font-semibold">
                                <SelectValue placeholder="Seleccionar escribano..." />
                            </SelectTrigger>
                            <SelectContent>
                                {escribanos.map((esc) => (
                                    <SelectItem key={esc.id} value={esc.id} className="text-xs font-medium">
                                        {esc.nombre_completo} ({esc.caracter})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="default"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-4"
                    >
                        {isGenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Wand2 className="mr-2 h-4 w-4" />
                        )}
                        {isGenerating ? "Redactando..." : "Generar con IA"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="shadow-sm h-9">
                        <Save className="mr-2 h-4 w-4" />
                        Descanso Borrador
                    </Button>

                    <div className="h-6 w-[1px] bg-slate-200 mx-1" />

                    <Button variant="ghost" size="sm" className="text-xs h-9" onClick={handleCopy}>
                        <Copy className="mr-2 h-3 w-3" />
                        Copiar
                    </Button>
                    <Button variant="secondary" size="sm" className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 h-9" onClick={handleExportDocx}>
                        <FileDown className="mr-2 h-3 w-3" />
                        Word
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-9" onClick={handlePrintPdf}>
                        <FileText className="mr-2 h-3 w-3" />
                        Vista Previa
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
                {/* Left: Data Summary */}
                <div className="lg:col-span-3 space-y-4 overflow-y-auto pr-2 custom-scrollbar max-h-[calc(100vh-320px)]">
                    <Card className="bg-slate-50/50 border-slate-200 shadow-none">
                        <CardHeader className="p-4 border-b bg-white">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-400" />
                                Datos de Referencia
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4 text-[11px]">
                            <div className="space-y-1">
                                <p className="font-bold text-indigo-700 uppercase tracking-tighter text-[10px]">Inmueble</p>
                                <p className="text-slate-900 leading-tight font-semibold">
                                    {dataSummary.inmuebles?.direccion_completa ||
                                        dataSummary.inmuebles?.nomenclatura ||
                                        (dataSummary.inmuebles?.partido_id ? `${dataSummary.inmuebles.partido_id}` : "No vinculado")}
                                </p>
                                <p className="text-slate-500">
                                    Partida: {dataSummary.inmuebles?.nro_partida || "N/A"}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="font-bold text-indigo-700 uppercase tracking-tighter text-[10px]">Participantes</p>
                                    <Badge variant="secondary" className="text-[9px] cursor-pointer hover:bg-slate-200" onClick={() => window.location.hash = "mesa"}>
                                        + Agregar
                                    </Badge>
                                </div>
                                {dataSummary.operaciones?.[0]?.participantes_operacion?.map((p: any) => {
                                    const person = p.persona || p.personas;
                                    if (!person) return null;

                                    return (
                                        <div key={p.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1.5">
                                            <p className="font-bold text-slate-900">{formatPersonName(person.nombre_completo)}</p>
                                            <div className="flex justify-between items-center">
                                                <Badge variant="outline" className="text-[9px] py-0 px-1 bg-indigo-50 text-indigo-700 border-indigo-100">{p.rol}</Badge>
                                                <span className="text-[9px] font-mono text-slate-400">{person.tax_id || p.persona_id}</span>
                                            </div>
                                            <div className="text-[10px] space-y-1 pt-1 border-t mt-1 border-slate-100 text-slate-600">
                                                <p className="flex items-start gap-1"><span className="text-indigo-500">📍</span> <span>{person.domicilio_real?.literal || "No consta"}</span></p>
                                                <p className="flex items-start gap-1"><span className="text-indigo-500">💍</span> <span>{person.estado_civil_detalle || person.estado_civil_detallado?.estado || "Civil pendiente"}</span></p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 italic text-[10px] text-amber-800 leading-relaxed">
                                💡 Verifique que el escribano seleccionado coincida con quien autorizará el acto antes de generar con IA.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Rich Editor */}
                <div className="lg:col-span-9 flex flex-col h-full overflow-hidden">
                    <Card className="flex-1 shadow-sm border border-slate-200 bg-white overflow-hidden flex flex-col rounded-xl">
                        <Textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="flex-1 w-full p-12 font-serif text-[1.1rem] leading-[2] focus-visible:ring-0 border-none resize-none overflow-y-auto"
                            placeholder="El borrador redactado por la IA aparecerá aquí..."
                        />
                    </Card>
                    <div className="flex justify-between items-center mt-2 px-2">
                        <p className="text-[10px] text-slate-400 italic">
                            Modelo: Gemini Flash • Edición en tiempo real habilitada
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                            EscriAR Redactor v2
                        </p>
                    </div>
                </div>
            </div>
        </div >
    );
}
