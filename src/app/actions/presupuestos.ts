"use server";

import { createClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { getUserOrgId } from "@/lib/auth/getOrg";
import { calcularPresupuesto, type PresupuestoInput, type PresupuestoResult } from "@/lib/services/PresupuestoEngine";

// ─── Calcular (sin persistir) ─────────────────────────────

export async function calcularPresupuestoAction(input: PresupuestoInput): Promise<{
  success: boolean;
  data?: PresupuestoResult;
  error?: string;
}> {
  try {
    const result = calcularPresupuesto(input);
    return { success: true, data: result };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Guardar presupuesto ──────────────────────────────────

export async function guardarPresupuesto(carpetaId: string, input: PresupuestoInput): Promise<{
  success: boolean;
  presupuestoId?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const orgId = await getUserOrgId();
    if (!orgId) return { success: false, error: "Sin organización" };

    const result = calcularPresupuesto(input);

    // Check for existing draft — bump version
    const { data: existing } = await supabase
      .from("presupuestos")
      .select("version")
      .eq("carpeta_id", carpetaId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const nextVersion = (existing?.version ?? 0) + 1;

    // Insert presupuesto header
    const { data: presupuesto, error: pError } = await supabase
      .from("presupuestos")
      .insert({
        carpeta_id: carpetaId,
        org_id: orgId,
        version: nextVersion,
        codigo_acto: result.metadata.codigo_acto,
        tipo_acto: input.tipo_acto,
        monto_operacion: input.monto_operacion,
        moneda: input.moneda,
        cotizacion_usd: input.cotizacion_usd ?? null,
        valuacion_fiscal: input.valuacion_fiscal,
        base_imponible: result.metadata.base_imponible,
        es_vivienda_unica: input.es_vivienda_unica,
        tipo_inmueble: input.tipo_inmueble,
        es_banco_provincia: input.es_banco_provincia ?? false,
        fecha_adquisicion: input.fecha_adquisicion_vendedor ?? null,
        partido: input.partido ?? null,
        urgencia_rpi: input.urgencia_rpi ?? "simple",
        total_ars: result.totales.total,
        total_usd: input.moneda === "USD" && input.cotizacion_usd
          ? Math.round(result.totales.total / input.cotizacion_usd * 100) / 100
          : null,
        estado: "BORRADOR",
        alertas: result.alertas,
        valido_hasta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      })
      .select("id")
      .single();

    if (pError) throw pError;

    // Insert lineas
    const lineas = result.lineas.map((l, idx) => ({
      presupuesto_id: presupuesto.id,
      rubro: l.rubro,
      concepto: l.concepto,
      categoria: l.categoria,
      base_calculo: l.baseCalculo,
      alicuota: l.alicuota,
      monto: l.monto,
      pagador: l.pagador,
      notas: l.notas ?? null,
      orden: idx,
    }));

    if (lineas.length > 0) {
      const { error: lError } = await supabase
        .from("presupuesto_lineas")
        .insert(lineas);
      if (lError) throw lError;
    }

    revalidatePath(`/carpeta/${carpetaId}`);
    return { success: true, presupuestoId: presupuesto.id };
  } catch (e: any) {
    console.error("Error guardando presupuesto:", e);
    return { success: false, error: e.message };
  }
}

// ─── Obtener presupuesto de una carpeta ───────────────────

export async function getPresupuesto(carpetaId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("presupuestos")
      .select(`
        *,
        presupuesto_lineas (*)
      `)
      .eq("carpeta_id", carpetaId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    return { success: true, data: data ?? null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Cambiar estado ───────────────────────────────────────

export async function cambiarEstadoPresupuesto(
  presupuestoId: string,
  nuevoEstado: "ENVIADO" | "ACEPTADO" | "VENCIDO",
  carpetaId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const update: Record<string, any> = { estado: nuevoEstado };
    if (nuevoEstado === "ENVIADO") update.fecha_envio = new Date().toISOString();
    if (nuevoEstado === "ACEPTADO") update.fecha_aceptacion = new Date().toISOString();

    const { error } = await supabase
      .from("presupuestos")
      .update(update)
      .eq("id", presupuestoId);

    if (error) throw error;

    revalidatePath(`/carpeta/${carpetaId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
