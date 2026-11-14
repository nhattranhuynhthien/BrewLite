"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Image from 'next/image';
import {
  Award,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Coffee,
  CreditCard,
  Gift,
  MapPin,
  Search,
  Tag,
  WalletCards,
} from 'lucide-react';
import { ApiError, apiFetch, getAccessToken, getUserIdFromAccessToken, setAccessToken, subscribeToAccessToken } from '@/lib/api';
import SiteHeader from '@/layouts/SiteHeader';
import ProductDetailModal from '@/components/ProductDetailModal';
import { useUserProfile, notifyProfileUpdate } from '@/hooks/useUserProfile';
import { PRODUCTS as MENU_PRODUCTS } from '@/lib/menu-data';
import {
  getCartItemKey,
  getConfiguredUnitPrice,
  normalizeProductOptions,
} from '@/lib/product-options';
import { useCartStore } from '@/store/cart-store';
import { useToppings } from '@/hooks/useToppings';
import { checkoutStorageKey, loadCheckoutAttempt, saveCheckoutAttempt, getActiveCheckout, saveActiveCheckout, finishCheckout, withCheckoutLock } from '@/lib/checkout-attempt';
import { matchesOrderCode, orderCode, paymentLabel, primaryPayment, successfulSpend, type HistoryPayment } from '@/lib/order-history';
import type { Product } from '@/types/product';

