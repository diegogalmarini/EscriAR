"use client";

import { useState, useEffect } from "react";
import { runDiag } from "@/app/actions/diag";

export default function DiagPage() {
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        runDiag()
            .then(setResults)
            .catch(err => setError(err.message));
    }, []);

    return (
        <div className="p-8 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">NotiAR Diagnostics</h1>

            {error && (
                <div className="p-4 bg-red-100 text-red-700 mb-4 rounded">
                    Fatal Action Error: {error}
                </div>
            )}

            {!results && !error && <div>Running diagnostics...</div>}

            {results && (
                <div className="space-y-4">
                    <section>
                        <h2 className="font-bold border-b mb-2">Environment (Present?)</h2>
                        <pre>{JSON.stringify(results.env, null, 2)}</pre>
                    </section>

                    <section>
                        <h2 className="font-bold border-b mb-2">Checks</h2>
                        <pre>{JSON.stringify(results.checks, null, 2)}</pre>
                    </section>

                    <section>
                        <h2 className="font-bold border-b mb-2">Full Payload</h2>
                        <pre className="p-4 bg-slate-100 rounded overflow-auto max-h-96">
                            {JSON.stringify(results, null, 2)}
                        </pre>
                    </section>
                </div>
            )}
        </div>
    );
}
