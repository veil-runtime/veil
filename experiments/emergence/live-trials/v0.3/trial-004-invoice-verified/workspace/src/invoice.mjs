export function invoiceTotalCents(items, discountCents = 0) {
  const total = items.reduce((sum, item) => {
    if (item.active) {
      return sum + item.quantity * item.unitCents;
    } else {
      return sum;
    }
  }, 0) - discountCents;
  return total < 0 ? 0 : total;
}
