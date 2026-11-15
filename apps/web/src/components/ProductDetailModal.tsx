'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import {
  ICE_OPTIONS,
  SIZE_EXTRA_PRICES,
  SWEETNESS_OPTIONS,
  type CupSize,
  type Ice,
  type SelectedProductOptions,
  type Sweetness,
  type ToppingOption,
} from '@/lib/product-options';
import type { Product } from '@/types/product';
import '@/styles/ProductDetailModal.css';

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

interface Props {
  product: Product;
  inCartQuantity?: number;
  toppings: ToppingOption[];
  toppingsLoading: boolean;
  toppingsError: string;
  onReloadToppings: () => void;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, options: SelectedProductOptions) => void;
}

export default function ProductDetailModal({
  product,
  inCartQuantity = 0,
  toppings,
  toppingsLoading,
  toppingsError,
  onReloadToppings,
  onClose,
  onAdd,
}: Props) {
  const [size, setSize] = useState<CupSize>('M');
  const [sweetness, setSweetness] = useState<Sweetness>('Bình thường');
  const [ice, setIce] = useState<Ice>('Bình thường');
  const [selectedToppingIds, setSelectedToppingIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const selectedToppings = toppings.filter(({ id }) =>
    selectedToppingIds.includes(id),
  );
  const price =
    product.price +
    SIZE_EXTRA_PRICES[size] +
    selectedToppings.reduce((sum, topping) => sum + topping.extraPrice, 0);
  const remainingStock = Math.max(0, Math.floor(product.stock) - inCartQuantity);
  const outOfStock = !product.isAvailable || product.stock <= 0;
  const stockLimitReached = !outOfStock && remainingStock === 0;
  const available = !outOfStock && remainingStock > 0;
  const safeQuantity = available ? Math.max(1, Math.min(quantity, remainingStock)) : 1;
  const options: SelectedProductOptions = {
    size,
    toppings: selectedToppings,
    sweetness,
    ice,
    note: note.trim(),
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="product-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="product-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <button
          type="button"
          className="product-modal__close"
          onClick={onClose}
          aria-label="Đóng chi tiết sản phẩm"
        >
          <X size={22} />
        </button>

        <div className="product-modal__image">
          {product.imageUrl && (
            <Image src={product.imageUrl} alt={product.name} fill sizes="(max-width: 760px) 90vw, 344px" />
          )}
        </div>

        <div className="product-modal__content">
          <div className="product-modal__heading">
            <h2 id="product-modal-title">{product.name}</h2>
            <span className="product-modal__badge">BÁN CHẠY</span>
          </div>
          <p className="product-modal__description">
            {product.description || `${product.name} thơm ngon, được pha chế từ nguyên liệu chọn lọc.`}
          </p>
          <p className="product-modal__price">{formatPrice(price)}</p>

          <fieldset className="product-modal__group">
            <legend>Kích cỡ</legend>
            <div className="product-modal__sizes">
              {(['S', 'M', 'L'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`product-modal__size${size === option ? ' is-selected' : ''}`}
                  aria-pressed={size === option}
                  onClick={() => setSize(option)}
                >
                  <span>{option}</span>
                  {SIZE_EXTRA_PRICES[option] > 0 && (
                    <small>+{formatPrice(SIZE_EXTRA_PRICES[option])}</small>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="product-modal__group">
            <legend>Topping</legend>
            <div className="product-modal__choices">
              {toppingsLoading ? (
                <p role="status">Đang tải danh sách topping...</p>
              ) : toppingsError ? (
                <div role="alert">
                  <p>{toppingsError}</p>
                  <button type="button" onClick={onReloadToppings}>Thử tải lại</button>
                </div>
              ) : toppings.length === 0 ? (
                <p>Hiện chưa có topping.</p>
              ) : toppings.map((topping) => (
                <label key={topping.id}>
                  <input
                    type="checkbox"
                    name="toppings"
                    value={topping.code}
                    checked={selectedToppingIds.includes(topping.id)}
                    onChange={(event) =>
                      setSelectedToppingIds((current) =>
                        event.target.checked
                          ? [...current, topping.id]
                          : current.filter((id) => id !== topping.id),
                      )
                    }
                  />
                  <span>{topping.name} +{formatPrice(topping.extraPrice)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="product-modal__group">
            <legend>Đường</legend>
            <div className="product-modal__choices">
              {SWEETNESS_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="sweetness"
                    value={option}
                    checked={sweetness === option}
                    onChange={() => setSweetness(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="product-modal__group">
            <legend>Đá</legend>
            <div className="product-modal__choices">
              {ICE_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    type="radio"
                    name="ice"
                    value={option}
                    checked={ice === option}
                    onChange={() => setIce(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="product-modal__quantity">
            <span>Số lượng</span>
            <div className="product-modal__stepper" aria-label="Số lượng sản phẩm">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={!available || safeQuantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, Math.min(value, remainingStock) - 1))}
              >
                <Minus size={16} />
              </button>
              <output aria-live="polite">{available ? safeQuantity : 0}</output>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={!available || safeQuantity >= remainingStock}
                onClick={() => setQuantity((value) => Math.min(remainingStock, value + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          {!outOfStock && inCartQuantity > 0 && (
            <p className={`product-modal__stock-note${stockLimitReached ? ' is-limit' : ''}`} role="status">
              {stockLimitReached
                ? `Trong giỏ đã có đủ tối đa ${product.stock} sản phẩm hiện có trong kho.`
                : `Trong giỏ đã có ${inCartQuantity} · Còn thêm tối đa ${remainingStock}/${product.stock} sản phẩm.`}
            </p>
          )}

          <label className="product-modal__note">
            <span>Ghi chú</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ví dụ: ít ngọt, không lấy ống hút..."
              maxLength={200}
              rows={2}
            />
          </label>

          <button
            type="button"
            className="product-modal__submit"
            disabled={!available || toppingsLoading || Boolean(toppingsError)}
            onClick={() => onAdd(product, safeQuantity, options)}
          >
            <ShoppingCart size={20} />
            {outOfStock
              ? 'Tạm hết hàng'
              : stockLimitReached
                ? 'Đã đạt giới hạn kho trong giỏ'
                : `Thêm vào giỏ hàng · ${formatPrice(price * safeQuantity)}`}
          </button>
        </div>
      </section>
    </div>
  );
}
