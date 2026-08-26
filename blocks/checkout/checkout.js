/**
 * Checkout (flight/Trip-Summary) block – now a thin wrapper around the merged
 * implementation in blocks/checkout-shipping/checkout-shipping.js, forced into
 * flight mode so existing authored `checkout` block content keeps working.
 */
export default async function decorate(block) {
  const { default: decorateCheckoutShipping } = await import('../checkout-shipping/checkout-shipping.js');
  return decorateCheckoutShipping(block, { flightMode: true });
}
