# ScanLedger

ScanLedger is a retail operations system for small and medium stores that connects checkout scanning, inventory control, sales tracking, profit calculation, and low-stock monitoring in one workflow.

The system is built around a simple retail loop:

```text
scan -> identify product -> add to cart -> confirm sale -> update inventory -> update financial summary
```

## Purpose

Many small stores still track stock manually or use basic bookkeeping that does not connect sales activity to inventory changes. ScanLedger solves that by treating every checkout scan as a transaction event.

When a cashier confirms payment, ScanLedger automatically:

- records the sale
- reduces product stock
- calculates profit from cost price and selling price
- updates daily sales and profit totals
- checks whether any item has fallen below its low-stock threshold
- records an inventory audit trail entry
- keeps reorder recommendations ready by supplier

## Core Features

### Product Management

Each product stores the operating details needed for checkout and inventory control:

- product name
- barcode
- category or product type
- supplier
- cost price
- selling price
- quantity in stock
- low-stock threshold

Products are grouped by category in the inventory view, making it easier to scan stock levels across departments such as Foodstuff, Household, and Beverages.

### Barcode Checkout

The checkout screen supports barcode-based product lookup. A cashier can scan or type a barcode, and the product is added to the active cart.

The cart supports:

- adding scanned products
- increasing or decreasing item quantity
- clearing the active cart
- showing total due
- showing cost basis
- showing expected profit

### Active Cart Recovery

The active checkout cart is saved to browser `localStorage` on every cart change.

This protects the cashier from losing an in-progress checkout if:

- the browser refreshes
- the tab closes
- a second tab is opened
- the cashier needs to pause while a customer gets another item

When the page reloads, ScanLedger restores valid cart items and checks them against current product stock.

### Sale Recording

When payment is confirmed, ScanLedger creates a sale record containing:

- sale ID
- sold items
- quantity sold
- unit cost
- unit selling price
- line total
- line profit
- sale subtotal
- total cost
- total profit
- payment timestamp

### Inventory Automation

Stock automatically reduces after a confirmed sale.

Inventory can also increase through:

- supplier restocking
- customer returns
- opening stock when a product is created

The product inventory view includes quick `Restock +1` and `Return +1` controls.

### Profit Calculation

ScanLedger calculates profit from the difference between selling price and cost price.

Profit is tracked at multiple levels:

- line-item profit
- sale-level profit
- daily profit
- product performance
- category performance
- projected profit on stock currently available

### Low-Stock Monitoring

Each product has a low-stock threshold. In the Prisma/PostgreSQL model, this is mapped to the database column:

```text
low_stock_threshold
```

When a sale causes an item to fall below its threshold, ScanLedger displays an on-screen toast notification.

Example:

```text
⚠️ Sweet Treats Flakes is running low (3 left).
```

Low-stock items also appear in the Low Stock Watch and Smart Reorder Queue.

### Supplier Reorder Draft

The Insights tab includes a Supplier Reorder Draft that turns low-stock products into purchase-order-style drafts grouped by supplier.

For each supplier, ScanLedger shows:

- purchase order reference
- supplier name
- number of items to reorder
- total units recommended
- estimated purchase cost
- item-level order quantity
- barcode
- current stock
- low-stock threshold
- line cost estimate

Each draft can be copied as plain text, making it easy to send to a supplier or paste into a purchasing workflow.

### Inventory Audit Trail

Every stock movement is recorded in an audit trail.

Tracked movement types:

- sale
- restock
- return
- product created

Each audit entry includes:

- product
- barcode
- supplier
- movement type
- quantity change
- previous stock
- new stock
- reason
- timestamp

This gives the merchant a clear history of how inventory changed over time.

### Operations Command Center

The Insights tab provides an operational overview of the store, including:

- inventory value
- projected profit on hand
- gross margin
- reorder queue count
- total draft purchase order value
- category revenue performance
- category inventory exposure
- smart reorder recommendations
- profit leaders by product
- recent inventory audit activity

## Data Model

ScanLedger is designed around these core entities:

### Product

Stores inventory and pricing details.

Key fields:

- `id`
- `barcode`
- `name`
- `categoryId`
- `categoryName`
- `supplier`
- `costPrice`
- `sellingPrice`
- `stockQty`
- `lowStockAt`
- `createdAt`
- `updatedAt`

### Category

Groups products by product type.

Key fields:

- `id`
- `name`
- `createdAt`

### Sale

Represents a completed checkout transaction.

Key fields:

- `id`
- `subtotal`
- `totalCost`
- `profit`
- `paidAt`
- `createdAt`

### SaleItem

Stores the product-level details for each sale.

Key fields:

- `saleId`
- `productId`
- `quantity`
- `unitCost`
- `unitPrice`
- `lineTotal`
- `lineProfit`
- `productName`
- `productBarcode`
- `categoryName`

### StockMovement

Stores the inventory audit trail.

Key fields:

- `productId`
- `productName`
- `productBarcode`
- `supplier`
- `movementType`
- `quantity`
- `previousStock`
- `newStock`
- `reason`
- `createdAt`

## Tech Stack

- Next.js
- React
- TypeScript
- Prisma
- PostgreSQL-ready schema
- Browser `localStorage` for the current MVP demo state

## Current Persistence

The current MVP stores demo data in browser `localStorage` so the app can be tested quickly without database setup.

Stored browser state includes:

- products
- sales
- active cart
- stock movements

The Prisma schema is included to define the PostgreSQL-ready backend model.

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the local app:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js will choose the next available port.

## Available Scripts

Run the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

Run linting:

```bash
npm run lint
```

## Typical Workflow

1. Create products with barcode, category, supplier, cost price, selling price, stock quantity, and low-stock threshold.
2. Scan a product barcode at checkout.
3. Add products to the cart.
4. Confirm payment.
5. ScanLedger records the sale.
6. Stock automatically reduces.
7. Profit is calculated.
8. Low-stock warnings appear when needed.
9. Stock movements are logged in the audit trail.
10. Supplier reorder drafts update from low-stock inventory.

## Example Scenario

A cashier scans a carton of cereal at checkout. The item is added to the cart. When the sale is confirmed, ScanLedger reduces the stock quantity, records the sale, calculates profit, and checks the product threshold.

If the cereal stock falls below its threshold, the cashier sees a low-stock toast immediately. The product also appears in the reorder queue and inside a supplier-specific purchase order draft.

## Roadmap

Potential next improvements:

- connect the UI to PostgreSQL using Prisma Client
- add Supabase or Clerk authentication
- add cashier and manager roles
- add receipt printing
- add CSV export for sales and inventory reports
- add full returns workflow linked to original sales
- add supplier contact details
- add purchase order status tracking
- add dashboard charts for sales and profit trends
- add barcode scanner hardware testing notes

## Project Status

ScanLedger is currently an MVP prototype with a PostgreSQL-ready schema and browser-based demo persistence.

It demonstrates the complete operating loop for a small-store retail system:

```text
product setup -> checkout scanning -> sale recording -> stock update -> profit tracking -> audit trail -> reorder planning
```
