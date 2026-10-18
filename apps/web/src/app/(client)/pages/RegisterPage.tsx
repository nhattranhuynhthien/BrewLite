'use client';

import Link from 'next/link';
import styles from '@/styles/RegisterPage.module.css';
import { useRegister } from '@/hooks/useRegister';

export default function RegisterPage() {
  const {
    email, setEmail,
    password, setPassword,
    confirm, setConfirm,
    error, loading,
    handleSubmit,
  } = useRegister();

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Tạo tài khoản</h1>
          <p className={styles.subtitle}>Điền thông tin bên dưới để bắt đầu</p>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              placeholder="ban@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Mật khẩu</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="confirm" className={styles.label}>Nhập lại mật khẩu</label>
            <input
              id="confirm"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={styles.button}>
            {loading ? 'Đang xử lý...' : 'Đăng ký'}
          </button>
        </form>

        <p className={styles.footer}>
          Đã có tài khoản?{' '}
          <Link href="/login" className={styles.link}>
            Đăng nhập
          </Link>
        </p>
      </section>
    </main>
  );
}