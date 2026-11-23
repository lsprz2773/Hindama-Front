/**
 * Estado del servidor del frontend, para el healthcheck de Docker y del balanceador. No llama a la
 * API ni a Cognito y no lleva datos: solo dice que el proceso atiende peticiones.
 */
export function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
