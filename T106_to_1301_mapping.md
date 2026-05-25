# T106 → Form 1301 HTML Field Mapping Instructions

## Overview

This document maps fields from **Form 106 (T106)** — the employer's certificate of salary and deductions — to input fields in the Israeli Tax Authority's income report form **1301** (HTML form at `secapp.taxes.gov.il`).

T106 field numbers are bracketed, e.g. `[158]`. HTML field IDs match the numeric suffix in the input's `id` attribute (e.g. `txt158`).

Only fields confirmed to be filled in the reference HTML are documented here. Fields whose values likely originate from broker/investment data (IBKR) rather than T106 are noted separately.

---

## Mappings: T106 → Form 1301

### Income Fields

| T106 Field # | T106 Label (Hebrew) | HTML Field ID | HTML Label (Hebrew) | Notes |
|---|---|---|---|---|
| `[158]` / `[172]` | משכורת | `txt158` | ממשכורת/משכר עבודה | Main salary total. T106 field 158 (gross salary). Value: 444,431 |
| `[244]` / `[245]` | שכר מבוטח ששילם המעסיק | `txt244` | הכנסה מבוטחת | Insured salary for pension purposes. Value: 413,500 |
| `[218]` / `[219]` | ברוטו לקה"ל ששילם המעסיק | `txt218` | משכורת שבשלה שילם המעביד לקרן השתלמות | Gross salary against which employer paid to Study Fund (קרן השתלמות). Value: 188,544 |

### Deduction / Withholding Fields

| T106 Field # | T106 Label (Hebrew) | HTML Field ID | HTML Label (Hebrew) | Notes |
|---|---|---|---|---|
| `[042]` | מס הכנסה | `txt042` | מס הכנסה שנוכה במקור | Income tax withheld at source. Value: 103,468 |
| `[045]` / `[086]` | קופת גמל 35% זיכוי | `txt045` | לקצבה כ"עמית שכיר" | Employee pension contribution (deducted from salary). Value: 24,810 |
| `[248]` / `[249]` | הפקדות המעסיק לקצבה | `txt248` | הפקדות המעביד לקופת גמל לקצבה | Employer contributions to pension fund. Value: 61,333 |
| `[011]` / `[012]` | מחיר יום ההבראה שהופחת | `txt011` | השתתפות זמנית - הפחתת דמי הבראה | Reduced recuperation pay (הבראה) deduction. Value: 334 |

### Donations

| T106 Field # | T106 Label (Hebrew) | HTML Field ID | HTML Label (Hebrew) | Notes |
|---|---|---|---|---|
| `[037]` / `[237]` + external | תרומות למוסדות ציבור | `txt037` | תרומות בשנת המס | **Combined source**: `txt037` = T106 field `[037]` (employer-reported donations) + separately provided annual donations total. If T106 field `[037]` is 0 or absent, use only the external donations amount. Both values must be summed before filling. |

---

## Fields NOT from T106 (Broker/Investment Data)

These fields were filled in the reference HTML but their values come from investment/brokerage data (e.g., IBKR), not from T106:

| HTML Field ID | Label | Value | Source |
|---|---|---|---|
| `txt060` | ריבית על ני"ע, ריבית ורווחים מקופות גמל ודיבידנד (מס 15%) | 3,673 | Broker statements |
| `txt157` | ריבית על ני"ע, ריבית מקופות גמל (מס עד 25%) | 1 | Broker statements |
| `txt141` | דיבידנד ורווח ממניות (מס 25%) | 59 | Broker statements |
| `txt054` | מספר תיקיות השקעה - רווח הון מני"ע סחירים | 2 | Broker account count |
| `txt256` | סה"כ סכום המכירות מרווח הון מני"ע סחירים | 117,699 | Broker statements |
| `txt290` | סה"כ הכנסות חו"ל | 60 | Broker/foreign income |
| `txtMekorotAherim1` | מקורות אחרים (פרט/י) | ראה קובץ פירוטים | Manual description |
| `txtMekorotAherim2` | מקורות אחרים - סכום | 548 | Broker/other |
| `txt209` | סה"כ הכנסות/רווחים פטורים ובלתי חייבים במס | 548 | Derived/broker |
| `txt233` | (שדה מחושב משנים קודמות) | 2 | Prior years / manual |

---

## Filling Logic (Step-by-Step)

When given a T106 PDF, extract and fill as follows:

1. **`txt158`** ← T106 field `[158]` (משכורת total)
2. **`txt244`** ← T106 field `[244]` (שכר מבוטח ששילם המעסיק)
3. **`txt218`** ← T106 field `[218]` (ברוטו לקה"ל / קרן השתלמות gross salary)
4. **`txt042`** ← T106 field `[042]` (מס הכנסה withheld)
5. **`txt045`** ← T106 field `[045]` (employee pension contribution)
6. **`txt248`** ← T106 field `[248]` (employer pension contributions)
7. **`txt011`** ← T106 field `[011]` (הבראה reduction, if non-zero)
8. **`txt037`** ← T106 field `[037]` + separately provided donations amount (sum both; either may be 0)

All values should be integers (strip commas).

---

## T106 Reference Data (From Sample: Evinced_T106.pdf, Tax Year 2024)

| T106 Field | Label | Value |
|---|---|---|
| [158] | משכורת | 444,431 |
| [244] | שכר מבוטח ששילם המעסיק | 413,500 |
| [218] | ברוטו לקה"ל | 188,544 |
| [042] | מס הכנסה | 103,468 |
| [045] | קופת גמל לקצבה (עמית שכיר) | 24,810 |
| [248] | הפקדות המעסיק לקצבה | 61,333 |
| [011] | הפחתת דמי הבראה | 334 |
| [037] | תרומות למוסדות ציבור | (verify) |
