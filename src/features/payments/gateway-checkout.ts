// src/features/payments/gateway-checkout.ts
//
// One entry point for every browser checkout, whichever gateway the backend is
// currently pointed at.
//
//   PhonePe   → backend returns `redirectUrl` (hosted page)  → full-page redirect
//   Razorpay  → backend returns `razorpayCheckout`           → Checkout.js modal
//
// Both paths finish the same way: the browser lands on `/payment/pending?…` and
// the existing poller asks OUR server what happened. The browser is never
// trusted for payment truth — the handler response only tells us *when* to go
// look, never *whether* the money moved.
//
// Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/

// Overridable so a local run can point at a proxy/mock; defaults to Razorpay's
// own CDN, which is the only host that serves a working Checkout bundle.
const RAZORPAY_CHECKOUT_SCRIPT =
  process.env.NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL ||
  'https://checkout.razorpay.com/v1/checkout.js';

export type GatewayProvider = 'PHONEPE' | 'RAZORPAY';

export interface RazorpayCheckoutPayload {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  returnUrl: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  themeColor?: string;
  /**
   * Lock the prefilled contact. Used for payment links, where we already know
   * who owes the money — Razorpay's own hosted link page deliberately never
   * autofills it, which is the whole reason we host this checkout ourselves.
   */
  readonlyContact?: boolean;
}

/** The subset of a checkout response this helper needs. */
export interface GatewayCheckoutResponse {
  provider?: GatewayProvider | string | null;
  redirectUrl?: string | null;
  razorpayCheckout?: RazorpayCheckoutPayload | null;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (payload: unknown) => void) => void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let checkoutScriptPromise: Promise<void> | null = null;

function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Checkout can only run in the browser.'));
  }
  if (window.Razorpay) return Promise.resolve();
  if (checkoutScriptPromise) return checkoutScriptPromise;

  checkoutScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`,
    );
    const script = existing ?? document.createElement('script');

    const onLoad = () => resolve();
    const onError = () => {
      // Let the next attempt retry from scratch rather than caching a failure.
      checkoutScriptPromise = null;
      script.remove();
      reject(new Error('Payment page load nahi hua. Internet check karke dobara try karein.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.src = RAZORPAY_CHECKOUT_SCRIPT;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return checkoutScriptPromise;
}

function isRazorpayCheckout(
  checkout: GatewayCheckoutResponse,
): checkout is GatewayCheckoutResponse & {
  razorpayCheckout: RazorpayCheckoutPayload;
} {
  return (
    String(checkout.provider || '').toUpperCase() === 'RAZORPAY' &&
    Boolean(checkout.razorpayCheckout?.orderId && checkout.razorpayCheckout?.keyId)
  );
}

/**
 * Opens the checkout the backend prepared and hands the browser off to it.
 *
 * Resolves only in the rare case where nothing could be opened — otherwise the
 * page navigates away, so treat anything after the await as unreachable.
 */
export async function startGatewayCheckout(
  checkout: GatewayCheckoutResponse,
  options?: {
    /**
     * Called instead of navigating when the customer closes the modal.
     *
     * Only for surfaces that open checkout automatically, where bouncing to
     * the return page on an accidental dismiss would strand the customer.
     * Callers that open on a tap leave this unset and keep the default:
     * navigate, and let the server decide what actually happened.
     */
    onDismiss?: () => void;
  },
): Promise<void> {
  if (isRazorpayCheckout(checkout)) {
    await openRazorpayCheckout(checkout.razorpayCheckout, options?.onDismiss);
    return;
  }

  if (checkout.redirectUrl) {
    window.location.assign(checkout.redirectUrl);
    return;
  }

  throw new Error('Payment gateway did not return a checkout. Please try again.');
}

async function openRazorpayCheckout(
  payload: RazorpayCheckoutPayload,
  onDismiss?: () => void,
): Promise<void> {
  await loadRazorpayCheckoutScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) {
    throw new Error('Payment page load nahi hua. Dobara try karein.');
  }

  // Both outcomes go to the same place. The pending page re-reads the order
  // from our backend, so a dismissed modal that actually completed (app-switch
  // races on mobile UPI) still resolves correctly instead of being lost.
  const goToReturnUrl = () => {
    window.location.assign(payload.returnUrl);
  };

  const razorpay = new Razorpay({
    key: payload.keyId,
    order_id: payload.orderId,
    amount: payload.amount,
    currency: payload.currency,
    name: payload.name,
    description: payload.description,
    prefill: payload.prefill ?? {},
    ...(payload.readonlyContact
      ? { readonly: { contact: true, email: true } }
      : {}),
    notes: payload.notes ?? {},
    theme: { color: payload.themeColor || '#0F7A3D' },
    retry: { enabled: true },
    handler: goToReturnUrl,
    modal: {
      ondismiss: onDismiss ?? goToReturnUrl,
      confirm_close: true,
      escape: true,
    },
  });

  // Razorpay keeps the modal open after a failed attempt so the customer can
  // retry on another method — do not navigate away here.
  razorpay.on('payment.failed', (response: unknown) => {
    console.warn('[razorpay] payment.failed', response);
  });

  razorpay.open();
}
