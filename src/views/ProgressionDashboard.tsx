import React, { useEffect, useState } from 'react';
import { GraduationCap, RefreshCw, ChevronRight, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface Eligibility {
  currentStage: string;
  progressionStatus: string;
  eligible: boolean;
  passedCourseCount: number;
  requiredCourseCount: number;
}

interface StudentRow {
  studentId: string;
  matricNumber: string;
  fullName: string;
  programmeName: string;
  level: string;
  eligibility: Eligibility | null;
}

interface Decision {
  fromStage: string;
  toStage: string;
  fromStatus: string;
  toStatus: string;
  decisionType: string;
  outstandingCourseIds: string[];
  historyId: string;
}

const STAGE_LABELS: Record<string, string> = {
  ND_I: 'ND I',
  ND_II: 'ND II',
  EXTENSION_1: 'Extension 1',
  EXTENSION_2: 'Extension 2',
  EXTENSION_3: 'Extension 3',
  GRADUATED: 'Graduated',
};

function getToken(): string {
  return localStorage.getItem('edocasti_token') ?? localStorage.getItem('token') ?? '';
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
  return body as T;
}

export const ProgressionDashboard: React.FC = () => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<StudentRow | null>(null);
  const [academicSession, setAcademicSession] = useState('2027/2028');
  const [advancing, setAdvancing] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ students: StudentRow[] }>('/api/v1/academic-progression/students');
      setRows(data.students ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAdvance = async () => {
    if (!advanceTarget) return;
    setAdvancing(true);
    try {
      const result = await apiFetch<{ decision: Decision }>(
        `/api/v1/academic-progression/students/${advanceTarget.studentId}/advance`,
        { method: 'POST', body: JSON.stringify({ academicSession }) }
      );
      const d = result.decision;
      setToast({
        kind: 'ok',
        message: `${advanceTarget.fullName}: ${STAGE_LABELS[d.fromStage] ?? d.fromStage} -> ${STAGE_LABELS[d.toStage] ?? d.toStage} (${d.decisionType})`,
      });
      setAdvanceTarget(null);
      await load();
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Advance failed';
      const hint = raw.includes('already been recorded')
        ? ' Try a future academic session (e.g. 2027/2028).'
        : '';
      setToast({ kind: 'err', message: raw + hint });
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Academic Progression</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Live from PostgreSQL - snapshot verified</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Student</th>
              <th className="text-left px-4 py-3 font-bold">Programme</th>
              <th className="text-left px-4 py-3 font-bold">Stage</th>
              <th className="text-left px-4 py-3 font-bold">Status</th>
              <th className="text-left px-4 py-3 font-bold">Courses</th>
              <th className="text-left px-4 py-3 font-bold">Eligible</th>
              <th className="text-right px-4 py-3 font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-3">
                  <div className="font-semibold">{r.fullName}</div>
                  <div className="text-xs text-slate-500">{r.matricNumber}</div>
                </td>
                <td className="px-4 py-3">{r.programmeName}</td>
                <td className="px-4 py-3">{r.eligibility ? (STAGE_LABELS[r.eligibility.currentStage] ?? r.eligibility.currentStage) : '-'}</td>
                <td className="px-4 py-3">{r.eligibility?.progressionStatus ?? '-'}</td>
                <td className="px-4 py-3">{r.eligibility ? `${r.eligibility.passedCourseCount}/${r.eligibility.requiredCourseCount}` : '-'}</td>
                <td className="px-4 py-3">
                  {r.eligibility ? (
                    r.eligibility.eligible ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-bold">No</span>
                    )
                  ) : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setAdvanceTarget(r)}
                    disabled={!r.eligibility || r.eligibility.currentStage === 'GRADUATED'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Advance <ChevronRight className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No students found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {advanceTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Advance Student</h2>
              <button onClick={() => setAdvanceTarget(null)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              <strong>{advanceTarget.fullName}</strong> ({advanceTarget.matricNumber})<br />
              Current stage: <strong>{advanceTarget.eligibility ? (STAGE_LABELS[advanceTarget.eligibility.currentStage] ?? advanceTarget.eligibility.currentStage) : '-'}</strong>
            </p>
            <label className="block text-sm font-semibold mb-1">Academic session</label>
            <input
              type="text"
              value={academicSession}
              onChange={(e) => setAcademicSession(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-4 dark:bg-slate-800 dark:border-slate-700"
              placeholder="e.g. 2026/2027"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdvanceTarget(null)} className="px-4 py-2 rounded-lg border text-sm font-bold" disabled={advancing}>Cancel</button>
              <button
                onClick={handleAdvance}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
                disabled={advancing || !academicSession}
              >
                {advancing ? 'Advancing...' : 'Confirm Advance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 max-w-md px-4 py-3 rounded-lg shadow-lg ${toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
