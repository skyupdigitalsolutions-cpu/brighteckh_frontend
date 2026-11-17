You are designing new desktop screens in an existing Figma file using the Figma MCP. Read the existing file first and extend it; do not restyle anything that already exists.

FILE
https://www.figma.com/design/SAnylnS2Dp9zicCjzrU16H/Brightech-JMS-%E2%80%94-UI
Work on the page "☀️ Light theme — All screens" (177:102060). Dark theme is out of scope for this round.

WHAT TO DESIGN
BR-11 "Sales & Supply": the direct product-sales business (selling spare parts from stock or bought in), separate from the repair-job flow. It needs desktop screens for four roles: Sales, Purchase, Finance and System admin. Nothing for BR-11 exists in the file yet.

BEFORE YOU DRAW, STUDY THESE EXISTING SCREENS AND COPY THEIR PATTERNS EXACTLY
- Stores / Quality panel "ST-D · Stores / Quality · Desktop panel" (177:139285): list page (STR0), create form (STG0), split detail with a photo gate (STG1–STG7). This is the closest model for Outward + packing photo.
- Sales panel "S-D · Sales · Desktop panel" (177:137224): list with stage tabs + toolbar (SS0), quote view.
- Purchase screens "03c Jobs", "03e Sourcing", "03f Quotes", "03g Orders" (every-interaction sections): table cards, row menus, drawers, tab bars, quote builder.
- Purchase overview D·P0 (177:102544): dashboard cards.
Reuse these components and variables, never detached copies, and no new colours, radii or type styles:
- Shell / Top nav · <role>, Shell / Page header (76:802)
- Status badge (3:14): label = the API enum value with underscores as spaces; tone from the badge catalogue meaning (Neutral = not started, Progress = moving, Success = done, Blocked = needs action / stopped)
- Button (4:392), Text field (4:451), Inline alert (5:332), Gated action (5:409), Photo capture (6:499), Empty state (5:438), Pagination (33:742)
- Table card / header row / rows as in Inward register (177:102758), Drawer as in "P1 · Create JIN (drawer)" (177:108243)
- Typography: Desktop/H1/H2/Body/Small/Table header, Data/ID (mono) for every document number, Data/Number for qty and money

FRAME CONVENTIONS (match the existing ones)
- One section per role panel, named like the others: "SS-D · Sales · Product sales", "PS-D · Purchase · Sales & Supply", "F-D · Finance · Desktop panel", "A-D · System admin · Sales policy".
- Frames 1440×1024: Top nav instance (28,24 · 1384×72) → Page header (28,116 · 1384×52) → Content (28,188 · 1384×808), exactly as ST-D.
- Frame names: "<CODE><n> · <screen> · <state>", e.g. "SE0 · Enquiries · list", "SE1 · Enquiry SE-BLR-000012 · RECEIVED".
- Put a "Spec note" instance under each frame saying which API endpoint feeds it, as the existing frames do.
- Realistic Indian B2B sample data: industrial spares (IGBT modules, DC bus capacitors, contactors, encoders), Bengaluru / Chennai customers, ₹ amounts, BLR company.

GLOBAL RULES (these are product rules, not suggestions)
1. Actions a role can never do are HIDDEN, not disabled. Disabled is only for gates the role CAN clear, always with the visible reason (Gated action pattern).
2. Every list and detail screen needs four states: loading (skeleton rows), empty (Empty state with what to do next), error (retry), and loaded. Draw at least loading + empty + loaded for every list.
3. Numbers arrive as strings. Money is stored in paise: show ₹ with Indian grouping (₹1,24,500.00), right-aligned mono. Qty: trim zeros + unit ("4 NOS").
4. Dates are IST, "04 Nov 2026, 10:42".
5. Products are Item Master items only (item code + name), never assemblies.
6. Supplier price / cost / margin is visible ONLY to Purchase. Sales and Finance screens must not have that column at all.
7. Config gates that are CLIENT-UNCONFIRMED must be drawn as BLOCKED states with the reason, never as fake values: product invoice trigger, payment-before-closure, product GST rate/HSN, advance policy per order. Draw both the blocked and the configured variant where it matters.
8. Locked after issue/dispatch: issued quote revisions, verified orders and dispatched outwards are read-only (lock icon state of Text field). Changes go through a "new revision" or "change request".

