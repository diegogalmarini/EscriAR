-- ============================================================
-- 045 — search_carpetas: filtrar por escritura TRAMITE (operación activa)
-- Parties, código y acto deben venir SOLO de la escritura TRAMITE,
-- NO del antecedente (INGESTA).
-- ============================================================

-- PRECHECKS
-- SELECT source FROM escrituras LIMIT 1;
-- Debe funcionar (columna existe de migración 044).

-- APPLY
CREATE OR REPLACE FUNCTION public.search_carpetas(
  search_term text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  "number" integer,
  internal_id text,
  title text,
  status text,
  tags text[],
  created_at timestamp with time zone,
  total_count bigint,
  parties jsonb,
  escrituras jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_term text;
BEGIN
  clean_term := btrim(search_term);

  RETURN QUERY
  WITH matching_carpetas AS (
    SELECT DISTINCT c.id
    FROM carpetas c
    -- Para búsqueda, unimos TODAS las escrituras (buscar en antecedente está OK)
    LEFT JOIN escrituras e ON c.id = e.carpeta_id
    LEFT JOIN operaciones o ON e.id = o.escritura_id
    LEFT JOIN participantes_operacion po ON o.id = po.operacion_id
    LEFT JOIN personas p ON po.persona_id = p.dni
    WHERE
      (clean_term IS NULL OR clean_term = '')
      OR (
        c.nro_carpeta_interna::text ILIKE '%' || clean_term || '%'
        OR c.caratula ILIKE '%' || clean_term || '%'
        OR p.nombre_completo ILIKE '%' || clean_term || '%'
        OR p.dni ILIKE '%' || clean_term || '%'
        OR p.cuit ILIKE '%' || clean_term || '%'
        OR o.codigo ILIKE '%' || clean_term || '%'
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM matching_carpetas
  )
  SELECT
    c.id,
    c.nro_carpeta_interna AS "number",
    c.nro_carpeta_interna::text AS internal_id,
    c.caratula AS title,
    c.estado AS status,
    ARRAY[]::text[] AS tags,
    c.created_at,
    (SELECT total FROM counted) AS total_count,
    -- Parties: SOLO de escritura TRAMITE (operación activa)
    COALESCE(
      (
        SELECT jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', p2.dni,
            'full_name', p2.nombre_completo,
            'role', po2.rol,
            'tipo_persona', p2.tipo_persona,
            'cuit', p2.cuit
          )
        )
        FROM escrituras e2
        JOIN operaciones o2 ON e2.id = o2.escritura_id
        JOIN participantes_operacion po2 ON o2.id = po2.operacion_id
        JOIN personas p2 ON po2.persona_id = p2.dni
        WHERE e2.carpeta_id = c.id
          AND e2.source = 'TRAMITE'
      ),
      '[]'::jsonb
    ) AS parties,
    -- Escrituras/operaciones: SOLO TRAMITE para código y tipo_acto
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e2.id,
            'source', e2.source,
            'operaciones', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', o2.id,
                    'codigo', o2.codigo,
                    'tipo_acto', o2.tipo_acto
                  )
                )
                FROM operaciones o2
                WHERE o2.escritura_id = e2.id
              ),
              '[]'::jsonb
            )
          )
        )
        FROM escrituras e2
        WHERE e2.carpeta_id = c.id
          AND e2.source = 'TRAMITE'
      ),
      '[]'::jsonb
    ) AS escrituras
  FROM matching_carpetas mc
  JOIN carpetas c ON c.id = mc.id
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO service_role;
