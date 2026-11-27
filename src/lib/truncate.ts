export const MAX_VIEWER_BYTES = 10 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: false });

export interface Truncated {
  text: string;
  truncated: boolean;
  /** Tamaño original en bytes. */
  bytes: number;
}

/**
 * Recorta un texto a `maxBytes` bytes UTF-8 sin partir un carácter por la mitad
 * (el visor de petición/respuesta muestra hasta 10 KB, RF-62).
 */
export function truncateBytes(value: string, maxBytes: number = MAX_VIEWER_BYTES): Truncated {
  const bytes = encoder.encode(value);
  if (bytes.length <= maxBytes) return { text: value, truncated: false, bytes: bytes.length };
  let end = maxBytes;
  // Retrocede si el corte cayó dentro de un carácter de varios bytes (10xxxxxx).
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
  return { text: decoder.decode(bytes.slice(0, end)), truncated: true, bytes: bytes.length };
}
