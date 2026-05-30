/**
 * Panel UI: file upload, editable field table, manual override, fill button,
 * status/error banners. Talks to `form-filler` to read the page and write values.
 */
import { fillForm, probeIds, type FillResult } from './form-filler';
import { parseT106File } from './parse-browser';
import { makeDraggable, restorePosition } from './drag';
// @ts-expect-error — JS module, imported as JS via tsconfig allowJs.
import { T106_FIELDS } from '../../../lib/t106/extract.js';
// @ts-expect-error — JS module, imported as JS via tsconfig allowJs.
import { T106_TO_HTML, DONATIONS_HTML_ID } from '../../../lib/t106/mapping.js';

const PANEL_ID = 'tax-assistant-panel';
const POS_KEY = 'tap.panelPosition';
const FIELDS_KEY = 'tap.lastFields';

const FIELD_NUMBERS = Object.keys(T106_FIELDS as Record<string, string>).map(Number);

type Fields = Record<number, number>;

type PanelState = {
  fields: Fields;
  externalDonations: number;
  banner: { kind: 'ok' | 'warn' | 'err'; text: string } | null;
  result: string;
};

const state: PanelState = {
  fields: Object.fromEntries(FIELD_NUMBERS.map((n) => [n, 0])) as Fields,
  externalDonations: 0,
  banner: null,
  result: '',
};

export async function mountPanel(): Promise<void> {
  if (document.getElementById(PANEL_ID)) return; // already mounted

  await injectCss();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = panelHtml();
  document.body.appendChild(panel);

  const header = panel.querySelector('.tap-header') as HTMLElement;
  makeDraggable(panel, header, POS_KEY);
  await restorePosition(panel, POS_KEY);

  await loadStoredFields();
  bindHandlers(panel);
  refreshPageStatus(panel);
  render(panel);
}

export function unmountPanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}

export function togglePanel(): void {
  const existing = document.getElementById(PANEL_ID);
  if (existing) unmountPanel();
  else mountPanel();
}

// --- CSS injection -----------------------------------------------------------

async function injectCss(): Promise<void> {
  if (document.getElementById('tax-assistant-panel-css')) return;
  const link = document.createElement('link');
  link.id = 'tax-assistant-panel-css';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content/panel.css');
  document.head.appendChild(link);
}

// --- Rendering ---------------------------------------------------------------

function panelHtml(): string {
  return `
    <div class="tap-header">
      <h1>Tax Form Assistant</h1>
      <button class="tap-close" aria-label="Close">×</button>
    </div>
    <div class="tap-body">
      <div class="tap-banner-slot"></div>

      <div class="tap-section">
        <label class="tap-row">
          <span>T106 PDF</span>
          <input class="tap-file" type="file" accept="application/pdf" />
        </label>
      </div>

      <div class="tap-section">
        <table class="tap-fields">
          <thead>
            <tr>
              <th>T106 #</th>
              <th>Label</th>
              <th>Value</th>
              <th>→ HTML ID</th>
            </tr>
          </thead>
          <tbody class="tap-fields-body"></tbody>
        </table>
      </div>

      <div class="tap-row">
        <label for="tap-donations">External donations</label>
        <input id="tap-donations" type="number" min="0" step="1" value="0" />
      </div>

      <div class="tap-actions">
        <button class="tap-btn tap-clear">Clear values</button>
        <button class="tap-btn primary tap-fill">Fill form</button>
      </div>

      <div class="tap-result"></div>
    </div>
  `;
}

function render(panel: HTMLElement): void {
  // Banner
  const slot = panel.querySelector('.tap-banner-slot') as HTMLElement;
  slot.innerHTML = state.banner
    ? `<div class="tap-banner ${state.banner.kind}">${escapeHtml(state.banner.text)}</div>`
    : '';

  // Field rows
  const tbody = panel.querySelector('.tap-fields-body') as HTMLElement;
  tbody.innerHTML = FIELD_NUMBERS.map((num) => {
    const label = (T106_FIELDS as Record<number, string>)[num] ?? '';
    const value = state.fields[num] ?? 0;
    const htmlId = num === 37 ? `${DONATIONS_HTML_ID} (+donations)` : (T106_TO_HTML as Record<number, string>)[num] ?? '';
    const zeroClass = value === 0 ? 'zero' : '';
    return `
      <tr class="${zeroClass}" data-field="${num}">
        <td>[${String(num).padStart(3, '0')}]</td>
        <td>${escapeHtml(label)}</td>
        <td><input type="number" min="0" step="1" value="${value}" data-field="${num}" /></td>
        <td><code>${escapeHtml(htmlId)}</code></td>
      </tr>
    `;
  }).join('');

  (panel.querySelector('#tap-donations') as HTMLInputElement).value = String(state.externalDonations);

  // Result
  (panel.querySelector('.tap-result') as HTMLElement).textContent = state.result;
}

