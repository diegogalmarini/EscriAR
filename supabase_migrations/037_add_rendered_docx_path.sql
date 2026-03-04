-- 037: Add rendered_docx_path to escrituras
-- Stores the Supabase Storage path of the last template-rendered DOCX
-- so the preview persists across page reloads.

ALTER TABLE escrituras
  ADD COLUMN IF NOT EXISTS rendered_docx_path TEXT DEFAULT NULL;

COMMENT ON COLUMN escrituras.rendered_docx_path
  IS 'Storage path (bucket: escrituras) of the last template-generated DOCX';
