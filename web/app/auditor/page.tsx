'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function AuditorPage() {
  return (
    <CipherRollComingSoon
      badge="Status Only"
      title="Auditor Access Is Not Shipped Yet"
      description="CipherRoll does not currently ship a live auditor workspace. This page exists to state that clearly and to outline the next compliance-focused work without implying active disclosure tooling."
      wave="Roadmap Target: Phase 2 Priority 4+"
      focus={[
        "Add contract-side auditor read paths instead of reusing admin-only getters.",
        "Expose aggregate-only summaries rather than employee-level salary history.",
        "Back disclosures with scoped permits and verifiable policy checks."
      ]}
    />
  );
}
