'use client';

import CipherRollComingSoon from "@/components/CipherRollComingSoon";

export default function TreasuryPreviewPage() {
  return (
    <CipherRollComingSoon
      badge="Future Protocol Scaling"
      title="Treasury And Compliance Expansion"
      description="CipherRoll establishes the treasury adapter boundary structurally today, but defers larger stablecoin settlement pipelines, tax provisioning, and oversight tooling for future protocol iterations."
      wave="Scheduled for V3 Roadmap"
      focus={[
        "Fhenix-native confidential stablecoin automated settlement flows.",
        "Tax authority visibility routing and automated compliance receipt generation.",
        "Broader treasury analytics and multi-step payroll settlement paths."
      ]}
    />
  );
}
