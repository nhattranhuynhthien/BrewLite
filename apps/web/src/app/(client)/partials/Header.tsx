'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, Search, ShoppingCart, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/menu', label: 'Menu' },
  { href: '/promotions', label: 'Khuyến mãi' },
  { href: '/about', label: 'Giới thiệu' },
  { href: '/contact', label: 'Liên hệ' },
];

type HeaderProps = {
  cartCount?: number;
};

export default function Header({ cartCount = 0 }: HeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMenus() {
    setMobileOpen(false);
    setSearchOpen(false);
  }

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" href="/" aria-label="BrewLite - Trang chủ" onClick={closeMenus}>
          <Image src="/img/logo.svg" alt="BrewLite - Good Drink, Good Day" width={126} height={32} priority />
        </Link>

        <nav className={`site-header__nav${mobileOpen ? ' is-open' : ''}`} aria-label="Điều hướng chính">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={`site-header__nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={closeMenus}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="site-header__actions">
          <button
            className="site-header__icon-button"
            type="button"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Mở tìm kiếm'}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            {searchOpen ? <X size={19} /> : <Search size={19} />}
          </button>
          <Link className="site-header__cart" href="/cart" aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}>
            <ShoppingCart size={20} />
            <span className="site-header__cart-count">{cartCount}</span>
          </Link>
          <Link className="site-header__login" href="/login" onClick={closeMenus}>
            Đăng nhập
          </Link>
          <button
            className="site-header__mobile-toggle"
            type="button"
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <form className="site-header__search" action="/menu" role="search">
          <Search size={18} aria-hidden="true" />
          <input name="q" type="search" placeholder="Tìm thức uống..." aria-label="Tìm thức uống" autoFocus />
          <button type="submit">Tìm</button>
        </form>
      )}
    </header>
  );
}