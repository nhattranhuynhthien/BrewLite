"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Image from 'next/image';
import { CalendarDays, ChevronDown, ClipboardList, CreditCard, MapPin, Search, WalletCards } from 'lucide-react';
import { apiFetch, getAccessToken, getUserIdFromAccessToken, setAccessToken, subscribeToAccessToken } from '@/lib/api';
import SiteHeader from '@/layouts/SiteHeader';
import ProductDetailModal from '@/components/ProductDetailModal';
import { PRODUCTS as MENU_PRODUCTS } from '@/lib/menu-data';
import { useCartStore } from '@/store/cart-store';
import type { Product } from '@/types/product';

type View = 'menu' | 'checkout' | 'confirmation' | 'orders';
type PaymentMethod = 'WALLET' | 'CARD';
type Order = {
  id: number | string;
  total: number;
  status: string;
  createdAt?: string;
  items?: {
    id: number;
    quantity: number;
    price: number;
    product?: Pick<Product, 'name' | 'imageUrl'> | null;
  }[];
  payment?: { method: string; status: string }[];
};

const currency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const statuses: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Sẵn sàng',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};
function Status({ value }: { value: string }) {
  return <span className={`status-pill status-${value.toLowerCase()}`}>{statuses[value] ?? value}</span>;
}

