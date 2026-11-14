'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronRight, ClipboardList, Coffee, LogIn, LogOut, Search, ShoppingCart, UserRound } from 'lucide-react';
import { useSiteHeader } from '@/hooks/useSiteHeader';
import { getAccessToken, setAccessToken, subscribeToAccessToken } from '@/lib/api';
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
  onSignOut?: () => void;
  onOrdersClick?: () => void;
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
  onSignOut,
  onOrdersClick,
  onCartClick,
  cartHref,
  brandHref = '/',
  onBrandClick,
}: SiteHeaderProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const accessToken = useSyncExternalStore(subscribeToAccessToken, getAccessToken, () => null);
  const authenticated = Boolean(accessToken);
  const {
    cartCount,
    closeSearch,
    onSearchChange: updateSearch,
    searchInputRef,
    searchOpen,
    toggleSearch,
  } = useSiteHeader(onSearchChange, onSearchOpen);

  useEffect(() => {
    if (!accountMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [accountMenuOpen]);

  function signOut() {
    setAccountMenuOpen(false);
    if (onSignOut) onSignOut();
    else setAccessToken(null);
  }

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
          {onCartClick
            ? <button className="site-header__cart" onClick={onCartClick} type="button" aria-label={`Giỏ hàng, ${cartCount} món`}><ShoppingCart aria-hidden="true" size={20} strokeWidth={1.8} /><span>{cartCount}</span></button>
            : <Link className="site-header__cart" href={cartHref ?? '/#menu'} aria-label={`Giỏ hàng, ${cartCount} món`}><ShoppingCart aria-hidden="true" size={20} strokeWidth={1.8} /><span>{cartCount}</span></Link>}
          <div className="site-header__account-wrap" ref={accountMenuRef}>
            <button
              className={`site-header__account${authenticated ? ' is-authenticated' : ''}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
              type="button"
              aria-label={authenticated ? 'Tài khoản, đã đăng nhập' : 'Tài khoản, chưa đăng nhập'}
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              title={authenticated ? 'Tài khoản' : 'Đăng nhập'}
            >
              <UserRound aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>
            {accountMenuOpen && (
              <div className="site-header__account-menu" role="menu">
                {authenticated ? (
                  <>
                    {onOrdersClick ? (
                      <button
                        className="site-header__account-menu-item"
                        onClick={() => { setAccountMenuOpen(false); onOrdersClick(); }}
                        role="menuitem"
                        type="button"
                      >
                        <ClipboardList aria-hidden="true" size={17} />
                        <span>Lịch sử đơn hàng</span>
                        <ChevronRight className="site-header__account-menu-chevron" aria-hidden="true" size={15} />
                      </button>
                    ) : (
                      <Link
                        className="site-header__account-menu-item"
                        href="/?view=orders"
                        onClick={() => setAccountMenuOpen(false)}
                        role="menuitem"
                      >
                        <ClipboardList aria-hidden="true" size={17} />
                        <span>Lịch sử đơn hàng</span>
                        <ChevronRight className="site-header__account-menu-chevron" aria-hidden="true" size={15} />
                      </Link>
                    )}
                    <button className="site-header__account-menu-item is-destructive" onClick={signOut} role="menuitem" type="button">
                      <LogOut aria-hidden="true" size={17} />
                      <span>Đăng xuất</span>
                    </button>
                  </>
                ) : onLogin ? (
                  <button
                    className="site-header__account-menu-item"
                    onClick={() => { setAccountMenuOpen(false); onLogin(); }}
                    role="menuitem"
                    type="button"
                  >
                    <LogIn aria-hidden="true" size={17} />
                    <span>Đăng nhập</span>
                    <ChevronRight className="site-header__account-menu-chevron" aria-hidden="true" size={15} />
                  </button>
                ) : (
                  <Link
                    className="site-header__account-menu-item"
                    href="/?login=1"
                    onClick={() => setAccountMenuOpen(false)}
                    role="menuitem"
                  >
                    <LogIn aria-hidden="true" size={17} />
                    <span>Đăng nhập</span>
                    <ChevronRight className="site-header__account-menu-chevron" aria-hidden="true" size={15} />
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
