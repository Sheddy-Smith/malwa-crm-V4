# SUPPLIER → INVENTORY → ACCOUNTS DEEP RELATION & DATA FLOW

## Overview
This document defines the complete data flow, relationships, and redirections between:
- **Supplier Module** (Supplier Details, Supplier Ledger)
- **Inventory Module** (Stock, Add Category)
- **Accounts Module** (Purchase, Voucher, Invoice, Challan, GST Ledger)

---

## 1. SUPPLIER MODULE

### A) Supplier Details (`/supplier?tab=details`)

**Purpose:** Master data for all suppliers (materials providers)

**Data Stored:**
- `suppliers` table: id, name, phone, company, category, address, gstin, credit_limit

**Key Relationships:**
1. **→ Inventory Categories:** 
   - Supplier category dropdown loads from `inventory_categories` table
   - When creating/editing supplier, category must exist in inventory
   
2. **→ Accounts Purchase:**
   - Supplier ID used in `purchases` table (supplier_id field)
   - Name displayed in purchase invoice dropdown
   
3. **→ Supplier Ledger:**
   - Supplier ID links to `supplier_ledger_entries` table
   - All financial transactions tracked per supplier

**Data Flow:**
```
inventory_categories → supplier.category (dropdown)
suppliers → purchases.supplier_id (FK)
suppliers → supplier_ledger_entries.supplier_id (FK)
suppliers → vouchers (when payment made)
```

### B) Supplier Ledger (`/supplier?tab=ledger`)

**Purpose:** Track all financial transactions with suppliers (AP tracking)

**Data Stored:**
- `supplier_ledger_entries` table: supplier_id, entry_type, amount, entry_date, reference_type, reference_id, reference_no

**Key Relationships:**
1. **← Accounts Purchase:**
   - When purchase invoice created → automatic ledger entry (DEBIT)
   - `reference_type = 'purchase'`, `reference_id = purchase.id`
   
2. **← Accounts Voucher:**
   - When payment made to supplier → ledger entry (CREDIT)
   - `reference_type = 'payment'`, `reference_id = voucher.id`
   
3. **← Accounts Challan:**
   - When purchase challan created → ledger entry (DEBIT)
   - `reference_type = 'purchase_challan'`, `reference_id = challan.id`

**Data Flow:**
```
Purchase Invoice → supplier_ledger_entries (DEBIT - increases payable)
Payment Voucher → supplier_ledger_entries (CREDIT - decreases payable)
Purchase Challan → supplier_ledger_entries (DEBIT - material received)
```

**Balance Calculation:**
```
Outstanding Balance = SUM(debit_amount) - SUM(credit_amount)
```

---

## 2. INVENTORY MODULE

### A) Stock (`/inventory?tab=stock`)

**Purpose:** Manage all inventory items/products with stock tracking

**Data Stored:**
- `inventory_items` table: id, item_name, category_id, unit, current_stock, min_stock, max_stock, unit_price
- `stock_movements` table: item_id, movement_type, quantity, movement_date, reference_type, reference_id

**Key Relationships:**
1. **← Inventory Categories:**
   - Item category_id links to `inventory_categories.id`
   - Category dropdown loads from categories
   
2. **← Accounts Purchase:**
   - When purchase created → stock IN movement
   - `stock_movements`: type='in', reference_type='purchase'
   - Updates `inventory_items.current_stock` (+quantity)
   
3. **→ Accounts Invoice/Challan:**
   - When selling → stock OUT movement
   - `stock_movements`: type='out', reference_type='invoice/challan'
   - Updates `inventory_items.current_stock` (-quantity)

**Data Flow:**
```
inventory_categories → inventory_items.category_id (FK)
purchases → stock_movements (IN) → inventory_items.current_stock (UPDATE)
invoices/challans → stock_movements (OUT) → inventory_items.current_stock (UPDATE)
```

**Stock Calculation:**
```
current_stock = opening_stock + SUM(IN movements) - SUM(OUT movements)
```

