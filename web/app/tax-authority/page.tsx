'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function TreasuryPreviewPage() {
  return (
    <CipherRollComingSoon
      badge="Status Only"
      title="Tax And Treasury Flows Are Roadmap Work"
      description="CipherRoll does not currently ship tax authority workflows, automated withholding, or production settlement rails in the web product. This page reflects roadmap status rather than a live portal."
      wave="Roadmap Target: Phase 3"
      focus={[
        "Confidential settlement rails once the core payroll path is stable.",
        "Tax authority visibility and withholding flows with explicit role boundaries.",
        "Broader organization-level compliance analytics and evidence generation."
      ]}
    />
  );
}
