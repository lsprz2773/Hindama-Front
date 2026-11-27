"""Arranca el laboratorio de Hindama dentro de un contenedor (misma logica que tests/lab/serve.py).

Escucha en 0.0.0.0 solo para que el puerto publicado de Docker llegue al contenedor; el puerto del
anfitrion se publica en 127.0.0.1 y el unico acceso publico es el tunel. El codigo de verificacion
se lee de /data/verificacion.txt en cada peticion: se cambia sin reiniciar.

Correcciones parciales (`LAB_FIXES`, separadas por coma): el laboratorio sigue vulnerable y solo las
rutas de cada correccion se atienden con el laboratorio en modo seguro. Son dos aplicaciones del mismo
laboratorio (una vulnerable y una segura) y un despachador que elige por la ruta, asi que no se toca
el codigo del backend:

- objetos   -> /orders/{id} y /accounts/{id}/statement (API1, acceso a objetos de otra identidad)
- funciones -> /admin/users (API5, funciones de administrador)
- sql       -> /products y /products/{id} (inyeccion SQL)

`/orders` (la lista) y `/admin/audit` quedan vulnerables a proposito: el modulo de configuracion
revisa las cabeceras en la primera ruta GET sin parametros (`/admin/audit`), y asi esa falla no se
corrige sin querer. Efecto colateral: en las rutas
corregidas tambien se verifica la firma del JWT, porque eso depende del modo.
"""

import os
from pathlib import Path

import uvicorn
from fastapi.responses import PlainTextResponse

from tests.lab.app import Mode, build_lab

VERIFICATION = Path("/data/verificacion.txt")

FIXES: dict[str, tuple[str, ...]] = {
    "objetos": ("/orders/", "/accounts/"),
    "funciones": ("/admin/users",),
    "sql": ("/products",),
}

mode = Mode(os.environ.get("LAB_MODE", "vulnerable"))
requested = [name for name in os.environ.get("LAB_FIXES", "").split(",") if name in FIXES]
lab = build_lab(mode)


def verification() -> PlainTextResponse:
    try:
        return PlainTextResponse(VERIFICATION.read_text(encoding="utf-8").strip())
    except FileNotFoundError:
        return PlainTextResponse("", status_code=404)


lab.add_api_route("/.well-known/hindama-verificacion.txt", verification, include_in_schema=False)

# El modo seguro completo no necesita despachador: todo ya esta corregido.
prefixes = tuple(prefix for name in requested for prefix in FIXES[name])
if prefixes and mode == Mode.VULNERABLE:
    secure_lab = build_lab(Mode.SECURE)

    async def app(scope, receive, send):  # noqa: ANN001
        use_secure = scope["type"] == "http" and scope["path"].startswith(prefixes)
        await (secure_lab if use_secure else lab)(scope, receive, send)
else:
    app = lab

if __name__ == "__main__":
    print(
        f"Laboratorio en modo {mode.value}; correcciones: {', '.join(requested) or 'ninguna'}",
        flush=True,
    )
    uvicorn.run(app, host="0.0.0.0", port=8100, log_level="info")
