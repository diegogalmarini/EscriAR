-- Migration 068: Multi-act presupuestos
--
-- Adds actos_json JSONB column to presupuestos table for storing
-- per-act form state, and acto_index to presupuesto_lineas for
-- linking lines to their originating act.
--
-- Backward compatible: existing presupuestos keep actos_json = '[]'.

ALTER TABLE presupuestos
  ADD COLUMN IF NOT EXISTS actos_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE presupuesto_lineas
  ADD COLUMN IF NOT EXISTS acto_index INTEGER DEFAULT 0;
