'use client';

import { useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    // TODO: gọi API đăng ký bảng tin khi có
    setEmail('');
  }

  return (
    <form onSubmit={handleSubscribe}>
      <input
        type="email"
        name="email"
        placeholder="Email*"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <div className="btn-wrapper">
        <button className="theme-btn-1 btn" type="submit">
          <i className="fas fa-location-arrow" />
        </button>
      </div>
    </form>
  );
}
