"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{ padding: "2rem", textAlign: "center" }}>
                    <h2>Algo salió mal</h2>
                    <p>Se produjo un error inesperado. El equipo técnico fue notificado.</p>
                    <button
                        onClick={() => reset()}
                        style={{
                            marginTop: "1rem",
                            padding: "0.5rem 1rem",
                            cursor: "pointer",
                        }}
                    >
                        Intentar de nuevo
                    </button>
                </div>
            </body>
        </html>
    );
}
