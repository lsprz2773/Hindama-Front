"""Arranca el laboratorio de Hindama dentro de un contenedor (misma logica que tests/lab/serve.py).

Escucha en 0.0.0.0 solo para que el puerto publicado de Docker llegue al contenedor; el puerto del
anfitrion se publica en 127.0.0.1 y el unico acceso publico es el tunel. El codigo de verificacion
se lee de /data/verificacion.txt en cada peticion: se cambia sin reiniciar.
"""

import os
from pathlib import Path

import uvicorn
from fastapi.responses import PlainTextResponse

from tests.lab.app import Mode, build_lab

VERIFICATION = Path("/data/verificacion.txt")

lab = build_lab(Mode(os.environ.get("LAB_MODE", "vulnerable")))


def verification() -> PlainTextResponse:
    try:
        return PlainTextResponse(VERIFICATION.read_text(encoding="utf-8").strip())
    except FileNotFoundError:
        return PlainTextResponse("", status_code=404)


lab.add_api_route("/.well-known/hindama-verificacion.txt", verification, include_in_schema=False)

if __name__ == "__main__":
    print(f"Laboratorio en modo {os.environ.get('LAB_MODE', 'vulnerable')}", flush=True)
    uvicorn.run(lab, host="0.0.0.0", port=8100, log_level="info")
