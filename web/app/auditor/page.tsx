'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function AuditorPage() {
  return (
    <CipherRollComingSoon
      badge="Future Compliance Integration"
      title="Auditor Selective Disclosure"
      description="The auditor workspace is actively being staged for the next protocol release. It builds upon our CoFHE foundation to enable verifiable regulatory checks without violating on-chain zero-knowledge constraints."
      wave="Scheduled for V2"
      focus={[
        "FHE permit sharing from admin multi-sigs to designated auditors.",
        "Organization-level encrypted settlement summaries without exposing exact PII.",
        "More complete approval and reporting lifecycle documentation."
      ]}
    />
  );
}
