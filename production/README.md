# PINASTER 360 — Producción (implantación independiente)

Este directorio no modifica ni sustituye la demo estática de la raíz del repositorio. El proyecto de Supabase es **pinaster360-production**, región Irlanda (UE).

## Antes de arrancar

1. Verificar que **ninguna** clave de servicio se publica en GitHub, Vercel o el navegador.
2. En Vercel, configurar ÚNICAMENTE `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (claves públicas). No guardar `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
3. Configurar en Supabase Auth: desactivar registros públicos, habilitar MFA TOTP, comprobar URL de aplicación y dominios autorizados, revisar rate limits / caducidad de sesiones.
4. Las cuentas iniciales usan exclusivamente los nombres Felipe, Marcos e Ivo (sin apellidos) y los usuarios Felipe_Pinaster, Marcos_Pinaster e Ivo_Pinaster. Si el ámbito real de Ivo aún no está definido, su acceso a datos de área queda restringido hasta asignárselo.
5. Desde un ordenador seguro, con Node y el repositorio, configurar las variables **locales** `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, y ejecutar `npm run bootstrap` UNA sola vez. El script crea los usuarios, asigna roles y genera un CSV **solo en ese ordenador** con permisos restrictivos. El CSV está excluido de Git.
6. Distribuir las contraseñas individualmente y eliminar el CSV después del reparto. Si se extravía, restablecer contraseñas, nunca consultar hashes.
7. Felipe debe activar MFA antes de que se autorice la lectura transversal de información operativa. No se exige cambio de contraseña en primer acceso, según decisión posterior del cliente.
8. Antes de fichajes reales, pasar a revisión jurídica el texto de privacidad, GPS puntual y conservación de datos. En el esquema el aviso está marcado como pendiente.
9. Configurar **copias automáticas diarias**, retención y ensayo de restauración. Supabase Free no incluye copias diarias automáticas; valorar Pro o backups externos supervisados. Los archivos de Storage necesitan copia propia.
10. Ejecutar test de roles, acceso directo a API, GPS denegado, offline, conflictos de asignación, validación de partes y prueba de restauración. Activar uso real solo tras estos resultados.

## Funciones del piloto

- Acceso por usuario `Nombre_Pinaster` y contraseña única (Supabase Auth).
- MFA TOTP para cuentas con perfil `mfa_required`.
- Consulta por rol: jornada, trabajos, planificación, partes, maquinaria y comunicaciones (según RLS).
- Creación de obras y asignaciones por coordinación; creación de partes solo por responsables.
- GPS solo al fichar; si se deniega, el fichaje sigue sin GPS. Sin seguimiento continuo.
- Subida de fotos de evidencias a depósito privado, asociado a un parte.

## No considerado completado

QA con varias cuentas reales y permisos cruzados; SMS/correo para restablecer claves técnicas; importación CSV de trabajadores; cierre de brechas de sesiones/CSRF para endpoints propios; offline/PWA completos; generación PDF; control de conflictos avanzado; paneles de administración completos; monitorización y alertas; procedimiento de recuperación probado. El piloto no equivale a salida operativa.

Steel Order sigue siendo independiente; no contiene facturación ni cobros.
