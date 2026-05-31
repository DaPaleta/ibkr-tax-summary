/**
 * Make `panel` draggable by its `handle` element. Position is persisted to
 * chrome.storage.local under `key` so the panel returns to the same spot
 * across page loads.
 */
export function makeDraggable(panel: HTMLElement, handle: HTMLElement, key: string): void {
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;
  let dragging = false;

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    // Don't start a drag when grabbing a control in the handle (e.g. the close button) —
    // moving the panel mid-press cancels that control's click.
    if ((e.target as HTMLElement).closest('button, input, a, select, textarea')) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    originLeft = rect.left;
    originTop = rect.top;
    // Switch to left/top positioning so we can move freely.
    panel.style.right = 'auto';
    panel.style.left = `${originLeft}px`;
    panel.style.top = `${originTop}px`;
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const left = Math.max(0, Math.min(window.innerWidth - 40, originLeft + dx));
    const top = Math.max(0, Math.min(window.innerHeight - 40, originTop + dy));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  };

  const onMouseUp = () => {
    if (!dragging) return;
    dragging = false;
    const left = parseFloat(panel.style.left);
    const top = parseFloat(panel.style.top);
    chrome.storage.local.set({ [key]: { left, top } });
  };

  handle.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export async function restorePosition(panel: HTMLElement, key: string): Promise<void> {
  const stored = await chrome.storage.local.get(key);
  const pos = stored[key] as { left: number; top: number } | undefined;
  if (!pos) return;
  panel.style.right = 'auto';
  panel.style.left = `${pos.left}px`;
  panel.style.top = `${pos.top}px`;
}
