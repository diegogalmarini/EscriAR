import { NextRequest, NextResponse } from "next/server";
import { renderTemplate, previewTemplateContext } from "@/app/actions/template-render";

/**
 * POST /api/templates/render
 *
 * Body JSON:
 *   { carpeta_id: string, act_type: string, overrides?: object, preview_only?: boolean }
 *
 * - preview_only=true  → devuelve solo el context JSON (para debug)
 * - preview_only=false → renderiza DOCX y devuelve URL de descarga
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { carpeta_id, act_type, overrides, preview_only } = body;

        if (!carpeta_id || !act_type) {
            return NextResponse.json(
                { error: "Faltan campos requeridos: carpeta_id, act_type" },
                { status: 400 }
            );
        }

        if (preview_only) {
            const result = await previewTemplateContext(carpeta_id);
            return NextResponse.json(result, { status: result.success ? 200 : 500 });
        }

        const result = await renderTemplate(carpeta_id, act_type, overrides);
        return NextResponse.json(result, { status: result.success ? 200 : 500 });
    } catch (error: any) {
        console.error("[API /templates/render]", error);
        return NextResponse.json(
            { error: error.message || "Error interno" },
            { status: 500 }
        );
    }
}
