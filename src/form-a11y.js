/** Accessible name for form controls without a visible label. */
export function formControlName({ label, ariaLabel, placeholder, bind }, fallback) {
  if (typeof label === 'string' && label.trim()) return undefined;
  const pathName = typeof bind === 'string' ? bind.split('.').at(-1) : undefined;
  for (const candidate of [ariaLabel, placeholder, pathName]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return fallback;
}
