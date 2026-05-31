# Form 867 → Form 1301 (Appendix C / נספח ג) Filling Instructions

## Overview

This document explains how to read an Israeli broker's **Form 867** (אישור ניכוי מס במקור — certificate of tax withheld at source) and use it to **calculate and fill Appendix C (נספח ג)** of the Tax Authority's annual income report **Form 1301** at `secapp.taxes.gov.il`.

Form 867 reports a brokerage account's capital gains/losses, dividends, and interest for the tax year, plus the tax already withheld at source. Appendix C of Form 1301 is where the taxpayer reconciles these — offsetting losses against gains and against interest/dividend income — and computes the net taxable amounts that flow into the main 1301.

> **Scope.** This covers the Israeli-broker path: **Form 867 → Appendix C → main 1301**. It is grounded in the form's own labels and field codes, not in tax-law interpretation. Foreign-broker (IBKR) capital gains, foreign-tax credits, and tax-withheld credits are reported on the **main 1301** (or its supplementary forms), not in Appendix C — see [Where the rest goes](#where-the-rest-goes-not-appendix-c). This tool does not give tax advice; confirm treatment with the Tax Authority or a professional.

> **Forms vs. fields.** Numbers like **1322 / 1323 / 1324 / 1327 / 1214** are *supplementary forms* (טופס) filed alongside the 1301 — not fields on it. The 867 annotation "יועברו לטופס 1322, נספח ג" means **Appendix C is itself form 1322**, filed with the 1301. Three-digit codes like `256 / 060 / 040` are the actual `שדה` field codes. "Appendix C of Form 1301" is used here colloquially for that bundle.

> **Portal tabs.** On `secapp.taxes.gov.il` the 1301 is split across tabs, and inputs exist in the DOM only for the open tab. The **main tab** holds the T106 salary fields *and* the 867 **summary lines** computed from broker totals (`txt060/067/141/157/055`, `txt256` total sales, `txt054` portfolio count). The detailed §ג securities fields (`txtRhC12/32/56`, helper table) live on the separate **Appendix C (נספח ג) tab**. The extension tags each target with its tab and routes the user; it does not auto-navigate.

---

## 1. Anatomy of Form 867

A single broker's 867 package is usually several sub-certificates. The two that feed Appendix C:

### 867 א+ב — Capital gain on securities (רווח הון מניירות ערך)

Section **ד. נתוני הכנסות - רווח הון**, with columns by tax rate (`0% / 15% / 20% / 25% / 35%`):

| 867 line | Meaning | Feeds |
|---|---|---|
| רווחים חייבים במס … (יועברו לטופס 1322, נספח ג) | **Taxable gains** by rate, before loss offset | Appendix C §ג row 1 |
| הפסדים ברי קיזוז | **Losses available for offset** (a single total) | The loss waterfall (§4) |
| מחזור מכירות כולל … (**שדה 256**) | **Total sales turnover** | Appendix C field 56 → 1301 `txt256` |
| מספר עסקאות | Number of transactions | Informational |
| מס שנוכה במקור (**שדה 040**) | **Tax withheld** on capital gain | Main 1301 (credit), not Appendix C |

A checkbox at the bottom states whether any of the losses were offset against interest/dividend income:
- ☑ *"קיימים הפסדי הון … שקוזזו כנגד הכנסה מריבית או מדיבידנד"* — losses **were** offset against interest/dividend.
- ☑ *"לא קיימים הפסדי הון שקוזזו כנגד הכנסה מריבית או מדיבידנד"* — they were **not**.

This checkbox is the broker's per-account hint; on a multi-broker 1301 the taxpayer recomputes the offset across all accounts (§5).

### 867 ג — Dividend and interest on securities (דיבידנד וריבית מניירות ערך)

Two blocks, each with rate columns:

| 867 ג line | Meaning | Feeds |
|---|---|---|
| 1. הכנסה מדיבידנד לפני קיזוז הפסדים | **Dividend income** by rate (rates incl. `0/4/15/20/25/23%`) | Appendix C helper table row 1 |
| 2. הכנסה מדיבידנד בחו"ל (כלול בשורה 1) | Foreign portion of the above | Forms 1323/1324, foreign-tax credit |
| 6. מס שנוכה במקור מדיבידנד | Tax withheld on dividends | Main 1301 (credit) |
| 7. הכנסה מריבית / דמי ניכיון לפני קיזוז הפסדים | **Interest income** by rate (rates incl. `0/10/15/20/25/23/35%`) | Appendix C helper table row 1 |
| 8. הכנסה מריבית בחו"ל (כלול בשורה 7) | Foreign portion of the above | Forms 1323/1324 |
| 11. מס שנוכה במקור מריבית / דמי ניכיון (**שדה 040**) | Tax withheld on interest | Main 1301 (credit) |
| החזר בגין קיזוז הפסדי הון | **Refund** the broker already gave for in-account loss offset | Sanity check (see §6) |

