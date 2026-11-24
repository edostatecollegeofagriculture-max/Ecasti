import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

type Status = { seeded: boolean; createdAt: string | null; recordCount: number; conflicts: Array<{ collection: string; id: string; issue: 'missing' | 'changed'; changedFields: string[] }> };

export const SuperAdminDemoDataControls: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    try {
      const result = await api.getStagingDemoDataStatus();
      setStatus({ seeded: result.seeded, createdAt: result.createdAt, recordCount: result.recordCount, conflicts: result.conflicts ?? [] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to read staging demo data status.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const canPreserveStudent = status?.conflicts.length === 1
    && status.conflicts[0].collection === 'students'
    && status.conflicts[0].id === 'demo-e2e-student-agric'
    && status.conflicts[0].issue === 'changed'
    && status.conflicts[0].changedFields.length === 1
    && status.conflicts[0].changedFields[0] === 'photoUrl';

  const preserveStudentAndClean = async () => {
    const prompt = 'Preserve the edited demo student record and photo, remove only unchanged demo records, and restore the Exam Officer account fields? This cannot be undone automatically.';
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await api.preserveEditedDemoStudentAndClean();
      setMessage(result.message);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The selective cleanup was stopped safely.');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

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
        <p className="text-sm text-slate-600 dark:text-slate-300">Creates labelled test records for the HOD course-registration approval → Lecturer result entry → HOD result approval → Exam Officer moderation. Existing demo accounts are reused; no new login credentials are created.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          {status === null ? 'Checking status…' : status.seeded ? `Seeded · ${status.recordCount} tracked changes` : 'Not seeded'}
        </span>
        <button type="button" disabled={busy || status?.seeded !== false} onClick={() => void run('seed')} className="rounded-lg bg-emerald-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Working…' : 'Seed test data'}</button>
        <button type="button" disabled={busy || status?.seeded !== true} onClick={() => void run('unseed')} className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Unseed test data</button>
        <button type="button" disabled={busy || !canPreserveStudent} onClick={() => void preserveStudentAndClean()} className="rounded-lg border border-amber-500 px-4 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 disabled:opacity-50">Preserve student & clean demo data</button>
        <button type="button" disabled={busy} onClick={() => void refresh()} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">Refresh</button>
      </div>
      {status?.createdAt && <p className="text-xs text-slate-500">Seeded at {new Date(status.createdAt).toLocaleString()}</p>}
      {status?.conflicts.length ? (
        <div role="status" className="rounded-lg border border-amber-400 bg-white/70 p-3 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
          <p className="font-bold">Read-only conflict report · {status.conflicts.length} record(s)</p>
          <p className="mt-1">No records were changed by this check. Unseed remains protected until these differences are reviewed.</p>
          {canPreserveStudent && <p className="mt-2 font-semibold">The selective cleanup is available because the only difference is the student's photoUrl. It will keep that student record intact and remove only other unchanged demo records.</p>}
          <ul className="mt-2 space-y-1">
            {status.conflicts.map((conflict) => (
              <li key={conflict.collection + ':' + conflict.id}>
                <span className="font-semibold">{conflict.collection} / {conflict.id}</span>
                {' — '}
                {conflict.issue === 'missing' ? 'record is missing' : `changed fields: ${conflict.changedFields.join(', ') || 'record differs'}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {message && <p role="status" className="text-sm text-slate-700 dark:text-slate-200">{message}</p>}
    </section>
  );
};