### B) Add Category (`/inventory?tab=categories`)

**Purpose:** Master data for all item categories

**Data Stored:**
- `inventory_categories` table: id, name, description, created_at

**Key Relationships:**
1. **→ Inventory Stock:**
   - Categories used in inventory items dropdown
   
2. **→ Supplier Details:**
   - Categories used in supplier category dropdown
   - Links supplier to product types they provide

**Data Flow:**
```
inventory_categories → inventory_items.category_id (FK)
inventory_categories → suppliers.category (reference)
```

---

## 3. ACCOUNTS MODULE

### A) Purchase (`/accounts?tab=purchase`)

**Purpose:** Create purchase invoices from suppliers with automatic stock IN

**Data Stored:**
- `purchases` table: id, invoice_no, invoice_date, supplier_id, item_id, quantity, unit_price, cgst, sgst, igst, total_amount

**CRITICAL DATA FLOW (Atomic Transaction):**

When Purchase Invoice Created:
```
1. INSERT into `purchases` table
   - Links to supplier_id
   - Links to item_id (inventory)
   
2. INSERT into `stock_movements` table
   - movement_type = 'in'
   - quantity = purchase quantity
   - reference_type = 'purchase'
   - reference_id = purchase.id
   
3. UPDATE `inventory_items` table
   - current_stock += quantity
   
4. INSERT into `supplier_ledger_entries` table
   - supplier_id = purchase.supplier_id
   - entry_type = 'debit'
   - amount = total_amount
   - reference_type = 'purchase'
   - reference_id = purchase.id
   
5. INSERT into `journal_entries` + `journal_lines` (if accounting enabled)
   - DEBIT: Inventory Account
   - CREDIT: Accounts Payable
```

**Key Relationships:**
1. **Supplier Master Data:**
   - Loads from `suppliers` table for dropdown
   - supplier_id stored in purchase
   
2. **Inventory Items:**
   - Loads from `inventory_items` table for item dropdown
   - item_id stored in purchase
   
3. **Supplier Ledger:**
   - Automatic entry created on purchase
   
4. **Stock Management:**
   - Automatic stock IN movement

**Data Flow:**
```
suppliers → purchases.supplier_id (FK)
inventory_items → purchases.item_id (FK)
purchases → stock_movements (INSERT)
purchases → supplier_ledger_entries (INSERT)
purchases → inventory_items.current_stock (UPDATE +)
```

### B) Voucher (`/accounts?tab=voucher`)

**Purpose:** Record payments to suppliers/vendors

**Data Stored:**
- `vouchers` table: id, voucher_no, voucher_date, voucher_type, payee_type, payee_id, amount, payment_mode, reference

**CRITICAL DATA FLOW:**

When Payment Voucher Created:
```
1. INSERT into `vouchers` table
   - payee_type = 'supplier'
   - payee_id = supplier.id
   
2. INSERT into `supplier_ledger_entries` table
   - supplier_id = payee_id
   - entry_type = 'credit'
   - amount = voucher amount
   - reference_type = 'payment'
   - reference_id = voucher.id
   
3. INSERT into `journal_entries` + `journal_lines`
   - DEBIT: Accounts Payable
   - CREDIT: Cash/Bank Account
```

**Key Relationships:**
1. **Supplier Master:**
   - Links to supplier via payee_id
   
2. **Supplier Ledger:**
   - Reduces outstanding balance

**Data Flow:**
```
suppliers → vouchers.payee_id (when payee_type='supplier')
vouchers → supplier_ledger_entries (INSERT CREDIT)
```

### C) Invoice (`/accounts?tab=invoice`)

**Purpose:** Create sales invoices to customers with automatic stock OUT

**Data Stored:**
- `invoices` table: id, invoice_no, invoice_date, customer_id, items[], subtotal, tax, total

**CRITICAL DATA FLOW:**

