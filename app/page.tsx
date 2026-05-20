"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  barcode: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockAt: number;
  createdAt: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type SaleItem = {
  productId: string;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  lineTotal: number;
  lineProfit: number;
};

type Sale = {
  id: string;
  items: SaleItem[];
  subtotal: number;
  totalCost: number;
  profit: number;
  paidAt: string;
};

type ProductForm = {
  barcode: string;
  name: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  lowStockAt: string;
};

const storageKey = "scanledger-state-v1";

const seedProducts: Product[] = [
  {
    id: "prod-rice-5kg",
    barcode: "600100100001",
    name: "Mama Gold Rice 5kg",
    costPrice: 9800,
    sellingPrice: 12500,
    stockQty: 16,
    lowStockAt: 5,
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-soap",
    barcode: "600100100002",
    name: "Fresh Bar Soap",
    costPrice: 450,
    sellingPrice: 700,
    stockQty: 28,
    lowStockAt: 8,
    createdAt: new Date().toISOString()
  },
  {
    id: "prod-milk",
    barcode: "600100100003",
    name: "Peak Milk Sachet",
    costPrice: 290,
    sellingPrice: 400,
    stockQty: 7,
    lowStockAt: 10,
    createdAt: new Date().toISOString()
  }
];

const emptyForm: ProductForm = {
  barcode: "",
  name: "",
  costPrice: "",
  sellingPrice: "",
  stockQty: "",
  lowStockAt: "5"
};

