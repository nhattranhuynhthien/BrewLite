'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Minus, Plus, ShieldCheck, ShoppingCart, Trash2, Truck } from 'lucide-react';
import SiteHeader from '@/layouts/SiteHeader';
import { useCartPage } from '@/hooks/useCartPage';
import '@/styles/CartPage.css';

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

export default function CartPage() {
  const {
    clearCart,
    deliveryFee,
    freeDeliveryThreshold,
    items,
    removeItem,
    setQuantity,
    subtotal,
    total,
    totalQuantity,
  } = useCartPage();

  return (
    <div className="cart-page">
      <SiteHeader
        navItems={[
          { label: 'Trang chủ', href: '/' },
          { label: 'Menu', href: '/menu', active: true },
          { label: 'Khuyến mãi', href: '/menu#menu-promo' },
          { label: 'Giới thiệu', href: '/menu#menu-intro' },
          { label: 'Liên hệ', href: 'mailto:contact@brewlite.vn' },
        ]}
        onSearchChange={() => {}}
        cartHref="/cart"
      />

      <section className="cart-hero">
        <div className="cart-hero__inner">
          <div className="cart-hero__copy">
            <ShoppingCart aria-hidden="true" size={30} strokeWidth={2.2} />
            <div>
              <h1>Giỏ hàng của bạn</h1>
              <p>Kiểm tra lại các món đã chọn và tiến hành đặt hàng nhé!</p>
            </div>
          </div>
          <p className="cart-hero__script">Good Drink<br />Good Day</p>
        </div>
      </section>

      <main className="cart-main">
        {items.length === 0 ? (
          <section className="cart-empty">
            <span className="cart-empty__icon"><ShoppingCart aria-hidden="true" size={28} /></span>
            <h2>Giỏ hàng đang trống</h2>
            <p>Hãy chọn thức uống yêu thích để thêm vào giỏ hàng nhé.</p>
            <Link className="cart-button cart-button--primary" href="/menu">Khám phá thực đơn</Link>
          </section>
        ) : (
          <div className="cart-layout">
            <section className="cart-list-card" aria-labelledby="cart-list-title">
              <div className="cart-list-heading">
                <h2 id="cart-list-title">Danh sách sản phẩm <span>({items.length})</span></h2>
                <button className="cart-clear" onClick={clearCart} type="button">
                  <Trash2 aria-hidden="true" size={14} /> Xóa tất cả
                </button>
              </div>

              <div className="cart-items-list">
                {items.map(({ product, quantity }) => (
                  <article className="cart-item" key={product.id}>
                    <div className="cart-item__image">
                      {product.imageUrl
                        ? <Image src={product.imageUrl} alt={product.name} fill sizes="80px" />
                        : <Image src="/img/product-placeholder.svg" alt="" fill sizes="80px" />}
                    </div>
                    <div className="cart-item__details">
                      <h3>{product.name}</h3>
                      <p>{product.description || 'Pha mới mỗi ngày'}</p>
                      <strong>{formatPrice(product.price)}</strong>
                    </div>
                    <div className="cart-quantity" aria-label={`Số lượng ${product.name}`}>
                      <button
                        aria-label={`Giảm số lượng ${product.name}`}
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        type="button"
                      ><Minus aria-hidden="true" size={13} /></button>
                      <span>{quantity}</span>
                      <button
                        aria-label={`Tăng số lượng ${product.name}`}
                        disabled={quantity >= product.stock}
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        type="button"
                      ><Plus aria-hidden="true" size={13} /></button>
                    </div>
                    <strong className="cart-item__total">{formatPrice(product.price * quantity)}</strong>
                    <button
                      className="cart-item__remove"
                      aria-label={`Xóa ${product.name} khỏi giỏ`}
                      onClick={() => removeItem(product.id)}
                      type="button"
                    ><Trash2 aria-hidden="true" size={16} /></button>
                  </article>
                ))}
              </div>

              <Link className="cart-continue" href="/menu">
                <ArrowLeft aria-hidden="true" size={15} /> Tiếp tục mua hàng
              </Link>
            </section>

            <aside className="cart-summary" aria-labelledby="cart-summary-title">
              <h2 id="cart-summary-title"><ClipboardCheck aria-hidden="true" size={18} /> Tóm tắt đơn hàng</h2>
              <div className="cart-summary__content">
                <dl className="cart-summary__rows">
                  <div><dt>Tạm tính ({totalQuantity} món)</dt><dd>{formatPrice(subtotal)}</dd></div>
                  <div><dt>Giảm giá</dt><dd>{formatPrice(0)}</dd></div>
                  <div><dt>Phí giao hàng</dt><dd>{deliveryFee === 0 ? 'Miễn phí' : formatPrice(deliveryFee)}</dd></div>
                </dl>
                <div className="cart-summary__total"><strong>Tổng cộng</strong><strong>{formatPrice(total)}</strong></div>
                <div className="cart-delivery-note">
                  <Truck aria-hidden="true" size={18} />
                  <p>Miễn phí giao hàng cho đơn từ {formatPrice(freeDeliveryThreshold)}<small>Áp dụng tự động cho đơn hàng của bạn.</small></p>
                </div>
                <Link className="cart-button cart-button--primary cart-checkout" href="/?checkout=1">
                  <ShoppingCart aria-hidden="true" size={16} /> Tiến hành đặt hàng
                </Link>
                <div className="cart-secure-note">
                  <ShieldCheck aria-hidden="true" size={18} />
                  <p>Thanh toán an toàn<small>Bảo mật thông tin khách hàng</small></p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer className="cart-footer">
        <Link className="cart-footer__brand" href="/" aria-label="BrewLite trang chủ">
          <span><ShoppingCart aria-hidden="true" size={19} /></span>
          <strong>BrewLite<small>Good Drink - Good Day</small></strong>
        </Link>
        <div><strong>Liên hệ</strong><a href="tel:0909123456">☎ 0909 123 456</a><a href="mailto:contact@brewlite.vn">✉ contact@brewlite.vn</a></div>
        <div><strong>Hỗ trợ</strong><Link href="/menu">Câu hỏi thường gặp</Link><Link href="/menu">Chính sách đổi trả</Link><Link href="/menu">Điều khoản sử dụng</Link></div>
        <div><strong>Kết nối với chúng tôi</strong><span>●　◎　♪　▶</span></div>
        <div className="cart-footer__subscribe"><strong>Đăng ký nhận tin</strong><span>Nhận thông tin khuyến mãi và sản phẩm mới nhất</span><form action="/menu"><input aria-label="Email nhận tin" placeholder="Nhập email của bạn" type="email" /><button aria-label="Đăng ký" type="submit">➤</button></form></div>
        <small className="cart-footer__copyright">© 2025 BrewLite. All rights reserved.</small>
      </footer>
    </div>
  );
}
