/** Concise, text-only description of chart points for assistive technology. */
export function chartAccessibleDescription(data) {
  if (!Array.isArray(data) || data.length === 0) return 'No data available.';
  return `Data points: ${data.slice(0, 36).map(item => `${item.label}: ${item.value}`).join('; ')}.`;
}
