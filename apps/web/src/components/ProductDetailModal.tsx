'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import {
  DEMO_TOPPING_OPTIONS,
  ICE_OPTIONS,
  SIZE_EXTRA_PRICES,
  SWEETNESS_OPTIONS,
  type CupSize,
  type Ice,
  type SelectedProductOptions,
  type Sweetness,
} from '@/lib/product-options';
import type { Product } from '@/types/product';
import '@/styles/ProductDetailModal.css';

const formatPrice = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

interface Props {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, options: SelectedProductOptions) => void;
}

export default function ProductDetailModal({ product, onClose, onAdd }: Props) {
  const [size, setSize] = useState<CupSize>('M');
  const [sweetness, setSweetness] = useState<Sweetness>('Bình thường');
  const [ice, setIce] = useState<Ice>('Bình thường');
  const [selectedToppingIds, setSelectedToppingIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const selectedToppings = DEMO_TOPPING_OPTIONS.filter(({ id }) =>
    selectedToppingIds.includes(id),
  );
  const price =
    product.price +
    SIZE_EXTRA_PRICES[size] +
    selectedToppings.reduce((sum, topping) => sum + topping.extraPrice, 0);
  const available = product.isAvailable && product.stock > 0;
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
              {DEMO_TOPPING_OPTIONS.map((topping) => (
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
                disabled={quantity <= 1}
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus size={16} />
              </button>
              <output aria-live="polite">{quantity}</output>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={quantity >= product.stock}
                onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

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
            disabled={!available}
            onClick={() => onAdd(product, quantity, options)}
          >
            <ShoppingCart size={20} />
            {available ? `Thêm vào giỏ hàng · ${formatPrice(price * quantity)}` : 'Tạm hết hàng'}
          </button>
        </div>
      </section>
    </div>
  );
}
