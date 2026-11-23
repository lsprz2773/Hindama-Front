# Demo de Hindama: APIs de prueba y guion

Hindama solo prueba una API cuyo dominio puedas demostrar que controlas (un archivo o un registro TXT). Por eso la demo necesita una API **propia y vulnerable a propósito**, publicada en una dirección pública. Aquí hay dos listas para encender con un comando, cada una con su túnel de Cloudflare (la guardia contra SSRF no deja verificar `localhost`).

|                     | Laboratorio del catálogo                                                   | VAmPI                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Qué es              | La API vulnerable de `hindama-backend/tests/lab`                           | [VAmPI](https://github.com/erev0s/VAmPI), una API vulnerable de la comunidad (imagen `erev0s/vampi`)                           |
| Operaciones         | 17                                                                         | 14                                                                                                                             |
| Estado de la prueba | **Probada de punta a punta con Hindama** (ejecución con los siete módulos) | Los scripts, el túnel, el contrato, la verificación y el inicio de sesión están probados. **Falta correr Hindama contra ella** |
| Script              | `demo/lab-catalogo.ps1`                                                    | `demo/vampi.ps1`                                                                                                               |
| Para qué sirve      | La demo completa, incluido «volver a probar» con la versión corregida      | Mostrar que Hindama funciona con una API que no escribimos nosotros                                                            |

## Antes de empezar

1. **Docker Desktop** encendido.
2. **El backend**, con la imagen `hindama-api` construida: en `hindama-backend`, `docker compose up -d --build --wait`.
3. **El frontend** con una cuenta de analista (con o sin segundo factor) en `https://localhost:3000` (`npm run dev`) o en la imagen de producción.
4. Los scripts están pensados para Windows PowerShell. Se ejecutan desde la raíz de este repositorio y esperan que `hindama-backend` sea la carpeta hermana (si no, `-Backend <ruta>`).

## Laboratorio del catálogo

```powershell
.\demo\lab-catalogo.ps1                       # enciende el laboratorio vulnerable y su túnel
.\demo\lab-catalogo.ps1 -Code <código>        # pone el código de verificación del proyecto
.\demo\lab-catalogo.ps1 -Mode secure          # lo «corrige» para volver a probar (la URL no cambia)
.\demo\lab-catalogo.ps1 -Action status
.\demo\lab-catalogo.ps1 -Action stop          # al terminar
```

Al encender imprime la **URL base**, la del **contrato** (`/openapi.json`) y las identidades de prueba:

| Identidad            | Cómo se configura           | Datos                                                                        |
| -------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| Ana                  | Inicio de sesión automático | `POST /auth/login`, usuario `ana`, contraseña `clave-de-ana-del-laboratorio` |
| Beto                 | Token                       | `tok-beto-laboratorio-7c1e`                                                  |
| Raíz (administrador) | Token                       | `tok-raiz-laboratorio-42aa`                                                  |

Son valores de prueba que ya están en el repositorio del backend. Las operaciones «solo propietario» piden indicar el campo propietario al confirmar la política.

**Qué debe salir** con los siete módulos (ejecución de referencia del 23/11/2026, 10 peticiones por segundo): terminó en 1:03 con 114 peticiones y 28 hallazgos (11 críticos, 9 altos, 4 medios, 3 bajos y 1 informativo), repartidos entre los siete módulos. En modo seguro, la nueva ejecución queda sin hallazgos y el proyecto pasa a «Concluido».

## VAmPI

```powershell
.\demo\vampi.ps1                              # enciende VAmPI, Caddy y el túnel (y crea sus datos)
.\demo\vampi.ps1 -Code <código>
.\demo\vampi.ps1 -Action stop
```

Caddy va delante porque VAmPI no sirve el archivo de verificación.

**Identidades: usa «Token Bearer», no «Inicio de sesión automático».** El script imprime un token para cada usuario (los obtiene con `POST /users/v1/login`) y estos duran **1 hora** (VAmPI los emite por 60 segundos, y el script lo sube con `tokentimetolive`). Hindama busca el token de un inicio de sesión en los campos `access_token`, `accessToken`, `token`, `jwt`, `id_token` e `idToken`, y VAmPI lo entrega en `auth_token`, así que, según el código del backend, el inicio de sesión automático no lo encontraría (no lo probé).

| Identidad     | Rol           | Usuario | Contraseña |
| ------------- | ------------- | ------- | ---------- |
| Usuario 1     | Usuario       | `name1` | `pass1`    |
| Usuario 2     | Usuario       | `name2` | `pass2`    |
| Administrador | Administrador | `admin` | `pass1`    |

Pega el token de cada uno en una identidad nueva. Si apagas y enciendes VAmPI, los tokens cambian.

## Guion (unos 10 minutos)

1. **Cuenta.** Inicia sesión (con el código del segundo factor si lo activaste).
2. **Proyecto nuevo.** Escribe la URL base que imprimió el script. Es HTTPS, así que no sale el aviso de HTTP.
3. **Verificar la propiedad.** Copia el código de la pantalla, ejecuta `.\demo\<script>.ps1 -Code <código>` y pulsa «Verificar».
4. **Importar el contrato** por URL (`<URL base>/openapi.json`). Aparecen las operaciones.
5. **Identidades.** Agrega las de la tabla y pulsa «Probar» en cada una. En el laboratorio, «Recursos» → «Descubrir recursos» encuentra los de Beto y Raíz; confírmalos uno por uno.
6. **Política de acceso.** Confirma las operaciones (en el laboratorio, «Solo propietario» pide el campo propietario).
7. **Nueva ejecución.** Selecciona los siete módulos, confirma los tres de riesgo y sube el límite a 10 peticiones por segundo para que dure un minuto.
8. **Progreso en vivo**, después **resultados**, **matriz** (celdas con discrepancia), **detalle de un hallazgo** (petición y respuesta con las credenciales enmascaradas) y **reporte** (con «Exportar a Excel»).
9. **Aceptar un riesgo** con justificación en un hallazgo.
10. **Corregir y volver a probar** (solo laboratorio): `.\demo\lab-catalogo.ps1 -Mode secure`, «Volver a probar» y la comparación «0 nuevos, 0 persistentes, 0 regresiones».
11. **Cierre.** `-Action stop` en el script que hayas usado.

## Cosas que conviene saber

- Cada vez que se **apaga y se enciende** un túnel, la URL cambia. Para reutilizar un proyecto, cambia su host en «Ajustes» (el proyecto vuelve a «Pendiente de verificación» y se verifica de nuevo con el mismo código). `-Mode secure` **no** cambia la URL.
- Los túneles de Cloudflare son **públicos mientras estén encendidos**: el laboratorio es vulnerable a propósito. Apágalo al terminar.
- La verificación se vuelve a comprobar al iniciar cada ejecución: no apagues el script a media demo.
- Los datos de los scripts quedan en `demo/.datos/` (ignorada por Git).
- El laboratorio también existe en AWS (`lab.asolo.tech`, `deploy/lab/demo.sh` del backend) para una demo con la plataforma desplegada.
