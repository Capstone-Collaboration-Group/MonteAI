export function fullNameHelper (first: string, mi?: string, last?: string, suffix?: string) {
  return [first, mi ? `${mi}.` : "", last, suffix].filter(Boolean).join(" ");
}