When Sales Invoice Created:
```
1. INSERT into `invoices` table
   - Links to customer_id
   - items[] contains array of inventory items
   
2. For each item in invoice:
   INSERT into `stock_movements` table
   - movement_type = 'out'
   - quantity = item quantity
   - reference_type = 'invoice'
   - reference_id = invoice.id
   
3. For each item in invoice:
   UPDATE `inventory_items` table
   - current_stock -= quantity
   
4. INSERT into `customer_ledger_entries` table
   - customer_id = invoice.customer_id
   - entry_type = 'debit'
   - amount = total
   - reference_type = 'invoice'
```

**Key Relationships:**
1. **Inventory Stock:**
   - Reduces stock when invoice created
   
2. **Customer Ledger:**
   - Creates receivable entry

**Data Flow:**
```
inventory_items → invoices.items (multiple)
invoices → stock_movements (INSERT OUT)
invoices → inventory_items.current_stock (UPDATE -)
invoices → customer_ledger_entries (INSERT)
```

### D) Challan (`/accounts?tab=challan`)

**Purpose:** Delivery/Material outward notes

**Data Stored:**
- `purchase_challans` table (incoming materials)
- `sell_challans` table (outgoing materials)

**CRITICAL DATA FLOW:**

Purchase Challan (Material IN):
```
1. INSERT into `purchase_challans` table
   - supplier_id
   - items[]
   
2. INSERT into `stock_movements` (IN)
3. UPDATE `inventory_items.current_stock` (+)
4. INSERT into `supplier_ledger_entries` (DEBIT)
```

Sell Challan (Material OUT):
```
1. INSERT into `sell_challans` table
   - customer_id or vehicle_no
   - items[]
   
2. INSERT into `stock_movements` (OUT)
3. UPDATE `inventory_items.current_stock` (-)
```

**Data Flow:**
```
purchase_challans → stock_movements (IN) → inventory_items (UPDATE +)
sell_challans → stock_movements (OUT) → inventory_items (UPDATE -)
purchase_challans → supplier_ledger_entries (INSERT)
```

### E) GST Ledger (`/accounts?tab=gst`)

**Purpose:** Track all GST transactions (Input & Output)

**Data Stored:**
- Derived from purchases (Input GST) and invoices (Output GST)

**Data Flow:**
```
purchases → Input GST (CGST + SGST + IGST paid)
invoices → Output GST (CGST + SGST + IGST collected)

Net GST = Output GST - Input GST
```

**Key Calculations:**
```
Input GST = SUM(purchases.cgst + purchases.sgst + purchases.igst)
Output GST = SUM(invoices.cgst + invoices.sgst + invoices.igst)
GST Payable = Output GST - Input GST (if positive)
GST Refundable = Input GST - Output GST (if negative)
```

---

## 4. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────┐
│                    INVENTORY CATEGORIES                      │
│                    (Master Data)                             │
└────────┬────────────────────────────────────┬───────────────┘
         │                                    │
         ↓                                    ↓
┌────────────────────┐              ┌────────────────────┐
│  SUPPLIERS         │              │  INVENTORY ITEMS   │
│  - category FK     │              │  - category_id FK  │
└─────┬──────────────┘              └──────┬─────────────┘
      │                                    │
      ↓                                    ↓
┌─────────────────────────────────────────────────────────────┐
│                      PURCHASES                               │
│  - supplier_id FK                                           │
│  - item_id FK                                               │
│  - quantity, price, GST                                     │
└──┬────────┬────────┬─────────────────────────────────┬─────┘
   │        │        │                                 │
   │        │        │                                 │
   ↓        ↓        ↓                                 ↓
┌──────┐ ┌──────┐ ┌────────────────┐    ┌──────────────────────┐
│ SUPP │ │STOCK │ │ INVENTORY_ITEMS│    │   JOURNAL_ENTRIES    │
│LEDGER│ │ MOVE │ │  current_stock │    │   (Accounting)       │
│(DEBIT)│ │(IN) │ │    UPDATE (+)  │    │   Inventory/AP       │
└──────┘ └──────┘ └────────────────┘    └──────────────────────┘
   │
   │
   ↓
