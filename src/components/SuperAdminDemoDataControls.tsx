import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

type Status = { seeded: boolean; createdAt: string | null; recordCount: number };

export const SuperAdminDemoDataControls: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await api.getStagingDemoDataStatus();
      setStatus({ seeded: result.seeded, createdAt: result.createdAt, recordCount: result.recordCount });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read staging demo data status.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (action: 'seed' | 'unseed') => {
    const prompt = action === 'seed'
      ? 'Create the clearly labelled staging-only academic workflow test records?'
      : 'Remove the tracked staging demo records? This will stop if any seeded record has been edited.';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage('');
    try {
      const result = action === 'seed' ? await api.seedStagingDemoData() : await api.unseedStagingDemoData();
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The demo data action failed.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-5 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Super Admin only · Staging environment</p>
        <h3 className="text-base font-black text-slate-900 dark:text-white">Demo Academic Workflow Data</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">Creates labelled test records for the HOD → Lecturer → HOD result approval → Exam Officer workflow. Existing demo accounts are reused; no new login credentials are created.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {status === null ? 'Checking status…' : status.seeded ? `Seeded · ${status.recordCount} tracked changes` : 'Not seeded'}
        </span>
        <button type="button" disabled={busy || status?.seeded !== false} onClick={() => void run('seed')} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Working…' : 'Seed test data'}</button>
        <button type="button" disabled={busy || status?.seeded !== true} onClick={() => void run('unseed')} className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Unseed test data</button>
        <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Refresh</button>
      </div>
      {status?.createdAt && <p className="text-xs text-slate-500">Seeded at {new Date(status.createdAt).toLocaleString()}</p>}
      {message && <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{message}</p>}
    </section>
  );
};
