/**
 * Demo build (`npm run build:demo`): a static preview without the server. Routing stays
 * in memory and the API is simulated in the browser (see demoApi.ts).
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';

/** window.confirm, except in the demo where dialogs may be blocked by the host page. */
export function confirmAction(message: string) {
  return DEMO ? true : window.confirm(message);
}

/** Sends the customer to the payment page: Mollie normally, an in-app page in the demo. */
export function goToPayment(checkoutUrl: string, navigate: (to: string) => void) {
  if (DEMO && checkoutUrl.startsWith('/')) navigate(checkoutUrl);
  else window.location.assign(checkoutUrl);
}
