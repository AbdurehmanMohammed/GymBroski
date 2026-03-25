/**
 * Brand lockup — shield + barbell + GYMBRUSKI (public/gymbruski-shield-logo.png).
 */
const LOGO_SRC = '/gymbruski-shield-logo.png';

export default function BrandLogo({ variant = 'sidebar', className = '' }) {
  const isAuth = variant === 'auth';

  return (
    <span
      className={['brand-logo', isAuth && 'brand-logo--auth', className].filter(Boolean).join(' ')}
    >
      <img
        src={LOGO_SRC}
        alt="GYMBRUSKI"
        className="brand-logo__img"
        decoding="async"
      />
    </span>
  );
}
