-- Enum para controlar el ciclo de vida del job
CREATE TYPE ingest_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

CREATE TABLE public.ingestion_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    carpeta_id UUID REFERENCES public.carpetas(id) ON DELETE CASCADE, -- Vinculación opcional directa a la carpeta
    
    -- Metadatos del archivo
    file_path TEXT NOT NULL, -- Ruta relativa en Supabase Storage (ej: 'user_123/docs/escritura.pdf')
    original_filename TEXT NOT NULL,
    file_size_bytes BIGINT, -- Útil para estadísticas y validaciones del worker
    mime_type TEXT DEFAULT 'application/pdf',

    -- Control de Estado
    status ingest_status DEFAULT 'pending',
    attempts INT DEFAULT 0, -- Contador de reintentos para manejo de fallos transitorios
    
    -- Resultados de la IA
    result_data JSONB, -- Payload crudo de la extracción de Gemini
    processing_metadata JSONB, -- Info técnica (ej: "¿Fue OCR o Texto nativo?", "tokens usados")
    
    -- Diagnóstico
    error_message TEXT,
    error_stack TEXT, -- Stack trace para depuración (solo visible para admin)
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    started_at TIMESTAMP WITH TIME ZONE, -- Cuándo lo agarró el worker
    finished_at TIMESTAMP WITH TIME ZONE -- Cuándo terminó
);

-- Índices para optimizar el polling del worker
CREATE INDEX idx_ingestion_jobs_status ON public.ingestion_jobs(status);
CREATE INDEX idx_ingestion_jobs_user_id ON public.ingestion_jobs(user_id);

-- Políticas RLS (Seguridad Robusta)
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden crear trabajos para sí mismos
CREATE POLICY "Users can insert their own jobs" ON public.ingestion_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Los usuarios solo pueden ver el estado de sus propios trabajos
CREATE POLICY "Users can view their own jobs" ON public.ingestion_jobs
    FOR SELECT USING (auth.uid() = user_id);

-- Se asegura que Supabase Storage y el bucket escrituras estén listos 
-- Insertamos bucket si no existe (normalmente ya viene de la mg 005_storage_bucket_escrituras.sql, pero por si acaso)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('escrituras', 'escrituras', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para Storage (Para que nextjs pueda pedir firmados y subir al bucket)
-- Nota: La autenticación de storage.objects generalmente se maneja vía tokens firmados o sesión.
CREATE POLICY "Users can upload their own documents" ON storage.objects
    FOR INSERT WITH CHECK (auth.uid() = owner AND bucket_id = 'escrituras');

CREATE POLICY "Users can view their own documents" ON storage.objects
    FOR SELECT USING (auth.uid() = owner AND bucket_id = 'escrituras');

CREATE POLICY "Users can update their own documents" ON storage.objects
    FOR UPDATE USING (auth.uid() = owner AND bucket_id = 'escrituras');
