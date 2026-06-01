export type D1Primitive = string | number | null;

export function dbDate(value: string | Date | undefined | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function dbBoolean(value: boolean | undefined | null) {
  return value ? 1 : 0;
}

export function rowString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function rowNullableString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

export function rowNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function rowBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function rowDateIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && value) return new Date(value).toISOString();
  return undefined;
}

export function rowRequiredDateIso(value: unknown) {
  return rowDateIso(value) ?? new Date(0).toISOString();
}