THE FLOW AND ITS DATA (design to these exact statuses and fields)

A. Enquiry (Sales creates; everyone views)
- Number SE-<CO>-000001. Fields: customer, enquiry_channel (EMAIL / WHATSAPP / PHONE / WEBSITE / WALK_IN / REFERRAL / OTHER), enquiry_details, optional source evidence file, lines (item or free description, qty, uom, desired_condition NEW / REFURBISHED / REPAIRED / OTHER).
- Status: RECEIVED → QUOTED, or CANCELLED (cancel needs a reason).
- Screens: enquiry list (filters: status; search: number / customer), create-enquiry drawer, enquiry detail (lines + linked quotes + cancel).

B. Product quote (Purchase prices it; Sales sends it and records the customer response)
- Number SQ-<CO>-000001, with revisions 0,1,2… Revision status DRAFT → ISSUED, or CANCELLED. A new revision needs a reason; issued revisions are immutable.
- Revision terms: validity_until, payment / delivery / warranty / tax terms (text).
- Lines (Purchase adds them on DRAFT): item, description, manufacturer, part number, specification, product_condition, warranty, alternative label, qty, uom, unit price (paise), list price (paise), line total. Show indicative stock availability per line ("ledger allocatable", indicative only, nothing reserved).
- Issue is blocked unless the customer is APPROVED and every item is APPROVED/ACTIVE: draw that blocked state.
- Sales sends the issued revision via channel EMAIL / WHATSAPP / PDF_PRINT / OTHER (a "sent" log), then records customer responses: ENQUIRY / NEGOTIATING / ACCEPTED / PART_ACCEPTED / REJECTED / NO_RESPONSE.
- Screens:
  - Purchase: "Quotes to price" worklist with stages TO_PRICE (draft) / ISSUED / WITH_CUSTOMER / ACCEPTED / PART_ACCEPTED / REJECTED / CANCELLED, plus a quote builder (lines table + terms + issue + new revision + revision history).
  - Sales: quote view (no list price if you choose, never supplier cost) + send drawer + record-response drawer.

C. Sales Order (Sales or Purchase drafts it from the accepted lines; Purchase verifies)
- Drafted from the accepted lines/qty of the current issued revision (prices are snapshotted). Status: DRAFT → VERIFIED → PART_DELIVERED → DELIVERED → CLOSED, or CANCELLED. The number SO-<CO>-000001 is assigned only at VERIFY (before that it is a draft with no number).
- Authorisation evidence (Sales or Purchase attach): source_kind CUSTOMER_PO / ORDER_CONFIRMATION / EMAIL_AUTHORISATION, with verified_status PENDING / VERIFIED / REJECTED. Purchase verifies against the quote + customer.
- Payment terms per order (Purchase): advance_kind NOT_REQUIRED / FIXED_AMOUNT / PERCENTAGE / FULL. These are required before any reservation or sourcing: draw the blocked "record payment terms first" state. If an advance is required, Finance confirms it against a customer payment receipt.
- Order lines show: accepted qty, unit price, line status, and the quantity pipeline reservation_pending / reserved / sourcing_authorised / shipped / delivered / invoiced / outstanding delivery. Make this pipeline readable at a glance (it is the heart of the order screen).
- Change requests (Sales or Purchase raise, Purchase decides): change_kind PRICE / QTY / CANCELLATION / SUBSTITUTION / BACKORDER_REMOVAL / DELIVERY_DATE / OTHER, decision PENDING / APPROVED / REJECTED. Only an approved CANCELLATION changes data.
- Close (Purchase): a closure review that passes only when POD-delivered = invoiced = ordered, a live invoice exists, and payment is complete IF the payment-before-closure policy says so. If that policy is unconfigured, closure is BLOCKED: draw that state and the "checks failed" state, listing which check failed.
- Screens: order list (Sales + Purchase), order detail (header, authorisations, payment terms, lines pipeline, reservations, outwards, change requests, invoices, closure), plus drawers: attach authorisation, verify, payment terms, change request, decide change request, close.

