"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    MapPin,
    Search,
    Plus,
    Edit,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Map,
    Hash,
    Building2,
    Tag,
    Power,
    PowerOff
} from "lucide-react";
import {
    Jurisdiccion,
    getJurisdicciones,
    getJurisdiccionStats,
    createJurisdiccion,
    updateJurisdiccion,
    deleteJurisdiccion,
    toggleJurisdiccionActive,
    toggleBulkActive
} from "@/app/actions/jurisdicciones";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";

interface JurisdiccionForm {
    jurisdiction_id: string;
    version: string;
    party_name: string;
    party_code: string;
    delegation_code: string;
    aliases: string;
}

const EMPTY_FORM: JurisdiccionForm = {
    jurisdiction_id: "PBA",
    version: "2026_01",
    party_name: "",
    party_code: "",
    delegation_code: "",
    aliases: "",
};

export function JurisdiccionesTab() {
    const [jurisdicciones, setJurisdicciones] = useState<Jurisdiccion[]>([]);
    const [stats, setStats] = useState<{ total: number; activas: number; inactivas: number; provincias: string[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
    const [filterProvincia, setFilterProvincia] = useState<string>("all");

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<Jurisdiccion | null>(null);
    const [form, setForm] = useState<JurisdiccionForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Delete state
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [jRes, sRes] = await Promise.all([
                getJurisdicciones(),
                getJurisdiccionStats()
            ]);
            if (jRes.success && jRes.data) setJurisdicciones(jRes.data);
            if (sRes.success && sRes.data) setStats(sRes.data);
        } catch {
            toast.error("Error al cargar jurisdicciones");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const filtered = useMemo(() => {
        let items = jurisdicciones;
        if (filterActive === "active") items = items.filter(j => j.active);
        if (filterActive === "inactive") items = items.filter(j => !j.active);
        if (filterProvincia !== "all") items = items.filter(j => j.jurisdiction_id === filterProvincia);
        if (search.trim()) {
            const q = search.toLowerCase();
            items = items.filter(j =>
                j.party_name.toLowerCase().includes(q) ||
                j.party_code.includes(q) ||
                j.delegation_code.includes(q) ||
                j.aliases.some(a => a.toLowerCase().includes(q))
            );
        }
        return items;
    }, [jurisdicciones, filterActive, filterProvincia, search]);

    // Group by delegation for stats display
    const delegationCount = useMemo(() => {
        const groups: Record<string, number> = {};
        for (const j of jurisdicciones.filter(j => j.active)) {
            groups[j.delegation_code] = (groups[j.delegation_code] || 0) + 1;
        }
        return Object.keys(groups).length;
    }, [jurisdicciones]);

    const handleNew = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const handleEdit = (j: Jurisdiccion) => {
        setEditTarget(j);
        setForm({
            jurisdiction_id: j.jurisdiction_id,
            version: j.version,
            party_name: j.party_name,
            party_code: j.party_code,
            delegation_code: j.delegation_code,
            aliases: j.aliases.join(", "),
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.party_name || !form.party_code || !form.delegation_code) {
            toast.error("Complete nombre, código de partido y código de delegación");
            return;
        }

        setSaving(true);
        const aliases = form.aliases.split(",").map(a => a.trim()).filter(Boolean);
        const payload = {
            jurisdiction_id: form.jurisdiction_id,
            version: form.version,
            party_name: form.party_name,
            party_code: form.party_code,
            delegation_code: form.delegation_code,
            aliases,
        };

        const res = editTarget
            ? await updateJurisdiccion(editTarget.id, payload)
            : await createJurisdiccion(payload);

        if (res.success) {
            toast.success(editTarget ? "Partido actualizado" : "Partido creado");
            setDialogOpen(false);
            loadData();
        } else {
            toast.error(res.error || "Error al guardar");
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        setDeleting(true);
        const res = await deleteJurisdiccion(deleteTargetId);
        if (res.success) {
            toast.success("Partido eliminado");
            loadData();
        } else {
            toast.error(res.error || "Error al eliminar");
        }
        setDeleting(false);
        setDeleteTargetId(null);
    };

    const handleToggleActive = async (j: Jurisdiccion) => {
        const res = await toggleJurisdiccionActive(j.id, !j.active);
        if (res.success) {
            toast.success(`${j.party_name} ${!j.active ? "activado" : "desactivado"}`);
            loadData();
        } else {
            toast.error(res.error || "Error al cambiar estado");
        }
    };

    const handleBulkToggle = async (jurisdictionId: string, active: boolean) => {
        const res = await toggleBulkActive(jurisdictionId, active);
        if (res.success) {
            toast.success(`${jurisdictionId} ${active ? "activada" : "desactivada"} completa`);
            loadData();
        } else {
            toast.error(res.error || "Error al cambiar estado masivo");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Jurisdicciones</h2>
                    <p className="text-slate-500">Mapeo de partidos a códigos oficiales (ARBA / CESBA)</p>
                </div>
                <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Nuevo Partido
                </Button>
            </div>

            {/* Stats cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                            <div className="text-xs text-slate-500">Partidos Total</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold text-green-600">{stats.activas}</div>
                            <div className="text-xs text-slate-500">Activos</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold text-slate-400">{stats.inactivas}</div>
                            <div className="text-xs text-slate-500">Inactivos</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="text-2xl font-bold text-blue-600">{delegationCount}</div>
                            <div className="text-xs text-slate-500">Delegaciones</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar partido, código, alias..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex gap-1">
                    {(["all", "active", "inactive"] as const).map((f) => (
                        <Button
                            key={f}
                            variant={filterActive === f ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterActive(f)}
                            className={filterActive === f ? "bg-slate-800" : ""}
                        >
                            {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
                        </Button>
                    ))}
                </div>

                {stats && stats.provincias.length > 1 && (
                    <div className="flex gap-1">
                        <Button
                            variant={filterProvincia === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterProvincia("all")}
                            className={filterProvincia === "all" ? "bg-slate-800" : ""}
                        >
                            Todas
                        </Button>
                        {stats.provincias.map((p) => (
                            <Button
                                key={p}
                                variant={filterProvincia === p ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFilterProvincia(p)}
                                className={filterProvincia === p ? "bg-slate-800" : ""}
                            >
                                {p}
                            </Button>
                        ))}
                    </div>
                )}

                {stats && stats.provincias.length > 0 && (
                    <div className="ml-auto flex gap-2">
                        {stats.provincias.map((p) => (
                            <div key={p} className="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600 border-green-200 hover:bg-green-50"
                                    onClick={() => handleBulkToggle(p, true)}
                                    title={`Activar todos los partidos de ${p}`}
                                >
                                    <Power className="mr-1 h-3 w-3" />
                                    {p}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-slate-400 border-slate-200 hover:bg-slate-50"
                                    onClick={() => handleBulkToggle(p, false)}
                                    title={`Desactivar todos los partidos de ${p}`}
                                >
                                    <PowerOff className="mr-1 h-3 w-3" />
                                    {p}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="py-10 text-center text-slate-400">Cargando jurisdicciones...</div>
                    ) : filtered.length === 0 ? (
                        <div className="py-10 text-center">
                            <MapPin className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                            <p className="text-slate-500">
                                {search ? "Sin resultados para la búsqueda" : "No hay partidos registrados"}
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[200px]">Partido</TableHead>
                                    <TableHead className="w-[80px]">Cód. ARBA</TableHead>
                                    <TableHead className="w-[80px]">Deleg. CESBA</TableHead>
                                    <TableHead className="w-[100px]">Provincia</TableHead>
                                    <TableHead>Aliases</TableHead>
                                    <TableHead className="w-[80px]">Estado</TableHead>
                                    <TableHead className="w-[120px] text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((j) => (
                                    <TableRow key={j.id} className={!j.active ? "opacity-50" : ""}>
                                        <TableCell className="font-medium">{j.party_name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono">
                                                {j.party_code}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-mono text-blue-600 border-blue-200">
                                                {j.delegation_code}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">{j.jurisdiction_id}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[300px]">
                                            <span className="text-xs text-slate-500 truncate block">
                                                {j.aliases.slice(0, 3).join(", ")}
                                                {j.aliases.length > 3 && ` (+${j.aliases.length - 3})`}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => handleToggleActive(j)}
                                                className="cursor-pointer"
                                                title={j.active ? "Click para desactivar" : "Click para activar"}
                                            >
                                                {j.active ? (
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200">
                                                        Activo
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 hover:text-slate-600">
                                                        Inactivo
                                                    </Badge>
                                                )}
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-slate-700"
                                                    onClick={() => handleEdit(j)}
                                                    title="Editar"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                                    onClick={() => setDeleteTargetId(j.id)}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="text-xs text-slate-400 text-right">
                Mostrando {filtered.length} de {jurisdicciones.length} partidos
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? "Editar Partido" : "Nuevo Partido"}</DialogTitle>
                        <DialogDescription>
                            {editTarget
                                ? "Modifique los datos del partido jurisdiccional."
                                : "Agregue un nuevo partido al mapa de jurisdicciones."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="j-prov">Provincia</Label>
                                <Input
                                    id="j-prov"
                                    value={form.jurisdiction_id}
                                    onChange={(e) => setForm({ ...form, jurisdiction_id: e.target.value.toUpperCase() })}
                                    placeholder="PBA"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="j-version">Versión</Label>
                                <Input
                                    id="j-version"
                                    value={form.version}
                                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                                    placeholder="2026_01"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="j-name">Nombre del Partido</Label>
                            <Input
                                id="j-name"
                                value={form.party_name}
                                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                                placeholder="Ej: Bahía Blanca"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="j-code">Código ARBA (partido)</Label>
                                <Input
                                    id="j-code"
                                    value={form.party_code}
                                    onChange={(e) => setForm({ ...form, party_code: e.target.value })}
                                    placeholder="007"
                                    className="font-mono"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="j-deleg">Código Delegación CESBA</Label>
                                <Input
                                    id="j-deleg"
                                    value={form.delegation_code}
                                    onChange={(e) => setForm({ ...form, delegation_code: e.target.value })}
                                    placeholder="007"
                                    className="font-mono"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="j-aliases">Aliases (separados por coma)</Label>
                            <Input
                                id="j-aliases"
                                value={form.aliases}
                                onChange={(e) => setForm({ ...form, aliases: e.target.value })}
                                placeholder="bahia blanca, bahía blanca, b. blanca"
                            />
                            <p className="text-xs text-slate-400">
                                Variantes de nombre para matching automático (sin tildes, abreviaturas, etc.)
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Guardando..." : editTarget ? "Guardar Cambios" : "Crear Partido"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDeleteDialog
                open={!!deleteTargetId}
                onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
                onConfirm={handleDelete}
                loading={deleting}
                description="Se eliminará este partido del mapa de jurisdicciones. Esta acción no se puede deshacer."
            />
        </div>
    );
}