function formatOrderDate(value?: string) {
  if (!value) return 'Thời gian không khả dụng';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian không khả dụng';
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Storefront({
  initialView = 'menu',
  openLoginOnLoad = false,
}: {
  initialView?: View;
  openLoginOnLoad?: boolean;
}) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>(initialView);
  const [method, setMethod] = useState<PaymentMethod>('WALLET');
  const [authOpen, setAuthOpen] = useState(openLoginOnLoad);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRequest, setHistoryRequest] = useState(0);
  const [historySearch, setHistorySearch] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string> | null>(null);
  const [receipt, setReceipt] = useState<{ id: number | string; status: string } | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (initialView !== 'checkout' || window.location.search === '') return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }, [initialView]);

  useEffect(() => {
    if (!openLoginOnLoad) return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }, [openLoginOnLoad]);

  useEffect(() => {
    let active = true;
    apiFetch<Product[]>('/products')
      .then((data) => { if (active) setProducts(data); })
      .catch((error: unknown) => {
        if (active) setProductsError(error instanceof Error ? error.message : 'Không thể tải thực đơn.');
      })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== 'orders') return;
    if (!token) return;
    let active = true;
    apiFetch<Order[] | { orders: Order[] }>('/orders/me')
      .then((data) => {
        if (active) setHistory(Array.isArray(data) ? data : data.orders);
      })
      .catch((error: unknown) => {
        if (active) setHistoryError(error instanceof Error ? error.message : 'Không thể tải lịch sử đơn.');
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [view, token, historyRequest]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi');
    const featuredProducts = products.slice(0, 16);
    return query
      ? featuredProducts.filter((product) => product.name.toLocaleLowerCase('vi').includes(query))
      : featuredProducts;
  }, [products, searchQuery]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('vi');
    return history.filter((order) => {
      const matchesSearch = !query || String(order.id).toLocaleLowerCase('vi').includes(query);
      return matchesSearch;
    });
  }, [history, historySearch]);

  function toggleOrder(orderId: number | string) {
    const key = String(orderId);
    setExpandedOrders((expanded) => {
      const next = new Set(expanded ?? history.map((order) => String(order.id)));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    try {
      if (authMode === 'register') {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            name: String(data.get('name') ?? '').trim(),
            email,
            password,
          }),
        });
      }
      const result = await apiFetch<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!result.accessToken) throw new Error('API đăng nhập không trả về access token.');
      setAccessToken(result.accessToken);
      setAuthOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Không thể đăng nhập.');
    } finally {
      setAuthBusy(false);
    }
  }

  function openHistory() {
    if (!token) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryRequest((request) => request + 1);
    setView('orders');
  }

  function signOut() {
    setAccessToken(null);
    setHistory([]);
    setView('menu');
  }

  async function pay() {
    if (!token) {
      setCheckoutError('Vui lòng đăng nhập trước khi thanh toán.');
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    const userId = getUserIdFromAccessToken(token);
    if (!userId) {
      setCheckoutError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }
    if (items.length === 0) {
      setCheckoutError('Giỏ hàng đang trống.');
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError('');
    idempotencyKey.current ??= crypto.randomUUID();
    const key = idempotencyKey.current;
    try {
      const created = await apiFetch<{
        id?: number | string;
        orderId?: number | string;
        order?: { id: number | string };
      }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          userId,
          total,
          items: items.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
            price: product.price,
          })),
        }),
      });
      const orderId = created.orderId ?? created.order?.id ?? created.id;
      if (orderId === undefined || orderId === null) throw new Error('API tạo đơn không trả về mã đơn hàng.');

      const payment = await apiFetch<{
        status?: string;
        message?: string;
        orderStatus?: string;
        payment?: { status?: string };
        order?: { status?: string };
      }>('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ orderId, amount: total, method }),
      });
      const paymentStatus = payment?.status ?? payment?.orderStatus ?? payment?.payment?.status ?? payment?.order?.status;
      if (!payment || typeof paymentStatus !== 'string') throw new Error('API thanh toán không trả về trạng thái hợp lệ.');
      if (paymentStatus === 'PAYMENT_FAILED') throw new Error(payment.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
      if (paymentStatus !== 'PAID' && paymentStatus !== 'SUCCESS') {
        throw new Error(payment.message ?? `Thanh toán chưa hoàn tất (${paymentStatus}).`);
      }
      setReceipt({ id: orderId, status: payment.order?.status ?? payment.orderStatus ?? paymentStatus ?? 'PAID' });
      clearCart();
      idempotencyKey.current = null;
      setView('confirmation');
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Không thể hoàn tất thanh toán.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <>
      <SiteHeader
        navItems={[
          { label: 'Trang chủ', href: '/', active: true },
          { label: 'Menu', href: '/menu' },
          { label: 'Khuyến mãi', href: '/menu#menu-promo' },
          { label: 'Giới thiệu', href: '/menu#menu-intro' },
        ]}
        onSearchChange={setSearchQuery}
        onSearchOpen={() => setView('menu')}
        onLogin={() => { setAuthMode('login'); setAuthOpen(true); }}
        onSignOut={signOut}
        onOrdersClick={openHistory}
        cartHref="/cart"
        brandHref="#top"
        onBrandClick={() => setView('menu')}
      />

      <main className="site-shell">
      {view === 'menu' && <>
        <section className="hero" id="top">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot" /> CÀ PHÊ TỬ TẾ, MỖI NGÀY</span>
            <h1>Một chút <em>dịu dàng</em><br />cho ngày bận rộn.</h1>
            <p>Từ hạt cà phê được chọn lọc đến ly nước pha bằng cả sự chăm chút. Đặt món yêu thích, nhận tại quầy.</p>
            <a className="button button-primary" href="#menu">Khám phá thực đơn <span aria-hidden="true">↓</span></a>
            <div className="hero-note"><span className="hero-stars">★★★★★</span><span>Được pha mới cho bạn</span></div>
          </div>
          <div className="hero-visual" aria-label="Tách cà phê BrewLite">
            <div className="hero-sun" /><div className="bean bean-one" /><div className="bean bean-two" />
            <div className="hero-cup"><div className="cup-coffee" /><div className="cup-handle" /><span className="cup-logo">B</span></div>
            <div className="hero-stamp">SIP<br /><span>SLOW</span></div><div className="hero-shadow" />
          </div>
        </section>
        <section className="content-layout" id="menu">
          <div className="menu-section">
            <div className="section-heading"><div><span className="eyebrow">PHA CHẾ MỖI NGÀY</span><h2>Được yêu thích</h2></div><span className="menu-subtitle">Tươi ngon · Thủ công · Gần gũi</span></div>
            {productsLoading ? <div className="state-message"><span className="loader" /> Đang tải thực đơn...</div>
              : productsError ? <div className="state-message state-error"><strong>Chưa thể tải thực đơn</strong><p>{productsError}</p><button className="button button-outline" onClick={() => window.location.reload()} type="button">Thử lại</button></div>
                : products.length === 0 ? <div className="state-message">Hiện chưa có món nào trong thực đơn.</div>
                  : filteredProducts.length === 0 ? <div className="state-message">Không tìm thấy món phù hợp với “{searchQuery}”.</div>
                  : <div className="product-grid">{filteredProducts.map((product) => (
                    <article className="product-card" key={product.id}>
                      <div className="product-art-wrap">
                        {product.id === products[0]?.id && <span className="product-tag">BÁN CHẠY</span>}
                        <button
                          className="product-card__art"
                          onClick={() => setSelectedProduct(product)}
                          type="button"
                          aria-label={`Xem chi tiết ${product.name}`}
                        >
                          <Image
                            src={product.imageUrl || MENU_PRODUCTS.find((menuProduct) => menuProduct.id === product.id)?.imageUrl || '/img/menu/ca-phe-den-da.png'}
                            alt={product.name}
                            fill
                            sizes="(max-width: 760px) 50vw, 35vw"
                          />
                        </button>
                      </div>
                      <div className="product-card__footer">
                        <button
                          className="product-card__detail"
                          onClick={() => setSelectedProduct(product)}
                          type="button"
                          aria-label={`Xem chi tiết ${product.name}`}
                        >
                          <div className="product-info"><h3>{product.name}</h3><strong>{currency(product.price)}</strong></div>
                        </button>
                        <button
                          className="add-button"
                          onClick={() => setSelectedProduct(product)}
                          type="button"
                          aria-label={`Xem chi tiết ${product.name}`}
                        >+</button>
                      </div>
                    </article>
                  ))}</div>}
            <div className="promise-strip">
              <div><span>✳</span><p><strong>Hạt tuyển chọn</strong><br />Rang mới mỗi tuần</p></div>
              <div><span>⌁</span><p><strong>Pha chế thủ công</strong><br />Chăm chút từng ly</p></div>
              <div><span>♡</span><p><strong>Nhận tại cửa hàng</strong><br />Nhanh chóng, tiện lợi</p></div>
            </div>
          </div>
        </section>
      </>}

      {view === 'checkout' && <section className="page-section checkout-section">
        <button className="back-link" onClick={() => setView('menu')} type="button">← Quay lại thực đơn</button>
        <div className="checkout-header"><span className="eyebrow">BƯỚC CUỐI CÙNG</span><h1>Thanh toán</h1><p>Chọn phương thức thanh toán phù hợp với bạn.</p></div>
        <div className="checkout-layout">
          <div className="payment-card"><h2>Phương thức thanh toán</h2>
            <button className={`payment-option ${method === 'WALLET' ? 'selected' : ''}`} onClick={() => setMethod('WALLET')} type="button">
              <span className="payment-icon wallet-icon">◈</span><span className="payment-copy"><strong>Ví điện tử</strong><small>Thanh toán nhanh chóng</small></span><span className="radio-mark" />
            </button>
            <button className={`payment-option ${method === 'CARD' ? 'selected' : ''}`} onClick={() => setMethod('CARD')} type="button">
              <span className="payment-icon card-icon">▤</span><span className="payment-copy"><strong>Thẻ ngân hàng</strong><small>Visa, Mastercard, nội địa</small></span><span className="radio-mark" />
            </button>
            <div className="checkout-secure">⌑ <span>Thông tin thanh toán được bảo vệ an toàn.</span></div>
            {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
            <button className="button button-primary button-full pay-button" disabled={checkoutBusy || items.length === 0} onClick={pay} type="button">
              {checkoutBusy ? 'Đang xử lý...' : `Xác nhận & thanh toán · ${currency(total)}`}
            </button>
            <p className="terms-copy">Bằng việc tiếp tục, bạn đồng ý với điều khoản sử dụng của BrewLite.</p>
          </div>
          <aside className="order-summary"><h2>Đơn hàng của bạn <span>{items.length} món</span></h2>
            {items.map((item) => <div className="summary-row" key={item.product.id}><span className="summary-quantity">{item.quantity}×</span><span className="summary-name">{item.product.name}</span><strong>{currency(item.product.price * item.quantity)}</strong></div>)}
            <div className="summary-total"><span>Tổng thanh toán</span><strong>{currency(total)}</strong></div>
          </aside>
        </div>
      </section>}

      {view === 'confirmation' && receipt && <section className="page-section confirmation-section">
        <div className="confirmation-card"><div className="success-mark">✓</div><span className="eyebrow">CẢM ƠN BẠN ĐÃ ĐẶT MÓN</span>
          <h1>Đơn hàng đã được xác nhận!</h1><p>Quán đã nhận được đơn và sẽ bắt đầu chuẩn bị ngay.</p>
          <div className="receipt-details"><div><span>Mã đơn hàng</span><strong>#{receipt.id}</strong></div><div><span>Trạng thái</span><Status value={receipt.status} /></div>
            <div><span>Phương thức</span><strong>{method === 'WALLET' ? 'Ví điện tử' : 'Thẻ ngân hàng'}</strong></div></div>
          <div className="confirmation-actions"><button className="button button-primary" onClick={() => { setView('menu'); setReceipt(null); }} type="button">Đặt thêm món</button>
            <button className="button button-outline" onClick={openHistory} type="button">Xem lịch sử đơn</button></div>
        </div>
      </section>}

      {view === 'orders' && <section className="page-section history-section">
        {!token ? (
          <div className="history-empty"><span className="empty-icon">⌑</span><h2>Đăng nhập để xem đơn hàng</h2><p>Lịch sử đơn được lưu an toàn theo tài khoản của bạn.</p><button className="button button-primary" onClick={() => setAuthOpen(true)} type="button">Đăng nhập</button></div>
        ) : historyLoading ? (
          <div className="state-message"><span className="loader" /> Đang tải đơn hàng...</div>
        ) : historyError ? (
          <div className="state-message state-error"><strong>Chưa thể tải lịch sử</strong><p>{historyError}</p><button className="button button-outline" onClick={openHistory} type="button">Thử lại</button></div>
        ) : (
          <>
            <header className="history-heading">
              <div>
                <span className="eyebrow">BREWLITE CỦA BẠN</span>
                <h1><ClipboardList aria-hidden="true" size={27} /> Lịch sử đơn hàng</h1>
                <p>Theo dõi đơn hàng và xem lại những món yêu thích của bạn.</p>
              </div>
              <button className="button button-outline" onClick={() => setView('menu')} type="button">← Về thực đơn</button>
            </header>

            {history.length > 0 && (
              <>
                <div className="history-stats">
                  <article className="history-stat"><span className="history-stat__icon"><ClipboardList size={20} /></span><div><span>Tổng đơn hàng</span><strong>{history.length}</strong></div></article>
                  <article className="history-stat"><span className="history-stat__icon"><WalletCards size={20} /></span><div><span>Đã chi tiêu</span><strong>{currency(history.reduce((sum, order) => sum + order.total, 0))}</strong></div></article>
                </div>

                <div className="history-toolbar">
                  <label className="history-search">
                    <Search aria-hidden="true" size={16} />
                    <input
                      value={historySearch}
                      onChange={(event) => setHistorySearch(event.target.value)}
                      placeholder="Tìm mã đơn hàng..."
                      aria-label="Tìm theo mã đơn hàng"
                    />
                  </label>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="history-empty history-empty--filtered"><h2>Không tìm thấy đơn hàng</h2><p>Thử từ khóa tìm kiếm khác.</p></div>
                ) : (
                  <div className="history-list">
                    {filteredHistory.map((order) => {
                      const orderKey = String(order.id);
                      const isExpanded = expandedOrders === null || expandedOrders.has(orderKey);
                      const paymentMethod = order.payment?.[0]?.method;
                      return (
                        <article className={`history-order${isExpanded ? ' is-expanded' : ''}`} key={order.id}>
                          <button
                            className="history-order__header"
                            onClick={() => toggleOrder(order.id)}
                            type="button"
                            aria-expanded={isExpanded}
                          >
                            <span className="history-order__id"><strong>Mã đơn:</strong> BL{String(order.id).padStart(8, '0')}</span>
                            <span className="history-order__date"><CalendarDays size={14} /> Đặt lúc: {formatOrderDate(order.createdAt)}</span>
                            <Status value={order.status} />
                            <ChevronDown className="history-order__chevron" size={17} />
                          </button>
                          {isExpanded && (
                            <div className="history-order__body">
                              <div className="history-order__items">
                                {(order.items ?? []).map((item) => (
                                  <div className="history-item" key={item.id}>
                                    <div className="history-item__image">
                                      {item.product?.imageUrl && <Image src={item.product.imageUrl} alt="" fill sizes="48px" />}
                                    </div>
                                    <div className="history-item__details">
                                      <strong>{item.product?.name ?? 'Sản phẩm'}</strong>
                                      <span>Size M · SL: {item.quantity}</span>
                                      <b>{currency(item.price * item.quantity)}</b>
                                    </div>
                                  </div>
                                ))}
                                {(order.items?.length ?? 0) === 0 && <p className="history-order__empty-items">Không có thông tin món trong đơn này.</p>}
                              </div>
                              <div className="history-order__delivery">
                                <div><MapPin size={16} /><span><strong>Hình thức nhận hàng</strong><small>Nhận tại cửa hàng</small></span></div>
                                <div><CreditCard size={16} /><span><strong>Phương thức thanh toán</strong><small>{paymentMethod === 'CARD' ? 'Thẻ ngân hàng' : paymentMethod === 'WALLET' ? 'Ví điện tử' : 'Chưa có thông tin'}</small></span></div>
                              </div>
                              <div className="history-order__total">
                                <div><span>Tạm tính</span><strong>{currency(order.total)}</strong></div>
                                <div><span>Phí giao hàng</span><strong>Miễn phí</strong></div>
                                <div className="history-order__grand-total"><span>Tổng cộng</span><strong>{currency(order.total)}</strong></div>
                                <button className="history-order__detail" onClick={() => toggleOrder(order.id)} type="button">Thu gọn</button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {history.length === 0 && <div className="history-empty"><span className="empty-icon">⌑</span><h2>Chưa có đơn hàng nào</h2><p>Đơn hàng đầu tiên của bạn đang chờ được tạo.</p><button className="button button-primary" onClick={() => setView('menu')} type="button">Khám phá thực đơn</button></div>}
          </>
        )}
      </section>}

      {selectedProduct && (
        <ProductDetailModal
          key={selectedProduct.id}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={(product, quantity) => {
            addItem(product, quantity);
            setSelectedProduct(null);
          }}
        />
      )}

      <footer className="site-footer"><a className="brand footer-brand" href="#top"><span className="brand-mark">B</span><span>Brew<span>Lite</span></span></a><span>Cà phê tử tế, mỗi ngày.</span><span>© BrewLite 2026</span></footer>

      {authOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }} role="presentation">
        <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
          <button className="modal-close" aria-label="Đóng" onClick={() => setAuthOpen(false)} type="button">×</button>
          <span className="brand-mark modal-brand">B</span><span className="eyebrow">{authMode === 'login' ? 'CHÀO MỪNG TRỞ LẠI' : 'THÀNH VIÊN BREWLITE'}</span>
          <h2 id="auth-title">{authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h2><p className="auth-intro">Đăng nhập để thanh toán và theo dõi đơn hàng của bạn.</p>
          <form className="auth-form" onSubmit={authenticate}>
            {authMode === 'register' && <label>Họ tên<input autoComplete="name" name="name" placeholder="Tên của bạn" required /></label>}
            <label>Email<input autoComplete="email" name="email" placeholder="ban@email.com" required type="email" /></label>
            <label>Mật khẩu<input autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={6} name="password" placeholder="Tối thiểu 6 ký tự" required type="password" /></label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="button button-primary button-full" disabled={authBusy} type="submit">{authBusy ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
          </form>
          <p className="auth-switch">{authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }} type="button">{authMode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</button></p>
        </section>
      </div>}
      </main>
    </>
  );
}
