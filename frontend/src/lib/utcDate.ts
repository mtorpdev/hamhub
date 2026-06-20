const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/

export function toUtcDateTimeLocal(value: string | Date) {
  return new Date(value).toISOString().slice(0, 16)
}

export function nowUtcDateTimeLocal() {
  return toUtcDateTimeLocal(new Date())
}

export function dateTimeLocalUtcToIso(value: string) {
  const trimmed = value.trim()
  if (!DATE_TIME_LOCAL_PATTERN.test(trimmed)) return new Date(trimmed).toISOString()

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
  return new Date(`${withSeconds}Z`).toISOString()
}
