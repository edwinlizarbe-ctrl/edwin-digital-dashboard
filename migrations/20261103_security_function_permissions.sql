-- Edwin CRM · Ajustes de seguridad aplicados a producción el 2026-11-03.
-- Mantener esta migración en control de versiones para entornos nuevos.
-- El event trigger ensure_rls sigue activo: no eliminar ni reemplazar su función.

-- El event trigger opera internamente y no necesita una RPC pública.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- La función del trigger de actualización solo necesita funciones de pg_catalog.
-- Fijar search_path evita la resolución accidental de objetos de otros esquemas.
ALTER FUNCTION public.ed_features_touch_update() SET search_path = pg_catalog;
