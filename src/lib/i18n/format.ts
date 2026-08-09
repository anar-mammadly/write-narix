// Dictionary entries are plain strings (never functions) so the whole
// dictionary object stays serializable across the Server -> Client
// Component boundary. Templated strings use {placeholder} tokens and are
// resolved at the call site with this helper instead.
export function formatMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
