'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function TreasuryPreviewPage() {
  return (
    <CipherRollComingSoon
      badge="Status Only"
      title="Tax And Treasury Flows Are Roadmap Work"
      description="CipherRoll does not currently ship tax authority workflows or automated withholding in the web product. This page reflects roadmap status rather than a live portal."
      wave="Roadmap Target: Phase 3"
      focus={[
        "Tax-facing workflows once the current confidential payroll path is stable.",
        "Tax authority visibility and withholding flows with explicit role boundaries.",
        "Broader organization-level compliance analytics and evidence generation."
      ]}
    />
  );
}
