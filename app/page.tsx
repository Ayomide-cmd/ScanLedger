"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  barcode: string;
  name: string;
  categoryName: string;
  supplier: string;
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
  categoryName: string;
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

type StockMovementType = "sale" | "restock" | "return" | "product_created";

type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  productBarcode: string;
  supplier: string;
  movementType: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  createdAt: string;
};

type SupplierReorderDraft = {
  supplier: string;
  items: Array<Product & { recommendedQty: number }>;
  totalUnits: number;
  estimatedCost: number;
};

type Toast = {
  id: string;
  message: string;
};

type ProductForm = {
  barcode: string;
  name: string;
  categoryName: string;
  supplier: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  lowStockAt: string;
};

const storageKey = "scanledger-state-v2";
const cartStorageKey = "scanledger-active-cart-v1";
const uncategorized = "Uncategorized";
const unknownSupplier = "Unassigned supplier";

const seedProducts: Product[] = [
  {
    id: "prod-rice-5kg",
    barcode: "600100100001",
    name: "Mama Gold Rice 5kg",
    categoryName: "Foodstuff",
    supplier: "Lagos Food Depot",
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
    categoryName: "Household",
    supplier: "Everyday Wholesale",
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
    categoryName: "Beverages",
    supplier: "Dairy Direct",
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
  categoryName: "",
  supplier: "",
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

function percent(value: number) {
  return `${Math.round(value)}%`;
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCategory(value: string) {
  const clean = value.trim();
  return clean.length ? clean : uncategorized;
}

function resolveProductCategory(product: Partial<Product>) {
  const normalizedCategory = normalizeCategory(product.categoryName ?? "");
  const seededProduct = seedProducts.find(
    (currentProduct) => currentProduct.id === product.id || currentProduct.barcode === product.barcode
  );

  if (seededProduct && normalizedCategory === uncategorized) {
    return seededProduct.categoryName;
  }

  return normalizedCategory;
}

function resolveProductSupplier(product: Partial<Product>) {
  const cleanSupplier = product.supplier?.trim();
  const seededProduct = seedProducts.find(
    (currentProduct) => currentProduct.id === product.id || currentProduct.barcode === product.barcode
  );

  if (cleanSupplier) return cleanSupplier;
  return seededProduct?.supplier ?? unknownSupplier;
}

function normalizeCart(cartItems: CartItem[], products: Product[]) {
  return cartItems
    .map((item) => {
      const product = products.find((currentProduct) => currentProduct.id === item.productId);
      if (!product || product.stockQty <= 0) return null;

      const quantity = Math.min(product.stockQty, Math.max(1, Math.floor(Number(item.quantity))));
      if (!Number.isFinite(quantity)) return null;

      return { productId: product.id, quantity };
    })
    .filter(Boolean) as CartItem[];
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [status, setStatus] = useState("Scan or enter a barcode to begin checkout.");
  const [activeTab, setActiveTab] = useState<"checkout" | "products" | "sales" | "insights">("checkout");
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [productFormMessage, setProductFormMessage] = useState("");
  const [reorderDraftMessage, setReorderDraftMessage] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hasLoadedStoredCart, setHasLoadedStoredCart] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey) ?? window.localStorage.getItem("scanledger-state-v1");
    const rawCart = window.localStorage.getItem(cartStorageKey);
    let restoredProducts = seedProducts;

    try {
      if (raw) {
        const parsed = JSON.parse(raw) as {
          products?: Partial<Product>[];
          sales?: Sale[];
          stockMovements?: StockMovement[];
        };
        restoredProducts = parsed.products?.length
          ? (parsed.products.map((product) => ({
              ...product,
              categoryName: resolveProductCategory(product),
              supplier: resolveProductSupplier(product),
              createdAt: product.createdAt ?? new Date().toISOString()
            })) as Product[])
          : seedProducts;

        setProducts(restoredProducts);
        setSales(parsed.sales ?? []);
        setStockMovements(parsed.stockMovements ?? []);
      }

      const restoredCart = rawCart ? (JSON.parse(rawCart) as CartItem[]) : [];
      const activeCart = normalizeCart(restoredCart, restoredProducts);
      setCart(activeCart);

      if (activeCart.length) {
        const restoredCount = activeCart.reduce((sum, item) => sum + item.quantity, 0);
        setStatus(`Restored saved checkout cart with ${restoredCount} item(s).`);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(cartStorageKey);
    }

    setHasLoadedStoredCart(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredCart) return;
    const activeCart = normalizeCart(cart, products);

    if (!activeCart.length) {
      window.localStorage.removeItem(cartStorageKey);
      return;
    }

    window.localStorage.setItem(cartStorageKey, JSON.stringify(activeCart));
  }, [cart, hasLoadedStoredCart, products]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ products, sales, stockMovements }));
  }, [products, sales, stockMovements]);

  useEffect(() => {
    if (!toasts.length) return;

    const timer = window.setTimeout(() => {
      setToasts((current) => current.slice(0, -1));
    }, 6500);

    return () => window.clearTimeout(timer);
  }, [toasts]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categories = useMemo(
    () => [...new Set(products.map((product) => normalizeCategory(product.categoryName)))].sort(),
    [products]
  );

  const groupedProducts = useMemo(() => {
    return categories.map((category) => {
      const categoryProducts = products
        .filter((product) => normalizeCategory(product.categoryName) === category)
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        category,
        products: categoryProducts,
        totalStock: categoryProducts.reduce((sum, product) => sum + product.stockQty, 0),
        lowStockCount: categoryProducts.filter((product) => product.stockQty <= product.lowStockAt).length
      };
    });
  }, [categories, products]);

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
  const inventoryValue = products.reduce((sum, product) => sum + product.stockQty * product.costPrice, 0);
  const projectedProfitOnHand = products.reduce(
    (sum, product) => sum + product.stockQty * (product.sellingPrice - product.costPrice),
    0
  );
  const saleItems = sales.flatMap((sale) => sale.items);
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.subtotal, 0);
  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit, 0);
  const grossMargin = totalRevenue ? (totalProfit / totalRevenue) * 100 : 0;
  const reorderQueue = [...products]
    .filter((product) => product.stockQty <= product.lowStockAt)
    .sort((a, b) => a.stockQty / Math.max(a.lowStockAt, 1) - b.stockQty / Math.max(b.lowStockAt, 1))
    .map((product) => ({
      ...product,
      recommendedQty: Math.max(product.lowStockAt * 2 - product.stockQty, 1)
    }));
  const categoryInsights = groupedProducts
    .map((group) => {
      const soldItems = saleItems.filter((item) => normalizeCategory(item.categoryName) === group.category);
      const revenue = soldItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const profit = soldItems.reduce((sum, item) => sum + item.lineProfit, 0);
      const unitsSold = soldItems.reduce((sum, item) => sum + item.quantity, 0);

      return {
        ...group,
        revenue,
        profit,
        unitsSold,
        inventoryValue: group.products.reduce((sum, product) => sum + product.stockQty * product.costPrice, 0)
      };
    })
    .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category));
  const maxCategoryRevenue = Math.max(...categoryInsights.map((category) => category.revenue), 1);
  const productPerformance = [...productById.values()]
    .map((product) => {
      const soldItems = saleItems.filter((item) => item.productId === product.id);
      const unitsSold = soldItems.reduce((sum, item) => sum + item.quantity, 0);
      const revenue = soldItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const profit = soldItems.reduce((sum, item) => sum + item.lineProfit, 0);

      return { product, unitsSold, revenue, profit };
    })
    .sort((a, b) => b.profit - a.profit || b.unitsSold - a.unitsSold)
    .slice(0, 5);
  const mostUrgentReorder = reorderQueue[0];
  const supplierReorderDrafts = Object.values(
    reorderQueue.reduce<Record<string, SupplierReorderDraft>>((drafts, product) => {
      const supplier = product.supplier || unknownSupplier;
      const currentDraft = drafts[supplier] ?? {
        supplier,
        items: [],
        totalUnits: 0,
        estimatedCost: 0
      };

      currentDraft.items.push(product);
      currentDraft.totalUnits += product.recommendedQty;
      currentDraft.estimatedCost += product.recommendedQty * product.costPrice;
      drafts[supplier] = currentDraft;

      return drafts;
    }, {})
  ).sort((a, b) => b.estimatedCost - a.estimatedCost);
  const totalReorderCost = supplierReorderDrafts.reduce((sum, draft) => sum + draft.estimatedCost, 0);
  const recentStockMovements = stockMovements.slice(0, 10);
  const commandInsight =
    mostUrgentReorder
      ? `${mostUrgentReorder.name} needs restock attention: ${mostUrgentReorder.stockQty} left, reorder ${mostUrgentReorder.recommendedQty}.`
      : totalRevenue
        ? `Trading is healthy today: ${money(totalRevenue)} revenue with ${percent(grossMargin)} gross margin.`
        : "No urgent stock risk yet. Start recording sales to unlock performance insight.";

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
    setStatus(`${product.name} added to cart from ${product.categoryName}.`);
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

  function recordStockMovements(movements: StockMovement[]) {
    if (!movements.length) return;
    setStockMovements((current) => [...movements, ...current].slice(0, 100));
  }

  async function copySupplierDraft(draft: SupplierReorderDraft, draftNumber: number) {
    const purchaseOrderId = `PO-${todayKey().replaceAll("-", "")}-${String(draftNumber + 1).padStart(2, "0")}`;
    const lines = draft.items.map(
      (item) =>
        `${item.name} (${item.barcode}) - order ${item.recommendedQty} @ ${money(item.costPrice)} = ${money(
          item.recommendedQty * item.costPrice
        )}`
    );
    const draftText = [
      `Purchase Order Draft ${purchaseOrderId}`,
      `Supplier: ${draft.supplier}`,
      `Total units: ${draft.totalUnits}`,
      `Estimated cost: ${money(draft.estimatedCost)}`,
      "",
      ...lines
    ].join("\n");

    try {
      await navigator.clipboard.writeText(draftText);
      setReorderDraftMessage(`${purchaseOrderId} copied for ${draft.supplier}.`);
    } catch {
      setReorderDraftMessage(`${purchaseOrderId} is ready. Browser clipboard access was not available.`);
    }
  }

  function increaseStock(productId: string, quantity: number, reason: "restock" | "return") {
    const product = productById.get(productId);
    if (!product) return;
    const newStock = product.stockQty + quantity;

    setProducts((current) =>
      current.map((currentProduct) =>
        currentProduct.id === productId
          ? { ...currentProduct, stockQty: currentProduct.stockQty + quantity }
          : currentProduct
      )
    );
    recordStockMovements([
      {
        id: makeId("move"),
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        supplier: product.supplier,
        movementType: reason,
        quantity,
        previousStock: product.stockQty,
        newStock,
        reason: reason === "restock" ? "Supplier restock" : "Customer return",
        createdAt: new Date().toISOString()
      }
    ]);
    setStatus(
      `${product.name} stock increased by ${quantity} from ${reason === "restock" ? "restocking" : "customer return"}.`
    );
  }

  function confirmSale() {
    if (!cartRows.length) return;

    const saleItems: SaleItem[] = cartRows.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productBarcode: item.product.barcode,
      categoryName: item.product.categoryName,
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

    const lowStockToasts = saleItems
      .map((item) => {
        const product = products.find((currentProduct) => currentProduct.id === item.productId);
        if (!product) return null;

        const remainingStock = product.stockQty - item.quantity;
        const hasJustDippedBelowThreshold =
          product.stockQty >= product.lowStockAt && remainingStock < product.lowStockAt;

        if (!hasJustDippedBelowThreshold) return null;

        return {
          id: makeId("toast"),
          message: `⚠️ ${product.name} is running low (${remainingStock} left).`
        };
      })
      .filter(Boolean) as Toast[];
    const saleMovements = saleItems
      .map((item) => {
        const product = products.find((currentProduct) => currentProduct.id === item.productId);
        if (!product) return null;

        return {
          id: makeId("move"),
          productId: product.id,
          productName: product.name,
          productBarcode: product.barcode,
          supplier: product.supplier,
          movementType: "sale" as const,
          quantity: -item.quantity,
          previousStock: product.stockQty,
          newStock: product.stockQty - item.quantity,
          reason: `Sale ${sale.id}`,
          createdAt: sale.paidAt
        };
      })
      .filter(Boolean) as StockMovement[];

    setProducts((current) =>
      current.map((product) => {
        const soldItem = saleItems.find((item) => item.productId === product.id);
        if (!soldItem) return product;
        return { ...product, stockQty: product.stockQty - soldItem.quantity };
      })
    );
    setSales((current) => [sale, ...current]);
    recordStockMovements(saleMovements);
    setCart([]);
    window.localStorage.removeItem(cartStorageKey);
    setStatus(`Sale confirmed: ${money(sale.subtotal)} recorded with ${money(sale.profit)} profit.`);
    setToasts((current) => [...lowStockToasts, ...current].slice(0, 4));
  }

  function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductFormMessage("");

    const barcode = form.barcode.trim();
    const name = form.name.trim();
    const categoryName = normalizeCategory(form.categoryName);
    const supplier = form.supplier.trim();
    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const stockQty = Number.parseInt(form.stockQty, 10);
    const lowStockAt = Number.parseInt(form.lowStockAt, 10);

    if (
      !barcode ||
      !name ||
      !supplier ||
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      !Number.isFinite(stockQty) ||
      !Number.isFinite(lowStockAt) ||
      costPrice < 0 ||
      sellingPrice < 0 ||
      stockQty < 0 ||
      lowStockAt < 0
    ) {
      const message = "Add product name, barcode, supplier, prices, stock quantity, and low-stock threshold.";
      setProductFormMessage(message);
      setStatus(message);
      return;
    }

    if (products.some((product) => product.barcode === barcode)) {
      const message = `Barcode ${barcode} is already assigned to a product.`;
      setProductFormMessage(message);
      setStatus(message);
      return;
    }

    const product: Product = {
      id: makeId("prod"),
      barcode,
      name,
      categoryName,
      supplier,
      costPrice,
      sellingPrice,
      stockQty,
      lowStockAt,
      createdAt: new Date().toISOString()
    };

    setProducts((current) => [product, ...current]);
    recordStockMovements([
      {
        id: makeId("move"),
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        supplier: product.supplier,
        movementType: "product_created",
        quantity: product.stockQty,
        previousStock: 0,
        newStock: product.stockQty,
        reason: "Opening stock",
        createdAt: product.createdAt
      }
    ]);
    setForm(emptyForm);
    setProductFormMessage(`${product.name} saved with ${product.stockQty} unit(s) in stock.`);
    setStatus(`${product.name} created in ${product.categoryName}.`);
  }

  function stockPill(product: Product) {
    if (product.stockQty === 0) return <span className="pill out">Out</span>;
    if (product.stockQty <= product.lowStockAt) return <span className="pill low">Low</span>;
    return <span className="pill ok">OK</span>;
  }

  return (
    <main className="app-shell">
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            <button
              aria-label="Dismiss notification"
              className="toast-close"
              onClick={() => setToasts((current) => current.filter((currentToast) => currentToast.id !== toast.id))}
              type="button"
            >
              x
            </button>
          </div>
        ))}
      </div>

      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">SL</div>
          <div>
            <div className="brand-title">ScanLedger</div>
            <div className="brand-subtitle">Stock, checkout, sales, profit</div>
          </div>
        </div>

        <nav className="tabs" aria-label="Workspace sections">
          {(["checkout", "products", "insights", "sales"] as const).map((tab) => (
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

      <section className={`main-grid ${activeTab === "checkout" ? "checkout-grid" : ""}`}>
        {activeTab === "checkout" ? (
          <>
            <section className="checkout-stream">
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
                  <div className="metric-label">Categories</div>
                  <div className="metric-value">{categories.length}</div>
                </div>
              </div>

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
                    + Add Scan
                  </button>
                </form>
                <div className="status-line" role="status">
                  {status}
                </div>
              </section>

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
                            <div className="cart-meta">
                              {product.categoryName} | {product.barcode}
                            </div>
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
            </section>

            <aside className="cart-summary-zone">
              <section className="panel cart-panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Checkout Cart</h2>
                    <p className="panel-note">Each confirmed sale updates stock and profit immediately.</p>
                  </div>
                  <button className="button secondary" disabled={!cartRows.length} onClick={() => setCart([])}>
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
                                {item.product.categoryName} | {item.product.barcode} |{" "}
                                {money(item.product.sellingPrice)} each | stock {item.product.stockQty}
                              </div>
                            </div>
                            <div className="qty-control" aria-label={`${item.product.name} quantity`}>
                              <button className="qty-button" onClick={() => changeCartQuantity(item.product.id, -1)}>
                                -
                              </button>
                              <div className="qty-count">{item.quantity}</div>
                              <button
                                className="qty-button"
                                disabled={item.quantity >= item.product.stockQty}
                                onClick={() => changeCartQuantity(item.product.id, 1)}
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
            </aside>
          </>
        ) : (
          <>
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
              <div className="metric-label">Categories</div>
              <div className="metric-value">{categories.length}</div>
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
                        <div className="cart-meta">
                          {product.categoryName} | {product.barcode}
                        </div>
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

          {activeTab === "products" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Create Product</h2>
                    <p className="panel-note">Add the product type or category so inventory stays grouped.</p>
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
                          required
                          value={form.name}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="categoryName">Category / type</label>
                        <input
                          className="input"
                          id="categoryName"
                          list="category-options"
                          onChange={(event) => setForm({ ...form, categoryName: event.target.value })}
                          placeholder="Foodstuff, Drinks, Household"
                          value={form.categoryName}
                        />
                        <datalist id="category-options">
                          {categories.map((category) => (
                            <option key={category} value={category} />
                          ))}
                        </datalist>
                      </div>
                      <div className="field">
                        <label htmlFor="barcode">Barcode</label>
                        <input
                          className="input"
                          id="barcode"
                          onChange={(event) => setForm({ ...form, barcode: event.target.value })}
                          required
                          value={form.barcode}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="supplier">Supplier</label>
                        <input
                          className="input"
                          id="supplier"
                          onChange={(event) => setForm({ ...form, supplier: event.target.value })}
                          placeholder="Supplier or wholesaler name"
                          required
                          value={form.supplier}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="stockQty">Opening stock</label>
                        <input
                          className="input"
                          id="stockQty"
                          min="0"
                          onChange={(event) => setForm({ ...form, stockQty: event.target.value })}
                          required
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
                          required
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
                          required
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
                          required
                          type="number"
                          value={form.lowStockAt}
                        />
                      </div>
                    </div>
                    {productFormMessage ? (
                      <div className="form-message" role="status">
                        {productFormMessage}
                      </div>
                    ) : null}
                    <div className="button-row">
                      <button className="button primary" type="submit">
                        + Save Product
                      </button>
                    </div>
                  </form>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Inventory by Category</h2>
                    <p className="panel-note">Products are grouped by type for quicker stock review.</p>
                  </div>
                </div>
                <div className="category-sections">
                  {groupedProducts.map((group) => (
                    <section className="category-card" key={group.category}>
                      <div className="category-card-header">
                        <div>
                          <h3>{group.category}</h3>
                          <p>
                            {group.products.length} product(s) | {group.totalStock} unit(s) in stock
                          </p>
                        </div>
                        {group.lowStockCount ? (
                          <span className="pill low">{group.lowStockCount} low</span>
                        ) : (
                          <span className="pill ok">Healthy</span>
                        )}
                      </div>

                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Barcode</th>
                              <th>Supplier</th>
                              <th className="number-cell">Cost</th>
                              <th className="number-cell">Price</th>
                              <th className="number-cell">Stock</th>
                              <th>Status</th>
                              <th>Stock in</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.products.map((product) => (
                              <tr key={product.id}>
                                <td>{product.name}</td>
                                <td>{product.barcode}</td>
                                <td>{product.supplier}</td>
                                <td className="number-cell">{money(product.costPrice)}</td>
                                <td className="number-cell">{money(product.sellingPrice)}</td>
                                <td className="number-cell">{product.stockQty}</td>
                                <td>{stockPill(product)}</td>
                                <td>
                                  <div className="stock-actions">
                                    <button
                                      className="mini-button"
                                      onClick={() => increaseStock(product.id, 1, "restock")}
                                      type="button"
                                    >
                                      Restock +1
                                    </button>
                                    <button
                                      className="mini-button"
                                      onClick={() => increaseStock(product.id, 1, "return")}
                                      type="button"
                                    >
                                      Return +1
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === "insights" && (
            <>
              <section className="panel command-panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Operations Command Center</h2>
                    <p className="panel-note">{commandInsight}</p>
                  </div>
                </div>
                <div className="command-metrics">
                  <div className="command-metric">
                    <span>Inventory value</span>
                    <strong>{money(inventoryValue)}</strong>
                  </div>
                  <div className="command-metric">
                    <span>Profit on hand</span>
                    <strong>{money(projectedProfitOnHand)}</strong>
                  </div>
                  <div className="command-metric">
                    <span>Gross margin</span>
                    <strong>{percent(grossMargin)}</strong>
                  </div>
                  <div className="command-metric">
                    <span>Reorder queue</span>
                    <strong>{reorderQueue.length}</strong>
                  </div>
                  <div className="command-metric">
                    <span>Draft PO value</span>
                    <strong>{money(totalReorderCost)}</strong>
                  </div>
                </div>
              </section>

              <section className="insight-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Category Performance</h2>
                      <p className="panel-note">Revenue, stock exposure, and risk by product type.</p>
                    </div>
                  </div>
                  <div className="insight-list">
                    {categoryInsights.map((category) => (
                      <article className="category-insight" key={category.category}>
                        <div className="insight-row">
                          <div>
                            <strong>{category.category}</strong>
                            <div className="cart-meta">
                              {category.unitsSold} sold | {money(category.inventoryValue)} in stock
                            </div>
                          </div>
                          <div className="insight-money">
                            <strong>{money(category.revenue)}</strong>
                            <span>{money(category.profit)} profit</span>
                          </div>
                        </div>
                        <div className="bar-track" aria-label={`${category.category} revenue share`}>
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.max(6, (category.revenue / maxCategoryRevenue) * 100)}%` }}
                          />
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2 className="panel-title">Smart Reorder Queue</h2>
                      <p className="panel-note">Recommended quantities based on each low-stock threshold.</p>
                    </div>
                  </div>
                  <div className="insight-list">
                    {reorderQueue.length ? (
                      reorderQueue.map((product) => (
                        <article className="reorder-card" key={product.id}>
                          <div>
                            <strong>{product.name}</strong>
                            <div className="cart-meta">
                              {product.supplier} | {product.categoryName} | threshold {product.lowStockAt}
                            </div>
                          </div>
                          <div className="reorder-action">
                            <span>{product.stockQty} left</span>
                            <strong>Order {product.recommendedQty}</strong>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="empty-state">No reorder action needed right now.</div>
                    )}
                  </div>
                </section>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Supplier Reorder Draft</h2>
                    <p className="panel-note">Low-stock replenishment grouped by supplier with estimated cost.</p>
                  </div>
                </div>
                {reorderDraftMessage ? (
                  <div className="panel-message" role="status">
                    {reorderDraftMessage}
                  </div>
                ) : null}
                <div className="supplier-drafts">
                  {supplierReorderDrafts.length ? (
                    supplierReorderDrafts.map((draft, draftIndex) => (
                      <article className="supplier-draft" key={draft.supplier}>
                        <div className="supplier-draft-header">
                          <div>
                            <h3>{draft.supplier}</h3>
                            <p>
                              PO-{todayKey().replaceAll("-", "")}-{String(draftIndex + 1).padStart(2, "0")} |{" "}
                              {draft.items.length} item(s) | {draft.totalUnits} unit(s)
                            </p>
                          </div>
                          <div className="supplier-draft-actions">
                            <strong>{money(draft.estimatedCost)}</strong>
                            <button
                              className="mini-button"
                              onClick={() => copySupplierDraft(draft, draftIndex)}
                              type="button"
                            >
                              Copy Draft
                            </button>
                          </div>
                        </div>
                        <div className="draft-lines">
                          {draft.items.map((item) => (
                            <div className="draft-line" key={item.id}>
                              <div>
                                <strong>{item.name}</strong>
                                <span>
                                  {item.barcode} | stock {item.stockQty} | threshold {item.lowStockAt}
                                </span>
                              </div>
                              <div className="draft-line-cost">
                                <strong>Order {item.recommendedQty}</strong>
                                <span>{money(item.recommendedQty * item.costPrice)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">No supplier reorder draft needed right now.</div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Inventory Audit Trail</h2>
                    <p className="panel-note">Every stock movement from sales, restocks, returns, and opening stock.</p>
                  </div>
                </div>
                <div className="audit-list">
                  {recentStockMovements.length ? (
                    recentStockMovements.map((movement) => (
                      <article className="audit-entry" key={movement.id}>
                        <div className={`movement-type ${movement.movementType}`}>
                          {movement.movementType.replace("_", " ")}
                        </div>
                        <div>
                          <strong>{movement.productName}</strong>
                          <div className="cart-meta">
                            {movement.supplier} | {movement.reason} |{" "}
                            {new Date(movement.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="audit-stock">
                          <strong>
                            {movement.quantity > 0 ? "+" : ""}
                            {movement.quantity}
                          </strong>
                          <span>
                            {movement.previousStock} to {movement.newStock}
                          </span>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">No stock movements recorded yet.</div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">Profit Leaders</h2>
                    <p className="panel-note">Products ranked by contribution to profit.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th className="number-cell">Units sold</th>
                        <th className="number-cell">Revenue</th>
                        <th className="number-cell">Profit</th>
                        <th className="number-cell">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPerformance.map(({ product, unitsSold, revenue, profit }) => (
                        <tr key={product.id}>
                          <td>{product.name}</td>
                          <td>{product.categoryName}</td>
                          <td className="number-cell">{unitsSold}</td>
                          <td className="number-cell">{money(revenue)}</td>
                          <td className="number-cell">{money(profit)}</td>
                          <td className="number-cell">{product.stockQty}</td>
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
                  <p className="panel-note">Completed transactions with item detail, category, and profit.</p>
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
                            .map((item) => `${item.quantity}x ${item.productName} [${item.categoryName}]`)
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
          </>
        )}
      </section>
    </main>
  );
}
