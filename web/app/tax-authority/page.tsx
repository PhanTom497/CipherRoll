'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function TreasuryPreviewPage() {
  return (
    <CipherRollComingSoon
      badge="Status Only"
      title="Tax And Treasury Flows Are Roadmap Work"
      description="CipherRoll does not currently ship tax authority workflows or automated withholding in the live product. The current submission focuses on hardened payroll settlement, truthful privacy boundaries, selective-disclosure auditing, and operator support rather than a full tax portal."
      wave="Deferred To Future Waves"
      focus={[
        "Tax-facing workflows once the current confidential payroll path and reporting surfaces are fully extended.",
        "Tax authority visibility and withholding flows with explicit role boundaries.",
        "Broader organization-level compliance analytics and evidence generation."
      ]}
    />
  );
}
