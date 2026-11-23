"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

const QUIET_ZONE = 2;

/**
 * Código QR del `otpauth://` de la cuenta. Se dibuja en el navegador, módulo por módulo, con un
 * `<svg>` propio: la clave nunca sale del navegador ni se pasa por HTML. Blanco y negro fijos
 * (no cambian con el tema) para que la app de autenticación lo lea.
 */
export function TotpQr({ value, label }: { value: string; label: string }) {
  const modules = useMemo(
    () => QRCode.create(value, { errorCorrectionLevel: "M" }).modules,
    [value],
  );
  const size = modules.size + QUIET_ZONE * 2;
  const path: string[] = [];
  for (let y = 0; y < modules.size; y += 1) {
    for (let x = 0; x < modules.size; x += 1) {
      if (modules.get(x, y)) path.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`);
    }
  }
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="mx-auto size-[220px] max-w-full rounded-[18px] bg-white"
    >
      <path d={path.join("")} fill="#000" />
    </svg>
  );
}
