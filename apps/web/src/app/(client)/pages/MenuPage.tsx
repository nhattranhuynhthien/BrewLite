'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Coffee,
  Leaf,
  CupSoda,
  GlassWater,
  CakeSlice,
  MoreHorizontal,
  LayoutGrid,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import ProductCard from '../components/ProductCard';
import ProductDetailModal from '../components/ProductDetailModal';
import { CATEGORIES, PRODUCTS } from '@/lib/menu-data';
import type { CategoryId, Product } from '@/types/product';
import { useCartStore } from '@/store/cart-store';
import '@/styles/MenuPage.css';

type Active = 'all' | CategoryId;

const ICONS: Record<Active, LucideIcon> = {
  all: LayoutGrid,
  coffee: Coffee,
  tea: Leaf,
  'milk-tea': CupSoda,
  smoothie: GlassWater,
  cake: CakeSlice,
  other: MoreHorizontal,
};

const PREVIEW_COUNT = 5;

export default function MenuPage() {
  const [active, setActive] = useState<Active>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const addItem = useCartStore((state) => state.addItem);

  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);

  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: PRODUCTS.filter((p) => p.category === c.id),
  })).filter((s) => s.items.length > 0 && (active === 'all' || s.id === active));

  const tabs: { id: Active; label: string }[] = [
    { id: 'all', label: 'Tất cả' },
    ...CATEGORIES.map(({ id, label }) => ({ id, label })),
  ];

  return (
    <>
      <main className="menu">
        <section className="menu-hero">
          <Image
            src="/img/menu/banner.svg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="menu-hero__bg"
          />
          <div className="menu-hero__inner">
            <p className="menu-hero__script">Thức uống ngon</p>
            <h1 className="menu-hero__title">Cho ngày thêm năng lượng</h1>
            <p className="menu-hero__desc">
              Khám phá menu đa dạng với những thức uống thơm ngon, được pha chế từ
              nguyên liệu chất lượng.
            </p>
          </div>
        </section>

        <div className="menu-layout">
          <aside className="menu-side">
            <nav className="menu-tabs" aria-label="Danh mục">
              {tabs.map(({ id, label }) => {
                const Icon = ICONS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    className={`menu-tab${active === id ? ' is-active' : ''}`}
                    aria-current={active === id ? 'true' : undefined}
                    onClick={() => setActive(id)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="menu-promo">
              <Leaf size={18} />
              <p>
                Đặt hàng online
                <br />
                nhanh chóng
                <br />
                và tiện lợi
              </p>
              <button type="button" className="menu-promo__btn" aria-label="Đặt hàng online">
                <ArrowRight size={16} />
              </button>
            </div>
          </aside>

          <div className="menu-main">
            {sections.map((s) => {
              const Icon = ICONS[s.id];
              const items = active === 'all' ? s.items.slice(0, PREVIEW_COUNT) : s.items;
              return (
                <section key={s.id} className="menu-section">
                  <header className="menu-section__head">
                    <h2>
                      <Icon size={22} />
                      {s.title}
                    </h2>
                    {active === 'all' && (
                      <button
                        type="button"
                        className="menu-section__more"
                        onClick={() => setActive(s.id)}
                      >
                        Xem tất cả <ChevronRight size={14} />
                      </button>
                    )}
                  </header>
                  <div className="menu-grid">
                    {items.map((p) => (
                      <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
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
    </>
  );
}