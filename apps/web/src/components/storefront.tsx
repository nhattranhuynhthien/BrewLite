"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  Award,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Clock,
  Coffee,
  Copy,
  CreditCard,
  Gift,
  Leaf,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
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
import { getProductQuantityInCart, useCartStore } from '@/store/cart-store';
import { useToppings } from '@/hooks/useToppings';
import { checkoutStorageKey, loadCheckoutAttempt, saveCheckoutAttempt, getActiveCheckout, saveActiveCheckout, finishCheckout, withCheckoutLock } from '@/lib/checkout-attempt';
import { buildOrderItemsPayload, fetchOrderQuote, type OrderQuote } from '@/lib/order-quote';
import { matchesOrderCode, orderCode, paymentLabel, primaryPayment, successfulSpend, type HistoryPayment } from '@/lib/order-history';
import type { Product } from '@/types/product';

type View = 'menu' | 'checkout' | 'confirmation' | 'orders';
type PaymentMethod = 'WALLET' | 'CREDIT_CARD';
type Order = {
  id: number | string;
  total: number;
  status: string;
  rewardPointsEarned?: number;
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

function LoyaltyPolicyTable({
  samplePoints,
  caption,
  compact = false,
}: {
  samplePoints: number;
  caption: string;
  compact?: boolean;
}) {
  const points = samplePoints > 0 ? samplePoints : 5;
  return (
    <div className={`loyalty-policy-wrap${compact ? ' is-compact' : ''}`}>
      <p className="loyalty-policy-caption">{caption}</p>
      <table className="loyalty-policy-table" aria-label="Chính sách điểm chờ và hủy đơn">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Điểm được ghi nhận</th>
            <th>Điểm có thể dùng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Thanh toán thành công (<code>PAID</code>)</td>
            <td>+{points}</td>
            <td>0 — đang chờ</td>
          </tr>
          <tr>
            <td>Bắt đầu pha chế (<code>PREPARING</code>)</td>
            <td>Giữ nguyên {points}</td>
            <td>{points}</td>
          </tr>
          <tr>
            <td>Hủy trước pha chế (<code>CANCELLED</code>)</td>
            <td>Thu hồi {points}</td>
            <td>0</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

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
  const { rewardPoints, pendingRewardPoints, availableRewardPoints, refetch: refetchProfile } = useUserProfile();
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState('');
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [serverQuoteState, setServerQuoteState] = useState<{
    quoteKey: string;
    itemsKey: string;
    data: OrderQuote;
  } | null>(null);
  const [quoteErrorState, setQuoteErrorState] = useState<{
    quoteKey: string;
    message: string;
  } | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [receipt, setReceipt] = useState<{ id: number | string; total?: number; status: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const checkoutInFlight = useRef(false);
  const quoteSeqRef = useRef(0);
  const lastQuotedKeyRef = useRef<string | null>(null);

  function handleCopyVoucher(code: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  async function cancelOrder(orderId: number | string) {
    if (!window.confirm(`Hủy đơn hàng #${orderId}?\n\nKho, điểm đã đổi và lượt voucher sẽ được hoàn lại. Nếu đơn đã thanh toán, hệ thống ghi nhận hoàn tiền mô phỏng và thu hồi điểm chờ của đơn. Điểm chỉ được sử dụng khi quán bắt đầu pha chế; từ lúc đó đơn không còn được hủy.`)) return;
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

  function navigateToSection(sectionId: string) {
    if (view !== 'menu') {
      setView('menu');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
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
      ? products.filter((product) => product.name.toLocaleLowerCase('vi').includes(query))
      : featuredProducts;
  }, [products, searchQuery]);
  const itemsPayloadKey = useMemo(
    () => JSON.stringify(buildOrderItemsPayload(items)),
    [items],
  );
  const clientSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + getConfiguredUnitPrice(item.product, item.options) * item.quantity, 0),
    [items],
  );
  const activeQuote =
    serverQuoteState &&
    serverQuoteState.itemsKey === itemsPayloadKey &&
    (serverQuoteState.data.voucherCode ?? null) === (appliedVoucher ?? null)
      ? serverQuoteState.data
      : null;
  const subtotal = activeQuote ? activeQuote.subtotal : clientSubtotal;
  const voucherDiscount = appliedVoucher && activeQuote ? activeQuote.voucherDiscount : 0;

  const totalAfterVoucher = Math.max(0, subtotal - voucherDiscount);
  const maxUsablePoints = Math.max(0, Math.min(availableRewardPoints, Math.floor(totalAfterVoucher / 1000)));
  const actualPointsToUse = usePoints ? Math.min(pointsToUse, maxUsablePoints) : 0;
  const pointsDiscount = actualPointsToUse * 1000;
  const currentQuoteKey = `${itemsPayloadKey}|${appliedVoucher ?? ''}|${actualPointsToUse}`;
  const exactQuote = activeQuote && activeQuote.pointsToUse === actualPointsToUse ? activeQuote : null;
  const total = exactQuote ? exactQuote.total : Math.max(0, totalAfterVoucher - pointsDiscount);
  const earnedPoints = exactQuote ? exactQuote.earnedPoints : Math.floor(total / 10000);
  const quoteError = quoteErrorState?.quoteKey === currentQuoteKey ? quoteErrorState.message : '';
  const quoteBusy =
    view === 'checkout' &&
    items.length > 0 &&
    serverQuoteState?.quoteKey !== currentQuoteKey &&
    quoteErrorState?.quoteKey !== currentQuoteKey;

  useEffect(() => {
    if (view !== 'checkout' || items.length === 0) return;
    if (lastQuotedKeyRef.current === currentQuoteKey) return;
    const seq = ++quoteSeqRef.current;
    let active = true;
    fetchOrderQuote({
      items,
      voucherCode: appliedVoucher,
      pointsToUse: actualPointsToUse,
    })
      .then((data) => {
        if (!active || seq !== quoteSeqRef.current) return;
        const confirmedKey = `${itemsPayloadKey}|${data.voucherCode ?? ''}|${actualPointsToUse}`;
        lastQuotedKeyRef.current = confirmedKey;
        setQuoteErrorState(null);
        setServerQuoteState({ quoteKey: confirmedKey, itemsKey: itemsPayloadKey, data });
      })
      .catch((error: unknown) => {
        if (!active || seq !== quoteSeqRef.current) return;
        const message = error instanceof Error ? error.message : 'Không thể xác nhận báo giá từ server.';
        if (appliedVoucher) {
          lastQuotedKeyRef.current = null;
          setAppliedVoucher(null);
          setServerQuoteState(null);
          setVoucherError(message);
        } else {
          lastQuotedKeyRef.current = currentQuoteKey;
          setQuoteErrorState({ quoteKey: currentQuoteKey, message });
        }
      });
    return () => { active = false; };
  }, [view, items, itemsPayloadKey, appliedVoucher, actualPointsToUse, currentQuoteKey]);

  async function applyVoucher(code?: string) {
    const target = (code ?? voucherInput).trim();
    if (!target) {
      setVoucherError('Vui lòng nhập mã ưu đãi');
      return;
    }
    if (items.length === 0) {
      setVoucherError('Giỏ hàng đang trống');
      return;
    }
    const seq = ++quoteSeqRef.current;
    setVoucherBusy(true);
    setVoucherError('');
    setQuoteErrorState(null);
    try {
      const quoted = await fetchOrderQuote({
        items,
        voucherCode: target,
        pointsToUse: actualPointsToUse,
      });
      if (seq !== quoteSeqRef.current) return;
      const confirmedKey = `${itemsPayloadKey}|${quoted.voucherCode ?? ''}|${actualPointsToUse}`;
      lastQuotedKeyRef.current = confirmedKey;
      setServerQuoteState({ quoteKey: confirmedKey, itemsKey: itemsPayloadKey, data: quoted });
      setAppliedVoucher(quoted.voucherCode);
      setVoucherInput(quoted.voucherCode ?? target);
    } catch (error) {
      if (seq !== quoteSeqRef.current) return;
      lastQuotedKeyRef.current = null;
      setAppliedVoucher(null);
      setServerQuoteState(null);
      setVoucherError(error instanceof Error ? error.message : 'Mã giảm giá không hợp lệ hoặc đã hết hạn!');
    } finally {
      if (seq === quoteSeqRef.current) {
        setVoucherBusy(false);
      }
    }
  }

  function removeVoucher() {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError('');
    setServerQuoteState(null);
    lastQuotedKeyRef.current = null;
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
    void refetchProfile();
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
          items: buildOrderItemsPayload(items),
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
        setVoucherError('');
        setServerQuoteState(null);
        setQuoteErrorState(null);
        lastQuotedKeyRef.current = null;
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
          { label: 'Trang chủ', href: '#top', active: view === 'menu', onClick: () => navigateToSection('top') },
          { label: 'Menu', href: '/menu', onClick: () => navigateToSection('menu') },
          { label: 'Khuyến mãi', href: '#promotions', onClick: () => navigateToSection('promotions') },
          { label: 'Giới thiệu', href: '#about', onClick: () => navigateToSection('about') },
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

        {/* SECTION: KHUYẾN MÃI & TÍCH ĐIỂM */}
        <section className="promo-section" id="promotions">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><Gift size={13} /> ƯU ĐÃI ĐẶC QUYỀN</span>
              <h2>Chương trình Khuyến mãi & Tích điểm</h2>
            </div>
            <span className="menu-subtitle">Tiết kiệm nhiều hơn · Thưởng thức trọn vẹn</span>
          </div>

          <div className="promo-grid">
            <article className="promo-card promo-card--featured">
              <div className="promo-card__badge">GIẢM 10%</div>
              <div className="promo-card__body">
                <div className="promo-card__icon-wrap">
                  <Tag size={24} />
                </div>
                <h3>Ưu đãi đặt món trực tuyến</h3>
                <p>Giảm ngay 10% trên tổng giá trị đơn hàng (tối đa 50.000đ) khi đặt món qua hệ thống BrewLite.</p>
                <div className="promo-code-box">
                  <span className="promo-code-text">Mã: <strong>GIAM10</strong></span>
                  <button
                    type="button"
                    className="promo-copy-btn"
                    onClick={() => handleCopyVoucher('GIAM10')}
                  >
                    {copiedCode === 'GIAM10' ? <><CheckCheck size={14} /> Đã sao chép</> : <><Copy size={14} /> Sao chép</>}
                  </button>
                </div>
                <div className="promo-card__footer">
                  <small>Hạn dùng: Đang áp dụng · Không giới hạn số lần</small>
                </div>
              </div>
            </article>

            <article className="promo-card">
              <div className="promo-card__badge promo-card__badge--gold">HOÀN TIỀN 10%</div>
              <div className="promo-card__body">
                <div className="promo-card__icon-wrap promo-card__icon-wrap--gold">
                  <Award size={24} />
                </div>
                <h3>Tích điểm BrewLite Rewards</h3>
                <p>Tích lũy <strong>1 điểm cho mỗi 10.000đ</strong> thanh toán. Điểm chờ được mở khóa khi quán bắt đầu pha chế. Đổi <strong>1 điểm khả dụng = 1.000đ</strong> cho đơn hàng tiếp theo.</p>
                <div className="promo-loyalty-highlight">
                  <div className="promo-loyalty-stat">
                    <strong>10.000đ</strong>
                    <span>Chi tiêu = 1 điểm</span>
                  </div>
                  <div className="promo-loyalty-arrow">➜</div>
                  <div className="promo-loyalty-stat">
                    <strong>1.000đ</strong>
                    <span>Giảm / 1 điểm</span>
                  </div>
                </div>
                <LoyaltyPolicyTable
                  samplePoints={5}
                  caption="Ví dụ đơn 50.000đ (+5 điểm):"
                  compact
                />
                <div className="promo-card__footer">
                  <small>Mở khóa tự động khi bắt đầu pha chế · Hủy trước pha chế sẽ thu hồi điểm chờ</small>
                </div>
              </div>
            </article>

            <article className="promo-card">
              <div className="promo-card__badge promo-card__badge--green">TIỆN LỢI</div>
              <div className="promo-card__body">
                <div className="promo-card__icon-wrap promo-card__icon-wrap--green">
                  <Sparkles size={24} />
                </div>
                <h3>Đặt trước - Nhận tại quầy</h3>
                <p>Chủ động thời gian, không cần xếp hàng chờ đợi. Đồ uống luôn tươi mới và sẵn sàng khi bạn ghé quán.</p>
                <ul className="promo-benefits-list">
                  <li><Check size={14} /> 0đ phí giao hàng, nhận món nhanh</li>
                  <li><Check size={14} /> Đảm bảo độ mát lạnh & hương vị chuẩn xác</li>
                  <li><Check size={14} /> Tùy chọn lượng đá, độ ngọt theo ý muốn</li>
                </ul>
                <div className="promo-card__footer">
                  <button
                    type="button"
                    onClick={() => navigateToSection('menu')}
                    className="button button-primary button-full promo-order-btn"
                  >
                    Khám phá thực đơn <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          </div>

          <div className="promo-guide-strip">
            <div className="promo-guide-item">
              <span className="promo-guide-step">01</span>
              <div>
                <strong>Đăng ký / Đăng nhập</strong>
                <p>Để theo dõi lịch sử đơn và tự động tích lũy điểm thưởng cho tài khoản.</p>
              </div>
            </div>
            <div className="promo-guide-item">
              <span className="promo-guide-step">02</span>
              <div>
                <strong>Chọn món & Tùy biến</strong>
                <p>Tự do lựa chọn size ly, mức đá, độ ngọt và topping tươi giòn.</p>
              </div>
            </div>
            <div className="promo-guide-item">
              <span className="promo-guide-step">03</span>
              <div>
                <strong>Áp dụng ưu đãi & Nhận nước</strong>
                <p>Nhập mã <strong>GIAM10</strong> hoặc trừ điểm thưởng tại bước thanh toán.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION: GIỚI THIỆU VỀ BREWLITE */}
        <section className="about-section" id="about">
          <div className="section-heading">
            <div>
              <span className="eyebrow"><Coffee size={13} /> VỀ BREWLITE</span>
              <h2>Good Drink - Good Day</h2>
            </div>
            <span className="menu-subtitle">Mỗi ngày một chút dịu dàng · Tử tế từ từng hạt cà phê</span>
          </div>

          <div className="about-layout">
            <div className="about-story-card">
              <span className="about-quote-mark">“</span>
              <h3>Khởi nguồn từ niềm đam mê cà phê và trà mộc Việt Nam</h3>
              <p>
                BrewLite bắt đầu từ một ý niệm giản dị: giữa những bận rộn hối hả thường nhật, một ly nước ngon pha bằng sự tử tế có thể thắp sáng cả một ngày của bạn.
              </p>
              <p>
                Chúng tôi trân trọng từng hạt cà phê Robusta đậm đà từ Buôn Ma Thuột, Arabica thanh khiết Cầu Đất (Đà Lạt), và những búp trà xanh mộc mạc tuyển chọn từ vùng chè Bảo Lộc. Tất cả đều được rang mới đều đặn mỗi tuần để giữ trọn vẹn hương vị tự nhiên và tươi mới nhất.
              </p>
              <div className="about-signature">
                <strong>Đội ngũ BrewLite</strong>
                <small>Tận tâm phục vụ bạn mỗi ngày</small>
              </div>
            </div>

            <div className="about-pillars">
              <article className="about-pillar-card">
                <div className="about-pillar-icon"><Leaf size={22} /></div>
                <div className="about-pillar-content">
                  <h4>Nguyên liệu mộc tuyển chọn</h4>
                  <p>100% nông sản sạch từ cao nguyên Việt Nam. Rang mộc nguyên bản, không hương liệu tổng hợp hay chất bảo quản độc hại.</p>
                </div>
              </article>

              <article className="about-pillar-card">
                <div className="about-pillar-icon"><Clock size={22} /></div>
                <div className="about-pillar-content">
                  <h4>Pha chế thủ công & Tùy biến</h4>
                  <p>Pha mới ngay khi có đơn. Tự do tùy biến size ly, lượng đá, độ ngọt (100%, 70%, 50%, 30%) và topping tươi giòn.</p>
                </div>
              </article>

              <article className="about-pillar-card">
                <div className="about-pillar-icon"><ShieldCheck size={22} /></div>
                <div className="about-pillar-content">
                  <h4>Bền vững & Thân thiện môi trường</h4>
                  <p>Ưu tiên sử dụng ly giấy, ống hút giấy và bao bì phân hủy sinh học vì môi trường sống xanh và sức khỏe cộng đồng.</p>
                </div>
              </article>
            </div>
          </div>

          <div className="about-metrics-strip">
            <div className="about-metric-item">
              <strong>100%</strong>
              <span>Cà phê & Trà mộc sạch</span>
            </div>
            <div className="about-metric-item">
              <strong>40+</strong>
              <span>Thức uống & Bánh ngọt đa dạng</span>
            </div>
            <div className="about-metric-item">
              <strong>&lt; 5 phút</strong>
              <span>Thời gian chuẩn bị nhận tại quầy</span>
            </div>
            <div className="about-metric-item">
              <strong>4.9 ★</strong>
              <span>Đánh giá hài lòng từ khách hàng</span>
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
                  onClick={() => void applyVoucher('GIAM10')}
                  disabled={checkoutBusy || voucherBusy}
                >
                  <strong>GIAM10</strong> · Giảm 10% (tối đa 50k)
                </button>
              </div>
              {appliedVoucher ? (
                <div className="checkout-voucher-applied">
                  <div className="checkout-voucher-applied__info">
                    <Check size={16} className="checkout-voucher-applied__icon" />
                    <span>
                      Mã ưu đãi <strong>{appliedVoucher}</strong> đã được áp dụng
                      {activeQuote?.voucher
                        ? ` (giảm ${activeQuote.voucher.discountPct}%, tối đa ${currency(activeQuote.voucher.maxDiscount)})`
                        : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="checkout-voucher-remove"
                    onClick={removeVoucher}
                    disabled={checkoutBusy || voucherBusy}
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
                        void applyVoucher();
                      }
                    }}
                    disabled={checkoutBusy || voucherBusy}
                    aria-label="Mã giảm giá"
                  />
                  <button
                    className="button button-outline checkout-apply-btn"
                    type="button"
                    onClick={() => void applyVoucher()}
                    disabled={checkoutBusy || voucherBusy || !voucherInput.trim()}
                  >
                    {voucherBusy ? 'Đang kiểm...' : 'Áp dụng'}
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
                    <span>Tổng điểm tích lũy:</span>
                    <strong>{rewardPoints.toLocaleString('vi-VN')} điểm</strong>
                    <small>{availableRewardPoints.toLocaleString('vi-VN')} điểm khả dụng · {pendingRewardPoints.toLocaleString('vi-VN')} điểm chờ</small>
                  </div>
                  <p className="checkout-loyalty-note">Điểm chờ được mở khóa khi quán bắt đầu pha chế. Hủy trước đó sẽ thu hồi điểm chờ.</p>
                  {availableRewardPoints > 0 ? (
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
                      Chưa có điểm khả dụng. Điểm được cộng khi thanh toán và mở khóa khi quán bắt đầu pha chế.
                    </p>
                  )}
                  <LoyaltyPolicyTable
                    samplePoints={earnedPoints > 0 ? earnedPoints : 5}
                    caption={earnedPoints > 0
                      ? `Minh họa trên đơn này (+${earnedPoints} điểm):`
                      : 'Ví dụ minh họa đơn 50.000đ (+5 điểm):'}
                    compact
                  />
                </div>
              )}
            </div>

            <div className="checkout-secure">⌑ <span>Thông tin thanh toán được bảo vệ an toàn.</span></div>
            {(checkoutError || quoteError) && <p className="form-error" role="alert">{checkoutError || quoteError}</p>}
            <button
              className="button button-primary button-full pay-button"
              disabled={checkoutBusy || voucherBusy || quoteBusy || Boolean(quoteError) || items.length === 0}
              onClick={pay}
              type="button"
            >
              {checkoutBusy
                ? 'Đang xử lý...'
                : voucherBusy || quoteBusy
                  ? 'Đang kiểm tra báo giá...'
                  : `Xác nhận & thanh toán · ${currency(total)}`}
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
                <span>Nhận <strong>+{earnedPoints} điểm chờ</strong> khi thanh toán; mở khóa khi bắt đầu pha chế</span>
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
              <div>
                <span>
                  {receipt.status === 'CANCELLED'
                    ? 'Điểm chờ đã thu hồi'
                    : receipt.status === 'PAID'
                      ? 'Điểm chờ của đơn (mở khóa lúc pha chế)'
                      : ['PREPARING', 'READY', 'COMPLETED'].includes(receipt.status)
                        ? 'Điểm thưởng đã mở khóa'
                        : 'Điểm dự kiến khi thanh toán'}
                </span>
                <strong className="summary-points-earned">
                  {receipt.status === 'CANCELLED' ? '-' : '+'}{Math.floor(receipt.total / 10000)} điểm
                </strong>
              </div>
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
              {receipt.status === 'PAID' && (
                <p className="confirmation-cancel-note">Hủy lúc này sẽ ghi nhận hoàn tiền mô phỏng và thu hồi điểm chờ của đơn.</p>
              )}
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

            <div className="history-alert is-success" role="status">
              {availableRewardPoints.toLocaleString('vi-VN')} điểm khả dụng · {pendingRewardPoints.toLocaleString('vi-VN')} điểm chờ · Tổng {rewardPoints.toLocaleString('vi-VN')} điểm. Điểm được cộng khi thanh toán, mở khóa khi bắt đầu pha chế và thu hồi nếu hủy trước đó.
            </div>
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
                  <article className="history-stat">
                    <span className="history-stat__icon"><Award size={20} /></span>
                    <div>
                      <span>Điểm khả dụng / Tổng</span>
                      <strong>{availableRewardPoints.toLocaleString('vi-VN')} / {rewardPoints.toLocaleString('vi-VN')} điểm</strong>
                      <small className="history-stat__sub">{pendingRewardPoints.toLocaleString('vi-VN')} điểm đang chờ pha chế</small>
                    </div>
                  </article>
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
                      const orderPoints = order.rewardPointsEarned ?? 0;
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
                                {orderPoints > 0 && (
                                  <div className="history-order__points">
                                    <span>
                                      {order.status === 'CANCELLED'
                                        ? 'Điểm chờ đã thu hồi'
                                        : order.status === 'PAID'
                                          ? 'Điểm chờ mở khóa'
                                          : 'Điểm thưởng (đã mở khóa)'}
                                    </span>
                                    <strong>{order.status === 'CANCELLED' ? `-${orderPoints}` : `+${orderPoints}`} điểm</strong>
                                  </div>
                                )}
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
          inCartQuantity={getProductQuantityInCart(items, selectedProduct.id)}
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

      <footer className="site-footer">
        <div className="site-footer__main">
          <div className="site-footer__brand-col">
            <a className="brand footer-brand" href="#top"><span className="brand-mark">B</span><span>Brew<span>Lite</span></span></a>
            <p>Thương hiệu cà phê và trà mộc tử tế. Đặt món trực tuyến nhanh chóng, nhận đồ uống tươi ngon tại quầy.</p>
            <div className="site-footer__contact">
              <span>Hotline: <strong>0909 123 456</strong></span>
              <span>Giờ mở cửa: <strong>07:00 - 22:00</strong> mỗi ngày</span>
            </div>
          </div>
          <div className="site-footer__links-col">
            <h4>Khám phá</h4>
            <a href="#top" onClick={() => navigateToSection('top')}>Trang chủ</a>
            <a href="#menu" onClick={() => navigateToSection('menu')}>Thực đơn</a>
            <a href="#promotions" onClick={() => navigateToSection('promotions')}>Khuyến mãi & Vouchers</a>
            <a href="#about" onClick={() => navigateToSection('about')}>Về BrewLite</a>
          </div>
          <div className="site-footer__links-col">
            <h4>Hội viên & Đơn hàng</h4>
            <button type="button" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}>Đăng nhập / Đăng ký</button>
            <button type="button" onClick={openHistory}>Lịch sử đơn hàng</button>
            <a href="#promotions" onClick={() => navigateToSection('promotions')}>Chính sách tích điểm</a>
            <a href="/cart">Giỏ hàng ({items.reduce((s, i) => s + i.quantity, 0)})</a>
          </div>
        </div>
        <div className="site-footer__bottom">
          <span>© 2026 BrewLite. Good Drink - Good Day.</span>
          <span>Bảo vệ thông tin & cam kết vệ sinh an toàn thực phẩm.</span>
        </div>
      </footer>

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
