'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function TreasuryPreviewPage() {
  return (
    <CipherRollComingSoon
      badge="Status Only"
      title="Tax And Treasury Flows Are Roadmap Work"
      description="CipherRoll does not currently ship tax authority routing, automated withholding, or treasury settlement adapters in the web product. This page now reflects roadmap status rather than presenting a pseudo-portal."
      wave="Roadmap Target: Phase 3"
      focus={[
        "Confidential settlement rails once the core payroll path is stable.",
        "Tax authority visibility and withholding flows with explicit role boundaries.",
        "Broader treasury analytics and compliance evidence generation."
      ]}
    />
  );
}
