/**
 * server-polyfills.ts
 * 
 * Safe mocking of browser globals for server-side environments.
 */

if (typeof globalThis !== 'undefined') {
    const g = globalThis as any;

    // Polyfill window/self minimally
    if (!g.window) g.window = g;
    if (!g.self) g.self = g;

    // CRITICAL: We DO NOT mock 'location' globally anymore.
    // It was poisoning the Supabase client logic in production.
    if (g.location) {
        delete g.location;
    }

    // Polyfill character encoding
    if (!g.atob) g.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
    if (!g.btoa) g.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');

    // Ensure navigator exists minimally
    if (!g.navigator) g.navigator = { userAgent: 'Node.js/EscriAR' };
}
