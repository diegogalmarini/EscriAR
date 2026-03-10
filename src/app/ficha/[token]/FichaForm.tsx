"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { submitFichaData } from "@/app/actions/fichas";
import { toast } from "sonner";
import { FileText, User, MapPin, Phone, Mail, CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { isValidCUIT, cn } from "@/lib/utils";

export function FichaForm({ tokenData }: { tokenData: any }) {
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [cuitError, setCuitError] = useState(false);

    const persona = tokenData.personas;

    // Calculate remaining days
    const expiresAt = new Date(tokenData.expires_at);
    const today = new Date();
    const diffTime = expiresAt.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isLastDays = diffDays <= 5;

    const [formData, setFormData] = useState({
        nombre_completo: persona.nombre_completo || "",
        dni: (persona.dni?.startsWith("SIN-DNI-") ? "" : persona.dni) || "",
        cuit: persona.cuit || "",
        nacionalidad: persona.nacionalidad || "Argentina",
        fecha_nacimiento: persona.fecha_nacimiento || "",
        domicilio: persona.domicilio_real?.literal || "",
        nombres_padres: persona.nombres_padres || "",
        estado_civil: persona.estado_civil_detalle || "",
        nombre_conyuge: persona.datos_conyuge?.nombre_completo || persona.datos_conyuge?.nombre || "",
        email: persona.contacto?.email || "",
        telefono: persona.contacto?.telefono || "",
        profesion: persona.profesion || "",
        regimen_patrimonial: persona.regimen_patrimonial || "",
        nro_documento_conyugal: persona.nro_documento_conyugal || "",
    });

    // Check if married for conditional fields
    const isCasado = formData.estado_civil.toLowerCase().includes("casad");
    const isSoltero = formData.estado_civil.toLowerCase().includes("solter");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // CUIT Validation
        if (formData.cuit && formData.dni) {
            if (!isValidCUIT(formData.cuit, formData.dni)) {
                setCuitError(true);
                toast.error("El CUIT/CUIL no coincide con el DNI o no es válido");
                return;
            }
        } else if (formData.cuit && !formData.dni) {
            if (!isValidCUIT(formData.cuit)) {
                setCuitError(true);
                toast.error("El CUIT/CUIL ingresado no es válido");
                return;
            }
        }

        setCuitError(false);
        setLoading(true);

        const res = await submitFichaData(tokenData.id, persona.dni, formData);

        setLoading(false);
        if (res.success) {
            setSubmitted(true);
            toast.success("¡Datos enviados correctamente!");
        } else {
            toast.error(res.error || "Error al enviar los datos");
        }
    };

    if (submitted) {
        return (
            <Card className="max-w-md mx-auto mt-12 text-center p-8 border-t-4 border-t-green-500">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500 mb-4" />
                <CardTitle className="text-2xl mb-2">¡Muchas Gracias!</CardTitle>
                <CardDescription className="text-lg">
                    Tus datos han sido recibidos correctamente por el sistema EscriAR.
                    Ya puedes cerrar esta ventana.
                </CardDescription>
            </Card>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center p-3 bg-slate-100 rounded-full mb-4">
                    <FileText className="h-8 w-8 text-slate-600" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">Ficha de Datos Personales</h1>
                <p className="text-slate-500 mt-2">Por favor, completa o verifica tus datos para la confección del trámite.</p>

                {/* Countdown */}
                <div className={cn(
                    "mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border",
                    isLastDays
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                    <Calendar size={16} />
                    <span>Tienes {diffDays} {diffDays === 1 ? 'día' : 'días'} para completar tu ficha</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-slate-400" />
                            <CardTitle className="text-lg font-bold text-slate-800">Identificación y Datos Personales</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nombre">Nombre</Label>
                                <Input
                                    id="nombre"
                                    required
                                    value={formData.nombre_completo.split(" ").slice(0, -1).join(" ")}
                                    onChange={e => {
                                        const apellido = formData.nombre_completo.split(" ").slice(-1).join(" ");
                                        setFormData({ ...formData, nombre_completo: e.target.value + " " + apellido })
                                    }}
                                    placeholder="Nombres"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellido">Apellido</Label>
                                <Input
                                    id="apellido"
                                    required
                                    value={formData.nombre_completo.split(" ").slice(-1)[0]}
                                    onChange={e => {
                                        const nombre = formData.nombre_completo.split(" ").slice(0, -1).join(" ");
                                        setFormData({ ...formData, nombre_completo: nombre + " " + e.target.value })
                                    }}
                                    placeholder="Apellidos"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="dni">DNI</Label>
                                <Input
                                    id="dni"
                                    required
                                    value={formData.dni}
                                    onChange={e => setFormData({ ...formData, dni: e.target.value })}
                                    placeholder="Ej: 27841387"
                                    className="font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cuit" className={cn(cuitError ? "text-red-500 font-semibold" : "text-slate-700 font-medium")}>
                                    {cuitError && <AlertCircle size={12} className="inline mr-1" />}
                                    CUIT / CUIL
                                </Label>
                                <Input
                                    id="cuit"
                                    required
                                    value={formData.cuit}
                                    onChange={e => {
                                        setFormData({ ...formData, cuit: e.target.value });
                                        if (cuitError) setCuitError(false);
                                    }}
                                    placeholder="Ej: 27-27841387-5"
                                    className={cn("font-mono", cuitError ? "border-red-500 focus-visible:ring-red-500" : "border-slate-200")}
                                />
                                {cuitError && <p className="text-[10px] text-red-500 font-medium ml-1">El CUIT ingresado no es válido. Por favor, revísalo.</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nac">Nacionalidad</Label>
                                <Input
                                    id="nac"
                                    required
                                    value={formData.nacionalidad}
                                    onChange={e => setFormData({ ...formData, nacionalidad: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birth">Fecha de Nacimiento</Label>
                                <Input
                                    id="birth"
                                    type="date"
                                    required
                                    value={formData.fecha_nacimiento}
                                    onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="civil">Estado Civil</Label>
                            <Input
                                id="civil"
                                required
                                placeholder="Ej: Soltero/a, Casado/a, Divorciado/a, Viudo/a"
                                value={formData.estado_civil}
                                onChange={e => setFormData({ ...formData, estado_civil: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="profesion">Profesión / Ocupación</Label>
                            <Input
                                id="profesion"
                                required
                                placeholder="Ej: Comerciante, Empleada, Ingeniero, Ama de casa"
                                value={formData.profesion}
                                onChange={e => setFormData({ ...formData, profesion: e.target.value })}
                            />
                        </div>

                        {isCasado && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 p-4 bg-amber-50/50 border border-amber-200 rounded-lg">
                                <div className="space-y-2">
                                    <Label htmlFor="conyuge" className="font-medium text-slate-700">
                                        Nombre del Cónyuge <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="conyuge"
                                        required={isCasado}
                                        placeholder="Nombre completo de su cónyuge"
                                        value={formData.nombre_conyuge}
                                        onChange={e => setFormData({ ...formData, nombre_conyuge: e.target.value })}
                                        className="border-amber-200 focus-visible:ring-amber-400"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="dni_conyuge" className="font-medium text-slate-700">
                                            DNI del Cónyuge <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="dni_conyuge"
                                            required={isCasado}
                                            placeholder="Ej: 27841387"
                                            value={formData.nro_documento_conyugal}
                                            onChange={e => setFormData({ ...formData, nro_documento_conyugal: e.target.value })}
                                            className="font-mono border-amber-200 focus-visible:ring-amber-400"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="regimen" className="font-medium text-slate-700">
                                            Régimen Patrimonial <span className="text-red-500">*</span>
                                        </Label>
                                        <select
                                            id="regimen"
                                            required={isCasado}
                                            value={formData.regimen_patrimonial}
                                            onChange={e => setFormData({ ...formData, regimen_patrimonial: e.target.value })}
                                            className="flex h-9 w-full rounded-md border border-amber-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                                        >
                                            <option value="">Seleccionar...</option>
                                            <option value="COMUNIDAD">Comunidad de Ganancias</option>
                                            <option value="SEPARACION_BIENES">Separación de Bienes</option>
                                        </select>
                                        <p className="text-[10px] text-amber-600">Si no sabe, probablemente sea "Comunidad de Ganancias" (régimen supletorio).</p>
                                    </div>
                                </div>
                                <p className="text-[10px] text-amber-600">Datos obligatorios para personas casadas.</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="padres" className="font-medium text-slate-700">
                                Nombres de los Padres (Filiación) {isSoltero && <span className="text-red-500">*</span>}
                            </Label>
                            <Input
                                id="padres"
                                required={isSoltero}
                                placeholder="Nombres completos de Padre y Madre"
                                value={formData.nombres_padres}
                                onChange={e => setFormData({ ...formData, nombres_padres: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400">Obligatorio si su estado civil es soltero/a.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-slate-400" />
                            <CardTitle className="text-lg font-bold text-slate-800">Domicilio y Contacto</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-6">
                        <div className="space-y-2">
                            <Label htmlFor="dom">Domicilio Real</Label>
                            <Input
                                id="dom"
                                required
                                value={formData.domicilio}
                                onChange={e => setFormData({ ...formData, domicilio: e.target.value })}
                                placeholder="Calle, número, localidad"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tel" className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> Teléfono
                                </Label>
                                <Input
                                    id="tel"
                                    required
                                    type="tel"
                                    value={formData.telefono}
                                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                                    placeholder="Ej: 291 1234567"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mail" className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> Correo Electrónico
                                </Label>
                                <Input
                                    id="mail"
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="nombre@ejemplo.com"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="pb-12">
                    <Button type="submit" className="w-full h-12 text-base font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all" disabled={loading}>
                        {loading ? "Enviando..." : "Confirmar y Enviar Datos"}
                    </Button>
                </div>
            </form>
        </div>
    );
}
