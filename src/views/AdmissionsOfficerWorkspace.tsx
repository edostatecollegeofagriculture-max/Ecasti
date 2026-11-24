import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, Search, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type AdmissionRecord = {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  email: string;
  phone?: string;
  programmeId: string;
  session: string;
  status: string;
  submittedAt?: string;
  screeningNotes?: string;
  stateOfOrigin?: string;
  lga?: string;
  residentialAddress?: string;
  oLevelResults?: Array<{ subject: string; grade: string; examType?: string }>;
};

type ProgrammeRecord = { id: string; name: string };

const DECISIONS = ['OFFERED', 'UNDER_REVIEW', 'REJECTED'] as const;

export const AdmissionsOfficerWorkspace: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<AdmissionRecord[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [selected, setSelected] = useState<AdmissionRecord | null>(null);
  const [decision, setDecision] = useState<(typeof DECISIONS)[number]>('OFFERED');
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [applicationResponse, programmeResponse] = await Promise.all([
        api.getApplications(),
        api.getProgrammes(),
      ]);
      setApplications(applicationResponse.applications || []);
      setProgrammes(programmeResponse.programmes || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load admission applications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMISSIONS_OFFICER') void loadData();
  }, [user?.role, loadData]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return applications.filter((app) => {
      const statusMatch = statusFilter === 'PENDING'
        ? ['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)
        : statusFilter === 'ALL' || app.status === statusFilter;
      const programme = programmes.find((item) => item.id === app.programmeId)?.name || '';
      const textMatch = !term || [
        app.applicationNumber, app.firstName, app.lastName, app.otherNames,
        app.email, app.phone, app.status, programme,
      ].some((value) => String(value || '').toLowerCase().includes(term));
      return statusMatch && textMatch;
    });
  }, [applications, programmes, query, statusFilter]);

  const openReview = (application: AdmissionRecord) => {
    setSelected(application);
    setDecision(application.status === 'REJECTED' ? 'REJECTED' : application.status === 'UNDER_REVIEW' ? 'UNDER_REVIEW' : 'OFFERED');
    setNotes(application.screeningNotes || '');
    setNotice('');
    setError('');
  };

  const submitDecision = async () => {
    if (!selected || user?.role !== 'ADMISSIONS_OFFICER') return;
    setSaving(true);
    setError('');
    try {
      await api.reviewApplication(selected.id, {
        status: decision,
        screeningNotes: notes.trim() || 'Reviewed by the Admissions Officer.',
      });
      setNotice(`Decision saved for ${selected.applicationNumber}.`);
      setSelected(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Unable to save the application decision.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'ADMISSIONS_OFFICER') {
    return (
      <div className="max-w-3xl mx-auto p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          This workspace is restricted to Admissions Officers.
        </div>
      </div>
    );
  }

  const pendingCount = applications.filter((app) => ['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Admissions Office</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Application Review Workspace</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review submitted applications, record screening notes, and issue admission decisions.</p>
        </div>
        <button onClick={() => void loadData()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Total applications</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{applications.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">Awaiting decision</p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-200">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-300">Offers issued</p>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-200">{applications.filter((app) => app.status === 'OFFERED').length}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by applicant, reference, email or programme" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <option value="PENDING">Pending review</option>
            <option value="ALL">All applications</option>
            <option value="OFFERED">Offered</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading applications…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No applications match this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                <tr><th className="p-4">Reference / Applicant</th><th className="p-4">Programme</th><th className="p-4">Session</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((app) => (
                  <tr key={app.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4"><p className="font-mono text-xs font-bold text-emerald-800 dark:text-emerald-400">{app.applicationNumber}</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{app.firstName} {app.otherNames} {app.lastName}</p><p className="text-xs text-slate-500">{app.email}</p></td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{programmes.find((item) => item.id === app.programmeId)?.name || 'Programme unavailable'}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-300">{app.session}</td>
                    <td className="p-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{app.status}</span></td>
                    <td className="p-4 text-right"><button onClick={() => openReview(app)} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-900">Review application</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admissions-review-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Application screening</p><h2 id="admissions-review-title" className="mt-1 text-lg font-black text-slate-900 dark:text-white">{selected.applicationNumber}</h2><p className="text-sm text-slate-500">{selected.firstName} {selected.otherNames} {selected.lastName}</p></div>
              <button onClick={() => setSelected(null)} aria-label="Close review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-3 py-4 text-sm sm:grid-cols-2">
              <p><span className="font-semibold text-slate-500">Email:</span> {selected.email}</p>
              <p><span className="font-semibold text-slate-500">Phone:</span> {selected.phone || 'Not supplied'}</p>
              <p><span className="font-semibold text-slate-500">Origin:</span> {selected.stateOfOrigin || 'Not supplied'} · {selected.lga || ''}</p>
              <p><span className="font-semibold text-slate-500">Programme:</span> {programmes.find((item) => item.id === selected.programmeId)?.name || 'Programme unavailable'}</p>
              <p className="sm:col-span-2"><span className="font-semibold text-slate-500">Address:</span> {selected.residentialAddress || 'Not supplied'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">O-Level results supplied</h3>
              {selected.oLevelResults?.length ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{selected.oLevelResults.map((result, index) => <div key={index} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"><span>{result.subject}</span><strong>{result.grade}</strong></div>)}</div> : <p className="text-sm text-slate-500">No subject results supplied.</p>}
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Decision<select value={decision} onChange={(event) => setDecision(event.target.value as (typeof DECISIONS)[number])} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"><option value="OFFERED">Approve — issue provisional offer</option><option value="UNDER_REVIEW">Keep under review</option><option value="REJECTED">Reject application</option></select></label>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Screening notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={2000} placeholder="Record the screening outcome and any relevant notes." className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm normal-case dark:border-slate-700 dark:bg-slate-950" /></label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button onClick={() => setSelected(null)} disabled={saving} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
              <button onClick={() => void submitDecision()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{decision === 'REJECTED' ? <XCircle className="h-4 w-4" /> : decision === 'OFFERED' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}{saving ? 'Saving…' : 'Save decision'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