D. Reservation + sourcing (Purchase only)
- Reserve stock against an order line from MAIN_STORE allocatable stock only (real stock ledger). Reservation state: REQUESTED / CONFIRMED / FAILED / RELEASED / CONSUMED. A line can't be reserved twice beyond its qty: show the "insufficient stock / already reserved" outcome honestly, with the allocatable number.
- Shortfall → sourcing: authorise a supplier per order line (supplier, offer + comparison evidence, rank; MD evidence if not the L1 offer), then raise a SALES_ORDER supplier PO (same PO series as repair POs, no job number). Supplier prices are visible here (Purchase only).
- Screens: reserve drawer from an order line (shows allocatable), release reservation, sourcing authorisation drawer, the SO's supplier POs list.

E. Outward / dispatch (Purchase)
- DRAFT outward for one customer; each line ships one whole CONFIRMED reservation. Dispatch mode COURIER / CUSTOMER_PICKUP / OWN_TRANSPORT / OTHER, recipient, destination address, carrier, tracking reference.
- Per line: pick (verify item / part / qty; serial numbers for serial-tracked items) → packing evidence: evidence_kind PHOTO / VIDEO / PACKING_LIST / SERIAL_LABEL / OTHER. This is a PHOTO GATE: dispatch is blocked until each line has packing evidence. Use Gated action + Photo capture exactly like Stores STG1/STG2.
- Line status DRAFT → PICKED → DISPATCHED → DELIVERED. Outward status DRAFT → DISPATCHED, or CANCELLED (only before dispatch).
- Dispatch posts a real stock ISSUE out of MAIN_STORE and assigns SOUT-<CO>-000001. Show the resulting stock movement after dispatch (as Stores STG4 shows "Accepted → MAIN STORE").
- After dispatch: tracking events timeline, then per-line proof of delivery: delivery_status DELIVERED / FAILED / DAMAGED (+ evidence).
- Screens: outward list (Purchase), create outward drawer (pick reservations), outward detail with per-line pick / packing gate / dispatch, tracking, POD drawer.

F. Product invoice (Finance)
- PRODUCT_SALES tax invoice on the same INV series as repair invoices, but with no repair job number. Finance previews (no number consumed), then issues.
- BLOCKED until the company has BOTH an invoice trigger (ADVANCE / DISPATCH / DELIVERY; MILESTONE is not supported) AND a product GST rate configured. Draw the blocked state, the preview (tax regime INTRA_STATE / INTER_STATE: CGST+SGST vs IGST, HSN per line), and the issued invoice.
- Finance also confirms a required advance against a customer payment receipt.
- Screens: Finance shell (new: "F-D · Finance"), with a product-invoice queue (orders ready to invoice per the trigger), preview, issued invoice view, and an advance-confirmation queue.

G. System admin: Sales policy
- One screen showing invoice_trigger (ADVANCE / DISPATCH / DELIVERY / MILESTONE, or unset = BLOCKED), requires_full_payment_for_closure (yes / no / unset = BLOCKED), the product GST rate (read-only here), and what is currently blocked. Mark it CLIENT-UNCONFIRMED.

NAVIGATION (where these live)
- Sales top nav: keep Dashboard / To send / Sent / Responses (repair quotes) and add product-sales pills: "Enquiries", "Product quotes", "Orders".
- Purchase top nav: add "Sales & Supply" (sub-tabs: Quotes to price · Orders · Outwards), or propose a better grouping that fits the 9-pill bar.
- Finance: new shell, pills "Product invoices", "Advances".
- System admin: "Sales policy" next to the existing admin pills.

DELIVERABLES
1. The sections and frames above, every list/detail in its states, every gate in both blocked and cleared states, and every drawer.
2. Add any new status-enum tones to the "Badge catalogue · API status enums" (01 · Components, 3:22) as new rows.
3. Add new open questions (anything the flow above doesn't decide) to "90 · Open questions".
4. Reply with a list of section + frame node IDs so the developer can map each screen.
