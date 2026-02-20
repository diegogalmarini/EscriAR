-- Create or replace the search_carpetas function to reflect nro_acto -> codigo renaming

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
  -- Clean the search term
  clean_term := btrim(search_term);

  RETURN QUERY
  WITH matching_carpetas AS (
    -- If no search term, return all carpetas
    -- Otherwise, search across related tables
    SELECT DISTINCT c.id
    FROM carpetas c
    LEFT JOIN carpetas_personas cp ON c.id = cp.carpeta_id
    LEFT JOIN personas p ON cp.persona_id = p.id
    LEFT JOIN escrituras e ON c.id = e.carpeta_id
    LEFT JOIN operaciones o ON e.id = o.escritura_id
    WHERE 
      (clean_term IS NULL OR clean_term = '')
      OR (
        c.number::text ILIKE '%' || clean_term || '%'
        OR c.internal_id ILIKE '%' || clean_term || '%'
        OR c.title ILIKE '%' || clean_term || '%'
        OR p.full_name ILIKE '%' || clean_term || '%'
        OR p.document_number ILIKE '%' || clean_term || '%'
        OR p.cuit_cuil ILIKE '%' || clean_term || '%'
        OR o.codigo ILIKE '%' || clean_term || '%' -- Updated from nro_acto
      )
  ),
  counted AS (
    -- Get total count for pagination
    SELECT count(*) AS total FROM matching_carpetas
  )
  SELECT 
    c.id,
    c.number,
    c.internal_id,
    c.title,
    c.status,
    c.tags,
    c.created_at,
    (SELECT total FROM counted) AS total_count,
    -- Aggregate related parties
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p2.id,
            'full_name', p2.full_name,
            'role', cp2.role
          )
        )
        FROM carpetas_personas cp2
        JOIN personas p2 ON cp2.persona_id = p2.id
        WHERE cp2.carpeta_id = c.id
      ),
      '[]'::jsonb
    ) AS parties,
    -- Aggregate related escrituras and operations
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e2.id,
            'operaciones', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', o2.id,
                    'codigo', o2.codigo -- Updated from nro_acto
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
      ),
      '[]'::jsonb
    ) AS escrituras
  FROM matching_carpetas mc
  JOIN carpetas c ON c.id = mc.id
  ORDER BY c.number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Ensure the function is executable by API roles
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO service_role;