┌──────────────────┐
│   VOUCHERS       │
│  (Payments)      │
└──────┬───────────┘
       │
       ↓
┌──────────────────┐
│ SUPPLIER_LEDGER  │
│    (CREDIT)      │
│ Reduces Balance  │
└──────────────────┘

┌────────────────────┐
│   INVOICES         │
│  (Sales)           │
└──┬─────────┬───────┘
   │         │
   ↓         ↓
┌──────┐ ┌────────────────┐
│STOCK │ │ INVENTORY_ITEMS│
│ MOVE │ │  current_stock │
│(OUT) │ │    UPDATE (-)  │
└──────┘ └────────────────┘

┌────────────────────────────────┐
│        GST LEDGER              │
│                                │
│  Input GST  ← Purchases        │
│  Output GST ← Invoices         │
│  Net GST = Output - Input      │
└────────────────────────────────┘
```

---

## 5. NAVIGATION & REDIRECTIONS

### From Supplier Details:
- **→ Supplier Ledger:** Click supplier name/view ledger button
- **→ Accounts Purchase:** Click "Create Purchase" (pre-fills supplier)
- **→ Accounts Voucher:** Click "Make Payment" (pre-fills supplier)

### From Supplier Ledger:
- **→ Accounts Purchase:** Click reference number in purchase entries
- **→ Accounts Voucher:** Click reference number in payment entries
- **→ Supplier Details:** Click "Back to Details"

### From Inventory Stock:
- **→ Inventory Categories:** Click "Manage Categories"
- **→ Accounts Purchase:** Click "Purchase Stock" (shows items)
- **→ Stock Movements:** Click "View History" for item

### From Inventory Categories:
- **→ Inventory Stock:** Click "View Items" in category
- **→ Supplier Details:** Click "View Suppliers" in category

### From Accounts Purchase:
- **→ Supplier Details:** Click supplier name
- **→ Supplier Ledger:** Click "View Ledger" for supplier
- **→ Inventory Stock:** Click item name
- **→ Stock Movements:** Click "View Stock IN"

### From Accounts Voucher:
- **→ Supplier Ledger:** Click "View Ledger" for supplier
- **→ Supplier Details:** Click supplier name

### From Accounts Invoice:
- **→ Inventory Stock:** Click item name
- **→ Stock Movements:** Click "View Stock OUT"

### From Accounts GST Ledger:
- **→ Accounts Purchase:** Click purchase entry
- **→ Accounts Invoice:** Click invoice entry

---

## 6. VALIDATION RULES

### Supplier Module:
1. Supplier category must exist in `inventory_categories`
2. GSTIN format validation (if provided)
3. Supplier name must be unique

### Inventory Module:
1. Category must exist before adding items
2. Stock cannot go negative
3. Unit must be specified (kg, pcs, liters, etc.)

### Accounts Purchase:
1. Supplier must exist
2. Inventory item must exist
3. Quantity > 0
4. Unit price > 0
5. Stock IN movement must succeed
6. Ledger entry must succeed
7. All operations must be atomic (transaction)

### Accounts Voucher:
1. Supplier must exist (if payment to supplier)
2. Amount > 0
3. Payment mode must be specified
4. Ledger entry must succeed

### Accounts Invoice:
1. Items must exist in inventory
2. Sufficient stock must be available
3. Stock OUT movement must succeed
4. All operations must be atomic

---

## 7. ERROR HANDLING

### Atomic Transaction Failures:
If any part of the flow fails, ALL operations must rollback:

```javascript
// Purchase Transaction Example
try {
  beginTransaction();
  
  // 1. Insert purchase
  const purchase = await insertPurchase(...);
  
  // 2. Insert stock movement
  await insertStockMovement(...);
  
  // 3. Update inventory stock
  await updateInventoryStock(...);
  
  // 4. Insert ledger entry
  await insertSupplierLedger(...);
  
  // 5. Insert journal entries
  await insertJournalEntries(...);
  
  commitTransaction();
} catch (error) {
  rollbackTransaction();
  throw new Error('Purchase creation failed');
}
```

### Data Integrity Checks:
1. Foreign key validation before insert
2. Stock availability check before OUT
3. Balance check before ledger update
4. Duplicate invoice number prevention

---

## 8. IMPLEMENTATION CHECKLIST

### Supplier Module:
- [ ] Category dropdown loads from inventory_categories
- [ ] Supplier creation validates category exists
- [ ] Supplier ledger shows all transactions
- [ ] Navigation to Purchase with pre-filled supplier
- [ ] Navigation to Voucher with pre-filled supplier

### Inventory Module:
- [ ] Categories CRUD operations
- [ ] Stock items linked to categories
- [ ] Stock movements tracked for all IN/OUT
- [ ] Current stock calculated correctly
- [ ] Stock history shows all transactions

### Accounts Purchase:
- [ ] Supplier dropdown loads from suppliers
- [ ] Item dropdown loads from inventory_items
- [ ] Atomic transaction for all operations
- [ ] Stock IN movement created
- [ ] Inventory stock updated (+)
- [ ] Supplier ledger entry (DEBIT) created
- [ ] Journal entries created
- [ ] GST captured correctly

### Accounts Voucher:
- [ ] Supplier selection for payment
- [ ] Supplier ledger entry (CREDIT) created
- [ ] Outstanding balance reduced
- [ ] Journal entries created

### Accounts Invoice:
- [ ] Stock OUT movement created
- [ ] Inventory stock updated (-)
- [ ] Customer ledger entry created
- [ ] GST captured correctly

### Accounts Challan:
- [ ] Purchase challan creates stock IN
- [ ] Sell challan creates stock OUT
- [ ] Ledger entries created

### Accounts GST Ledger:
- [ ] Input GST from purchases
- [ ] Output GST from invoices
- [ ] Net GST calculation
- [ ] Period-wise reporting

---

## 9. TESTING SCENARIOS

### Scenario 1: Complete Purchase Flow
1. Add category "Hardware" in Inventory
2. Add supplier "ABC Suppliers" with category "Hardware"
3. Add inventory item "Bolt" in "Hardware" category
4. Create purchase invoice: Supplier=ABC, Item=Bolt, Qty=100
5. Verify: Stock IN movement created
6. Verify: Inventory stock = 100
7. Verify: Supplier ledger shows DEBIT entry
8. Verify: Outstanding balance updated

### Scenario 2: Payment to Supplier
1. Create payment voucher to ABC Suppliers for ₹5000
2. Verify: Supplier ledger shows CREDIT entry
3. Verify: Outstanding balance reduced by ₹5000

### Scenario 3: Sales with Stock OUT
1. Create sales invoice with item "Bolt", Qty=50
2. Verify: Stock OUT movement created
3. Verify: Inventory stock = 50 (100-50)
4. Verify: Customer ledger entry created

### Scenario 4: GST Calculation
1. Verify Input GST from purchases
2. Verify Output GST from invoices
3. Verify Net GST = Output - Input

---

## 10. DATABASE SCHEMA DEPENDENCIES

```
inventory_categories (id, name)
    ↓
suppliers (id, name, category)
inventory_items (id, name, category_id)
    ↓
purchases (id, supplier_id, item_id, quantity)
    ↓
stock_movements (id, item_id, reference_type, reference_id)
supplier_ledger_entries (id, supplier_id, reference_type, reference_id)
    ↓
vouchers (id, payee_id, payee_type)
invoices (id, customer_id, items[])
```

---

This document serves as the complete specification for implementing and maintaining the data flow between Supplier, Inventory, and Accounts modules.
