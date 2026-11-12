# Edwin CRM · Atención y recuperación segura del piloto privado

**Estado:** procedimiento propuesto, no evidencia de ejecución ni autorización de apertura comercial. Revisar junto con [PRELANZAMIENTO-PILOTO-CRM.md](./PRELANZAMIENTO-PILOTO-CRM.md). Las acciones A01–A50 permanecen contabilizadas únicamente en [50-ACCIONES-LANZAMIENTO-20261105.md](./50-ACCIONES-LANZAMIENTO-20261105.md).

## Objetivo y límites

Evitar que un incidente de registro, permisos o datos impida atender a una empresa piloto o provoque acceso cruzado. Este documento **no habilita** pagos, mensajes, cuentas reales, cambios de RLS, restauraciones ni despliegues. No solicitar contraseñas, códigos de correo, tokens, cookies, claves API, datos de clientes ni capturas que los contengan.

## Clasificación y primera respuesta

| Severidad | Señal | Acción segura sin modificar producción | Condición de escalamiento |
|---|---|---|---|
| P0: privacidad / aislamiento | Usuario ve datos de otra empresa, acceso ajeno por URL/API, exportación cruzada | Suspender nuevas altas y operaciones afectadas mediante decisión del responsable autorizado; conservar evidencia redactada y hora | Inmediato; no reabrir hasta prueba negativa y aislamiento A/B aprobadas |
| P1: acceso / continuidad | Confirmación email falla, login no funciona, onboarding bloqueado o datos no guardan | Registrar URL, ruta, hora, estado HTTP y SHA si son públicos; reproducir sólo con cuentas sintéticas autorizadas | Antes de admitir nuevas empresas; no crear cuentas manualmente ni alterar permisos |
| P2: UX / demo | Página no carga, enlaces rotos, fallo móvil o demo ficticia vacía | Verificar ruta pública y navegador sin incluir información personal | Corregir por PR y CI; no afirmar deploy hasta comprobación externa |
| P3: consulta comercial | Pregunta por plan, WhatsApp, IA o integración no validada | Explicar alcance piloto privado y limitaciones verificadas | No prometer fechas, resultados ni habilitar pagos |

## Registro mínimo de incidente (sin PII)

- ID interno, fecha/hora y zona horaria, severidad, responsable, módulo y entorno verificado.
- URL/ruta **sin parámetros sensibles**, commit GitHub y SHA de despliegue **sólo si se comprueban directamente**.
- Resultado esperado y observado; código HTTP y correlación anonimizada cuando exista.
- Evidencia redactada, decisión de contención, PR de corrección, checks del SHA y comprobación posterior.
- Estado: abierto / contenido / corregido en main / verificado en producción / cerrado. No equiparar «corregido en main» con «verificado en producción».

## Matriz de aceptación de soporte

| Caso | Positivo | Negativo | Aislamiento |
|---|---|---|---|
| Solicitud de ayuda de cuenta piloto | Operador confirma entorno y documenta síntoma sin secretos | Solicitud de contraseña o token: rechazar y usar recuperación oficial | Nunca consultar ni compartir recursos de otra empresa |
| Incidente de registro | Cuenta sintética autorizada completa signup → confirmación → login | Correo sin confirmar, expiración o proveedor caído no deben dar acceso | La sesión de A no habilita recursos de B |
| Error de oportunidades | Crear y consultar oportunidad ficticia en empresa A | Fallo de red o reintento no duplica datos | Empresa B no lee, edita ni exporta registros de A |
| Incidente de integración | Simulación autorizada muestra fallo controlado y sin secretos | Proveedor indisponible no se marca como conexión exitosa | Una conexión de A no aparece en B |
| Cierre de incidente | PR integrado, checks verdes del SHA y prueba externa autorizada documentada | Sin CI o sin evidencia de producción: mantener estado pendiente | Repetir pruebas A/B después de cambios de acceso o integración |

## Recuperación y comunicación

1. Contener primero un P0; no intentar «arreglar» mediante permisos amplios, desactivar RLS o mover datos entre empresas.
2. Reproducir en entorno autorizado con datos sintéticos. Priorizar corrección pequeña y reversible en rama/PR, con pruebas positivas, negativas y A/B.
3. Validar CI del SHA exacto y fusionar sólo con evidencia. Comprobar Cloudflare Production por separado; documentar URL, hora y SHA.
4. Comunicar a la empresa afectada únicamente el estado verificado y la siguiente acción permitida, sin datos de terceros ni promesas de resolución.
5. Cerrar sólo después de confirmar que el síntoma desapareció y no hubo contaminación cruzada; si no se puede probar, mantener bloqueo y escalar.

**Regla comercial:** hasta completar los bloqueos de lanzamiento, soporte no debe activar clientes de pago ni anunciar suscripciones automáticas.
