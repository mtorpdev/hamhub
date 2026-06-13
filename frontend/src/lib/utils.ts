export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' })
}

export function formatUtcDate(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}
