"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardList, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import catalogData from "@/data/catalogo_tramites_notariales.json";

interface Tramite {
    id: string;
    categoria: string;
    nombre: string;
    descripcion: string;
    jurisdiccion: "PBA" | "CABA" | "AMBAS" | "NACIONAL";
    url: string;
    url_label: string;
    costo_2026: string | number | null;
    nota: string | null;
}

interface Categoria {
    id: string;
    nombre: string;
    icono: string;
    fase: string;
    orden: number;
}

const FASE_LABELS: Record<string, { label: string; color: string }> = {
    PREVIO: { label: "Previo", color: "bg-slate-100 text-slate-700" },
    PRE: { label: "Pre-escriturario", color: "bg-blue-100 text-blue-700" },
    ESCRITURARIO: { label: "Escriturario", color: "bg-amber-100 text-amber-700" },
    POST: { label: "Post-escriturario", color: "bg-green-100 text-green-700" },
    INFO: { label: "Informativo", color: "bg-red-100 text-red-600" },
};

const JURISDICCION_COLORS: Record<string, string> = {
    PBA: "bg-violet-100 text-violet-700 border-violet-200",
    CABA: "bg-sky-100 text-sky-700 border-sky-200",
    AMBAS: "bg-slate-100 text-slate-600 border-slate-200",
    NACIONAL: "bg-orange-100 text-orange-700 border-orange-200",
};

export default function GuiaTramitesPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [jurisdiccionFilter, setJurisdiccionFilter] = useState("TODAS");
    const [faseFilter, setFaseFilter] = useState("TODAS");
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    const categorias = catalogData.categorias as Categoria[];
    const tramites = catalogData.tramites as Tramite[];

    const filteredTramites = useMemo(() => {
        return tramites.filter((t) => {
            if (jurisdiccionFilter !== "TODAS" && t.jurisdiccion !== jurisdiccionFilter) return false;
            const cat = categorias.find((c) => c.id === t.categoria);
            if (faseFilter !== "TODAS" && cat?.fase !== faseFilter) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                return (
                    t.nombre.toLowerCase().includes(term) ||
                    t.descripcion.toLowerCase().includes(term) ||
                    t.url_label.toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [tramites, categorias, searchTerm, jurisdiccionFilter, faseFilter]);

    const groupedByCategory = useMemo(() => {
        const groups: Record<string, Tramite[]> = {};
        for (const t of filteredTramites) {
            if (!groups[t.categoria]) groups[t.categoria] = [];
            groups[t.categoria].push(t);
        }
        return groups;
    }, [filteredTramites]);

    const sortedCategories = useMemo(() => {
        return categorias
            .filter((c) => groupedByCategory[c.id])
            .sort((a, b) => a.orden - b.orden);
    }, [categorias, groupedByCategory]);

    const toggleCat = (catId: string) => {
        setExpandedCats((prev) => {
            const next = new Set(prev);
            if (next.has(catId)) next.delete(catId);
            else next.add(catId);
            return next;
        });
    };

    const expandAll = () => setExpandedCats(new Set(sortedCategories.map((c) => c.id)));
    const collapseAll = () => setExpandedCats(new Set());

    const fases = [...new Set(categorias.map((c) => c.fase))];
    const jurisdicciones = [...new Set(tramites.map((t) => t.jurisdiccion))];

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <ClipboardList className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Guía de Trámites Notariales</h1>
                        <p className="text-sm text-slate-500">
                            PBA y CABA — Valores desde {catalogData.metadata.valores_desde}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                        {filteredTramites.length} de {tramites.length} trámites
                    </Badge>
                    <button onClick={expandAll} className="text-xs text-blue-600 hover:underline">
                        Expandir todo
                    </button>
                    <span className="text-slate-300">|</span>
                    <button onClick={collapseAll} className="text-xs text-blue-600 hover:underline">
                        Colapsar todo
                    </button>
                </div>
            </div>

            {/* Search + Filters */}
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-6 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Buscar trámite, certificado u organismo..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setExpandedCats(new Set(sortedCategories.map((c) => c.id))); }}
                            className="pl-10 h-11 text-base"
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Jurisdicción:</span>
                            <Select value={jurisdiccionFilter} onValueChange={setJurisdiccionFilter}>
                                <SelectTrigger className="h-8 w-[130px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TODAS">Todas</SelectItem>
                                    {jurisdicciones.map((j) => (
                                        <SelectItem key={j} value={j}>{j}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Fase:</span>
                            <Select value={faseFilter} onValueChange={setFaseFilter}>
                                <SelectTrigger className="h-8 w-[170px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TODAS">Todas las fases</SelectItem>
                                    {fases.map((f) => (
                                        <SelectItem key={f} value={f}>{FASE_LABELS[f]?.label ?? f}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400">
                        {filteredTramites.length} {filteredTramites.length === 1 ? "resultado" : "resultados"}
                        {searchTerm && ` para "${searchTerm}"`}
                    </p>
                </CardContent>
            </Card>

            {/* Categories accordion */}
            <div className="space-y-3">
                {sortedCategories.map((cat) => {
                    const isExpanded = expandedCats.has(cat.id);
                    const catTramites = groupedByCategory[cat.id] || [];
                    const faseStyle = FASE_LABELS[cat.fase] || FASE_LABELS.INFO;

                    return (
                        <Card key={cat.id} className="border-slate-200 shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleCat(cat.id)}
                                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                                )}
                                <span className="text-lg">{cat.icono}</span>
                                <span className="font-semibold text-slate-800 flex-1">{cat.nombre}</span>
                                <Badge variant="secondary" className={`text-[10px] ${faseStyle.color}`}>
                                    {faseStyle.label}
                                </Badge>
                                <span className="text-xs text-slate-400">{catTramites.length}</span>
                            </button>

                            {isExpanded && (
                                <div className="border-t divide-y divide-slate-100">
                                    {catTramites.map((t) => (
                                        <div key={t.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-slate-800">{t.nombre}</span>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${JURISDICCION_COLORS[t.jurisdiccion] || ""}`}
                                                        >
                                                            {t.jurisdiccion}
                                                        </Badge>
                                                        {t.costo_2026 && (
                                                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                {typeof t.costo_2026 === "number"
                                                                    ? `$ ${new Intl.NumberFormat("es-AR").format(t.costo_2026)}`
                                                                    : t.costo_2026}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-slate-500 mt-1">{t.descripcion}</p>
                                                    {t.nota && (
                                                        <p className="text-xs text-slate-400 italic mt-1">{t.nota}</p>
                                                    )}
                                                </div>
                                                {t.url && (
                                                    <a
                                                        href={t.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        {t.url_label}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            {filteredTramites.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <ClipboardList className="mx-auto h-10 w-10 opacity-30 mb-3" />
                    <p>No se encontraron trámites con ese criterio.</p>
                </div>
            )}

            {/* Footer */}
            <p className="text-xs text-slate-400 text-center">
                {catalogData.metadata.nota}
            </p>
        </div>
    );
}