### 867 / 867 ד — Interest from deposits & savings (ריבית מפיקדונות)

Reports bank-style deposit interest by rate (codes 076/078/126/142/053). For a pure securities account this is usually all zeros and feeds the main 1301's deposit-interest fields, not Appendix C.

---

## 2. Appendix C (נספח ג) field map

### Account list (top of Appendix C)

One row per broker account that produced an 867 (שם המנכה, מספר חשבון, מספר הסניף). With more than one broker, list each — the body of Appendix C holds the **combined** totals (§5). The count of accounts feeds `txt054` (מספר תיקיות השקעה).

### Section ג — Income from sale of securities (הכנסה ממכירת ניירות ערך)

Five rate columns. Each cell carries an Appendix-C field number (HTML id `txtRhC<NN>`). Rows are an offset waterfall; the bottom is the net taxable gain.

| # | Row (Hebrew) | Meaning | 15% | 20% | 25% | 30% | 35% |
|---|---|---|---|---|---|---|---|
| 1 | רווח חייב במס, לפני קיזוז הפסדים | Taxable gain, **before** offset | **12** | 10 | 13 | 48 | 44 |
| 2 | קיזוז הפסדי הון שוטפים מניירות ערך | Offset **current-year** securities losses | **32** | 30 | 33 | 49 | 36 |
| 3 | קיזוז הפסדי הון מועברים מניירות ערך | Offset **carried-forward** securities losses (from prior years) | 62 | 60 | 63 | 51 | 34 |
| 4 | קיזוז הפסדי הון שאינם מניירות ערך | Offset capital losses **not** from securities | 89 | 93 | 85 | 54 | 84 |
| 5 | קיזוז הפסדים שוטפים מעסק | Offset current-year **business** losses | 82 | 99 | 87 | 65 | 86 |
|   | הכנסה חייבת (חישוב 1−2−3−4−5) | **Net taxable gain** per rate | = | = | = | = | = |

- **סכום המכירות (field 56 → `txtRhC56` → 1301 שדה 256):** total sales turnover, summed across brokers.
- Field numbers above are read from the 2024/2025 Appendix C screenshots; the populated cells (12, 32, 56) are additionally confirmed by the live form's HTML ids (`txtRhC12`, `txtRhC32`, `txtRhC56`).
- **Rate-bucket mismatch:** the 867 capital-gains block has a `0%` column but no `30%`; §ג has `30%` but no `0%`. The `0%` (exempt) gains do not enter §ג. The `30%` bucket has no 867 source in these samples.

### Helper table — Offsetting securities losses against interest & dividend income

*(טבלת עזר לקיזוז הפסד מניירות ערך כנגד הכנסות מריבית ודיבידנד מניירות ערך)* — four rate columns (`15% / 20% / 25% / 30%`), HTML ids `txtSum15/20/25/30`:

| # | Row (Hebrew) | Meaning |
|---|---|---|
| 1 | הכנסה מריבית ודיבידנד מניירות ערך | Interest **+** dividend income (combined), by rate |
| 2 | קיזוז הפסדי הון **שוטף** מניירות ערך … | Offset of **current-year** securities losses against that income |
| 3 | קיזוז הפסד הון … שנוצר עד **31.12.05** … עד 20% | Offset of pre-2006 securities losses (capped at the ≤20% buckets) |
|   | (חישוב 1−2−3) | **Net taxable** interest/dividend per rate |

**Note on row 2 vs. Appendix C §ג row 3.** The helper table accepts only **current-year** (`שוטף`) and pre-2006 losses against interest/dividend. **Carried-forward** post-2006 losses are *not* entered here — they go into §ג **row 3** against future **gains** only. This distinction comes from the row labels themselves.

### Transfer to main 1301 (העברה לשדות בטופס 1301)

The net interest/dividend (helper table חישוב 1−2−3) transfers by rate:

| Rate | 1301 שדה | HTML id | Meaning |
|---|---|---|---|
| 15% | **060** | `txt060` | ריבית/דיבידנד מני"ע @ 15% |
| 20% | **067** | `txt067` | @ 20% |
| 25% | **141 / 157** | `txt141` (dividend) / `txt157` (interest) | @ 25% |
| 30% | **055** | `txt055` | @ 30% |

