# Identidad de clientes por correo — propuesta de migración (NO aplicada)

## Objetivo aprobado
En todas las pantallas del superadministrador que identifiquen una empresa, mostrar **nombre comercial + correo principal de acceso del propietario**. El nombre comercial puede cambiar; la cuenta se mantiene por los IDs internos.

## Estado comprobado el 2026-10-13
- `public.businesses`: id (UUID PK), name, slug (único), created_at; 1 fila (Edwin Digital).
- `public.business_members`: business_id + user_id (PK compuesta y FKs); 1 fila.
- `public.profiles`: id (FK a auth.users), email, role, created_at; 2 filas.
- `public.ed_business_features`: plan, features, updated_at, updated_by.
- RLS activado en todas esas tablas.
- Todavía no hay campo de propietario ni correo principal en businesses.

## Modelo de identidad
- `businesses.id` es la identidad técnica inmutable de cada empresa.
- `auth.users.id` es la identidad técnica inmutable de cada usuario.
- Añadir `businesses.owner_user_id UUID` (FK a `auth.users.id`) **solo tras verificar qué usuario de business_members es el propietario**.
- El correo principal visible se obtiene en backend, por un endpoint autorizado para superadministradores, desde la identidad de auth del propietario. No duplicar email en una columna que pueda quedar desincronizada.
- Correo de inicio de sesión no editable por autoservicio: bloquear actualización desde las rutas del CRM y asegurar que no haya una ruta alternativa abierta; las correcciones administrativas deben ser auditadas.
- `business_members` conserva asociaciones de usuarios; añadir roles por empresa (owner/admin/member/viewer) posteriormente con migración compatible.
- No deducir el propietario mediante dominio, nombre ni primer correo encontrado.

## Migración sugerida, pendiente de respaldo y validación
```sql
-- SOLO REVISIÓN; NO EJECUTAR SIN VALIDACIÓN DE BACKUP Y TITULARIDAD.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid
  REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS public.business_name_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id),
  old_name text NOT NULL,
  new_name text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_name_history ENABLE ROW LEVEL SECURITY;
-- No conceder acceso de cliente a este historial hasta diseñar políticas por membresía.
-- No crear un TRIGGER que dependa de permisos hasta validar las rutas de edición.
-- No hacer owner_user_id NOT NULL hasta completar backfill validado.
```

## Secuencia segura para implementar
1. Confirmar respaldo restaurable del proyecto y entorno de pruebas.
2. Confirmar propietario real de la empresa existente usando datos autorizados de Auth y business_members (sin exponer emails en logs).
3. Revisar endpoints actuales, autorización del superadministrador y flujo de creación de empresa.
4. Aplicar migración en entorno de pruebas; backfill explícito con UUID correcto; validar RLS y acceso entre tenants.
5. Implementar respuesta administrativa `{business_id, business_name, owner_email, created_at, member_count, plan, last_sign_in}` con lectura autenticada desde servidor y email no expuesto a otros tenants.
6. UI: `Nombre comercial · correo` en Mis clientes, Accesos, Integraciones, Suscripciones, Reportes, selectores y fichas, con búsqueda por ambos.
7. Cambios de nombre crean historial sin cambiar business_id ni vinculación de integraciones.
8. Probar nueva empresa, empresa sin propietario asignado, nombres duplicados, cambio de nombre y cliente suspendido. Nunca mostrar un email distinto como sustituto.
9. Publicar tras validación y revisión de seguridad.

## Notas
Este documento no modifica la base de datos ni despliega funcionalidades. No borrar filas ni cambiar RLS como atajo. El plan y el slug siguen siendo campos independientes del correo.