// --- Handlers ----------------------------------------------------------------

function bindHandlers(panel: HTMLElement): void {
  panel.querySelector('.tap-close')!.addEventListener('click', unmountPanel);

  panel.querySelector('.tap-file')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await onFileUploaded(panel, file);
  });

  panel.querySelector('.tap-fields-body')!.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const num = Number(input.dataset.field);
    if (!num) return;
    state.fields[num] = parseInt(input.value, 10) || 0;
    persistFields();
  });

  panel.querySelector('#tap-donations')!.addEventListener('input', (e) => {
    state.externalDonations = parseInt((e.target as HTMLInputElement).value, 10) || 0;
    persistFields();
  });

  panel.querySelector('.tap-clear')!.addEventListener('click', () => {
    for (const n of FIELD_NUMBERS) state.fields[n] = 0;
    state.externalDonations = 0;
    state.result = '';
    persistFields();
    render(panel);
  });

  panel.querySelector('.tap-fill')!.addEventListener('click', () => {
    onFill(panel);
  });
}

async function onFileUploaded(panel: HTMLElement, file: File): Promise<void> {
  state.banner = { kind: 'ok', text: `Parsing ${file.name}…` };
  render(panel);
  try {
    const { fields } = await parseT106File(file);
    state.fields = { ...state.fields, ...fields };
    persistFields();

    const allZero = Object.values(fields).every((v) => !v);
    if (allZero) {
      state.banner = {
        kind: 'warn',
        text: 'T106 parsed but no fields were recognised — the PDF format may have changed. You can still enter values manually below.',
      };
    } else {
      const filled = Object.entries(fields).filter(([, v]) => v).length;
      state.banner = {
        kind: 'ok',
        text: `Parsed T106: ${filled} / ${FIELD_NUMBERS.length} fields recognised.`,
      };
    }
  } catch (err) {
    state.banner = {
      kind: 'err',
      text: `Couldn't read this file as a PDF: ${(err as Error).message}`,
    };
  }
  render(panel);
}

function onFill(panel: HTMLElement): void {
  // Build id → value map. txt037 = T106[37] + externalDonations.
  const map: Record<string, number> = {};
  for (const [numStr, id] of Object.entries(T106_TO_HTML as Record<string, string>)) {
    const v = state.fields[Number(numStr)] ?? 0;
    if (v) map[id] = v;
  }
  const donations = (state.fields[37] ?? 0) + state.externalDonations;
  if (donations) map[DONATIONS_HTML_ID] = donations;

  const results: FillResult[] = fillForm(map);
  const filled = results.filter((r) => r.filled);
  const missing = results.filter((r) => r.reason === 'not-found');

  state.result = missing.length
    ? `Filled ${filled.length} field(s). Missing on page: ${missing.map((r) => r.id).join(', ')}`
    : `Filled ${filled.length} field(s).`;
  if (missing.length && missing.length === results.length) {
    state.banner = {
      kind: 'err',
      text: "This page doesn't look like Form 1301 — none of the expected input IDs were found.",
    };
  }
  render(panel);
}

function refreshPageStatus(panel: HTMLElement): void {
  const ids = [
    ...Object.values(T106_TO_HTML as Record<string, string>),
    DONATIONS_HTML_ID,
  ];
  const { present, missing } = probeIds(ids);
  if (present.length === 0) {
    state.banner = {
      kind: 'warn',
      text: `This page doesn't have any of the expected Form 1301 inputs (e.g. #txt158). You can still parse a T106 below; switch to the form page before clicking Fill.`,
    };
  } else if (missing.length > 0) {
    state.banner = {
      kind: 'warn',
      text: `Form detected. ${present.length}/${ids.length} expected inputs present. Missing: ${missing.join(', ')}.`,
    };
  } else {
    state.banner = { kind: 'ok', text: 'Form 1301 detected. All expected inputs present.' };
  }
  render(panel);
}

// --- Persistence -------------------------------------------------------------

async function loadStoredFields(): Promise<void> {
  const stored = await chrome.storage.local.get(FIELDS_KEY);
  const saved = stored[FIELDS_KEY] as { fields?: Fields; externalDonations?: number } | undefined;
  if (!saved) return;
  if (saved.fields) state.fields = { ...state.fields, ...saved.fields };
  if (typeof saved.externalDonations === 'number') state.externalDonations = saved.externalDonations;
}

function persistFields(): void {
  void chrome.storage.local.set({
    [FIELDS_KEY]: { fields: state.fields, externalDonations: state.externalDonations },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] ?? c;
  });
}
