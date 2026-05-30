export const DEFAULT_COMPLIANCE_TAX_RESERVE_BPS = 1500;
export const MAX_COMPLIANCE_TAX_RESERVE_BPS = 5000;

export function normalizeComplianceTaxReserveBps(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : DEFAULT_COMPLIANCE_TAX_RESERVE_BPS;

  if (!Number.isFinite(parsed)) return DEFAULT_COMPLIANCE_TAX_RESERVE_BPS;
  return Math.max(0, Math.min(MAX_COMPLIANCE_TAX_RESERVE_BPS, Math.trunc(parsed)));
}

export function calculateAggregateReserveAmount(value: string | bigint, reserveBps: number) {
  const amount = typeof value === "bigint" ? value : BigInt(value || "0");
  const bps = BigInt(normalizeComplianceTaxReserveBps(reserveBps));
  return ((amount * bps) / 10_000n).toString();
}

export function formatCompliancePolicyLabel(reserveBps: number) {
  const normalized = normalizeComplianceTaxReserveBps(reserveBps);
  const whole = Math.floor(normalized / 100);
  const fraction = String(normalized % 100).padStart(2, "0");
  return `${whole}.${fraction}% aggregate reserve policy`;
}
