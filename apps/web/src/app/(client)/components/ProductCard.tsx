
import Image from 'next/image';
import { Plus } from 'lucide-react';
import type { Product } from '@/types/product';

const formatPrice = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

interface Props {
  product: Product;
  onSelect: (product: Product) => void;
}

export default function ProductCard({ product, onSelect }: Props) {
  return (
    <article className="menu-card">
      <button
        type="button"
        className="menu-card__detail"
        onClick={() => onSelect(product)}
        aria-label={`Xem chi tiết ${product.name}`}
      >
        <div className="menu-card__img">
          {product.imageUrl && (
            <Image
              src={product.imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            />
          )}
        </div>
        <div className="menu-card__body">
          <h3 className="menu-card__name">{product.name}</h3>
          <span className="menu-card__price">{formatPrice(product.price)}</span>
        </div>
      </button>
      <button
        type="button"
        className="menu-card__add"
        aria-label={`Xem chi tiết ${product.name}`}
        disabled={!product.isAvailable || product.stock <= 0}
        onClick={() => onSelect(product)}
      >
        <Plus size={16} strokeWidth={2.5} />
      </button>
    </article>
  );
}