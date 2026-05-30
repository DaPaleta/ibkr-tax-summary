/**
 * T106 field # → Form 1301 HTML input ID.
 * txt037 (donations) is special: combine T106[037] + externally provided donations.
 */
export const T106_TO_HTML = {
  158: 'txt158',
  244: 'txt244',
  218: 'txt218',
  42: 'txt042',
  45: 'txt045',
  248: 'txt248',
  11: 'txt011',
  // 37 handled separately (combined with external donations) — see callers.
};

export const DONATIONS_HTML_ID = 'txt037';
