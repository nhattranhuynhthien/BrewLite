'use client';

import Link from 'next/link';
import { Coffee, Search, ShoppingCart } from 'lucide-react';
import { useSiteHeader } from '@/hooks/useSiteHeader';
import '@/styles/SiteHeader.css';

export type SiteHeaderNavItem = {
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

type SiteHeaderProps = {
  navItems: SiteHeaderNavItem[];
  onSearchChange: (query: string) => void;
  onSearchOpen?: () => void;
  onLogin?: () => void;
  authenticated?: boolean;
  onSignOut?: () => void;
  onCartClick?: () => void;
  cartHref?: string;
  brandHref?: string;
  onBrandClick?: () => void;
};

export default function SiteHeader({
  navItems,
  onSearchChange,
  onSearchOpen,
  onLogin,
  authenticated = false,
  onSignOut,
  onCartClick,
  cartHref,
  brandHref = '/',
  onBrandClick,
}: SiteHeaderProps) {
  const {
    cartCount,
    closeSearch,
    onSearchChange: updateSearch,
    searchInputRef,
    searchOpen,
    toggleSearch,
  } = useSiteHeader(onSearchChange, onSearchOpen);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="site-header__brand" href={brandHref} onClick={onBrandClick} aria-label="BrewLite - Trang chủ">
          <span className="site-header__mark"><Coffee aria-hidden="true" size={20} strokeWidth={2.2} /></span>
          <span className="site-header__brand-copy"><strong>BrewLite</strong><small>Good Drink - Good Day</small></span>
        </Link>

        <nav className="site-header__nav" aria-label="Điều hướng chính">
          {navItems.map(({ label, href, active, onClick }) => {
            const className = `site-header__link${active ? ' is-active' : ''}`;
            if (href) {
              return <Link key={label} className={className} href={href} aria-current={active ? 'page' : undefined}>{label}</Link>;
            }
            return <button key={label} className={className} onClick={onClick} type="button" aria-current={active ? 'page' : undefined}>{label}</button>;
          })}
        </nav>

        <div className="site-header__actions">
          {searchOpen && (
            <input
              ref={searchInputRef}
              className="site-header__search"
              aria-label="Tìm món"
              onChange={(event) => updateSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeSearch();
              }}
              placeholder="Tìm món..."
              type="search"
            />
          )}
          <button
            className="site-header__icon"
            type="button"
            aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm món'}
            onClick={toggleSearch}
          ><Search aria-hidden="true" size={18} strokeWidth={1.8} /></button>
          {authenticated
            ? <button className="site-header__account" onClick={onSignOut} title="Đăng xuất" type="button"><span className="site-header__avatar">B</span><span className="site-header__account-label">Tài khoản</span></button>
            : onLogin
              ? <button className="site-header__login" onClick={onLogin} type="button">Đăng nhập</button>
              : <Link className="site-header__login" href="/">Đăng nhập</Link>}
          {onCartClick
            ? <button className="site-header__cart" onClick={onCartClick} type="button" aria-label={`Giỏ hàng, ${cartCount} món`}><ShoppingCart aria-hidden="true" size={20} strokeWidth={1.8} /><span>{cartCount}</span></button>
            : <Link className="site-header__cart" href={cartHref ?? '/#menu'} aria-label={`Giỏ hàng, ${cartCount} món`}><ShoppingCart aria-hidden="true" size={20} strokeWidth={1.8} /><span>{cartCount}</span></Link>}
        </div>
      </div>
    </header>
  );
}
