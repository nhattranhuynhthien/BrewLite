"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { apiFetch, getAccessToken, getUserIdFromAccessToken, setAccessToken, subscribeToAccessToken } from '@/lib/api';
import SiteHeader from '@/layouts/SiteHeader';
import { useCartStore, type CartItem } from '@/store/cart-store';
import type { Product } from '@/types/product';

type View = 'menu' | 'checkout' | 'confirmation' | 'orders';
type PaymentMethod = 'WALLET' | 'CARD';
type Order = {
  id: number | string;
  total: number;
  status: string;
  createdAt?: string;
};

const currency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

const statuses: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PREPARING: 'Đang pha chế',
  READY: 'Sẵn sàng',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

function ProductArt({ id }: { id: number }) {
  const art = [
    ['☕', 'art-coffee'],
    ['🧊', 'art-ice'],
    ['🥛', 'art-milk'],
    ['🍑', 'art-peach'],
  ][(id - 1) % 4];
  return <div className={`product-art ${art[1]}`} aria-hidden="true"><span>{art[0]}</span><i /></div>;
}

function Status({ value }: { value: string }) {
  return <span className={`status-pill status-${value.toLowerCase()}`}>{statuses[value] ?? value}</span>;
}

export default function Storefront({ initialView = 'menu' }: { initialView?: View }) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>(initialView);
  const [method, setMethod] = useState<PaymentMethod>('WALLET');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRequest, setHistoryRequest] = useState(0);
  const [receipt, setReceipt] = useState<{ id: number | string; status: string } | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (initialView !== 'checkout' || window.location.search === '') return;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }, [initialView]);

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
    return query
      ? products.filter((product) => product.name.toLocaleLowerCase('vi').includes(query))
      : products;
  }, [products, searchQuery]);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items],
  );
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

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

      const payment = await apiFetch<{ status: string; message?: string; orderStatus?: string; order?: { status?: string } }>('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ orderId, amount: total, method }),
      });
      if (!payment || typeof payment.status !== 'string') throw new Error('API thanh toán không trả về trạng thái hợp lệ.');
      if (payment.status === 'PAYMENT_FAILED') throw new Error(payment.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
      if (payment.status !== 'PAID' && payment.status !== 'SUCCESS') {
        throw new Error(payment.message ?? `Thanh toán chưa hoàn tất (${payment.status}).`);
      }
      setReceipt({ id: orderId, status: payment.order?.status ?? payment.orderStatus ?? 'PAID' });
      clearCart();
      idempotencyKey.current = null;
      setView('confirmation');
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Không thể hoàn tất thanh toán.');
    } finally {
      setCheckoutBusy(false);
    }
  }

  const cart = (
    <aside className="cart-panel" aria-label="Giỏ hàng">
      <div className="section-heading cart-heading">
        <div><span className="eyebrow">ĐẶT MÓN</span><h2>Giỏ hàng <span className="cart-count">{count}</span></h2></div>
        {items.length > 0 && <button className="text-button" onClick={clearCart} type="button">Xóa hết</button>}
      </div>
      {items.length === 0 ? (
        <div className="empty-cart"><span className="empty-icon" aria-hidden="true">⌑</span><strong>Giỏ hàng còn trống</strong><p>Chọn món bạn yêu thích để bắt đầu.</p></div>
      ) : (
        <>
          <div className="cart-items">{items.map((item) => (
            <CartRow key={item.product.id} item={item} changeQuantity={setQuantity} remove={removeItem} />
          ))}</div>
          <div className="cart-total"><span>Tạm tính</span><strong>{currency(total)}</strong></div>
          <button className="button button-primary button-full" onClick={() => { setCheckoutError(''); setView('checkout'); }} type="button">
            Tiến hành thanh toán <span aria-hidden="true">→</span>
          </button>
          <p className="secure-note">⌑ Thanh toán an toàn, không tiền mặt</p>
        </>
      )}
    </aside>
  );

  return (
    <>
      <SiteHeader
        navItems={[
          { label: 'Menu', active: view === 'menu', onClick: () => setView('menu') },
          { label: 'Đơn hàng', active: view === 'orders', onClick: openHistory },
        ]}
        onSearchChange={setSearchQuery}
        onSearchOpen={() => setView('menu')}
        onLogin={() => { setAuthMode('login'); setAuthOpen(true); }}
        authenticated={Boolean(token)}
        onSignOut={signOut}
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
                  : <div className="product-grid">{filteredProducts.map((product, index) => (
                    <article className="product-card" key={product.id}>
                      <div className="product-art-wrap">{product.id === products[0]?.id && <span className="product-tag">BÁN CHẠY</span>}<ProductArt id={product.id} />
                        <button className="add-button" onClick={() => addItem(product)} type="button" aria-label={`Thêm ${product.name} vào giỏ`}>+</button></div>
                      <div className="product-info"><div><h3>{product.name}</h3><p>{index % 2 === 0 ? 'Đậm đà, cân bằng' : 'Thơm dịu, dễ uống'}</p></div><strong>{currency(product.price)}</strong></div>
                    </article>
                  ))}</div>}
            <div className="promise-strip">
              <div><span>✳</span><p><strong>Hạt tuyển chọn</strong><br />Rang mới mỗi tuần</p></div>
              <div><span>⌁</span><p><strong>Pha chế thủ công</strong><br />Chăm chút từng ly</p></div>
              <div><span>♡</span><p><strong>Nhận tại cửa hàng</strong><br />Nhanh chóng, tiện lợi</p></div>
            </div>
          </div>
          {cart}
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
        <div className="history-heading"><div><span className="eyebrow">BREWLITE CỦA BẠN</span><h1>Lịch sử đơn hàng</h1><p>Theo dõi những lần thưởng thức gần đây.</p></div><button className="button button-outline" onClick={() => setView('menu')} type="button">← Về thực đơn</button></div>
        {!token ? <div className="history-empty"><span className="empty-icon">⌑</span><h2>Đăng nhập để xem đơn hàng</h2><p>Lịch sử đơn được lưu an toàn theo tài khoản của bạn.</p><button className="button button-primary" onClick={() => setAuthOpen(true)} type="button">Đăng nhập</button></div>
          : historyLoading ? <div className="state-message"><span className="loader" /> Đang tải đơn hàng...</div>
            : historyError ? <div className="state-message state-error"><strong>Chưa thể tải lịch sử</strong><p>{historyError}</p><button className="button button-outline" onClick={openHistory} type="button">Thử lại</button></div>
              : history.length === 0 ? <div className="history-empty"><span className="empty-icon">⌑</span><h2>Chưa có đơn hàng nào</h2><p>Đơn hàng đầu tiên của bạn đang chờ được tạo.</p><button className="button button-primary" onClick={() => setView('menu')} type="button">Khám phá thực đơn</button></div>
                : <div className="history-list">{history.map((order) => <article className="history-order" key={order.id}>
                  <div className="history-order-top"><div><span className="eyebrow">MÃ ĐƠN</span><h2>#{order.id}</h2></div><Status value={order.status} /></div>
                  <div className="history-order-bottom"><span>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Ngày đặt không khả dụng'}</span><strong>{currency(order.total)}</strong></div>
                </article>)}</div>}
      </section>}

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

function CartRow({
  item,
  changeQuantity,
  remove,
}: {
  item: CartItem;
  changeQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
}) {
  return <div className="cart-row"><ProductArt id={item.product.id} /><div className="cart-row-content">
    <div className="cart-row-title"><strong>{item.product.name}</strong><button aria-label={`Xóa ${item.product.name}`} className="remove-button" onClick={() => remove(item.product.id)} type="button">×</button></div>
    <span>{currency(item.product.price)}</span><div className="quantity-control">
      <button aria-label="Giảm số lượng" onClick={() => changeQuantity(item.product.id, item.quantity - 1)} type="button">−</button><span>{item.quantity}</span>
      <button aria-label="Tăng số lượng" onClick={() => changeQuantity(item.product.id, item.quantity + 1)} type="button">+</button>
    </div>
  </div></div>;
}
