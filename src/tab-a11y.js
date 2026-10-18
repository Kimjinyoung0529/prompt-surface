/** Keep one tab operable even when streamed or restored state is stale. */
export function selectedTabValue(options, boundValue, defaultValue) {
  if (!Array.isArray(options) || options.length === 0) return '';
  for (const candidate of [boundValue, defaultValue]) {
    if (candidate === undefined || candidate === null) continue;
    const value = String(candidate);
    if (options.some(option => option.value === value)) return value;
  }
  return options[0].value;
}
