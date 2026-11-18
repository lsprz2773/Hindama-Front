/**
 * Marcador de posición del código QR del 2FA. Dibuja una cuadrícula determinista con los tres
 * cuadros de posición, igual que el diseño. TODO(api): reemplazar por el QR real a partir del
 * `otpauth://` que entregue la API.
 */
const N = 25;

function cells(): boolean[] {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const finder = (x: number, y: number): boolean | null => {
    for (const [fx, fy] of [
      [0, 0],
      [N - 7, 0],
      [0, N - 7],
    ]) {
      const dx = x - fx;
      const dy = y - fy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
        return (
          dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx > 1 && dx < 5 && dy > 1 && dy < 5)
        );
      }
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return false;
    }
    return null;
  };
  const out: boolean[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const f = finder(x, y);
      out.push(f === null ? rnd() > 0.52 : f);
    }
  }
  return out;
}

const CELLS = cells();

export function QrPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="grid self-center rounded-[20px] bg-white p-3.5"
      style={{ gridTemplateColumns: `repeat(${N}, 7px)` }}
    >
      {CELLS.map((dark, i) => (
        <span key={i} className={dark ? "size-[7px] bg-[#16110d]" : "size-[7px] bg-white"} />
      ))}
    </div>
  );
}
