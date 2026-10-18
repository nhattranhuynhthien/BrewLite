'use client';

import styles from '../../../styles/RegisterPage.module.css';
import { useRegister } from '../../../hooks/useRegister';

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
      <h1 className={styles.title}>Đăng ký</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={styles.input}
        />
        <input
          type="password"
          placeholder="Nhập lại mật khẩu"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={styles.input}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>
      <a href="/login" className={styles.link}>
        Đã có tài khoản? Đăng nhập
      </a>
    </main>
  );
}