type View = 'menu' | 'checkout' | 'confirmation' | 'orders';
type PaymentMethod = 'WALLET' | 'CREDIT_CARD';
type Order = {
  id: number | string;
  total: number;
  status: string;
  createdAt?: string;
  items?: {
    id: number;
    quantity: number;
    unitPrice: number;
    size: 'S' | 'M' | 'L' | null;
    toppings: { id: number; name: string; price: number }[] | null;
    sweetness: string | null;
    ice: string | null;
    note: string | null;
    product?: Pick<Product, 'name' | 'imageUrl'> | null;
  }[];
  payment?: HistoryPayment[];
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

const ORDER_STEPS = [
  { key: 'PENDING', label: 'Đặt đơn' },
  { key: 'PAID', label: 'Đã thanh toán' },
  { key: 'PREPARING', label: 'Đang pha chế' },
  { key: 'READY', label: 'Sẵn sàng lấy' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function OrderStateStepper({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return (
      <div className="order-stepper is-cancelled">
        <span className="order-stepper__badge">✕ Đơn hàng đã bị hủy</span>
      </div>
    );
  }
  if (status === 'PAYMENT_FAILED') {
    return (
      <div className="order-stepper is-failed">
        <span className="order-stepper__badge">⚠ Thanh toán thất bại · Chờ thử lại</span>
      </div>
    );
  }

  const currentIdx = ORDER_STEPS.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? (status === 'PAID' ? 1 : 0) : currentIdx;

  return (
    <div className="order-stepper" aria-label="Tiến trình đơn hàng">
      {ORDER_STEPS.map((step, idx) => {
        const isCompleted = idx < activeIdx;
        const isCurrent = idx === activeIdx;
        return (
          <div
            key={step.key}
            className={`order-stepper__step ${isCompleted ? 'is-completed' : ''} ${isCurrent ? 'is-current' : ''}`}
          >
            <div className="order-stepper__circle">
              {isCompleted ? '✓' : idx + 1}
            </div>
            <span className="order-stepper__label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
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
  const consumeItems = useCartStore((state) => state.consumeItems);
  const token = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState('');
  const {
    toppings,
    loading: toppingsLoading,
    error: toppingsError,
    reload: reloadToppings,
  } = useToppings();
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
  const { rewardPoints, refetch: refetchProfile } = useUserProfile();
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [receipt, setReceipt] = useState<{ id: number | string; total?: number; status: string } | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const checkoutInFlight = useRef(false);

  async function cancelOrder(orderId: number | string) {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderId} không?`)) return;
    setCancellingOrderId(orderId);
    setCancelMessage(null);
    try {
      await apiFetch(`/orders/${orderId}/cancel`, { method: 'PATCH' });
      setCancelMessage({ type: 'success', text: `Đã hủy thành công đơn hàng #${orderId}.` });
      setHistoryRequest((r) => r + 1);
      notifyProfileUpdate();
      void refetchProfile();
      if (receipt && String(receipt.id) === String(orderId)) {
        setReceipt((prev) => prev ? { ...prev, status: 'CANCELLED' } : null);
      }
    } catch (err) {
      setCancelMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể hủy đơn hàng này.',
      });
    } finally {
      setCancellingOrderId(null);
    }
  }

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
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + getConfiguredUnitPrice(item.product, item.options) * item.quantity, 0),
    [items],
  );
  const voucherDiscount = useMemo(() => {
    if (!appliedVoucher) return 0;
    if (appliedVoucher.toUpperCase() === 'GIAM10') {
      return Math.min(Math.round(subtotal * 0.1), 50000);
    }
    return 0;
  }, [appliedVoucher, subtotal]);

  const totalAfterVoucher = Math.max(0, subtotal - voucherDiscount);
  const maxUsablePoints = Math.min(rewardPoints, Math.floor(totalAfterVoucher / 1000));
  const actualPointsToUse = usePoints ? Math.min(pointsToUse, maxUsablePoints) : 0;
  const pointsDiscount = actualPointsToUse * 1000;
  const total = Math.max(0, totalAfterVoucher - pointsDiscount);
  const earnedPoints = Math.floor(total / 10000);

  function applyVoucher(code?: string) {
    const target = (code ?? voucherInput).trim().toUpperCase();
    if (!target) {
      setVoucherError('Vui lòng nhập mã ưu đãi');
      return;
    }
    setAppliedVoucher(target);
    setVoucherInput(target);
    setVoucherError('');
  }

  function removeVoucher() {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
  }

  function handleTogglePoints(checked: boolean) {
    setUsePoints(checked);
    if (checked && pointsToUse === 0) {
      setPointsToUse(maxUsablePoints);
    }
  }
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('vi');
    return history.filter((order) => {
      const matchesSearch = matchesOrderCode(order.id, query);
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
    if (checkoutInFlight.current) return;
    if (!token) {
      setCheckoutError('Vui lòng đăng nhập trước khi thanh toán.');
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    if (items.length === 0) {
      setCheckoutError('Giỏ hàng đang trống.');
      return;
    }

    checkoutInFlight.current = true;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      await withCheckoutLock(token, async () => {
        const authorization = { Authorization: `Bearer ${token}` };
        const orderPayload: {
          items: Array<{
            productId: number;
            quantity: number;
            size: 'S' | 'M' | 'L';
            toppingIds: number[];
            sweetness: string;
            ice: string;
            note: string;
          }>;
          voucherCode?: string;
          pointsToUse?: number;
        } = {
          items: items.map(({ product, quantity, options }) => {
            const normalized = normalizeProductOptions(options);
            return {
              productId: product.id, quantity, size: normalized.size,
              toppingIds: normalized.toppings.map(({ id }) => id),
              sweetness: normalized.sweetness, ice: normalized.ice, note: normalized.note,
            };
          }),
        };
        if (appliedVoucher) {
          orderPayload.voucherCode = appliedVoucher;
        }
        if (usePoints && actualPointsToUse > 0) {
          orderPayload.pointsToUse = actualPointsToUse;
        }
        const body = JSON.stringify(orderPayload);
        const storageKey = await checkoutStorageKey(token, body);
        const active = getActiveCheckout(token);
        if (active && active.storageKey !== storageKey) {
          // Recover a lost order response with the original key before inspecting its state.
          const previous = loadCheckoutAttempt(active.storageKey);
          let recovered: { orderId: number };
          try {
            recovered = await apiFetch('/orders', {
              method: 'POST', headers: { ...authorization, 'Idempotency-Key': previous.orderKey }, body: active.body,
            });
          } catch (error) {
            if (error instanceof ApiError && [400, 404].includes(error.status)) finishCheckout(token, active.storageKey);
            throw error;
          }
          const oldOrder = await apiFetch<Order>(`/orders/${recovered.orderId}`, { headers: authorization });
          if (oldOrder.status !== 'CANCELLED') {
            if (['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(oldOrder.status)) {
              finishCheckout(token, active.storageKey);
              throw new Error(`Đơn ${orderCode(oldOrder.id)} đã thanh toán. Giỏ hiện tại được giữ nguyên; hãy kiểm tra lịch sử trước khi thanh toán giỏ này.`);
            }
            throw new Error(`Đơn ${orderCode(oldOrder.id)} chưa hoàn tất. Vui lòng kiểm tra hoặc hủy đơn trong lịch sử trước khi thanh toán giỏ đã thay đổi.`);
          }
          finishCheckout(token, active.storageKey);
        }
        const attempt = loadCheckoutAttempt(storageKey);
        if (attempt.paymentMethod && attempt.paymentMethod !== method) {
          throw new Error('Lần thanh toán trước chưa rõ kết quả. Vui lòng chọn lại phương thức trước đó để kiểm tra, hoặc xem lịch sử đơn.');
        }
        saveActiveCheckout(token, { storageKey, body });
        let created: { orderId: number; order: { total: number } };
        try {
          created = await apiFetch('/orders', {
            method: 'POST', headers: { ...authorization, 'Idempotency-Key': attempt.orderKey }, body,
          });
        } catch (error) {
          if (error instanceof ApiError && [400, 404].includes(error.status)) finishCheckout(token, storageKey);
          throw error;
        }
        const orderId = created.orderId;
        const amount = created.order?.total;
        if (!Number.isInteger(orderId) || !Number.isFinite(amount) || amount < 0) {
          throw new Error('API tạo đơn không trả về mã đơn hoặc tổng tiền hợp lệ.');
        }
        saveActiveCheckout(token, { storageKey, body, orderId });
        const currentOrder = await apiFetch<Order>(`/orders/${orderId}`, { headers: authorization });
        if (currentOrder.status === 'CANCELLED') {
          finishCheckout(token, storageKey);
          throw new Error('Đơn trước đã hủy. Vui lòng bấm thanh toán lại để tạo đơn mới.');
        }
        attempt.paymentMethod = method;
        saveCheckoutAttempt(storageKey, attempt);
        const payment = await apiFetch<{
          status?: string;
          message?: string;
          orderStatus?: string;
          payment?: { status?: string };
          order?: { status?: string };
        }>('/payments', {
          method: 'POST',
          headers: { ...authorization, 'Idempotency-Key': attempt.paymentKey },
          body: JSON.stringify({ orderId, method, amount }),
        });
        const paymentStatus = payment?.orderStatus ?? payment?.payment?.status ?? payment?.status ?? payment?.order?.status;
        if (!payment || typeof paymentStatus !== 'string') throw new Error('API thanh toán không trả về trạng thái hợp lệ.');
        if (paymentStatus === 'PAYMENT_FAILED' || paymentStatus === 'FAILED') {
          attempt.paymentKey = crypto.randomUUID();
          delete attempt.paymentMethod;
          saveCheckoutAttempt(storageKey, attempt);
          throw new Error(payment.message ?? 'Thanh toán thất bại. Vui lòng thử lại.');
        }
        if (paymentStatus !== 'PAID' && paymentStatus !== 'SUCCESS') {
          throw new Error(payment.message ?? `Thanh toán chưa hoàn tất (${paymentStatus}).`);
        }
        if (getUserIdFromAccessToken(getAccessToken() ?? '') !== getUserIdFromAccessToken(token)) {
          throw new Error('Tài khoản đã thay đổi. Đơn đã thanh toán thuộc tài khoản trước; giỏ hiện tại được giữ nguyên.');
        }
        await useCartStore.persist.rehydrate();
        if (getUserIdFromAccessToken(getAccessToken() ?? '') !== getUserIdFromAccessToken(token)) {
          throw new Error('Tài khoản đã thay đổi. Vui lòng kiểm tra đơn với tài khoản đã thanh toán.');
        }
        setReceipt({
          id: orderId,
          total: amount,
          status: payment.order?.status ?? payment.orderStatus ?? paymentStatus ?? 'PAID',
        });
        consumeItems(items);
        setAppliedVoucher(null);
        setVoucherInput('');
        setUsePoints(false);
        setPointsToUse(0);
        notifyProfileUpdate();
        void refetchProfile();
        finishCheckout(token, storageKey);
        setView('confirmation');
      });
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Không thể hoàn tất thanh toán.');
      if (error instanceof ApiError && error.status === 401) {
        setAuthMode('login');
        setAuthOpen(true);
      }
    } finally {
      checkoutInFlight.current = false;
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

        {items.length > 0 && (
          <aside className="menu-floating-cart" aria-label="Xem giỏ hàng nhanh">
            <div className="menu-floating-cart__content">
              <div className="menu-floating-cart__left">
                <span className="menu-floating-cart__badge">{items.reduce((s, i) => s + i.quantity, 0)}</span>
                <div>
                  <strong>{currency(subtotal)}</strong>
                  <small>{items.reduce((s, i) => s + i.quantity, 0)} món trong giỏ</small>
                </div>
              </div>
              <button
                type="button"
                className="button button-primary menu-floating-cart__action"
                onClick={() => setView('checkout')}
              >
                Xem giỏ hàng ({items.reduce((s, i) => s + i.quantity, 0)}) →
              </button>
            </div>
          </aside>
        )}
      </>}

      {view === 'checkout' && <section className="page-section checkout-section">
        <button className="back-link" onClick={() => setView('menu')} type="button">← Quay lại thực đơn</button>
        <div className="checkout-header"><span className="eyebrow">BƯỚC CUỐI CÙNG</span><h1>Thanh toán</h1><p>Nhận tại quầy · Không tính phí giao hàng.</p></div>
        <div className="checkout-layout">
          <div className="payment-card">
            <h2>Phương thức thanh toán</h2>
            <button className={`payment-option ${method === 'WALLET' ? 'selected' : ''}`} disabled={checkoutBusy} onClick={() => setMethod('WALLET')} type="button">
              <span className="payment-icon wallet-icon">◈</span><span className="payment-copy"><strong>Ví điện tử</strong><small>Thanh toán nhanh chóng</small></span><span className="radio-mark" />
            </button>
            <button className={`payment-option ${method === 'CREDIT_CARD' ? 'selected' : ''}`} disabled={checkoutBusy} onClick={() => setMethod('CREDIT_CARD')} type="button">
              <span className="payment-icon card-icon">▤</span><span className="payment-copy"><strong>Thẻ ngân hàng</strong><small>Visa, Mastercard, nội địa</small></span><span className="radio-mark" />
            </button>

            <div className="checkout-section-divider" />

            <div className="checkout-subcard">
              <div className="checkout-subcard__head">
                <Tag size={17} className="checkout-subcard__icon" />
                <h3>Mã ưu đãi / Voucher</h3>
              </div>
              <div className="checkout-promo-hints">
                <span className="checkout-promo-hint-label"><Gift size={13} /> Gợi ý:</span>
                <button
                  type="button"
                  className={`checkout-promo-chip ${appliedVoucher === 'GIAM10' ? 'is-applied' : ''}`}
                  onClick={() => applyVoucher('GIAM10')}
                  disabled={checkoutBusy}
                >
                  <strong>GIAM10</strong> · Giảm 10% (tối đa 50k)
                </button>
              </div>
              {appliedVoucher ? (
                <div className="checkout-voucher-applied">
                  <div className="checkout-voucher-applied__info">
                    <Check size={16} className="checkout-voucher-applied__icon" />
                    <span>Mã ưu đãi <strong>{appliedVoucher}</strong> đã được áp dụng</span>
                  </div>
                  <button
                    type="button"
                    className="checkout-voucher-remove"
                    onClick={removeVoucher}
                    disabled={checkoutBusy}
                    title="Bỏ áp dụng mã này"
                  >
                    Bỏ chọn
                  </button>
                </div>
              ) : (
                <div className="checkout-input-group">
                  <input
                    className="checkout-input"
                    type="text"
                    placeholder="Nhập mã ưu đãi (ví dụ: GIAM10)"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyVoucher();
                      }
                    }}
                    disabled={checkoutBusy}
                    aria-label="Mã giảm giá"
                  />
                  <button
                    className="button button-outline checkout-apply-btn"
                    type="button"
                    onClick={() => applyVoucher()}
                    disabled={checkoutBusy || !voucherInput.trim()}
                  >
                    Áp dụng
                  </button>
                </div>
              )}
              {voucherError && <p className="checkout-field-error">{voucherError}</p>}
            </div>

            <div className="checkout-section-divider" />

            <div className="checkout-subcard">
              <div className="checkout-subcard__head">
                <Award size={17} className="checkout-subcard__icon" />
                <h3>Điểm thưởng BrewLite</h3>
              </div>
              {!token ? (
                <div className="checkout-loyalty-prompt">
                  <p>Đăng nhập tài khoản để tích điểm (10.000đ = 1 điểm) và dùng điểm thanh toán (1 điểm = 1.000đ).</p>
                  <button
                    className="button button-outline checkout-login-btn"
                    type="button"
                    onClick={() => { setAuthMode('login'); setAuthOpen(true); }}
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              ) : (
                <div className="checkout-loyalty-body">
                  <div className="checkout-loyalty-balance">
                    <span>Số điểm hiện có:</span>
                    <strong>{rewardPoints.toLocaleString('vi-VN')} điểm</strong>
                    <small>({currency(rewardPoints * 1000)})</small>
                  </div>
                  {rewardPoints > 0 ? (
                    <div className="checkout-loyalty-action">
                      <label className="checkout-checkbox-label">
                        <input
                          type="checkbox"
                          checked={usePoints}
                          onChange={(e) => handleTogglePoints(e.target.checked)}
                          disabled={checkoutBusy || maxUsablePoints <= 0}
                        />
                        <span>Sử dụng điểm thưởng để giảm giá đơn hàng</span>
                      </label>
                      {usePoints && (
                        <div className="checkout-points-control">
                          <div className="checkout-points-input-wrap">
                            <input
                              className="checkout-points-input"
                              type="number"
                              min={1}
                              max={maxUsablePoints}
                              value={pointsToUse || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (Number.isNaN(val)) setPointsToUse(0);
                                else setPointsToUse(Math.max(0, Math.min(val, maxUsablePoints)));
                              }}
                              disabled={checkoutBusy}
                              aria-label="Số điểm muốn sử dụng"
                            />
                            <span className="checkout-points-unit">/ {maxUsablePoints.toLocaleString('vi-VN')} điểm khả dụng</span>
                          </div>
                          <button
                            type="button"
                            className="button button-outline checkout-points-max"
                            onClick={() => setPointsToUse(maxUsablePoints)}
                            disabled={checkoutBusy || pointsToUse === maxUsablePoints}
                          >
                            Dùng tối đa
                          </button>
                        </div>
                      )}
                      {usePoints && pointsDiscount > 0 && (
                        <div className="checkout-points-savings">
                          Tiết kiệm <strong>{currency(pointsDiscount)}</strong> từ điểm thưởng
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="checkout-loyalty-note">
                      Bạn chưa có điểm thưởng. Sau khi hoàn tất đơn này, bạn sẽ nhận được <strong>+{earnedPoints} điểm</strong>!
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="checkout-secure">⌑ <span>Thông tin thanh toán được bảo vệ an toàn.</span></div>
            {checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}
            <button className="button button-primary button-full pay-button" disabled={checkoutBusy || items.length === 0} onClick={pay} type="button">
              {checkoutBusy ? 'Đang xử lý...' : `Xác nhận & thanh toán · ${currency(total)}`}
            </button>
            <p className="terms-copy">Bằng việc tiếp tục, bạn đồng ý với điều khoản sử dụng của BrewLite.</p>
          </div>

          <aside className="order-summary">
            <h2>Đơn hàng của bạn <span>{items.reduce((sum, item) => sum + item.quantity, 0)} món</span></h2>
            {items.map((item) => {
              const options = normalizeProductOptions(item.options);
              const toppingsLabel = options.toppings.map(({ name }) => name).join(', ');
              return (
                <div className="summary-row" key={getCartItemKey(item.product.id, item.options)}>
                  <span className="summary-quantity">{item.quantity}×</span>
                  <span className="summary-name">
                    {item.product.name}
                    <small>Size {options.size}{toppingsLabel ? ` · ${toppingsLabel}` : ''} · {options.sweetness} · {options.ice}</small>
                  </span>
                  <strong>{currency(getConfiguredUnitPrice(item.product, item.options) * item.quantity)}</strong>
                </div>
              );
            })}
            <div className="summary-breakdown">
              <div className="summary-breakdown-row">
                <span>Tạm tính</span>
                <span>{currency(subtotal)}</span>
              </div>
              {voucherDiscount > 0 && (
                <div className="summary-breakdown-row is-discount">
                  <span>Mã ưu đãi ({appliedVoucher})</span>
                  <span>-{currency(voucherDiscount)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="summary-breakdown-row is-discount">
                  <span>Điểm thưởng ({actualPointsToUse} điểm)</span>
                  <span>-{currency(pointsDiscount)}</span>
                </div>
              )}
            </div>
            <div className="summary-total">
              <span>Tổng thanh toán</span>
              <strong>{currency(total)}</strong>
            </div>
            {token && earnedPoints > 0 && (
              <div className="summary-reward-note">
                <Award size={14} />
                <span>Nhận ngay <strong>+{earnedPoints} điểm</strong> khi đơn hoàn thành</span>
              </div>
            )}
          </aside>
        </div>
      </section>}

      {view === 'confirmation' && receipt && <section className="page-section confirmation-section">
        <div className="confirmation-card">
          <div className="success-mark">✓</div>
          <span className="eyebrow">CẢM ƠN BẠN ĐÃ ĐẶT MÓN</span>
          <h1>Đặt hàng thành công!</h1>

          <div className="pickup-callout">
            <Coffee size={22} className="pickup-callout__icon" />
            <div>
              <strong>Mời tới quầy lấy nước</strong>
              <p>Đồ uống đang được Barista chuẩn bị tươi mới cho bạn.</p>
            </div>
          </div>

          <OrderStateStepper status={receipt.status} />

          <div className="receipt-details">
            <div><span>Mã đơn hàng</span><strong>#{receipt.id}</strong></div>
            <div><span>Trạng thái</span><Status value={receipt.status} /></div>
            <div><span>Phương thức</span><strong>{method === 'WALLET' ? 'Ví điện tử' : 'Thẻ ngân hàng'}</strong></div>
            {typeof receipt.total === 'number' && (
              <div><span>Tổng thanh toán</span><strong>{currency(receipt.total)}</strong></div>
            )}
            {typeof receipt.total === 'number' && Math.floor(receipt.total / 10000) > 0 && (
              <div><span>Điểm thưởng nhận được</span><strong className="summary-points-earned">+{Math.floor(receipt.total / 10000)} điểm</strong></div>
            )}
          </div>

          {['PENDING', 'PAID'].includes(receipt.status) && (
            <div className="confirmation-cancel-wrap">
              <button
                type="button"
                className="button-link-cancel"
                onClick={() => cancelOrder(receipt.id)}
                disabled={cancellingOrderId === receipt.id}
              >
                {cancellingOrderId === receipt.id ? 'Đang xử lý hủy...' : 'Hủy đơn hàng này'}
              </button>
            </div>
          )}

          <div className="confirmation-actions">
            <button className="button button-primary" onClick={() => { setView('menu'); setReceipt(null); }} type="button">
              Về trang chủ
            </button>
            <button className="button button-outline" onClick={openHistory} type="button">
              Xem lịch sử đơn
            </button>
          </div>
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

            {cancelMessage && (
              <div className={`history-alert is-${cancelMessage.type}`}>
                <span>{cancelMessage.text}</span>
                <button type="button" onClick={() => setCancelMessage(null)}>✕</button>
              </div>
            )}

            {history.length > 0 && (
              <>
                <div className="history-stats">
                  <article className="history-stat"><span className="history-stat__icon"><ClipboardList size={20} /></span><div><span>Tổng đơn hàng</span><strong>{history.length}</strong></div></article>
                  <article className="history-stat"><span className="history-stat__icon"><WalletCards size={20} /></span><div><span>Đã chi tiêu</span><strong>{currency(successfulSpend(history))}</strong></div></article>
                  <article className="history-stat"><span className="history-stat__icon"><Award size={20} /></span><div><span>Điểm tích lũy</span><strong>{rewardPoints.toLocaleString('vi-VN')} điểm</strong></div></article>
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
                      const paymentMethod = primaryPayment(order.payment)?.method;
                      return (
                        <article className={`history-order${isExpanded ? ' is-expanded' : ''}`} key={order.id}>
                          <button
                            className="history-order__header"
                            onClick={() => toggleOrder(order.id)}
                            type="button"
                            aria-expanded={isExpanded}
                          >
                            <span className="history-order__id"><strong>Mã đơn:</strong> {orderCode(order.id)}</span>
                            <span className="history-order__date"><CalendarDays size={14} /> Đặt lúc: {formatOrderDate(order.createdAt)}</span>
                            <Status value={order.status} />
                            <ChevronDown className="history-order__chevron" size={17} />
                          </button>
                          {isExpanded && (
                            <div className="history-order__body">
                              <OrderStateStepper status={order.status} />

                              {order.status === 'READY' && (
                                <div className="pickup-callout pickup-callout--ready">
                                  <Coffee size={18} className="pickup-callout__icon" />
                                  <div>
                                    <strong>Mời bạn tới quầy lấy nước!</strong>
                                    <p>Đồ uống đã được pha chế hoàn tất và đang chờ bạn nhận tại quầy.</p>
                                  </div>
                                </div>
                              )}

                              <div className="history-order__items">
                                {(order.items ?? []).map((item) => {
                                  const optionsSummary = [
                                    item.size ? `Size ${item.size}` : '',
                                    item.toppings?.map(({ name }) => name).join(', ') ?? '',
                                    item.sweetness ?? '',
                                    item.ice ?? '',
                                    item.note ? `Ghi chú: ${item.note}` : '',
                                    `SL: ${item.quantity}`,
                                  ].filter(Boolean).join(' · ');
                                  return (
                                    <div className="history-item" key={item.id}>
                                      <div className="history-item__image">
                                        {item.product?.imageUrl && <Image src={item.product.imageUrl} alt="" fill sizes="48px" />}
                                      </div>
                                      <div className="history-item__details">
                                        <strong>{item.product?.name ?? 'Sản phẩm'}</strong>
                                        <span>{optionsSummary}</span>
                                        <b>{currency(item.unitPrice * item.quantity)}</b>
                                      </div>
                                    </div>
                                  );
                                })}
                                {(order.items?.length ?? 0) === 0 && <p className="history-order__empty-items">Không có thông tin món trong đơn này.</p>}
                              </div>
                              <div className="history-order__delivery">
                                <div><MapPin size={16} /><span><strong>Hình thức nhận hàng</strong><small>Nhận tại cửa hàng</small></span></div>
                                <div><CreditCard size={16} /><span><strong>Phương thức thanh toán</strong><small>{paymentLabel(paymentMethod)}</small></span></div>
                              </div>
                              <div className="history-order__total">
                                <div><span>Tạm tính</span><strong>{currency(order.total)}</strong></div>
                                <div className="history-order__grand-total"><span>Tổng thanh toán · nhận tại quầy</span><strong>{currency(order.total)}</strong></div>
                                <div className="history-order__actions-row">
                                  {['PENDING', 'PAYMENT_FAILED', 'PAID'].includes(order.status) && (
                                    <button
                                      type="button"
                                      className="button button-outline history-order__cancel-btn"
                                      onClick={() => cancelOrder(order.id)}
                                      disabled={cancellingOrderId === order.id}
                                    >
                                      {cancellingOrderId === order.id ? 'Đang hủy...' : 'Hủy đơn'}
                                    </button>
                                  )}
                                  <button className="history-order__detail" onClick={() => toggleOrder(order.id)} type="button">Thu gọn</button>
                                </div>
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
          toppings={toppings}
          toppingsLoading={toppingsLoading}
          toppingsError={toppingsError}
          onReloadToppings={() => void reloadToppings()}
          onClose={() => setSelectedProduct(null)}
          onAdd={(product, quantity, options) => {
            addItem(product, quantity, options);
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
