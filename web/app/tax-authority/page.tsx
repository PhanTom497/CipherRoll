'use client';

import { useMemo, useState } from 'react';
import { Download, FileCheck2, Landmark, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import GlassCard from '@/components/GlassCard';
import NetworkStatus from '@/components/NetworkStatus';
import { BACKEND_BASE_URL, DEFAULT_ORG_ID, toBytes32Label } from '@/lib/cipherroll-config';
import { getCipherRollBackendClient } from '@/lib/cipherroll-backend';
import { extractCipherRollErrorMessage, formatTokenAmount, shortHash } from '@/lib/admin-portal-utils';
import type { CompliancePackage } from '@/lib/cipherroll-types';

export default function TaxAuthorityPage() {
  const [orgLabel, setOrgLabel] = useState(DEFAULT_ORG_ID);
  const [taxReserveBps, setTaxReserveBps] = useState('1500');
  const [compliancePackage, setCompliancePackage] = useState<CompliancePackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orgId = useMemo(() => toBytes32Label(orgLabel), [orgLabel]);
  const taxReserveBpsValue = useMemo(() => {
    const parsed = Number.parseInt(taxReserveBps, 10);
    return Number.isFinite(parsed) ? parsed : 1500;
  }, [taxReserveBps]);

  const loadCompliancePackage = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const backend = getCipherRollBackendClient();
      const result = await backend.getCompliancePackage(orgId, { taxReserveBps: taxReserveBpsValue });
      setCompliancePackage(result);
    } catch (loadError) {
      setError(extractCipherRollErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPackage = async (format: 'json' | 'csv') => {
    setError(null);

    try {
      const url = `${BACKEND_BASE_URL}/api/compliance/organizations/${encodeURIComponent(orgId)}/export?taxReserveBps=${encodeURIComponent(String(taxReserveBpsValue))}${format === 'csv' ? '&format=csv' : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || payload?.error || 'Compliance package export failed.');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cipherroll-${orgId}-tier-a-compliance.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (downloadError) {
      setError(extractCipherRollErrorMessage(downloadError));
    }
  };

  const reserveDisplay = compliancePackage
    ? formatTokenAmount(compliancePackage.taxProvision.estimatedTaxReserve)
    : '—';
  const reservedBasisDisplay = compliancePackage
    ? formatTokenAmount(compliancePackage.taxProvision.reservedTreasuryFunds)
    : '—';

  return (
    <main className="min-h-screen relative z-10 font-sans text-gray-100 bg-black selection:bg-white/20 pt-32">
      <div
        className="fixed inset-0 z-0 bg-[length:800px] md:bg-[length:1800px] bg-left bg-no-repeat bg-fixed opacity-40"
        style={{ backgroundImage: "url('/assets/milad-fakurian-7W3X1dAuKqg-unsplash.jpg')" }}
      />
      <div className="fixed inset-0 z-0 bg-black/60 backdrop-blur-[2px]" />

      <div className="w-full max-w-7xl mx-auto px-6 pb-20 relative z-10">
        <div className="mb-10 border-b border-white/5 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 text-cyan-300 text-xs font-bold tracking-widest uppercase mb-4">
            <Landmark className="w-3.5 h-3.5" />
            Tier A Compliance
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-3">
            Aggregate Compliance Package
          </h1>
          <p className="text-[#a1a1aa] text-lg max-w-4xl">
            Build a policy-oriented compliance package from indexed aggregate state, treasury posture, and audit receipt metadata. This is not a tax filing, not an external authority integration, and not an employee salary export.
          </p>
        </div>

        <NetworkStatus />

        <div className="grid gap-8 lg:grid-cols-[0.9fr,1.1fr]">
          <GlassCard className="p-8 bg-[#0a0a0a] border-white/5 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <h2 className="text-2xl font-bold text-white">Policy inputs</h2>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="text-white/70">Organization label</span>
                <input
                  value={orgLabel}
                  onChange={(event) => setOrgLabel(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="cipherroll-default-org"
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/45 break-all">
                Derived org id: {orgId}
              </div>
              <label className="block space-y-2 text-sm">
                <span className="text-white/70">Aggregate reserve policy, basis points</span>
                <input
                  value={taxReserveBps}
                  onChange={(event) => setTaxReserveBps(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35"
                  placeholder="1500"
                />
              </label>
              <p className="text-xs leading-5 text-[#a1a1aa]">
                The estimate applies to aggregate reserved treasury funds only. It does not decrypt, infer, or export employee-level payroll rows.
              </p>
              <button
                type="button"
                onClick={() => void loadCompliancePackage()}
                disabled={isLoading || !orgLabel.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isLoading ? 'Loading package…' : 'Load Compliance Package'}
              </button>
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-50">
                {error}
              </div>
            ) : null}
          </GlassCard>

          <GlassCard className="p-8 bg-[#0a0a0a] border-white/5 rounded-3xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <FileCheck2 className="w-5 h-5 text-cyan-300" />
                  <h2 className="text-2xl font-bold text-white">Package summary</h2>
                </div>
                <p className="mt-2 text-sm text-[#a1a1aa]">
                  Scope boundary: aggregate-first reporting plus receipt metadata. Employee rows are excluded.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white/60">
                {compliancePackage?.packageKind?.replace(/_/g, ' ') ?? 'not loaded'}
              </span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                ['Estimated reserve', reserveDisplay],
                ['Reserve basis', reservedBasisDisplay],
                ['Payout backlog', compliancePackage ? String(compliancePackage.treasury.payoutBacklog) : '—']
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</p>
                  <p className="mt-2 text-2xl font-black text-white">{value}</p>
                </div>
              ))}
            </div>

            {compliancePackage ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-semibold text-white">{compliancePackage.policy.label}</p>
                  <p className="mt-2 text-sm text-[#c9c9d0]">{compliancePackage.policy.scopeBoundary}</p>
                  <p className="mt-2 text-xs text-emerald-200">Employee rows included: {String(compliancePackage.policy.employeeRowsIncluded)}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">Evidence receipts</p>
                    <p className="mt-2 text-sm text-[#c9c9d0]">
                      {compliancePackage.evidence.verifiedReceipts} verified · {compliancePackage.evidence.publishedReceipts} published
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      Latest: {compliancePackage.evidence.latestReceiptTxHash ? shortHash(compliancePackage.evidence.latestReceiptTxHash) : 'No receipt indexed'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">Route health</p>
                    <p className="mt-2 text-sm text-[#c9c9d0] capitalize">
                      {compliancePackage.treasury.routeHealth.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-2 text-xs text-white/45">
                      {compliancePackage.treasury.supportsConfidentialSettlement ? 'Wrapper request/finalize route' : compliancePackage.treasury.routeConfigured ? 'Direct treasury route' : 'No treasury route'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {compliancePackage.safetyNotes.map((note) => (
                    <div key={note} className="rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-sm text-cyan-50">
                      {note}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void downloadPackage('json')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadPackage('csv')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-[#a1a1aa]">
                Load a package to review aggregate compliance posture and export evidence-ready summaries.
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
