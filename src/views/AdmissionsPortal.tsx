import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { AdmissionApplication, Programme } from '../types';
import {
  FileText,
  CheckCircle,
  Award,
  Send,
  Printer,
  Upload,
  UserCheck,
} from 'lucide-react';
import { WildcardFilterBar } from '../components/WildcardFilterBar';
import { matchesWildcard } from '../utils/wildcard';
import { readImageFileAsDataUrl } from '../utils/imageUpload';
import { NIGERIA_LGAS } from '../utils/nigeriaLocations';

interface Props {
  onOpenPrintModal: (type: any, data: any) => void;
  onGoToStudentWorkspace: () => void;
  onOpenLoginModal: () => void;
  initialSection?: string;
  forceApplicantView?: boolean;
}

export const AdmissionsPortal: React.FC<Props> = ({
  onOpenPrintModal,
  onGoToStudentWorkspace,
  onOpenLoginModal,
  initialSection,
  forceApplicantView = false,
}) => {
  const { user, settings, updateSessionUser } = useAuth();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const locationData = (() => { try { return settings?.nigeriaLocationDataJson ? JSON.parse(settings.nigeriaLocationDataJson) as Record<string,string[]> : NIGERIA_LGAS; } catch { return NIGERIA_LGAS; } })();
  const stateOptions = Object.keys(locationData).sort((a,b)=>a.localeCompare(b));
  const lgaOptions = formData.stateOfOrigin ? (locationData[formData.stateOfOrigin] || []) : [];
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);
  const [showApplicationForm, setShowApplicationForm] = useState(initialSection === 'form');
  const [myApp, setMyApp] = useState<AdmissionApplication | null>(null);
  const [allApps, setAllApps] = useState<AdmissionApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wildcard Filter state for Staff Applicant Register
  const [appWildcard, setAppWildcard] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState('');
  const [appProgrammeFilter, setAppProgrammeFilter] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    otherNames: '',
    gender: '',
    dob: '',
    phone: '',
    photoUrl: '',
    programmeId: '',
    stateOfOrigin: '',
    lga: '',
    residentialAddress: '',
    examType: '',
    examNumber: '',
  });

  // Start with empty rows so applicants enter their own verified O-Level results.
  const [oLevelResults, setOLevelResults] = useState([
    { id: 1, subject: '', grade: '' },
    { id: 2, subject: '', grade: '' },
    { id: 3, subject: '', grade: '' },
    { id: 4, subject: '', grade: '' },
    { id: 5, subject: '', grade: '' },
  ]);

  const oLevelSubjects = [
    'Agricultural Science',
    'Arabic',
    'Art',
    'Basic Electricity',
    'Biology',
    'Business Studies',
    'Chemistry',
    'Civic Education',
    'Commerce',
    'Computer Studies',
    'Data Processing',
    'Economics',
    'English Language',
    'Financial Accounting',
    'Food and Nutrition',
    'Further Mathematics',
    'Geography',
    'Government',
    'Hausa',
    'Health Education',
    'History',
    'Igbo',
    'Literature in English',
    'Mathematics',
    'Marketing',
    'Physical Education',
    'Physics',
    'Technical Drawing',
    'Yoruba',
  ];

  const updateOLevelResult = (id: number, field: 'subject' | 'grade', value: string) => {
    setOLevelResults((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addOLevelSubject = () => {
    const availableSubject = oLevelSubjects.find(
      (subject) => !oLevelResults.some((result) => result.subject === subject)
    );
    setOLevelResults((current) => [
      ...current,
      {
        id: Date.now(),
        subject: availableSubject || '',
        grade: 'C6',
      },
    ]);
  };

  const removeOLevelSubject = (id: number) => {
    setOLevelResults((current) =>
      current.length > 5 ? current.filter((item) => item.id !== id) : current
    );
  };

  // Review decision state for staff
  const [decisionStatus, setDecisionStatus] = useState<'OFFERED' | 'REJECTED' | 'UNDER_REVIEW'>('OFFERED');
  const [screeningNotes, setScreeningNotes] = useState('');

  const isStaff =
    !forceApplicantView && !!user && ['SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR', 'ADMISSIONS_OFFICER'].includes(user.role);

  const loadData = async () => {
    setLoading(true);
    try {
      const progRes = await api.getProgrammes();
      if (progRes.success) setProgrammes(progRes.programmes);

      if (user) {
        if (isStaff) {
          const appsRes = await api.getApplications();
          if (appsRes.success) setAllApps(appsRes.applications);
        } else {
          try {
            const myRes = await api.getMyApplication();
            if (myRes.success) setMyApp(myRes.application);
          } catch {
            setMyApp(null);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    if (initialSection === 'programmes') setShowApplicationForm(false);
    if (initialSection === 'form') setShowApplicationForm(true);
  }, [initialSection]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, { maxDimension: 480, quality: 0.85 });
      setFormData((prev) => ({ ...prev, photoUrl: dataUrl }));
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not process selected photo.');
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenLoginModal();
      return;
    }

    const completedSubjects = oLevelResults.filter(
      (result) => result.subject.trim() && result.grade
    );
    if (completedSubjects.length < 5) {
      setErrorMsg('Please provide at least five O-Level subjects and grades.');
      return;
    }
    const selectedSubjects = completedSubjects.map((result) => result.subject.trim().toLowerCase());
    if (new Set(selectedSubjects).size !== selectedSubjects.length) {
      setErrorMsg('Please select each O-Level subject only once.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        otherNames: formData.otherNames,
        gender: formData.gender,
        dob: formData.dob,
        phone: formData.phone,
        photoUrl: formData.photoUrl || user.photoUrl || '',
        programmeId: formData.programmeId,
        stateOfOrigin: formData.stateOfOrigin,
        lga: formData.lga,
        residentialAddress: formData.residentialAddress,
        oLevelResults: oLevelResults.map(({ subject, grade }) => ({
          subject,
          grade,
          examNumber: formData.examNumber,
          examType: formData.examType,
        })),
      };

      const res = await api.submitApplication(payload);
      if (res.success) {
        setMyApp(res.application);
        setSuccessMsg('Your admission application has been submitted successfully! Check your status below.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDecisionSubmit = async (appId: string) => {
    setLoading(true);
    try {
      const res = await api.reviewApplication(appId, {
        status: decisionStatus,
        screeningNotes: screeningNotes || 'Candidate screened and vetted against institutional quotas.',
      });
      if (res.success) {
        setSuccessMsg(`Decision '${decisionStatus}' successfully recorded for application ${res.application.applicationNumber}`);
        setSelectedApp(null);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record decision');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (appId: string) => {
    setLoading(true);
    try {
      const res = await api.acceptOffer(appId);
      if (res.success) {
        if (res.token && res.user) {
          updateSessionUser(res.token, res.user);
        }
        setSuccessMsg(
          `Congratulations! Offer accepted & account migrated to Student (${res.student?.matricNumber || ''}).`
        );
        setTimeout(() => {
          onGoToStudentWorkspace();
        }, 900);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept offer');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffMigrateStudent = async (appId: string) => {
    setLoading(true);
    try {
      const res = await api.migrateApplicantToStudent(appId);
      if (res.success) {
        setSuccessMsg(`Applicant migrated to live Student account (${res.student?.matricNumber}).`);
        loadData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to migrate applicant');
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = allApps.filter((app) => {
    if (appStatusFilter && app.status !== appStatusFilter) return false;
    if (appProgrammeFilter && app.programmeId !== appProgrammeFilter) return false;
    const progName = programmes.find((p) => p.id === app.programmeId)?.name || '';
    return matchesWildcard(
      appWildcard,
      app.applicationNumber,
      app.firstName,
      app.lastName,
      app.email,
      app.stateOfOrigin,
      app.status,
      progName
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Admissions Registry
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
            {isStaff ? 'Admissions Committee Screening Portal' : '2025/2026 Online Admission & Screening'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official National Diploma (ND) and Higher National Diploma (HND) application processing.
          </p>
        </div>

        {myApp && (
          <button
            onClick={() => onOpenPrintModal('ADMISSION_LETTER', myApp)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print Application Slip
          </button>
        )}
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-600">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-red-600">✕</button>
        </div>
      )}

      {/* STAFF VIEW: Applications Table */}
      {isStaff && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Submitted Applicant Register</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Screen credentials, inspect O-Level grades, and record admission decisions.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg">
              Total Applicants: {allApps.length}
            </span>
          </div>

          <WildcardFilterBar
            query={appWildcard}
            onQueryChange={setAppWildcard}
            placeholder="Wildcard filter applicants (*Name*, EDOCASTI/2025/*, *Edo*)..."
            totalCount={allApps.length}
            filteredCount={filteredApps.length}
            facets={[
              {
                key: 'status',
                label: 'Status',
                value: appStatusFilter,
                onChange: setAppStatusFilter,
                options: ['SUBMITTED', 'UNDER_REVIEW', 'OFFERED', 'ACCEPTED', 'REJECTED'].map((s) => ({
                  value: s,
                  label: s,
                })),
              },
              {
                key: 'prog',
                label: 'Programme',
                value: appProgrammeFilter,
                onChange: setAppProgrammeFilter,
                options: programmes.map((p) => ({ value: p.id, label: p.name })),
              },
            ]}
          />

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3">Ref Number</th>
                  <th className="p-3">Applicant Name</th>
                  <th className="p-3">Programme</th>
                  <th className="p-3">O-Level Highlights</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">{app.applicationNumber}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white uppercase">
                      <div className="flex items-center gap-2">
                        {app.photoUrl && (
                          <img src={app.photoUrl} alt={app.firstName} className="w-7 h-7 rounded-md object-cover border border-slate-300" />
                        )}
                        <span>{app.firstName} {app.lastName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">
                      {programmes.find((p) => p.id === app.programmeId)?.name || 'Agricultural Technology'}
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 font-mono">
                        {app.oLevelResults?.length || 5} Subjects Verified
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
                          app.status === 'OFFERED'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : app.status === 'ACCEPTED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : app.status === 'REJECTED'
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                            : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                        }`}
                      >
                        {app.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setDecisionStatus(app.status === 'REJECTED' ? 'REJECTED' : 'OFFERED');
                          setScreeningNotes(app.screeningNotes || '');
                        }}
                        className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold rounded cursor-pointer text-xs"
                      >
                        Screen &amp; Decide
                      </button>
                      {app.status === 'OFFERED' && (
                        <button
                          onClick={() => handleStaffMigrateStudent(app.id)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded cursor-pointer text-xs inline-flex items-center gap-1"
                          title="Migrate applicant directly to active Student account"
                        >
                          <UserCheck className="w-3 h-3" /> Migrate
                        </button>
                      )}
                      <button
                        onClick={() => onOpenPrintModal('ADMISSION_LETTER', { ...app, programmeName: programmes.find((p) => p.id === app.programmeId)?.name })}
                        className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded cursor-pointer text-xs"
                      >
                        Letter
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Decision Modal / Drawer */}
          {selectedApp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
                <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      Screening Application: {selectedApp.applicationNumber}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">
                      {selectedApp.firstName} {selectedApp.lastName} • {selectedApp.stateOfOrigin} ({selectedApp.lga})
                    </p>
                  </div>
                  <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">✕</button>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                      Submitted O-Level Results (WAEC/NECO):
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      {selectedApp.oLevelResults?.map((r, i) => (
                        <div key={i} className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                          <span className="text-slate-600 dark:text-slate-400">{r.subject}:</span>
                          <span className="font-bold font-mono text-emerald-800 dark:text-emerald-400">{r.grade}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                      Admission Decision
                    </label>
                    <select
                      value={decisionStatus}
                      onChange={(e: any) => setDecisionStatus(e.target.value)}
                      className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg"
                    >
                      <option value="OFFERED">Grant Provisional Offer of Admission (OFFERED)</option>
                      <option value="UNDER_REVIEW">Place Under Review (UNDER_REVIEW)</option>
                      <option value="REJECTED">Decline Application (REJECTED)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase block mb-1">
                      Screening Notes & Comments
                    </label>
                    <textarea
                      rows={3}
                      value={screeningNotes}
                      onChange={(e) => setScreeningNotes(e.target.value)}
                      placeholder="Add official screening comments regarding qualification eligibility..."
                      className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setSelectedApp(null)}
                    className="px-4 py-2 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDecisionSubmit(selectedApp.id)}
                    className="px-4 py-2 text-xs bg-emerald-800 hover:bg-emerald-900 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold rounded-lg cursor-pointer"
                  >
                    Confirm & Publish Decision
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPLICANT VIEW: Application Status or Admission Form */}
      {!isStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Tracker Card (if application exists) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-800" /> Application Status
              </h2>

              {myApp ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Reference:</span>
                      <span className="font-mono font-bold text-emerald-900">{myApp.applicationNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Applicant:</span>
                      <span className="font-semibold uppercase">{myApp.firstName} {myApp.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Programme:</span>
                      <span className="font-semibold text-right">
                        {programmes.find((p) => p.id === myApp.programmeId)?.name || 'Agricultural Technology'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="text-slate-500 font-semibold">Status:</span>
                      <span
                        className={`px-2.5 py-0.5 font-bold rounded-full text-[11px] ${
                          myApp.status === 'OFFERED'
                            ? 'bg-amber-100 text-amber-800'
                            : myApp.status === 'ACCEPTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : myApp.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {myApp.status}
                      </span>
                    </div>
                  </div>

                  {myApp.status === 'OFFERED' && (
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                        <Award className="w-5 h-5 text-amber-600" /> Provisional Offer Ready!
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        You have been officially offered admission into EDOCASTI. Accept the offer below to proceed to matriculation and student profile activation.
                      </p>

                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          onClick={() => onOpenPrintModal('ADMISSION_LETTER', myApp)}
                          className="w-full py-2 bg-white hover:bg-slate-50 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-4 h-4" /> View / Print Offer Letter
                        </button>

                        <button
                          onClick={() => handleAcceptOffer(myApp.id)}
                          className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4" /> Accept Admission Offer Now
                        </button>
                      </div>
                    </div>
                  )}

                  {myApp.status === 'ACCEPTED' && (
                    <div className="p-4 bg-emerald-100 border border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-900">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Admission Offer Accepted
                      </div>
                      <p>Your student profile is active. You can now access course registration and fee settlement.</p>
                      <button
                        onClick={onGoToStudentWorkspace}
                        className="w-full py-2 bg-emerald-800 text-white font-semibold rounded-lg mt-2 cursor-pointer"
                      >
                        Go to Student Workspace →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-500 space-y-3">
                  <p>You have not submitted an admission application yet for the {settings?.currentSession || '2025/2026'} academic session.</p>
                  <p className="text-slate-400">Fill in the form on the right to apply.</p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
              <span className="font-bold uppercase tracking-wider block">Admissions Helpdesk</span>
              <p>For inquiries regarding O-Level subject combinations, contact the admissions office at <strong>admissions@edocasti.edu.ng</strong>.</p>
            </div>
          </div>

          {/* Programme catalogue: applicants review programme requirements before opening the form. */}
          {!myApp && !showApplicationForm && (
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Available Programmes</span>
                <h2 className="text-xl font-bold text-slate-900">Choose a Programme</h2>
                <p className="text-sm text-slate-600">Review each programme's description, duration and admission requirements before applying.</p>
              </div>
              {programmes.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-600">
                  {loading ? 'Loading available programmes…' : 'No programmes are currently published for admission. Please contact the Admissions Office.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {programmes.map((programme) => (
                    <article key={programme.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">{programme.qualification}</span>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{programme.name}</h3>
                          <p className="text-xs text-slate-500 mt-1">{programme.code} · {programme.durationYears} {programme.durationYears === 1 ? 'year' : 'years'}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-emerald-50 text-emerald-800 px-2.5 py-1 text-[11px] font-bold">{programme.qualification}</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{programme.description}</p>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Admission Requirements</h4>
                        {programme.requirements?.length ? (
                          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700">
                            {programme.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}
                          </ul>
                        ) : (
                          <p className="text-xs text-slate-500">Specific requirements have not yet been provided. Contact the Admissions Office to confirm eligibility before applying.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProgrammeId(programme.id);
                          setFormData((current) => ({ ...current, programmeId: programme.id }));
                          setShowApplicationForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="mt-auto w-full rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm py-3 cursor-pointer"
                      >
                        Apply for this Programme
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Application form is shown only after an applicant selects a programme. */}
          {!myApp && showApplicationForm && (
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  Online Screening Form
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Application for {programmes.find((programme) => programme.id === (selectedProgrammeId || formData.programmeId))?.name || 'Selected Programme'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Complete the applicant information and O-Level results for the programme you selected.</p>
                </div>
                <button type="button" onClick={() => setShowApplicationForm(false)} className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer">Back to programmes</button>
              </div>

              <form onSubmit={handleSubmitApplication} className="space-y-6 text-xs">
                {/* Step 1: Biodata & Passport Photo */}
                <div className="space-y-3 border-b border-slate-100 pb-5">
                  <h3 className="font-bold uppercase tracking-wider text-[11px] text-emerald-800">
                    1. Applicant Personal Information &amp; Passport Photo
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="w-16 h-20 rounded-lg border-2 border-emerald-700 bg-white overflow-hidden flex items-center justify-center shrink-0">
                      {formData.photoUrl ? (
                        <img
                          src={formData.photoUrl}
                          alt="Applicant Passport"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center px-1">No Photo</span>
                      )}
                    </div>
                    <div className="space-y-1 flex-1 min-w-[200px]">
                      <div className="font-bold text-slate-800">Upload Passport Photograph</div>
                      <p className="text-[11px] text-slate-500">
                        Automatically used on your Admission Letter, Student ID Card, and Transcript upon matriculation.
                      </p>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> Select Passport Photo
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">First Name</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Last Name / Surname</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Gender</label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Date of Birth</label>
                      <input
                        type="date"
                        required
                        value={formData.dob}
                        onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">State of Origin</label>
                      <select required value={formData.stateOfOrigin} onChange={(e) => setFormData({ ...formData, stateOfOrigin: e.target.value, lga: '' })} className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white">
                        <option value="">Select state / FCT</option>
                        {stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">LGA of Origin</label>
                      <select required disabled={!formData.stateOfOrigin} value={formData.lga} onChange={(e) => setFormData({ ...formData, lga: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white disabled:bg-slate-100">
                        <option value="">{formData.stateOfOrigin ? 'Select LGA' : 'Select state first'}</option>
                        {lgaOptions.map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Step 2: Programme Choice */}
                <div className="space-y-3 border-b border-slate-100 pb-5">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] text-emerald-800">
                    2. Programme of Choice
                  </h3>
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Select Academic Programme</label>
                    <select
                      value={formData.programmeId}
                      onChange={(e) => setFormData({ ...formData, programmeId: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-white"
                    >
                      {programmes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.qualification} - {p.durationYears} Years)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 3: O-Level Examination Grades */}
                <div className="space-y-3 border-b border-slate-100 pb-5">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] text-emerald-800">
                    3. O-Level Examination Records (WAEC / NECO / NABTEB)
                  </h3>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Examination Body</label>
                      <select
                        value={formData.examType}
                        onChange={(e) => setFormData({ ...formData, examType: e.target.value })}
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="WAEC">WAEC (SSCE)</option>
                        <option value="NECO">NECO (SSCE)</option>
                        <option value="NABTEB">NABTEB</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Candidate Exam Number</label>
                      <input
                        type="text"
                        required
                        value={formData.examNumber}
                        onChange={(e) => setFormData({ ...formData, examNumber: e.target.value })}
                        placeholder="e.g. 4201992011"
                        className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-12 gap-2 font-semibold text-slate-600 pb-1">
                      <span className="col-span-7">Subject Name</span>
                      <span className="col-span-4">Grade Attained</span>
                      <span className="col-span-1" aria-label="Remove subject"></span>
                    </div>

                    {oLevelResults.map((result, index) => (
                      <div key={result.id} className="grid grid-cols-12 gap-2 items-center">
                        <select
                          required
                          value={result.subject}
                          onChange={(e) => updateOLevelResult(result.id, 'subject', e.target.value)}
                          className="col-span-7 min-w-0 p-2 bg-white border border-slate-300 rounded text-xs"
                        >
                          <option value="">Select subject</option>
                          {oLevelSubjects.map((subject) => (
                            <option
                              key={subject}
                              value={subject}
                              disabled={
                                oLevelResults.some(
                                  (item) => item.id !== result.id && item.subject === subject
                                )
                              }
                            >
                              {subject}
                            </option>
                          ))}
                        </select>

                        <select
                          required
                          value={result.grade}
                          onChange={(e) => updateOLevelResult(result.id, 'grade', e.target.value)}
                          className="col-span-4 min-w-0 p-2 bg-white border border-slate-300 rounded text-xs font-bold font-mono"
                        >
                          {['A1', 'B2', 'B3', 'C4', 'C5', 'C6', 'D7', 'E8', 'F9'].map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => removeOLevelSubject(result.id)}
                          disabled={oLevelResults.length <= 5}
                          title={oLevelResults.length <= 5 ? 'At least five subjects are required' : `Remove subject ${index + 1}`}
                          className="col-span-1 text-red-600 hover:text-red-800 disabled:text-slate-300 disabled:cursor-not-allowed font-bold"
                          aria-label={`Remove subject ${index + 1}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <span className="text-[11px] text-slate-500">
                        {oLevelResults.length} subjects added. At least five are required.
                      </span>
                      <button
                        type="button"
                        onClick={addOLevelSubject}
                        disabled={oLevelResults.length >= oLevelSubjects.length}
                        className="px-3 py-2 bg-white border border-emerald-700 text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-bold"
                      >
                        + Add Subject
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    {myApp ? 'Update & Re-Submit Application' : 'Submit Admission Application Online'}
                  </button>
                </div>
              </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
