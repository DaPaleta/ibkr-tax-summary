/**
 * Panel UI: upload multiple T106 / 867 PDFs, review a combined summary (T106 salary fields and
 * the §92 loss-offset proposal for securities), edit any value, then fill Form 1301.
 *
 * The tax-offset maths live in the shared pure modules (lib/867/*); this file is UI + glue.
 */
import { fillForm, probeIds, type FillResult } from './form-filler';
import { parseT106File } from './parse-browser';
import { parse867File, detectPdfType, type Extracted867 } from './parse-867';
import { makeDraggable, restorePosition } from './drag';
import { T106_FIELDS } from '../../../lib/t106/extract.js';
import { T106_TO_HTML, DONATIONS_HTML_ID } from '../../../lib/t106/mapping.js';
import { aggregate867, computeWaterfall } from '../../../lib/867/waterfall.js';
import { net867ToMainForm, net867ToAppendixC } from '../../../lib/867/mapping.js';

/** Loose shape of the `computeWaterfall` result (the module is plain JS). */
type Waterfall = {
  totalSales: number;
  portfolioCount: number;
  taxableGainByRate: Record<string, number>;
  netGainByRate: Record<string, number>;
  gainCurrentOffsetByRate: Record<string, number>;
  interestByRate: Record<string, number>;
  dividendByRate: Record<string, number>;
  netInterestByRate: Record<string, number>;
  netDividendByRate: Record<string, number>;
  carryForwardLoss: number;
  taxWithheld: { capitalGains: number; dividend: number; interest: number };
  notes: string[];
};

const PANEL_ID = 'tax-assistant-panel';
const POS_KEY = 'tap.panelPosition';
const STATE_KEY = 'tap.state';

type T106Fields = Record<number, number>;

type SourceFile =
  | { name: string; type: 'T106'; fields: T106Fields }
  | { name: string; type: '867'; f867: Extracted867 }
  | { name: string; type: 'unknown' };

type PanelState = {
  files: SourceFile[];
  externalDonations: number;
  carriedForwardLosses: number;
  overrides: Record<string, number>; // htmlId → user-edited fill value
  banner: { kind: 'ok' | 'warn' | 'err'; text: string } | null;
  result: string;
};

const state: PanelState = {
  files: [],
  externalDonations: 0,
  carriedForwardLosses: 0,
  overrides: {},
  banner: null,
  result: '',
};

const LABELS_867_MAIN: Record<string, string> = {
  txt256: 'סה"כ מכירות ני"ע (שדה 256)',
  txt054: 'מספר תיקי השקעה',
  txt060: 'ריבית/דיבידנד מני"ע @15%',
  txt067: 'ריבית/דיבידנד מני"ע @20%',
  txt141: 'דיבידנד מני"ע @25%',
  txt157: 'ריבית מני"ע @25%',
  txt055: 'ריבית/דיבידנד מני"ע @30%',
};

const LABELS_867_APPENDIX: Record<string, string> = {
  txtRhC12: 'נספח ג: רווח חייב @15% (שורה 1)',
  txtRhC32: 'נספח ג: קיזוז הפסד שוטף @15% (שורה 2)',
  txtRhC56: 'נספח ג: סכום המכירות',
};

// Form 1301 spans tabs. T106 salary fields and the 867 *summary* lines (net interest/dividend,
// total sales, portfolio count) live on the MAIN tab; the detailed §ג fields live on the separate
// Appendix C (נספח ג) tab. `fillForm` only writes inputs on the current page, so we tag each
// target with its tab to route the user.
type Tab = 'main' | 'appendixC';
const APPENDIX_C_IDS = new Set(Object.keys(LABELS_867_APPENDIX));
const tabOf = (id: string): Tab => (APPENDIX_C_IDS.has(id) ? 'appendixC' : 'main');
const TAB_NAME: Record<Tab, string> = {
  main: 'the main tab (טאב ראשי)',
  appendixC: 'the נספח ג (Appendix C) tab',
};

/** Which 1301 tab is currently open, inferred from which inputs are present. */
function detectCurrentTab(): Tab | null {
  if (probeIds([...APPENDIX_C_IDS]).present.length) return 'appendixC';
  const mainIds = [...Object.values(T106_TO_HTML as Record<string, string>), 'txt256', 'txt060'];
  if (probeIds(mainIds).present.length) return 'main';
  return null;
}

// --- Lifecycle ---------------------------------------------------------------

export async function mountPanel(): Promise<void> {
  if (document.getElementById(PANEL_ID)) return;
  await injectCss();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.innerHTML = panelHtml();
  document.body.appendChild(panel);

  const header = panel.querySelector('.tap-header') as HTMLElement;
  makeDraggable(panel, header, POS_KEY);
  await restorePosition(panel, POS_KEY);

  await loadStoredState();
  bindHandlers(panel);
  refreshPageStatus();
  render(panel);
}

