# EscriAr - Guía de Variables de Entorno

Esta guía detalla todas las variables de entorno necesarias para el correcto funcionamiento de EscriAr en producción (Vercel).

## 📋 Variables Requeridas

### 1. Supabase (Base de Datos & Autenticación)

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Dónde obtenerlas:**
1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar tu proyecto
3. Settings > API
4. Copiar "Project URL" y "anon/public key"

**Importante:** 
- El prefijo `NEXT_PUBLIC_` es crítico - permite acceso desde el navegador
- La `ANON_KEY` es segura para exposición pública (tiene permisos limitados por RLS)

---

### 2. Google Gemini AI (Motor de Redacción)

```env
GEMINI_API_KEY=AIzaSy...
```

**Dónde obtenerla:**
1. Ir a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Get API key"
3. Crear nueva API key o usar existente

**Importante:**
- Esta key NO tiene prefijo `NEXT_PUBLIC_` (solo se usa en server-side)
- Necesaria para la funcionalidad de "Generar Borrador con IA"

---

### 3. URL Base de la Aplicación (Opcional pero Recomendado)

```env
NEXT_PUBLIC_SITE_URL=https://escriar.vercel.app
```

**Por qué es importante:**
- Se usa para generar los links de WhatsApp en `ClientOutreach.tsx`
- Si no se define, el código usa `http://localhost:3000` como fallback
- En producción, debe ser la URL real de Vercel

---

## 🔧 Configuración en Vercel

### Paso a paso:

1. Ir al dashboard de tu proyecto en Vercel
2. Click en "Settings"
3. Ir a "Environment Variables"
4. Agregar cada variable con su valor correspondiente
5. Seleccionar el ambiente: **Production, Preview, Development** (recomendado: todas)
6. Click "Save"

### Screenshot de referencia:
```
┌─────────────────────────────────────┐
│ Environment Variables               │
├─────────────────────────────────────┤
│ Name:  NEXT_PUBLIC_SUPABASE_URL     │
│ Value: https://xxx.supabase.co      │
│ [x] Production [x] Preview [x] Dev  │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Verificación

Antes de hacer deploy, confirma:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` configurada
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` configurada
- [ ] `GEMINI_API_KEY` configurada
- [ ] `NEXT_PUBLIC_SITE_URL` configurada (opcional)
- [ ] Variables aplicadas a **Production**
- [ ] Redeploy triggerado después de agregar variables

---

## 🚨 Troubleshooting

### Error: "supabase is not defined"
- Falta `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Verificar que tengan el prefijo `NEXT_PUBLIC_`

### Error: "Failed to generate draft"
- Falta `GEMINI_API_KEY`
- Verificar que la API key sea válida en Google AI Studio

### Links de WhatsApp apuntan a localhost
- Falta `NEXT_PUBLIC_SITE_URL` o tiene valor incorrecto
- Debe ser la URL de producción de Vercel

---

## 📝 Notas Adicionales

- Las variables de entorno solo se leen en **build time** para las que tienen prefijo `NEXT_PUBLIC_`
- Después de agregar/modificar variables, Vercel debe hacer **redeploy**
- Para testing local, créa un archivo `.env.local` en la raíz con las mismas variables
- Nunca commitees `.env.local` a Git (ya está en `.gitignore`)

---

**Última actualización:** Enero 2026
**Versión de Next.js:** 16.1.3
**Versión de Supabase:** @supabase/supabase-js 2.x
