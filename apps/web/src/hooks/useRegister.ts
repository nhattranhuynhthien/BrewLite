'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useRegister() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate(): string {
    if (!EMAIL_REGEX.test(email.trim())) return 'Email không đúng định dạng';
    if (password.length < 6) return 'Mật khẩu phải có ít nhất 6 ký tự';
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Mật khẩu phải gồm cả chữ và số';
    if (password !== confirm) return 'Mật khẩu nhập lại không khớp';
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const message = validate();
    if (message) {
      setError(message);
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
      router.push('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại');
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