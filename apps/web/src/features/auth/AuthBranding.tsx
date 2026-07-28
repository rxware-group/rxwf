import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export function AuthBranding() {
  const [brand, setBrand] = useState({ productName: 'RX-Workflow', logoUrl: '' });

  useEffect(() => {
    void api.auth.branding().then(setBrand).catch(() => undefined);
  }, []);

  return (
    <div className="auth-brand">
      <div className="auth-brand-logo" aria-hidden>
        {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : null}
      </div>
      <p className="auth-brand-name">{brand.productName}</p>
    </div>
  );
}
