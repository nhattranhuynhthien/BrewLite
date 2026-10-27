
import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { Product } from '@/types/product';

const formatPrice = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

interface Props {
  product: Product;
  onAdd: (product: Product) => void;
}

export default function ProductCard({ product, onAdd }: Props) {
  return (
    <article className="menu-card">
      <div className="menu-card__img">
        {product.imageUrl && (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        )}
      </div>
      <div className="menu-card__body">
        <h3 className="menu-card__name">{product.name}</h3>
        <div className="menu-card__row">
          <span className="menu-card__price">{formatPrice(product.price)}</span>
          <button
            type="button"
            className="menu-card__add"
            aria-label={`Thêm ${product.name} vào giỏ`}
            disabled={!product.isAvailable || product.stock <= 0}
            onClick={() => onAdd(product)}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </article>
  );
}