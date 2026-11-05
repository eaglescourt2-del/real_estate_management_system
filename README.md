# Enterprise Real Estate Sales and Management Application (Ghana)

A production-grade, internal business management platform engineered for Ghanaian real estate and land development enterprises.

---

## 🏛️ System Overview

This application centralizes and automates:
1. **Customer Relationship Management (CRM):** Staff-managed customer registration, Ghana Card verification, live webcam photograph capture, and document storage.
2. **Land Location & Inventory Management:** Multiple acquisition sites, plot numbering (`Plot 1`, `Plot 1A`, `Plot 1B`), standard Ghanaian plot dimensions ($70\times 100\text{ ft}$, $50\times 70\text{ ft}$), and mutual exclusivity logic between full and half plots.
3. **Sales & Customer Payments:** Deposits, instalment tracking, payment schedules, GHS currency calculations, Mobile Money (MTN, Telecel, AT), bank transfers, and cash receipts.
4. **Automated Documentation:** Non-editable, serialized Invoices, Receipts, Payment Vouchers, and Ledger Statements in PDF and Excel formats.
5. **Landowner Obligations:** Land acquisition deeds, payment tranches, landowner ledgers, and payout vouchers.
6. **Customer Refund Governance:** Controlled refund request workflow, deduction calculations, Managing Director approvals, and plot quarantine integrity.
7. **Daily Income & Expense Accounting:** Comprehensive cash flow tracking, P&L reporting, and anti-double-counting controls.
8. **Automated Notifications:** Meta WhatsApp Business API and email delivery for payment receipts, reminders, and confirmations (no SMS).
9. **Role-Based Access Control (RBAC):** Exactly 4 user roles:
   - Super Administrator
   - Managing Director
   - Administrator
   - Sales Agent
10. **White-Label Configuration:** Dynamic corporate identity, branding, logos, and gateway settings without hardcoded company names.

---

## 🛠️ Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, TanStack Query, TanStack Table, Recharts, Leaflet.
- **Backend:** NestJS, TypeScript, REST API architecture, Swagger / OpenAPI, Passport JWT, Argon2.
- **Database & Queue:** PostgreSQL 16 with Prisma ORM, Redis 7, BullMQ.
- **Integrations:** Meta WhatsApp Business Platform, Resend Email API, Ghanaian Payment Gateways (Paystack, Flutterwave, MoMo).
- **Document Generation:** PDFKit, React-PDF, ExcelJS.

---

## 🚀 Systematic Development Roadmap

- **Stage 1:** Requirements Analysis and System Architecture *(Current Stage - Blueprint Approved)*
- **Stage 2:** Database and Backend Infrastructure (PostgreSQL, Prisma, RBAC, Authentication, Audit Trail)
- **Stage 3:** Land Inventory Management (Locations, Plots, Full/Half Plot Rules, Pessimistic Locking)
- **Stage 4:** CRM and Customer Management (Webcam Photo Capture, Profiles, Ledger)
- **Stage 5:** Customer Payment Management (Instalments, MoMo/Bank/Cash, Invoices, Receipts)
- **Stage 6:** Landowner and Refund Management (Agreements, Vouchers, Deductions, Plot Quarantine)
- **Stage 7:** Daily Financial Management (Income, Expenses, P&L, Cash Flow, PDF/Excel Exports)
- **Stage 8:** WhatsApp and Email Integrations (Templates, Idempotent Delivery, Retry Logs)
- **Stage 9:** Management Dashboard and Analytics (Recharts Executive KPIs, Visual Map)
- **Stage 10:** Testing, Security Verification, and Production Deployment