export function unmountPanel(): void {
  document.getElementById(PANEL_ID)?.remove();
}

export function togglePanel(): void {
  if (document.getElementById(PANEL_ID)) unmountPanel();
  else void mountPanel();
}

async function injectCss(): Promise<void> {
  if (document.getElementById('tax-assistant-panel-css')) return;
  const link = document.createElement('link');
  link.id = 'tax-assistant-panel-css';
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('src/content/panel.css');
  document.head.appendChild(link);
}

// --- Derived: aggregate + fill plan -----------------------------------------

type PlanRow = { id: string; label: string; value: number; group: string; tab: Tab };

type Plan = {
  rows: PlanRow[];
  waterfall: Waterfall | null;
  appendix: Record<string, number>;
};

function aggregateT106(): T106Fields {
  const sum: T106Fields = {};
  for (const f of state.files) {
    if (f.type !== 'T106') continue;
    for (const [num, val] of Object.entries(f.fields)) {
      sum[Number(num)] = (sum[Number(num)] ?? 0) + (val as number);
    }
  }
  return sum;
}

/** Build the editable fill rows + the securities waterfall, applying user overrides. */
function buildPlan(): Plan {
  const rows: PlanRow[] = [];
  const withOverride = (id: string, value: number) =>
    state.overrides[id] !== undefined ? state.overrides[id] : value;

  const push = (id: string, label: string, value: number, group: string) =>
    rows.push({ id, label, value: withOverride(id, value), group, tab: tabOf(id) });

  // T106 salary fields (+ donations into txt037) — main tab.
  const t106 = aggregateT106();
  for (const [numStr, id] of Object.entries(T106_TO_HTML as Record<string, string>)) {
    const v = t106[Number(numStr)] ?? 0;
    if (v) push(id, (T106_FIELDS as Record<number, string>)[Number(numStr)] ?? id, v, 'Main tab · שכר (T106)');
  }
  const donations = (t106[37] ?? 0) + state.externalDonations;
  if (donations) push(DONATIONS_HTML_ID, 'תרומות', donations, 'Main tab · שכר (T106)');

  // 867 securities: aggregate + §92 waterfall.
  const f867 = state.files.filter((f): f is Extract<SourceFile, { type: '867' }> => f.type === '867');
  let waterfall: Waterfall | null = null;
  let appendix: Record<string, number> = {};
  if (f867.length) {
    const combined = aggregate867(f867.map((f) => f.f867));
    waterfall = computeWaterfall(combined, { carriedForwardLosses: state.carriedForwardLosses }) as Waterfall;
    const main = net867ToMainForm(waterfall) as Record<string, number>;
    for (const [id, v] of Object.entries(main)) {
      push(id, LABELS_867_MAIN[id] ?? id, v, 'Main tab · ני"ע (שורות מסכמות)');
    }
    appendix = net867ToAppendixC(waterfall) as Record<string, number>;
    for (const [id, v] of Object.entries(appendix)) {
      push(id, LABELS_867_APPENDIX[id] ?? id, v, 'נספח ג tab · ני"ע');
    }
  }

  return { rows, waterfall, appendix };
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
          <span>Add T106 / 867 PDF</span>
          <input class="tap-file" type="file" accept="application/pdf" multiple />
        </label>
        <ul class="tap-files"></ul>
      </div>

      <div class="tap-section tap-inputs">
        <label class="tap-row"><span>External donations</span>
          <input id="tap-donations" type="number" min="0" step="1" value="0" /></label>
        <label class="tap-row"><span>Carry-forward losses (prior years)</span>
          <input id="tap-carry" type="number" min="0" step="1" value="0" /></label>
      </div>

      <div class="tap-section tap-summary"></div>

      <div class="tap-section">
        <table class="tap-fields">
          <thead><tr><th>Field</th><th>Value</th><th>→ ID</th><th>On page</th></tr></thead>
          <tbody class="tap-fields-body"></tbody>
        </table>
      </div>

      <div class="tap-actions">
        <button class="tap-btn tap-clear">Clear all</button>
        <button class="tap-btn primary tap-fill">Fill form</button>
      </div>

      <div class="tap-result"></div>
    </div>
  `;
}

function num(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtByRate(byRate: Record<string, number> | null | undefined): string {
  if (!byRate) return '—';
  const parts = Object.entries(byRate)
    .filter(([, v]) => v)
    .map(([r, v]) => `${num(v)} @${r}%`);
  return parts.length ? parts.join(', ') : '0';
}

function render(panel: HTMLElement): void {
  const slot = panel.querySelector('.tap-banner-slot') as HTMLElement;
  slot.innerHTML = state.banner
    ? `<div class="tap-banner ${state.banner.kind}">${escapeHtml(state.banner.text)}</div>`
    : '';

  // Files list
  const filesEl = panel.querySelector('.tap-files') as HTMLElement;
  filesEl.innerHTML = state.files.length
    ? state.files
        .map((f, i) => {
          const badge = f.type === 'unknown' ? 'warn' : 'ok';
          return `<li><span class="tap-badge ${badge}">${f.type}</span> <span class="tap-fname">${escapeHtml(f.name)}</span> <button class="tap-rm" data-idx="${i}" aria-label="Remove">×</button></li>`;
        })
        .join('')
    : '<li class="tap-empty">No files yet — upload a T106 or 867 PDF.</li>';

  (panel.querySelector('#tap-donations') as HTMLInputElement).value = String(state.externalDonations);
  (panel.querySelector('#tap-carry') as HTMLInputElement).value = String(state.carriedForwardLosses);

  const plan = buildPlan();

  // Securities summary (read-only review of the §92 proposal)
  const summaryEl = panel.querySelector('.tap-summary') as HTMLElement;
  const w = plan.waterfall;
  summaryEl.innerHTML = w
    ? `
      <h2>Securities summary — §92 proposal (review & edit)</h2>
      <table class="tap-kv">
        <tr><td>Total sales</td><td>${num(w.totalSales)}</td></tr>
        <tr><td>Portfolios</td><td>${w.portfolioCount}</td></tr>
        <tr><td>Taxable gain</td><td>${fmtByRate(w.taxableGainByRate)}</td></tr>
        <tr><td>→ net gain after offset</td><td>${fmtByRate(w.netGainByRate)}</td></tr>
        <tr><td>Interest/dividend</td><td>${fmtByRate(addRate(w.interestByRate, w.dividendByRate))}</td></tr>
        <tr><td>→ net after offset</td><td>${fmtByRate(addRate(w.netInterestByRate, w.netDividendByRate))}</td></tr>
        <tr><td>Carry-forward loss</td><td>${num(w.carryForwardLoss)}</td></tr>
        <tr><td>Tax withheld (gain/div/int)</td><td>${num(w.taxWithheld.capitalGains)} / ${num(w.taxWithheld.dividend)} / ${num(w.taxWithheld.interest)}</td></tr>
      </table>
      ${w.notes.length ? `<div class="tap-notes">${w.notes.map((n: string) => `⚠ ${escapeHtml(n)}`).join('<br>')}</div>` : ''}
      <p class="tap-fine">Proposed offsets follow Income-Tax circular 10/2025 (§92). The offset order is your choice — edit any value below before filling.</p>
    `
    : '';

  // Fill-targets table
  const onPage = new Set(probeIds(plan.rows.map((r) => r.id)).present);
  const tbody = panel.querySelector('.tap-fields-body') as HTMLElement;
  if (!plan.rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="tap-empty">Upload files or enter values to see fill targets.</td></tr>';
  } else {
    let lastGroup = '';
    tbody.innerHTML = plan.rows
      .map((r) => {
        const groupRow = r.group !== lastGroup ? ((lastGroup = r.group), `<tr class="tap-group"><td colspan="4">${escapeHtml(r.group)}</td></tr>`) : '';
        const present = onPage.has(r.id) ? '✓' : '—';
        return `${groupRow}<tr data-id="${r.id}">
          <td>${escapeHtml(r.label)}</td>
          <td><input type="number" step="1" value="${r.value}" data-id="${r.id}" /></td>
          <td><code>${escapeHtml(r.id)}</code></td>
          <td class="tap-onpage">${present}</td>
        </tr>`;
      })
      .join('');
  }

  (panel.querySelector('.tap-result') as HTMLElement).textContent = state.result;
}

function addRate(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [r, v] of Object.entries(b ?? {})) out[r] = (out[r] ?? 0) + v;
  return out;
}

// --- Handlers ----------------------------------------------------------------

function bindHandlers(panel: HTMLElement): void {
  panel.querySelector('.tap-close')!.addEventListener('click', unmountPanel);

  panel.querySelector('.tap-file')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) await onFileUploaded(panel, file);
  });

  panel.querySelector('.tap-files')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.tap-rm') as HTMLElement | null;
    if (!btn) return;
    state.files.splice(Number(btn.dataset.idx), 1);
    persist();
    render(panel);
  });

  panel.querySelector('#tap-donations')!.addEventListener('input', (e) => {
    state.externalDonations = parseInt((e.target as HTMLInputElement).value, 10) || 0;
    persist();
    render(panel);
  });

  panel.querySelector('#tap-carry')!.addEventListener('input', (e) => {
    state.carriedForwardLosses = parseInt((e.target as HTMLInputElement).value, 10) || 0;
    // Carry-forward feeds the §92 waterfall, so drop securities overrides — otherwise an
    // earlier manual edit would freeze a value while the recomputed proposal moves under it.
    for (const id of Object.keys(state.overrides)) {
      if (id in LABELS_867_MAIN || id in LABELS_867_APPENDIX) delete state.overrides[id];
    }
    persist();
    render(panel);
  });

  panel.querySelector('.tap-fields-body')!.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.id;
    if (!id) return;
    state.overrides[id] = parseInt(input.value, 10) || 0;
    persist();
  });

  panel.querySelector('.tap-clear')!.addEventListener('click', () => {
    state.files = [];
    state.externalDonations = 0;
    state.carriedForwardLosses = 0;
    state.overrides = {};
    state.result = '';
    persist();
    render(panel);
  });

  panel.querySelector('.tap-fill')!.addEventListener('click', () => onFill(panel));
}

async function onFileUploaded(panel: HTMLElement, file: File): Promise<void> {
  state.banner = { kind: 'ok', text: `Parsing ${file.name}…` };
  render(panel);
  try {
    const type = await detectPdfType(file);
    if (type === '867') {
      const f867 = await parse867File(file);
      state.files.push({ name: file.name, type: '867', f867 });
      const warns = (f867 as { _warnings?: string[] })._warnings ?? [];
      state.banner = warns.length
        ? { kind: 'warn', text: `${file.name}: 867 parsed. ${warns.join(' ')}` }
        : { kind: 'ok', text: `${file.name}: 867 parsed.` };
    } else if (type === 'T106') {
      const { fields } = await parseT106File(file);
      state.files.push({ name: file.name, type: 'T106', fields });
      const recognised = Object.values(fields).filter((v) => v).length;
      state.banner = recognised
        ? { kind: 'ok', text: `${file.name}: T106 parsed (${recognised} fields).` }
        : { kind: 'warn', text: `${file.name}: T106 parsed but no fields recognised — enter values manually.` };
    } else {
      state.files.push({ name: file.name, type: 'unknown' });
      state.banner = { kind: 'warn', text: `${file.name}: couldn't tell if this is a T106 or 867. Ignored.` };
    }
    persist();
  } catch (err) {
    state.banner = { kind: 'err', text: `Couldn't read ${file.name} as a PDF: ${(err as Error).message}` };
  }
  render(panel);
}