- **הפסדים להעברה** — remaining unused losses **carried forward** to next year. (In the 2024 example this box holds the value **678**; the field's own numeric code was not separately confirmed.)

---

## 3. The big picture: what gets combined where

```
867 א+ב  ─ taxable gains (by rate) ─────────────►  §ג row 1
         ─ losses ברי קיזוז (total) ────┐
                                         │  loss waterfall (§4)
867 ג    ─ dividend income (by rate) ──┐ │
         ─ interest income (by rate) ──┴─┴►  helper table row 1
         ─ tax withheld ──────────────────►  MAIN 1301 (credit, not Appendix C)
         ─ foreign portion ────────────────►  MAIN 1301 (1323/1324, foreign credit)
```

---

## 4. The loss waterfall (the core calculation)

The offset rules come from **Section 92** of the Income Tax Ordinance, per Tax Authority circular **10/2025** (קיזוז הפסדי הון). Implemented in `lib/867/waterfall.js` (`aggregate867` + `computeWaterfall`). It is **not** the IBKR tool's *"Optimized P/L"* (the unrelated buy-date-vs-sell-date FX choice in the CSV parser).

The order:

1. **Capital gains first.** Losses offset real capital gains (§ג row 1 → fill §ג **row 2**). **Carried-forward** losses from prior years are spent here *first* — §4.1 says they may **not** offset interest/dividend — preserving the more-flexible current-year losses.
2. **Interest & dividend with the remainder (current-year losses only).** Leftover current-year losses offset interest/dividend income (helper-table **row 2**), but only where the tax rate is **≤25%** (§3.3.2, "other securities"; the no-cap *same-security* case of §3.3.1 can't be proven from aggregated 867 data). Income at **0%** is never offset (no tax saved — matches the 2024 example's untouched 9 @ 0% dividend). This recovers tax the broker withheld.
3. **Carry forward what's left** → **הפסדים להעברה**, rolling into next year's §ג **row 3**. No time limit.

> **The order is the taxpayer's choice.** §6.1 — the ordering regulations are not enacted, so the taxpayer offsets "בסדר שבו יחפוץ". The tool therefore *proposes* the tax-optimal order (highest rate first) and the extension panel lets the user **review and edit** every value before filling. This keeps the tool's "not a tax advisor" stance: it computes a reviewable proposal, not a binding determination.

> **Out of scope (noted, not computed):** the inflationary-amount 3.5:1 offset (§3.1 — 867 gains are already real ILS) and foreign-loss ordering (Greenfeld — 867 doesn't separate foreign *capital* gains). The waterfall surfaces a warning when foreign interest/dividend is present. Neither worked example populates §ג **row 3** (carried-forward) or the helper table's pre-2006 **row 3** — those are described from the form's labels.

---

## 5. Multiple brokers (combine before filling)

Appendix C is filled **once** with the **sum across all brokers**. Combine **per rate and per category** before applying the waterfall:

- Section ג row 1 (taxable gain): sum each rate column across brokers.
- `הפסדים ברי קיזוז`: sum the loss totals across brokers (it is a single number per broker; pool them).
- Helper-table row 1: sum interest **and** dividend income per rate across brokers.
- Field 56 / `txt256`: sum all brokers' total sales.
- `txt054`: count of broker accounts.

Run the waterfall (§4) on the **pooled** numbers. The per-broker "losses offset against interest/dividend" checkbox is informational only; at the 1301 level the pooled gains-vs-losses balance decides whether anything is left to offset interest/dividend.

> **2025 detail (two brokers in one PDF).** The 2025 package combined **IBI** and **Psagot** 867s into one PDF, summarized into a single Appendix C. The brokers carry *different* withholding-file numbers (`930474655` IBI, `935807727` Psagot) and account numbers (`120047`, `208884`) — both are listed in the account table, but the body holds the combined totals.

---

## 6. Worked examples

### Example A — Tax year 2024 (single broker, IBI): losses exceed gains

**From the 867:**
- Taxable gain: **5,686** @ 25%
- Losses available (ברי קיזוז): **10,378**
- Dividend income: **341** @ 25% (+ 9 @ 0%, untaxed); foreign dividend 59
- Interest income: **3,673** @ 15%
- Total sales: **93,969** · transactions: 16
- Broker refund for loss offset (החזר בגין קיזוז): **636**

**Waterfall:**
1. Offset gains: `10,378 − 5,686 = 4,692` left. → §ג row 1 (25%) = 5,686, row 2 (25%) = 5,686, net gain = **0**.
2. Offset interest 3,673 @ 15%, then dividend 341 @ 25%: `4,692 − 3,673 − 341 = 678` left. → helper row 1 (15%)=3,673, (25%)=341; row 2 (15%)=3,673, (25%)=341; net interest/dividend = **0** in both buckets → `txt060`=0, `txt141/157`=0.
3. Carry forward: **הפסדים להעברה = 678**.

**Cross-check:** the broker's refund `636 = 551 (interest tax, 3,673 × 15%) + 85 (dividend tax, 341 × 25%)` — the loss offset recovered exactly the tax previously withheld on that interest and dividend. ✓
**1301:** `txt256` = 93,969.

### Example B — Tax year 2025 (two brokers: IBI + Psagot): gains exceed losses

**Combined from both 867s:**

| Item | IBI | Psagot | Combined |
|---|---|---|---|
| Taxable gain @ 15% | 1,757 | 0 | **1,757** |
| Losses (ברי קיזוז) | 1,094 | 38 | **1,132** |
| Interest @ 15% | 5,943 | 661 | **6,604** |
| Dividend @ 25% | 9 | 0 | **9** |
| Total sales | 112,609 | 20,343 | **132,952** |

**Waterfall:**
1. Offset gains: `1,132 − 1,757` → losses fully absorbed by the gain. → §ג row 1 (15%)=1,757, row 2 (15%)=1,132, **net gain = 625** @ 15%.
2. Nothing left → helper-table row 2 stays empty. Interest/dividend fully taxable: `txt060` (15%) = **6,604**, `txt141/157` (25%) = **9**.
3. Carry forward: **0**.

**1301:** field 56 / `txt256` = **132,952**; `txt054` (portfolios) = 2.

> ⚠️ **Carry-forward not applied in this example.** Example A produced a **678** carry-forward loss, which *should* land in 2025 §ג **row 3** (15%) and reduce the 625 net gain. The 2025 fill leaves row 3 empty and net gain 625 — i.e. the prior-year carry-forward appears **not** to have been applied. Treat this as a likely oversight in the sample, **not** as the rule: when filling a year that follows a loss year, enter the prior `הפסדים להעברה` into §ג **row 3** and recompute the net gain.

---

## 7. Step-by-step procedure

1. **Collect** every 867 sub-certificate for the year, across all brokers.
2. **Extract per broker:** taxable gains by rate (867 א+ב), `הפסדים ברי קיזוז` total, total sales (שדה 256), dividend income by rate (867 ג line 1), interest income by rate (867 ג line 7), and all `מס שנוכה במקור` (withheld tax) amounts.
3. **Combine** across brokers per rate/category (§5).
4. **Apply the waterfall** (§4) to the pooled numbers:
   - §ג row 1 = combined gains; row 2 = current-year loss offset; **plus** §ג row 3 = any prior-year `הפסדים להעברה`.
   - Helper row 1 = combined interest+dividend; row 2 = leftover current-year loss offset.
5. **Fill Appendix C:** §ג rows, field 56 (`txt256`), the helper table, and the transfer fields `txt060 / txt067 / txt141 / txt157 / txt055`.
6. **Record carry-forward:** put any unused losses in `הפסדים להעברה`.
7. **Fill the main 1301 (outside Appendix C):** tax-withheld credits (שדה 040 amounts), `txt054` portfolio count, and foreign income / foreign-tax credits (867 ג lines 2/5/8/10 → supplementary forms 1323/1324).
8. All values are integers — strip commas; round the agorot.

---

## Where the rest goes (not Appendix C)

| 867 item | Goes to | Why |
|---|---|---|
| מס שנוכה במקור (שדה 040), all sub-forms | Main 1301 withheld-tax / credit fields | It's a payment credit, not income |
| Foreign dividend/interest (867 ג lines 2, 8) | Supplementary forms 1323/1324 | Foreign-source reporting |
| Foreign tax paid (867 ג lines 5, 10) | Main 1301 foreign-tax credit | Credit for tax paid abroad |
| Deposit interest (867 / 867 ד, codes 076–142) | Main 1301 deposit-interest fields | Not a securities sale |

---

## Field-code quick reference

| Code | id | What |
|---|---|---|
| 56 / שדה 256 | `txtRhC56` / `txt256` | Total securities sales turnover |
| §ג row 1 | `txtRhC12` (15%) … | Taxable gain before offset |
| §ג row 2 | `txtRhC32` (15%) … | Current-year loss offset (gains) |
| helper sums | `txtSum15/20/25/30` | Net interest+dividend by rate |
| 060 | `txt060` | Net interest/dividend @ 15% |
| 067 | `txt067` | @ 20% |
| 141 / 157 | `txt141` / `txt157` | Dividend / interest @ 25% |
| 055 | `txt055` | @ 30% |
| 054 | `txt054` | Number of investment portfolios |
| 040 | — | Tax withheld at source (→ main 1301 credit) |
