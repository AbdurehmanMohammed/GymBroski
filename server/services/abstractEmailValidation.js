/**
 * Abstract API — email check on sign-up
 *
 * Products (different hostnames + keys in Abstract dashboard):
 * - Email Reputation: https://emailreputation.abstractapi.com/v1/  ← most dashboard “Verify” email product
 * - Email Validation: https://emailvalidation.abstractapi.com/v1/
 *
 * .env:
 *   ABSTRACT_EMAIL_API_KEY=your_key
 *   ABSTRACT_EMAIL_PRODUCT=reputation   (default) | validation
 */

const URL_BY_PRODUCT = {
  reputation: 'https://emailreputation.abstractapi.com/v1/',
  validation: 'https://emailvalidation.abstractapi.com/v1/',
};

/** Normalize Abstract's boolean fields (sometimes boolean, sometimes { value: boolean }) */
function isTruthyField(field) {
  if (field == null) return false;
  if (typeof field === 'boolean') return field;
  if (typeof field === 'object' && Object.prototype.hasOwnProperty.call(field, 'value')) {
    return Boolean(field.value);
  }
  return Boolean(field);
}

/** Strip BOM, quotes, and whitespace from .env values (common Windows/editor issues) */
export function normalizeAbstractEmailApiKey(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let k = raw
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^["']|["']$/g, '');
  k = k.replace(/\s+/g, '');
  return k;
}

function getAbstractProduct() {
  const p = String(process.env.ABSTRACT_EMAIL_PRODUCT || 'reputation').toLowerCase().trim();
  if (p === 'validation') return 'validation';
  return 'reputation';
}

function getDeliverabilityUpper(data) {
  const d = data?.deliverability;
  if (typeof d === 'string') return d.toUpperCase();
  if (d && typeof d === 'object' && typeof d.status === 'string') return d.status.toUpperCase();
  if (typeof data?.email_deliverability_status === 'string') {
    return data.email_deliverability_status.toUpperCase();
  }
  if (data?.email_deliverability?.status) {
    return String(data.email_deliverability.status).toUpperCase();
  }
  return '';
}

/** Email Validation API + shared fields some products return */
function evaluateValidationShape(data) {
  const formatOk = isTruthyField(data.is_valid_format);
  if (!formatOk && data.is_valid_format !== undefined && data.is_valid_format !== null) {
    return { ok: false, message: 'Invalid email address.' };
  }

  const mxOk = isTruthyField(data.is_mx_found);
  const deliverability = getDeliverabilityUpper(data) || String(data.deliverability || '').toUpperCase();

  if (deliverability === 'UNDELIVERABLE') {
    return {
      ok: false,
      message: 'This email cannot receive messages. Please use a real email address.',
    };
  }
  if (deliverability === 'DELIVERABLE') {
    return { ok: true };
  }

  if (deliverability === 'UNKNOWN' || !deliverability) {
    if (mxOk) return { ok: true };
    if (!formatOk) {
      return {
        ok: false,
        message: 'We could not verify this email. Please check for typos or try another address.',
      };
    }
    return { ok: true };
  }

  if (mxOk) return { ok: true };

  return {
    ok: false,
    message: 'This email does not appear to be valid. Please use another address.',
  };
}

/** Email Reputation API — disposable / risk / deliverability (payload differs from Validation API) */
function evaluateReputationResponse(data) {
  if (isTruthyField(data.is_disposable_email)) {
    return {
      ok: false,
      message: 'Disposable or temporary email addresses are not allowed. Use a regular email.',
    };
  }

  const risk =
    data?.email_risk?.address_risk_status ||
    data?.risk_level ||
    data?.email_risk_level ||
    '';
  const riskLower = String(risk).toLowerCase();
  if (riskLower === 'high') {
    return {
      ok: false,
      message: 'This email address looks too risky to use for sign-up. Try another email.',
    };
  }

  const del = getDeliverabilityUpper(data);
  if (del === 'UNDELIVERABLE') {
    return {
      ok: false,
      message: 'This email cannot receive messages. Please use a real email address.',
    };
  }

  const fmt = data.is_valid_format;
  if (fmt != null && !isTruthyField(fmt)) {
    return { ok: false, message: 'Invalid email address.' };
  }

  // 200 + no hard failure above → accept (Reputation often omits MX / format fields Validation sends)
  return { ok: true };
}

/**
 * @param {string} email - normalized (trimmed, lowercased)
 * @returns {Promise<{ ok: boolean, message?: string, skipped?: boolean }>}
 */
export async function verifyEmailWithAbstract(email) {
  if (process.env.ABSTRACT_EMAIL_SKIP_VERIFICATION === 'true') {
    console.warn('[abstractEmailValidation] Skipped: ABSTRACT_EMAIL_SKIP_VERIFICATION=true');
    return { ok: true, skipped: true };
  }

  const apiKey = normalizeAbstractEmailApiKey(process.env.ABSTRACT_EMAIL_API_KEY);

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[abstractEmailValidation] ABSTRACT_EMAIL_API_KEY is not set — email verification skipped in production'
      );
    }
    return { ok: true, skipped: true };
  }

  const product = getAbstractProduct();
  const baseUrl = URL_BY_PRODUCT[product];
  if (!baseUrl) {
    console.error('[abstractEmailValidation] Unknown ABSTRACT_EMAIL_PRODUCT:', product);
    return { ok: true, skipped: true };
  }

  const url = `${baseUrl}?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': `GymApp-Server/1.0 (Abstract ${product})`,
      },
    });
  } catch (err) {
    console.error('[abstractEmailValidation] Network error:', err.message);
    return {
      ok: false,
      message: 'Could not verify email right now. Please try again in a moment.',
    };
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('[abstractEmailValidation] Non-JSON response', res.status, text?.slice(0, 200));
  }

  if (!res.ok) {
    const apiMsg = data?.error?.message || data?.message;
    console.error('[abstractEmailValidation] HTTP', res.status, apiMsg || data, `[product=${product}]`);

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message:
          product === 'reputation'
            ? 'Abstract rejected the API key. Use the Primary Key from the Email Reputation page (app.abstractapi.com → Email Reputation → Try it out). For Email Validation instead, set ABSTRACT_EMAIL_PRODUCT=validation in server/.env.'
            : 'Abstract rejected the API key. Use the key from the Email Validation product, or set ABSTRACT_EMAIL_PRODUCT=reputation and use your Email Reputation key.',
      };
    }
    if (res.status === 402) {
      return {
        ok: false,
        message:
          'Email verification quota exceeded on your Abstract account. Add credits or try again tomorrow.',
      };
    }
    if (res.status === 429) {
      return {
        ok: false,
        message: 'Too many sign-up attempts. Please try again in a few minutes.',
      };
    }
    if (res.status >= 500) {
      return {
        ok: false,
        message: 'Email verification service is temporarily unavailable. Please try again later.',
      };
    }

    return {
      ok: false,
      message: apiMsg || 'Email verification service unavailable. Please try again later.',
    };
  }

  if (data.error) {
    console.error('[abstractEmailValidation] API error:', data.error);
    return { ok: false, message: 'Email verification failed. Please check your address.' };
  }

  if (product === 'reputation') {
    return evaluateReputationResponse(data);
  }
  return evaluateValidationShape(data);
}
