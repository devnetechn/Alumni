// All amounts are integer centavos. The customer pays a little extra so that
// the association nets `subtotal` after PayMongo takes feePercent of the total.
function computeTotals(price, quantity, feePercent) {
  const subtotal = price * quantity;
  const feeBp = Math.round(feePercent * 100); // basis points, avoids float drift
  const total = Math.ceil((subtotal * 10000) / (10000 - feeBp));
  return { subtotal, fee: total - subtotal, total };
}

module.exports = { computeTotals };
