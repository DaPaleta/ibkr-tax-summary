/**
 * DOM helpers for finding and filling Form 1301 inputs (#txtNNN).
 * Reports per-field success so the panel can surface missing fields.
 */

export type FillResult = {
  id: string;
  filled: boolean;
  reason?: 'not-found' | 'skipped-zero';
};

/**
 * Set value on an input and dispatch input + change events so framework listeners run.
 */
function setInputValue(el: HTMLInputElement, value: string): void {
  // For React-style controlled inputs, use the prototype setter so the framework sees the change.
  const proto = Object.getPrototypeOf(el) as HTMLInputElement;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) {
    desc.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @param values map of HTML input id → numeric value to fill
 */
export function fillForm(values: Record<string, number>): FillResult[] {
  const results: FillResult[] = [];
  for (const [id, value] of Object.entries(values)) {
    if (!value) {
      results.push({ id, filled: false, reason: 'skipped-zero' });
      continue;
    }
    const el = document.getElementById(id);
    if (!el || !(el instanceof HTMLInputElement)) {
      results.push({ id, filled: false, reason: 'not-found' });
      continue;
    }
    setInputValue(el, String(value));
    results.push({ id, filled: true });
  }
  return results;
}

/**
 * Returns which of the given IDs are present on the page right now.
 */
export function probeIds(ids: string[]): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    if (document.getElementById(id)) present.push(id);
    else missing.push(id);
  }
  return { present, missing };
}
