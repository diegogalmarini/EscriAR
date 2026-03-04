"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useState, useCallback, useEffect } from "react";
import { Bold, Italic, Underline as UnderlineIcon, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeedRichEditorProps {
    html: string;
    onSave: (html: string) => void;
    onClose: () => void;
    title?: string;
}

export default function DeedRichEditor({ html, onSave, onClose, title }: DeedRichEditorProps) {
    const [hasChanges, setHasChanges] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Desactivar heading para mantener formato notarial simple
                heading: false,
                codeBlock: false,
                code: false,
                blockquote: false,
            }),
            Underline,
        ],
        content: html,
        onUpdate: () => setHasChanges(true),
        editorProps: {
            attributes: {
                class: "prose max-w-none p-12 min-h-full focus:outline-none text-[14px] leading-relaxed prose-p:mb-1 prose-p:mt-0",
            },
        },
    });

    // Cerrar con Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault();
                handleClose();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [hasChanges]);

    const handleClose = useCallback(() => {
        if (hasChanges) {
            setShowConfirm(true);
        } else {
            onClose();
        }
    }, [hasChanges, onClose]);

    const handleSave = useCallback(() => {
        if (!editor) return;
        onSave(editor.getHTML());
        setHasChanges(false);
        onClose();
    }, [editor, onSave, onClose]);

    if (!editor) return null;

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* ── Toolbar ── */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/30 shrink-0">
                <div className="flex items-center gap-1">
                    {title && (
                        <span className="text-sm font-medium text-muted-foreground mr-4 truncate max-w-[300px]">
                            {title}
                        </span>
                    )}
                    <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5">
                        <ToolbarButton
                            active={editor.isActive("bold")}
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            title="Negrita (Ctrl+B)"
                        >
                            <Bold className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            active={editor.isActive("italic")}
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            title="Cursiva (Ctrl+I)"
                        >
                            <Italic className="h-4 w-4" />
                        </ToolbarButton>
                        <ToolbarButton
                            active={editor.isActive("underline")}
                            onClick={() => editor.chain().focus().toggleUnderline().run()}
                            title="Subrayado (Ctrl+U)"
                        >
                            <UnderlineIcon className="h-4 w-4" />
                        </ToolbarButton>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges}>
                        <Save className="h-4 w-4 mr-1.5" />
                        Guardar
                    </Button>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="Cerrar (Esc)"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* ── Editor ── */}
            <div className="flex-1 overflow-y-auto bg-gray-100">
                <div className="max-w-[850px] mx-auto my-8 bg-white shadow-lg rounded min-h-[calc(100vh-120px)]">
                    <EditorContent editor={editor} className="h-full" />
                </div>
            </div>

            {/* ── Modal confirmación ── */}
            <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cambios sin guardar</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tiene modificaciones que no se han guardado. Si cierra ahora, los cambios se perderán.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Volver al editor</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => { setShowConfirm(false); onClose(); }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Salir sin guardar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

/* ── Botón toolbar ── */
function ToolbarButton({
    active,
    onClick,
    title,
    children,
}: {
    active: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`p-1.5 rounded transition-colors ${
                active
                    ? "bg-foreground text-background"
                    : "hover:bg-muted text-muted-foreground"
            }`}
        >
            {children}
        </button>
    );
}