function money(value: number) {
  return new Intl.NumberFormat("en-NG", {
    currency: "NGN",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [status, setStatus] = useState("Scan or enter a barcode to begin checkout.");
  const [activeTab, setActiveTab] = useState<"checkout" | "products" | "sales">("checkout");
  const [form, setForm] = useState<ProductForm>(emptyForm);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { products?: Product[]; sales?: Sale[] };
      setProducts(parsed.products?.length ? parsed.products : seedProducts);
      setSales(parsed.sales ?? []);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ products, sales }));
  }, [products, sales]);

  const productById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const cartRows = useMemo(() => {
    return cart
      .map((item) => {
        const product = productById.get(item.productId);
        if (!product) return null;
        const lineTotal = item.quantity * product.sellingPrice;
        const lineProfit = item.quantity * (product.sellingPrice - product.costPrice);
        return { ...item, product, lineTotal, lineProfit };
      })
      .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number; lineProfit: number }>;
  }, [cart, productById]);

  const cartSubtotal = cartRows.reduce((sum, item) => sum + item.lineTotal, 0);
  const cartProfit = cartRows.reduce((sum, item) => sum + item.lineProfit, 0);
  const cartCost = cartRows.reduce((sum, item) => sum + item.quantity * item.product.costPrice, 0);

  const todaySales = sales.filter((sale) => todayKey(new Date(sale.paidAt)) === todayKey());
  const dailySales = todaySales.reduce((sum, sale) => sum + sale.subtotal, 0);
  const dailyProfit = todaySales.reduce((sum, sale) => sum + sale.profit, 0);
  const lowStockItems = products.filter((product) => product.stockQty <= product.lowStockAt);

  function addScannedProduct(barcode: string) {
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) return;

    const product = products.find((item) => item.barcode === normalizedBarcode);
    if (!product) {
      setStatus(`No product found for barcode ${normalizedBarcode}.`);
      return;
    }

    if (product.stockQty <= 0) {
      setStatus(`${product.name} is out of stock.`);
      return;
    }

    const existing = cart.find((item) => item.productId === product.id);
    if (existing && existing.quantity >= product.stockQty) {
      setStatus(`Only ${product.stockQty} unit(s) of ${product.name} are available.`);
      return;
    }

    setCart((current) => {
      const currentItem = current.find((item) => item.productId === product.id);
      if (!currentItem) return [...current, { productId: product.id, quantity: 1 }];
      return current.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
      );
    });
    setStatus(`${product.name} added to cart.`);
  }

  function submitScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addScannedProduct(scanValue);
    setScanValue("");
  }

  function changeCartQuantity(productId: string, delta: number) {
    const product = productById.get(productId);
    if (!product) return;

    setCart((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) return item;
          const nextQuantity = Math.min(product.stockQty, Math.max(0, item.quantity + delta));
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function confirmSale() {
    if (!cartRows.length) return;

    const saleItems: SaleItem[] = cartRows.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productBarcode: item.product.barcode,
      quantity: item.quantity,
      unitCost: item.product.costPrice,
      unitPrice: item.product.sellingPrice,
      lineTotal: item.lineTotal,
      lineProfit: item.lineProfit
    }));

    const sale: Sale = {
      id: makeId("sale"),
      items: saleItems,
      subtotal: cartSubtotal,
      totalCost: cartCost,
      profit: cartProfit,
      paidAt: new Date().toISOString()
    };

    setProducts((current) =>
      current.map((product) => {
        const soldItem = saleItems.find((item) => item.productId === product.id);
        if (!soldItem) return product;
        return { ...product, stockQty: product.stockQty - soldItem.quantity };
      })
    );
    setSales((current) => [sale, ...current]);
    setCart([]);
    setStatus(`Sale confirmed: ${money(sale.subtotal)} recorded with ${money(sale.profit)} profit.`);
    setActiveTab("checkout");
  }

  function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const barcode = form.barcode.trim();
    const name = form.name.trim();
    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const stockQty = Number.parseInt(form.stockQty, 10);
    const lowStockAt = Number.parseInt(form.lowStockAt, 10);

    if (
      !barcode ||
      !name ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(stockQty) ||
      !Number.isFinite(lowStockAt) ||
      costPrice < 0 ||
      sellingPrice < 0 ||
      stockQty < 0 ||
      lowStockAt < 0
    ) {
      setStatus("Product details need a name, barcode, valid prices, and stock quantity.");
      return;
    }

    if (products.some((product) => product.barcode === barcode)) {
      setStatus(`Barcode ${barcode} is already assigned to a product.`);
      return;
    }

    const product: Product = {
      id: makeId("prod"),
      barcode,
      name,
      costPrice,
      sellingPrice,
      stockQty,
      lowStockAt,
      createdAt: new Date().toISOString()
    };

    setProducts((current) => [product, ...current]);
    setForm(emptyForm);
    setStatus(`${product.name} created and ready for scanning.`);
  }

  function stockPill(product: Product) {
    if (product.stockQty === 0) return <span className="pill out">Out</span>;
    if (product.stockQty <= product.lowStockAt) return <span className="pill low">Low</span>;
    return <span className="pill ok">OK</span>;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">SL</div>
          <div>
            <div className="brand-title">ScanLedger</div>
            <div className="brand-subtitle">Stock, checkout, sales, profit</div>
          </div>
        </div>

        <nav className="tabs" aria-label="Workspace sections">
          {(["checkout", "products", "sales"] as const).map((tab) => (
            <button
              className={`tab-button ${activeTab === tab ? "active" : ""}`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </header>

      <section className="main-grid">
        <aside className="workspace">
          <div className="metrics">
            <div className="metric">
              <div className="metric-label">Today sales</div>
              <div className="metric-value">{money(dailySales)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Today profit</div>
              <div className="metric-value">{money(dailyProfit)}</div>
            </div>
            <div className="metric">
              <div className="metric-label">Low stock</div>
              <div className="metric-value">{lowStockItems.length}</div>
            </div>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Low Stock Watch</h2>
                <p className="panel-note">Items at or below their reorder threshold.</p>
              </div>
            </div>
            <div className="panel-body">
              {lowStockItems.length ? (
                <div className="low-stock-list">
                  {lowStockItems.map((product) => (
                    <div className="low-stock-row" key={product.id}>
                      <div>
                        <strong>{product.name}</strong>
                        <div className="cart-meta">{product.barcode}</div>
                      </div>
                      <span className="pill low">{product.stockQty} left</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No products are below threshold.</div>
              )}
            </div>
          </section>
        </aside>

        <section className="workspace">
          {activeTab === "checkout" && (
            <>
              <section className="scan-box">
                <form className="scan-row" onSubmit={submitScan}>
                  <input
                    autoFocus
                    className="input"
                    inputMode="numeric"
                    onChange={(event) => setScanValue(event.target.value)}
                    placeholder="Scan barcode or type one, e.g. 600100100001"
                    value={scanValue}
                  />
                  <button className="button primary" type="submit">
                    <span className="icon">+</span>
                    Add Scan
                  </button>
                </form>
                <div className="status-line" role="status">
                  {status}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Checkout Cart</h2>
                    <p className="panel-note">Each confirmed sale updates stock and profit immediately.</p>
                  </div>
                  <button
                    className="button secondary"
                    disabled={!cartRows.length}
                    onClick={() => setCart([])}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div className="panel-body">
                  {cartRows.length ? (
                    <>
                      <div className="cart-list">
                        {cartRows.map((item) => (
                          <div className="cart-item" key={item.product.id}>
                            <div>
                              <div className="cart-name">{item.product.name}</div>
                              <div className="cart-meta">
                                {item.product.barcode} | {money(item.product.sellingPrice)} each | stock{" "}
                                {item.product.stockQty}
                              </div>
                            </div>
                            <div className="qty-control" aria-label={`${item.product.name} quantity`}>
                              <button
                                className="qty-button"
                                onClick={() => changeCartQuantity(item.product.id, -1)}
                                type="button"
                              >
                                -
                              </button>
                              <div className="qty-count">{item.quantity}</div>
                              <button
                                className="qty-button"
                                disabled={item.quantity >= item.product.stockQty}
                                onClick={() => changeCartQuantity(item.product.id, 1)}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="totals">
                        <div className="total-row">
                          <span>Cost basis</span>
                          <strong>{money(cartCost)}</strong>
                        </div>
                        <div className="total-row">
                          <span>Expected profit</span>
                          <strong>{money(cartProfit)}</strong>
                        </div>
                        <div className="total-row strong">
                          <span>Total due</span>
                          <span>{money(cartSubtotal)}</span>
                        </div>
                      </div>

                      <div className="button-row">
                        <button className="button primary" onClick={confirmSale} type="button">
                          Confirm Payment
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-state">Cart is empty. Scan a product barcode to start a sale.</div>
                  )}
                </div>
              </section>
            </>
          )}

          {activeTab === "products" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Create Product</h2>
                    <p className="panel-note">Barcode, pricing, and stock quantity become the scan source of truth.</p>
                  </div>
                </div>
                <div className="panel-body">
                  <form onSubmit={createProduct}>
                    <div className="form-grid">
                      <div className="field full">
                        <label htmlFor="name">Product name</label>
                        <input
                          className="input"
                          id="name"
                          onChange={(event) => setForm({ ...form, name: event.target.value })}
                          value={form.name}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="barcode">Barcode</label>
                        <input
                          className="input"
                          id="barcode"
                          onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                          value={form.barcode}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="stockQty">Opening stock</label>
                        <input
                          className="input"
                          id="stockQty"
                          min="0"
                          onChange={(event) => setForm({ ...form, stockQty: event.target.value })}
                          type="number"
                          value={form.stockQty}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="costPrice">Cost price</label>
                        <input
                          className="input"
                          id="costPrice"
                          min="0"
                          onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
                          step="0.01"
                          type="number"
                          value={form.costPrice}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="sellingPrice">Selling price</label>
                        <input
                          className="input"
                          id="sellingPrice"
                          min="0"
                          onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
                          step="0.01"
                          type="number"
                          value={form.sellingPrice}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="lowStockAt">Low stock threshold</label>
                        <input
                          className="input"
                          id="lowStockAt"
                          min="0"
                          onChange={(event) => setForm({ ...form, lowStockAt: event.target.value })}
                          type="number"
                          value={form.lowStockAt}
                        />
                      </div>
                    </div>
                    <div className="button-row">
                      <button className="button primary" type="submit">
                        <span className="icon">+</span>
                        Save Product
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Inventory</h2>
                    <p className="panel-note">Current stock and pricing used by checkout scans.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Barcode</th>
                        <th className="number-cell">Cost</th>
                        <th className="number-cell">Price</th>
                        <th className="number-cell">Stock</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td>{product.name}</td>
                          <td>{product.barcode}</td>
                          <td className="number-cell">{money(product.costPrice)}</td>
                          <td className="number-cell">{money(product.sellingPrice)}</td>
                          <td className="number-cell">{product.stockQty}</td>
                          <td>{stockPill(product)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === "sales" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2 className="panel-title">Sales Ledger</h2>
                  <p className="panel-note">Completed transactions with item detail and profit.</p>
                </div>
              </div>
              <div className="panel-body">
                {sales.length ? (
                  <div className="sales-list">
                    {sales.map((sale) => (
                      <article className="sale-item" key={sale.id}>
                        <div className="sale-topline">
                          <div>
                            <strong>{new Date(sale.paidAt).toLocaleString()}</strong>
                            <div className="sale-detail">{sale.items.length} line item(s)</div>
                          </div>
                          <div className="sale-total">{money(sale.subtotal)}</div>
                        </div>
                        <div className="sale-detail">
                          Profit {money(sale.profit)} | Cost {money(sale.totalCost)}
                        </div>
                        <div className="sale-detail">
                          {sale.items
                            .map((item) => `${item.quantity}x ${item.productName} (${item.productBarcode})`)
                            .join(", ")}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No sales recorded yet.</div>
                )}
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
