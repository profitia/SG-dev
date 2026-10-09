import React from 'react'
import type { Sg2LifecycleReadModel } from '../../lib/pmos/flight-record-read'

export function Sg2LifecycleStatus({ model }: { model: Sg2LifecycleReadModel }) {
  return <section className="bg-bg-surface border border-bg-border rounded-lg p-5 space-y-5" aria-label="SG2 snapshot and lifecycle">
    <div>
      <h2 className="text-sm font-medium text-text-primary">{model.historicalException ? 'Historical FlightRecord — recorded snapshot' : 'Immutable FlightRecord — state at persistence'}</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-3">
        {Object.entries(model.snapshotState).map(([label, value]) => <Status key={label} label={label} value={value ?? 'NOT_VERIFIED'} />)}
      </dl>
      <p className="text-xs text-text-tertiary mt-3">Snapshot completionEvidence is a point-in-time record; it is not the current lifecycle result.</p>
    </div>
    <div>
      <h2 className="text-sm font-medium text-text-primary">Current lifecycle</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-3">
        <Status label="Verified current state" value={model.currentState} />
        <Status label="Evidence integrity" value={model.evidenceIntegrity} />
        <Status label="MEMOROS publication" value={model.memorosPublication} />
        <Status label="MEMOROS consumer readiness" value={model.memorosConsumerReadiness} />
        <Status label="PHR publication" value={model.phrPublication} />
        <Status label="Recovery required" value={model.recoveryRequired ? 'YES' : 'NO VERIFIED RECOVERY EVENT'} />
        <Status label="Immutable boundary integrity" value={model.immutableIntegrity} />
      </dl>
      <p className="text-xs text-text-tertiary mt-3">{model.verificationScope}: {model.eventCount} lifecycle events. Local JSON/hash/lock files were not inspected. Delivery ACK does not prove downstream consumer readiness.</p>
      {model.mode === 'HISTORICAL_SNAPSHOT_ONLY' && <p className="text-xs text-orange-300 mt-3">Historical snapshot-only read: no append-only lifecycle evidence is available. The recorded snapshot status remains visible above; completion under the new contract is NOT_VERIFIED. Absence alone does not prove historical corruption.</p>}
      {model.verificationError && <p className="text-xs text-orange-300 mt-3">{model.verificationError}</p>}
      {model.historicalException && <p className="text-xs text-orange-300 mt-3">Historical Stage 1 immutable integrity: FAIL. Previous recovery authorization: FAIL. Evidence: {model.historicalException}. This finding is unchanged.</p>}
    </div>
  </section>
}

function Status({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-text-tertiary">{label}</dt><dd className="text-text-primary font-mono mt-1">{value}</dd></div>
}
