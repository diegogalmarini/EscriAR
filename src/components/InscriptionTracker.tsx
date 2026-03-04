"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, Copy, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { markAsSigned, updateRegistryStatus } from "@/app/actions/inscription";
import { formatPersonName } from "@/lib/utils/normalization";
import { toast } from "sonner";

export function InscriptionTracker({ data }: { data: any }) {
    const [fechaFirma, setFechaFirma] = useState(data?.fecha_firma_real || "");
    const [estado, setEstado] = useState(data?.estado_inscripcion || "PENDIENTE");
    const [nroEntrada, setNroEntrada] = useState(data?.nro_entrada_registro || "");
    const [isUpdating, setIsUpdating] = useState(false);
    const router = useRouter();

    const handleMarkAsSigned = async () => {
        if (!fechaFirma) {
            toast.error("Ingrese la fecha de firma");
            return;
        }

        setIsUpdating(true);
        const res = await markAsSigned(data.id, fechaFirma);
        setIsUpdating(false);

        if (res.success) {
            toast.success(`Firmada. Vencimiento: ${res.vencimiento}`);
            setTimeout(() => router.refresh(), 1000);
        } else {
            toast.error(res.error || "Error al marcar como firmada");
        }
    };

    const handleUpdateStatus = async () => {
        setIsUpdating(true);
        const res = await updateRegistryStatus(data.id, estado, nroEntrada);
        setIsUpdating(false);

        if (res.success) {
            toast.success("Estado actualizado");
            setTimeout(() => router.refresh(), 1000);
        } else {
            toast.error(res.error || "Error al actualizar estado");
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado`);
    };

    // Calculate status badge
    const getStatusBadge = () => {
        if (!data?.estado_inscripcion) return null;

        const statusConfig: any = {
            PENDIENTE: { label: "Pendiente", variant: "outline", icon: Clock, color: "text-slate-600" },
            INGRESADA: { label: "Ingresada", variant: "outline", icon: Clock, color: "text-blue-600" },
            OBSERVADA: { label: "Observada", variant: "outline", icon: AlertTriangle, color: "text-amber-600" },
            INSCRIPTA: { label: "Inscripta", variant: "outline", icon: CheckCircle2, color: "text-green-600" },
            RETIRADA: { label: "Retirada", variant: "outline", icon: CheckCircle2, color: "text-slate-500" }
        };

        const config = statusConfig[data.estado_inscripcion] || statusConfig.PENDIENTE;
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className={`${config.color} border-current`}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Management Form */}
            <Card>
                <CardHeader className="border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Gestión de Inscripción</CardTitle>
                            <CardDescription>Control de plazos y estados</CardDescription>
                        </div>
                        {getStatusBadge()}
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Signature Date */}
                    <div className="space-y-2">
                        <Label htmlFor="fechaFirma" className="text-sm font-semibold">
                            Fecha de Firma
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="fechaFirma"
                                type="date"
                                value={fechaFirma}
                                onChange={(e) => setFechaFirma(e.target.value)}
                                disabled={!!data?.fecha_firma_real}
                            />
                            {!data?.fecha_firma_real && (
                                <Button onClick={handleMarkAsSigned} disabled={isUpdating}>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Firmar
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Expiration Info */}
                    {data?.fecha_vencimiento_inscripcion && (
                        <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-blue-700" />
                                <span className="font-semibold text-sm text-blue-900">Vencimiento de Inscripción</span>
                            </div>
                            <p className="text-lg font-bold text-blue-700">
                                {new Date(data.fecha_vencimiento_inscripcion).toLocaleDateString('es-AR')}
                            </p>
                            <p className="text-xs text-blue-600 mt-1">45 días corridos desde la firma</p>
                        </div>
                    )}

                    {/* Registry Status */}
                    <div className="space-y-2">
                        <Label htmlFor="estado" className="text-sm font-semibold">
                            Estado de Inscripción
                        </Label>
                        <Select value={estado} onValueChange={setEstado}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                                <SelectItem value="INGRESADA">Ingresada</SelectItem>
                                <SelectItem value="OBSERVADA">Observada</SelectItem>
                                <SelectItem value="INSCRIPTA">Inscripta</SelectItem>
                                <SelectItem value="RETIRADA">Retirada</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Entry Number */}
                    <div className="space-y-2">
                        <Label htmlFor="nroEntrada" className="text-sm font-semibold">
                            Número de Entrada
                        </Label>
                        <Input
                            id="nroEntrada"
                            placeholder="Ej: 2024-001234"
                            value={nroEntrada}
                            onChange={(e) => setNroEntrada(e.target.value)}
                        />
                    </div>

                    {/* Update Button */}
                    <Button
                        onClick={handleUpdateStatus}
                        disabled={isUpdating || !data?.fecha_firma_real}
                        className="w-full"
                    >
                        Actualizar Estado
                    </Button>
                </CardContent>
            </Card>

            {/* Click-to-Copy Data Card */}
            <Card>
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle className="text-lg">Datos para el Registro</CardTitle>
                    <CardDescription>Click para copiar al portapapeles</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {/* Property Data */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-slate-600 uppercase tracking-wider">Inmueble</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => copyToClipboard(data.inmuebles?.partido_id || "", "Partido")}>
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Partido</span>
                                    <span className="font-medium">{data.inmuebles?.partido_id || "N/A"}</span>
                                </div>
                                <Copy className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                                onClick={() => copyToClipboard(data.inmuebles?.nro_partida || "", "Nro. Partida")}>
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">Nro. Partida</span>
                                    <span className="font-medium">{data.inmuebles?.nro_partida || "N/A"}</span>
                                </div>
                                <Copy className="h-4 w-4 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Parties Data */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-slate-600 uppercase tracking-wider">Partes</h3>
                        <div className="space-y-2">
                            {data.operaciones?.[0]?.participantes_operacion?.map((p: any, idx: number) => (
                                <div key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => copyToClipboard(
                                        `${p.personas.nombre_completo} - CUIL: ${p.persona_id}`,
                                        "Participante"
                                    )}>
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground">{p.rol}</span>
                                        <span className="font-medium">{formatPersonName(p.personas.nombre_completo)}</span>
                                        <span className="text-xs text-slate-500">CUIL: {p.persona_id}</span>
                                    </div>
                                    <Copy className="h-4 w-4 text-slate-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
