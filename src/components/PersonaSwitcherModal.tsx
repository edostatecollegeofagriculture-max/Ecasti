import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, UserCheck, GraduationCap, BookOpen, Wallet, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonaSwitcherModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, switchPersona } = useAuth();
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const personas = [
    {
      category: 'Institutional Leadership & Global Administration',
      items: [
        { name: 'Engr. Osasere Igbinedion', role: 'SUPER_ADMIN', title: 'Super Administrator', email: 'superadmin@edocasti.edu.ng', icon: ShieldCheck, badgeColor: 'bg-purple-100 text-purple-800 border-purple-200', desc: 'Full global CRUD on all records, school stamp/signatures/logo image controls & audit trail.' },
        { name: 'Prof. Patrick O. Aghimien', role: 'RECTOR', title: 'Rector / Provost', email: 'rector@edocasti.edu.ng', icon: UserCheck, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'Executive analytics, senate approvals, institutional oversight & key performance metrics.' },
        { name: 'Barr. Itohan Edokpayi', role: 'REGISTRAR', title: 'College Registrar', email: 'registrar@edocasti.edu.ng', icon: FileText, badgeColor: 'bg-blue-100 text-blue-800 border-blue-200', desc: 'Generate student Transcripts & Final Certificates, admissions registry & official records.' },
        { name: 'Mr. Festus Ojo (FCA)', role: 'BURSAR', title: 'Bursar / Chief Finance Officer', email: 'bursar@edocasti.edu.ng', icon: Wallet, badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'Fee schedule configuration, invoice settlements, Remita reconciliation & payment ledgers.' },
      ],
    },
    {
      category: 'Academic Curriculum, Examinations & Faculty',
      items: [
        { name: 'Prof. Eghosa Osagie', role: 'DEAN', title: 'Dean of Academics', email: 'dean@edocasti.edu.ng', icon: BookOpen, badgeColor: 'bg-violet-100 text-violet-800 border-violet-200', desc: 'Create & manage academic Programmes, curricula, and assign Courses to departments.' },
        { name: 'Dr. Monday Osa-Egharevba', role: 'HOD', title: 'Head of Department (HOD)', email: 'hod.agric@edocasti.edu.ng', icon: BookOpen, badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200', desc: 'Assign departmental courses to Lecturers and oversee departmental academic delivery.' },
        { name: 'Dr. (Mrs) Osarugue Iyoha', role: 'EXAM_OFFICER', title: 'Examination Officer', email: 'examofficer@edocasti.edu.ng', icon: FileText, badgeColor: 'bg-rose-100 text-rose-800 border-rose-200', desc: 'Approve student course registrations and approve/publish lecturer CA & Exam results.' },
        { name: 'Dr. Osaze Obanor', role: 'LECTURER', title: 'Lecturer (Faculty)', email: 'lecturer.agric@edocasti.edu.ng', icon: GraduationCap, badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200', desc: 'Filter class/student lists, record attendance, and submit CA (40) & Exam (60) scores.' },
        { name: 'Mr. Jude Osahon', role: 'ADMISSIONS_OFFICER', title: 'Admissions Officer', email: 'admissions@edocasti.edu.ng', icon: FileText, badgeColor: 'bg-teal-100 text-teal-800 border-teal-200', desc: 'Screen applicants, verify WAEC/NECO credentials, issue offers & migrate to Student.' },
      ],
    },
    {
      category: 'Students & Applicants',
      items: [
        { name: 'Blessing Osasogie Omorodion', role: 'STUDENT', title: 'Student (ND I Agricultural Technology)', email: 'student.agric@edocasti.edu.ng', icon: GraduationCap, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', desc: 'Register courses, view published results, flippable ID card, pay & download transcript/certificate.' },
        { name: 'Jerry Osamudiamen Idahosa', role: 'APPLICANT', title: 'Prospective Applicant (Offer Ready)', email: 'applicant.jerry@gmail.com', icon: FileText, badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', desc: 'Upload passport photo, complete application & accept admission to migrate to Student.' },
      ],
    },
  ];

  const handleSelect = async (email: string) => {
    if (switchingEmail) return;
    setError('');
    setSwitchingEmail(email);

    try {
      await switchPersona(email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to switch account. Please try again.');
    } finally {
      setSwitchingEmail(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-linear-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-500/30 text-emerald-200 rounded border border-emerald-400/30">Institutional Role Switcher</span>
            </div>
            <h2 className="text-xl font-bold mt-1">Select an Institutional Persona</h2>
            <p className="text-xs text-emerald-200/90 mt-0.5">Instantly test workflows, role-based access control (RBAC), and dashboards with seeded Nigerian academic accounts.</p>
          </div>
          <button onClick={onClose} disabled={!!switchingEmail} className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer disabled:opacity-50">✕</button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {personas.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">{group.category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = user?.email === item.email;
                  const isSwitching = switchingEmail === item.email;
                  return (
                    <button
                      key={item.email}
                      type="button"
                      disabled={!!switchingEmail}
                      onClick={() => void handleSelect(item.email)}
                      aria-busy={isSwitching}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between disabled:opacity-60 disabled:cursor-wait ${
                        isCurrent
                          ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-sm ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-slate-50/80 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"><Icon className="w-5 h-5" /></div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{item.name}</div>
                            <span className={`inline-block mt-0.5 px-2 py-0.5 text-[11px] font-medium rounded-full border ${item.badgeColor}`}>{item.title}</span>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">{item.desc}</p>
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                        {isSwitching ? 'Switching account…' : item.email}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-2xl flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>All demonstration accounts are seeded with standard access credentials.</span>
          <button onClick={onClose} disabled={!!switchingEmail} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-lg transition cursor-pointer disabled:opacity-50">Close</button>
        </div>
      </div>
    </div>
  );
};
