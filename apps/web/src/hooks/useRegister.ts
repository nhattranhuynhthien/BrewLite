import { useState, type FormEvent } from 'react';
import { apiFetch } from '../lib/api';

export function useRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      window.location.href = '/login';
    } catch {
      setError('Đăng ký thất bại, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  }

  return {
    email, setEmail,
    password, setPassword,
    confirm, setConfirm,
    error, loading,
    handleSubmit,
  };
}