function onFill(panel: HTMLElement): void {
  const plan = buildPlan();
  const map: Record<string, number> = {};
  for (const r of plan.rows) if (r.value) map[r.id] = r.value;

  const results: FillResult[] = fillForm(map);
  const filled = results.filter((r) => r.filled);
  const missing = results.filter((r) => r.reason === 'not-found');

  // Route the un-found fields by the tab they belong to, so the user knows where to go next.
  const missingByTab: Record<Tab, string[]> = { main: [], appendixC: [] };
  for (const r of missing) missingByTab[tabOf(r.id)].push(r.id);

  const parts = [`Filled ${filled.length} field(s) on this tab.`];
  for (const tab of ['main', 'appendixC'] as Tab[]) {
    if (missingByTab[tab].length) {
      parts.push(
        `${missingByTab[tab].length} field(s) belong to ${TAB_NAME[tab]} — switch there and click Fill again (${missingByTab[tab].join(', ')}).`
      );
    }
  }
  state.result = parts.join(' ');

  if (results.length && missing.length === results.length) {
    state.banner = {
      kind: 'err',
      text: 'None of these inputs are on the current page. Open Form 1301 and the relevant tab, then click Fill.',
    };
  } else if (filled.length) {
    state.banner = { kind: 'ok', text: `Filled ${filled.length} field(s).` };
  }
  render(panel);
}

function refreshPageStatus(): void {
  const tab = detectCurrentTab();
  if (!tab) {
    state.banner = {
      kind: 'warn',
      text: 'This page has none of the expected Form 1301 inputs. You can still upload files; switch to the form before clicking Fill.',
    };
  } else {
    state.banner = { kind: 'ok', text: `Form 1301 detected — current tab: ${TAB_NAME[tab]}.` };
  }
}

// --- Persistence -------------------------------------------------------------

async function loadStoredState(): Promise<void> {
  const stored = await chrome.storage.local.get(STATE_KEY);
  const saved = stored[STATE_KEY] as Partial<PanelState> | undefined;
  if (!saved) return;
  state.files = saved.files ?? [];
  state.externalDonations = saved.externalDonations ?? 0;
  state.carriedForwardLosses = saved.carriedForwardLosses ?? 0;
  state.overrides = saved.overrides ?? {};
}

function persist(): void {
  void chrome.storage.local.set({
    [STATE_KEY]: {
      files: state.files,
      externalDonations: state.externalDonations,
      carriedForwardLosses: state.carriedForwardLosses,
      overrides: state.overrides,
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c] ?? c;
  });
}
