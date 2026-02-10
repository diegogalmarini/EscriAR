"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { upsertPerson } from "@/app/actions/carpeta";
import { updatePersona } from "@/app/actions/personas";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn, formatDateInstructions } from "@/lib/utils";
import { formatCUIT, formatPersonName, toTitleCase } from "@/lib/utils/normalization";

interface PersonFormProps {
    initialData?: any;
    onSuccess: (person: any) => void;
    onCancel: () => void;
}

export function PersonForm({ initialData, onSuccess, onCancel }: PersonFormProps) {
    const [loading, setLoading] = useState(false);
    const [tipoPersona, setTipoPersona] = useState(
        initialData?.tipo_persona === 'JURIDICA' ||
            ['30', '33', '34'].some((p: string) => initialData?.cuit?.startsWith(p))
            ? 'JURIDICA' : 'FISICA'
    );

    // State split for better UX
    const [nameParts, setNameParts] = useState(() => {
        const full = initialData?.nombre_completo || "";

        // Handle "SURNAME, Name" format
        if (full.includes(",")) {
            const [last, ...firstParts] = full.split(",").map((s: string) => s.trim());
            return {
                nombre: firstParts.join(", "),
                apellido: last.toUpperCase()
            };
        }

        const parts = full.trim().split(/\s+/);

        // Improved Heuristic: Check for uppercase words (surnames)
        const upperParts = parts.filter((p: string) => p.length > 1 && p === p.toUpperCase() && /^[A-ZÑÁÉÍÓÚ]+$/.test(p));

        if (upperParts.length > 0 && upperParts.length < parts.length) {
            // "Ramsés Antonio CASTILLO MARACAY"
            const surnames = upperParts.join(" ");
            const names = parts.filter((p: string) => !upperParts.includes(p)).join(" ");
            return {
                nombre: names,
                apellido: surnames.toUpperCase()
            };
        }

        if (parts.length >= 2) {
            const last = parts.pop();
            return { nombre: parts.join(" "), apellido: (last || "").toUpperCase() };
        }
        return { nombre: full, apellido: "" };
    });

    const [formData, setFormData] = useState({
        nombre_completo: initialData?.nombre_completo || "",
        dni: initialData?.dni || "",
        // Critical: Do NOT autofill CUIT from DNI unless explicitly same
        cuit: formatCUIT(initialData?.cuit_cuil || initialData?.cuit || ""),
        nacionalidad: initialData?.nacionalidad || "",
        fecha_nacimiento: initialData?.fecha_nacimiento ? new Date(initialData.fecha_nacimiento).toISOString().split('T')[0] : "",
        domicilio_real: initialData?.domicilio_real?.literal || initialData?.domicilio_real || "",
        estado: initialData?.estado_civil_detalle || initialData?.estado_civil_detallado?.estado || initialData?.estado_civil || "",
        padres: initialData?.nombres_padres || initialData?.estado_civil_detallado?.padres || "",
        conyuge: (initialData?.datos_conyuge?.nombre || initialData?.datos_conyuge?.nombre_completo || initialData?.estado_civil_detallado?.conyuge || initialData?.conyuge?.nombre)
            ? formatPersonName(initialData?.datos_conyuge?.nombre || initialData?.datos_conyuge?.nombre_completo || initialData?.estado_civil_detallado?.conyuge || initialData?.conyuge?.nombre)
            : "",
        email: initialData?.contacto?.email || "",
        telefono: initialData?.contacto?.telefono || "",
        cuit_tipo: initialData?.cuit_tipo || 'CUIT',
        cuit_is_formal: initialData?.cuit_is_formal ?? true,
    });

    // Update full name on parts change
    useEffect(() => {
        if (tipoPersona === 'FISICA') {
            const apellidoUpper = (nameParts.apellido || "").toUpperCase();
            const nombreTitle = toTitleCase(nameParts.nombre || "") || "";
            const tempFull = nombreTitle ? `${nombreTitle} ${apellidoUpper}` : apellidoUpper;
            if (formData.nombre_completo !== tempFull) {
                setFormData(prev => ({
                    ...prev,
                    nombre_completo: tempFull
                }));
            }
        }
    }, [nameParts, tipoPersona, formData.nombre_completo]);

    // Auto-switch type based on CUIT input
    const handleCuitChange = (val: string) => {
        const cleanVal = val.replace(/\D/g, '');
        const formatted = formatCUIT(val) || "";

        setFormData(prev => ({ ...prev, cuit: formatted }));

        // Only switch if explicit entity prefix found
        if (['30', '33', '34'].some(p => cleanVal.startsWith(p))) {
            setTipoPersona('JURIDICA');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalData = { ...formData };
            // Sanitization
            if (tipoPersona === 'JURIDICA') {
                finalData.dni = ""; // Entities don't have DNI
                finalData.nacionalidad = "";
                finalData.estado = "";
                finalData.conyuge = "";
                finalData.padres = "";
            }

            // Allow manual override for DNI vs CUIT
            // User complained they were same. Now inputs are distinct.

            const payloadCommon = {
                nombre_completo: finalData.nombre_completo,
                cuit: finalData.cuit,
                domicilio_real: { literal: finalData.domicilio_real },
                contacto: { email: finalData.email, telefono: finalData.telefono },
                tipo_persona: tipoPersona
            };

            const targetId = initialData?.id || initialData?.dni || initialData?.cuit; // More robust ID target extraction

            if (initialData) {
                const updatePayload: any = {
                    ...payloadCommon,
                    domicilio: finalData.domicilio_real,
                    dni: finalData.dni
                };
                if (tipoPersona === 'FISICA') {
                    updatePayload.nacionalidad = finalData.nacionalidad;
                    updatePayload.fecha_nacimiento = finalData.fecha_nacimiento;
                    updatePayload.estado_civil = finalData.estado;
                    updatePayload.nombres_padres = finalData.padres;
                    updatePayload.nombre_conyuge = formatPersonName(finalData.conyuge);
                }
                updatePayload.cuit_tipo = finalData.cuit_tipo;
                updatePayload.cuit_is_formal = finalData.cuit_is_formal;

                const res = await updatePersona(targetId, updatePayload);
                if (res.success) {
                    toast.success("Persona actualizada");
                    onSuccess(res.data);
                } else {
                    toast.error("Error: " + res.error);
                }
            } else {
                const createPayload: any = {
                    ...payloadCommon,
                    dni: finalData.dni,
                    estado_civil_detalle: finalData.estado,
                    nombres_padres: finalData.padres,
                    datos_conyuge: { nombre_completo: formatPersonName(finalData.conyuge) },
                    nacionalidad: finalData.nacionalidad,
                    fecha_nacimiento: finalData.fecha_nacimiento || null,
                    cuit_tipo: finalData.cuit_tipo,
                    cuit_is_formal: finalData.cuit_is_formal
                };
                const res = await upsertPerson(createPayload);
                if (res.success) {
                    toast.success("Persona creada");
                    onSuccess(res.data);
                } else {
                    toast.error("Error: " + res.error);
                }
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };


    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="flex gap-4 p-1 bg-slate-100/50 rounded-lg justify-center mb-4">
                <Button
                    type="button"
                    variant={tipoPersona === 'FISICA' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTipoPersona('FISICA')}
                    className="w-1/2"
                >
                    Persona Física
                </Button>
                <Button
                    type="button"
                    variant={tipoPersona === 'JURIDICA' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTipoPersona('JURIDICA')}
                    className="w-1/2"
                >
                    Persona Jurídica
                </Button>
            </div>

            {tipoPersona === 'FISICA' ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nombre</Label>
                        <Input
                            required
                            value={nameParts.nombre}
                            onChange={(e) => setNameParts({ ...nameParts, nombre: e.target.value })}
                            placeholder="Nombres (Ej: Carlos Alberto)"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Apellido</Label>
                        <Input
                            required
                            value={nameParts.apellido}
                            onChange={(e) => setNameParts({ ...nameParts, apellido: e.target.value })}
                            placeholder="Apellidos (Ej: Perez Aguirre)"
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        Razón Social
                        <span className="text-[10px] text-muted-foreground font-normal">(Nombre de la Entidad / Sociedad)</span>
                    </Label>
                    <Input
                        required
                        value={formData.nombre_completo || ''}
                        onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                        placeholder="Ej: BANCO DE GALICIA Y BUENOS AIRES S.A.U."
                        className="font-bold"
                    />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {tipoPersona === 'FISICA' && (
                    <div className="space-y-2">
                        <Label>DNI</Label>
                        <Input
                            value={formData.dni || ''}
                            onChange={e => setFormData({ ...formData, dni: e.target.value })}
                            placeholder="DNI"
                        />
                    </div>
                )}
                <div className={tipoPersona === 'JURIDICA' ? "col-span-2 space-y-2" : "space-y-2"}>
                    <div className="flex items-center justify-between">
                        <Label>Identificación Tributaria</Label>
                        <div className="flex items-center gap-2 bg-slate-100 p-0.5 rounded text-[10px] font-bold">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, cuit_tipo: 'CUIT' })}
                                className={cn("px-2 py-0.5 rounded", formData.cuit_tipo === 'CUIT' ? "bg-white shadow-sm" : "text-muted-foreground")}
                            >
                                CUIT
                            </button>
                            <button
                                type="button"
                                disabled={tipoPersona === 'JURIDICA'}
                                onClick={() => setFormData({ ...formData, cuit_tipo: 'CUIL' })}
                                className={cn("px-2 py-0.5 rounded", formData.cuit_tipo === 'CUIL' ? "bg-white shadow-sm" : "text-muted-foreground", tipoPersona === 'JURIDICA' && "opacity-50 cursor-not-allowed")}
                            >
                                CUIL
                            </button>
                        </div>
                    </div>
                    <Input
                        value={formData.cuit || ''}
                        onChange={e => handleCuitChange(e.target.value)}
                        placeholder={(formData.cuit_tipo || 'CUIT') + " (Sin guiones)"}
                    />
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="checkbox"
                            id="is_formal"
                            checked={formData.cuit_is_formal}
                            onChange={(e) => setFormData({ ...formData, cuit_is_formal: e.target.checked })}
                            className="h-3 w-3"
                        />
                        <Label htmlFor="is_formal" className="text-[10px] text-muted-foreground font-normal cursor-pointer">
                            Usar formato formal con puntos (Ej: {formData.cuit_tipo === 'CUIL' ? 'C.U.I.L.' : 'C.U.I.T.'})
                        </Label>
                    </div>
                </div>
            </div>

            {tipoPersona === 'FISICA' ? (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Nacionalidad</Label>
                        <Input
                            value={formData.nacionalidad || ''}
                            onChange={e => setFormData({ ...formData, nacionalidad: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha Nacimiento</Label>
                        <Input
                            type="date"
                            value={formData.fecha_nacimiento || ''}
                            onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label>Fecha de Constitución / Contrato Social</Label>
                    <Input
                        type="date"
                        value={formData.fecha_nacimiento}
                        onChange={e => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label>{tipoPersona === 'JURIDICA' ? 'Domicilio Legal / Fiscal' : 'Domicilio Real'}</Label>
                <Input
                    value={formData.domicilio_real || ''}
                    onChange={e => setFormData({ ...formData, domicilio_real: e.target.value })}
                    placeholder="Calle, Nro, Ciudad..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                        type="email"
                        value={formData.email || ''}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="email@ejemplo.com"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                        type="tel"
                        value={formData.telefono || ''}
                        onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                        placeholder="Cod. Área + Número"
                    />
                </div>
            </div>

            {tipoPersona === 'FISICA' && (
                <div className="border-t pt-4 mt-2">
                    <p className="text-sm font-bold text-indigo-700 mb-4 uppercase tracking-wider">Estado Civil y Filiación</p>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Estado Civil (Detalle)</Label>
                            <Textarea
                                rows={3}
                                value={formData.estado || ''}
                                onChange={e => setFormData({ ...formData, estado: e.target.value })}
                                placeholder="Ej: Casado en primeras nupcias con..."
                                className="resize-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Filiación (Padres)</Label>
                            <Input
                                value={formData.padres || ''}
                                onChange={e => setFormData({ ...formData, padres: e.target.value })}
                                placeholder="Hijo de [Padre] y de [Madre]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Cónyuge (Nombre)</Label>
                            <Input
                                value={formData.conyuge || ''}
                                onChange={e => setFormData({ ...formData, conyuge: e.target.value })}
                                onBlur={(e) => {
                                    const formatted = formatPersonName(e.target.value);
                                    if (formatted !== "Sin nombre") {
                                        setFormData(prev => ({ ...prev, conyuge: formatted }));
                                    }
                                }}
                                placeholder="Nombre completo del cónyuge"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-6">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {initialData ? "Actualizar" : "Crear Persona"}
                </Button>
            </div>
        </form>
    );
}
