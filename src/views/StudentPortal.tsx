import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Student,
  Course,
  CourseRegistration,
  AssessmentResult,
  Invoice,
  IssuedDocument,
} from '../types';
import {
  BookOpen,
  CreditCard,
  Printer,
  Award,
  FileText,
  ShieldCheck,
  Send,
  Lock,
  Unlock,
  Upload,
  Download,
} from 'lucide-react';
import { WildcardFilterBar } from '../components/WildcardFilterBar';
import { matchesWildcard } from '../utils/wildcard';
import { StudentIdCard } from '../components/StudentIdCard';
import { readImageFileAsDataUrl } from '../utils/imageUpload';

interface Props {
  onOpenPrintModal: (type: any, data: any) => void;
}

export const StudentPortal: React.FC<Props> = ({ onOpenPrintModal }) => {
  const { user, settings, refreshUserData } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [activeSection, setActiveSection] = useState<
    'courses' | 'results' | 'documents' | 'finance' | 'idcard'
  >('courses');
  const [eligibleCourses, setEligibleCourses] = useState<Course[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [currentReg, setCurrentReg] = useState<CourseRegistration | null>(null);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [issuedDocs, setIssuedDocs] = useState<IssuedDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Wildcard Filters
  const [courseWildcard, setCourseWildcard] = useState('');
  const [courseSemesterFilter, setCourseSemesterFilter] = useState('');
  const [resultWildcard, setResultWildcard] = useState('');
  const [resultGradeFilter, setResultGradeFilter] = useState('');
  const [invoiceWildcard, setInvoiceWildcard] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const stdRes = await api.getMyStudentProfile();
      if (stdRes.success) {
        setStudent(stdRes.student);

        const [crsRes, regRes, resRes, invRes, docRes] = await Promise.all([
          api.getCourses({ departmentId: stdRes.student.departmentId }),
          api.getMyRegistration().catch(() => ({ success: false, registration: null })),
          api.getMyResults().catch(() => ({ success: false, results: [] })),
          api.getInvoices().catch(() => ({ success: false, invoices: [] })),
          api.getMyDocuments().catch(() => ({ success: false, documents: [] })),
        ]);

        if (crsRes.success) {
          setEligibleCourses(crsRes.courses);
          if (!regRes.success || !regRes.registration) {
            setSelectedCourseIds(crsRes.courses.map((c: Course) => c.id));
          }
        }

        if (regRes.success && regRes.registration) {
          setCurrentReg(regRes.registration);
          setSelectedCourseIds(regRes.registration.courseIds || []);
        }

        if (resRes.success) setResults(resRes.results);
        if (invRes.success) setInvoices(invRes.invoices);
        if (docRes.success) setIssuedDocs(docRes.documents);
      }
    } catch (err: any) {
      console.error('Failed to load student details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, [user]);

  // A submitted registration is locked until an authorised officer rejects it.
  const isRegistrationLocked = Boolean(currentReg && currentReg.status !== 'REJECTED');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file, { maxDimension: 480, quality: 0.85 });
      const res = await api.updateProfile({ photoUrl: dataUrl });
      if (res.success) {
        setStudent((prev) => (prev ? { ...prev, photoUrl: dataUrl } : prev));
        await refreshUserData();
        setStatusMessage('Passport photograph updated across your ID card, slips, and official records.');
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to update passport photograph.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCourse = (id: string) => {
    if (isRegistrationLocked) return;
    if (selectedCourseIds.includes(id)) {
      setSelectedCourseIds(selectedCourseIds.filter((cid) => cid !== id));
    } else {
      setSelectedCourseIds([...selectedCourseIds, id]);
    }
  };

  const handleRegisterCourses = async () => {
    if (isRegistrationLocked) {
      setStatusMessage('Your course registration has already been submitted and is locked pending review.');
      return;
    }
    if (selectedCourseIds.length === 0) {
      setStatusMessage('Please select at least one course.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.registerCourses(selectedCourseIds);
      if (res.success) {
        setCurrentReg(res.registration);
        setSelectedCourseIds(res.registration.courseIds || selectedCourseIds);
        setStatusMessage(
          'Course registration submitted successfully! Awaiting Examination Officer approval.'
        );
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string, openReceipt = true) => {
    setLoading(true);
    try {
      const res = await api.payInvoice(invoiceId, 'Remita');
      if (res.success) {
        setStatusMessage('Payment settled and verified via Remita. Document & receipt unlocked!');
        await loadStudentData();
        if (openReceipt) {
          onOpenPrintModal('PAYMENT_RECEIPT', res.transaction);
        }
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  const totalSelectedCredits = eligibleCourses
    .filter((c) => selectedCourseIds.includes(c.id))
    .reduce((sum, c) => sum + c.creditUnits, 0);

  const filteredCourses = eligibleCourses.filter((c) => {
    if (courseSemesterFilter && c.semester !== courseSemesterFilter) return false;
    return matchesWildcard(courseWildcard, c.code, c.title, c.lecturerName, c.level, c.semester);
  });

  const filteredResults = results.filter((r) => {
    if (resultGradeFilter && r.grade !== resultGradeFilter) return false;
    const crs = eligibleCourses.find((c) => c.id === r.courseId);
    return matchesWildcard(
      resultWildcard,
      crs?.code,
      crs?.title,
      r.courseId,
      r.grade,
      r.session,
      r.semester
    );
  });

  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter && inv.status !== invoiceStatusFilter) return false;
    return matchesWildcard(invoiceWildcard, inv.invoiceNumber, inv.title, inv.session, inv.status);
  });

  const resolvedPhoto = student?.photoUrl || user?.photoUrl || '';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Student Banner */}
      <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-wrap items-center justify-between gap-6 border border-emerald-800">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-20 h-24 rounded-2xl bg-emerald-800 text-amber-300 flex items-center justify-center font-bold text-3xl border-2 border-amber-400 shadow-md overflow-hidden">
              {resolvedPhoto ? (
                <img
                  src={resolvedPhoto}
                  alt={student?.fullName || user?.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>🎓</span>
              )}
            </div>
            <label
              title="Upload / Update Passport Photograph"
              className="absolute -bottom-2 -right-2 bg-amber-400 hover:bg-amber-300 text-slate-950 p-1.5 rounded-lg shadow-md cursor-pointer transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-400 text-slate-950 uppercase">
                {student?.level || 'ND I'} Student
              </span>
              <span className="text-xs text-emerald-300 font-semibold">
                Status: {student?.academicStatus || 'Good Standing'}
              </span>
            </div>
            <h1 className="text-2xl font-bold mt-1 text-white uppercase tracking-tight">
              {student?.fullName || user?.fullName}
            </h1>
            <p className="text-xs text-emerald-200 font-mono mt-0.5">
              Matriculation No: <strong>{student?.matricNumber || 'EDOCASTI/ND/2024/0101'}</strong>
            </p>
            <p className="text-xs text-emerald-300/80 mt-0.5">
              {student?.programmeName || 'National Diploma Programme'} • {student?.departmentName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white/10 px-5 py-3 rounded-2xl backdrop-blur-xs border border-white/10">
          <div className="text-right">
            <span className="text-xs text-emerald-200 block uppercase font-semibold">Cumulative GPA</span>
            <span className="text-2xl font-black text-amber-400 tabular-nums">
              {Number(student?.cgpa || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-300 block">Scale: 5.00</span>
          </div>
          <div className="h-10 w-[1px] bg-white/20"></div>
          <div className="text-right">
            <span className="text-xs text-emerald-200 block uppercase font-semibold">Session</span>
            <span className="text-sm font-bold text-white">{settings?.currentSession || '2025/2026'}</span>
            <span className="text-[10px] text-emerald-300 block">{settings?.currentSemester}</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer">✕</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'courses', label: 'Course Enrolment & Slips', icon: BookOpen },
          { id: 'results', label: 'Exam Results', icon: Award },
          { id: 'documents', label: 'Admission Letter & Other Documents', icon: FileText },
          { id: 'finance', label: 'Bursary Fees & Payments', icon: CreditCard },
          { id: 'idcard', label: 'Student ID Card (Flippable)', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-emerald-800 text-white dark:bg-emerald-700 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Section 1: Course Registration */}
      {activeSection === 'courses' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {settings?.currentSession} Course Registration Register
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isRegistrationLocked
                  ? 'Your submitted course selection is locked while it is awaiting review or has been approved.'
                  : 'Select your departmental courses and submit for Examination Officer approval.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg tabular-nums">
                Selected: {totalSelectedCredits} Credit Units
              </span>

              {currentReg && (
                <button
                  onClick={() =>
                    onOpenPrintModal('COURSE_REGISTRATION', {
                      ...currentReg,
                      student: { ...student, photoUrl: resolvedPhoto },
                      totalCredits: currentReg.totalCredits,
                      coursesList: eligibleCourses.filter((c) => currentReg.courseIds.includes(c.id)),
                    })
                  }
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" /> Print / Download Slip
                </button>
              )}
            </div>
          </div>

          <WildcardFilterBar
            query={courseWildcard}
            onQueryChange={setCourseWildcard}
            placeholder="Wildcard filter courses (e.g. AGT*, *Soil*, *Obanor*)..."
            totalCount={eligibleCourses.length}
            filteredCount={filteredCourses.length}
            facets={[
              {
                key: 'semester',
                label: 'Semester',
                value: courseSemesterFilter,
                onChange: setCourseSemesterFilter,
                options: [
                  { value: 'First Semester', label: 'First Semester' },
                  { value: 'Second Semester', label: 'Second Semester' },
                ],
              },
            ]}
          />

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                <tr>
                  <th className="p-3 w-10">Select</th>
                  <th className="p-3">Course Code</th>
                  <th className="p-3">Course Title</th>
                  <th className="p-3 text-center">Units</th>
                  <th className="p-3">Assigned Lecturer</th>
                  <th className="p-3">Level / Semester</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredCourses.map((crs) => {
                  const isChecked = selectedCourseIds.includes(crs.id);
                  return (
                    <tr
                      key={crs.id}
                      className={`transition ${
                        isChecked
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isRegistrationLocked}
                          onChange={() => toggleCourse(crs.id)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold font-mono text-emerald-900 dark:text-emerald-400">{crs.code}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">{crs.title}</td>
                      <td className="p-3 text-center font-bold tabular-nums">{crs.creditUnits}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{crs.lecturerName || 'Faculty Assigned'}</td>
                      <td className="p-3 text-slate-500 dark:text-slate-400">
                        {crs.level} • {crs.semester}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Registration Status:{' '}
              <strong className="text-emerald-800 dark:text-emerald-400">
                {currentReg?.status === 'APPROVED_BY_EXAM_OFFICER' || currentReg?.status === 'APPROVED_BY_HOD'
                  ? (currentReg?.status === 'APPROVED_BY_HOD' ? 'APPROVED BY HOD' : 'APPROVED BY EXAM OFFICER')
                  : currentReg?.status || 'NOT_SUBMITTED'}
              </strong>
            </div>

            {!isRegistrationLocked && (
              <button
                onClick={handleRegisterCourses}
                disabled={loading}
                className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-sm transition"
              >
                <Send className="w-4 h-4" /> Submit Course Registration to Exam Officer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Exam Results */}
      {activeSection === 'results' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Published Academic Results &amp; Continuous Assessment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Only Examination Officer approved and published grades are visible here.
              </p>
            </div>

            {results.length > 0 && (
              <button
                onClick={() =>
                  onOpenPrintModal('RESULT_SLIP', {
                    student: { ...student, photoUrl: resolvedPhoto },
                    resultsList: results.map((r) => {
                      const crs = eligibleCourses.find((c) => c.id === r.courseId);
                      return { ...r, courseCode: crs?.code || r.courseId, courseTitle: crs?.title || 'Course' };
                    }),
                  })
                }
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" /> Print / Download Result Slip
              </button>
            )}
          </div>

          <WildcardFilterBar
            query={resultWildcard}
            onQueryChange={setResultWildcard}
            placeholder="Wildcard filter results (e.g. AGT*, *Agronomy*, 2025/*)..."
            totalCount={results.length}
            filteredCount={filteredResults.length}
            facets={[
              {
                key: 'grade',
                label: 'Grade',
                value: resultGradeFilter,
                onChange: setResultGradeFilter,
                options: ['A', 'B', 'C', 'D', 'E', 'F'].map((g) => ({ value: g, label: `Grade ${g}` })),
              },
            ]}
          />

          {filteredResults.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 text-white uppercase text-[11px]">
                  <tr>
                    <th className="p-3">Course Code</th>
                    <th className="p-3">Course Title</th>
                    <th className="p-3 text-center">CA ({settings?.caMaxMarks || 40})</th>
                    <th className="p-3 text-center">Exam ({settings?.examMaxMarks || 60})</th>
                    <th className="p-3 text-center">Total (100)</th>
                    <th className="p-3 text-center">Grade</th>
                    <th className="p-3 text-center">Grade Point</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {filteredResults.map((r) => {
                    const crs = eligibleCourses.find((c) => c.id === r.courseId);
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">{crs?.code || r.courseId}</td>
                        <td className="p-3 text-slate-800 dark:text-slate-100 font-medium">{crs?.title || 'Academic Course'}</td>
                        <td className="p-3 text-center">{r.caScore}</td>
                        <td className="p-3 text-center">{r.examScore}</td>
                        <td className="p-3 text-center font-bold">{r.totalScore}</td>
                        <td className="p-3 text-center font-black text-emerald-800 dark:text-emerald-400 text-sm">{r.grade}</td>
                        <td className="p-3 text-center font-bold">{r.gradePoint.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs space-y-2">
              <p>No published examination results matching your filter yet.</p>
              <p className="text-slate-400">Results appear once entered by your Lecturer and approved by the Examination Officer.</p>
            </div>
          )}
        </div>
      )}

      {/* Section 3: Payment-Gated Transcripts & Final Certificates */}
      {activeSection === 'documents' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Official Admission Letter, Transcripts &amp; Final Certificates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Your admission letter is available without a fee after admission is accepted. Transcripts and final certificates are issued by the Registrar and may require payment.
            </p>
          </div>

          {issuedDocs.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-bold text-slate-700 dark:text-slate-200">No Official Documents Available Yet</div>
              <p>
                Your admission letter will appear here after your admission is accepted. Transcripts and final certificates will appear when issued by the{' '}
                <strong>Office of the Registrar</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {issuedDocs.map((doc) => {
                const isAdmissionLetter = String(doc.type) === 'ADMISSION_LETTER';
                const cgpaValue = Number(doc.cgpa);
                const feeValue = Number(doc.feeAmount);
                const hasValidCgpa = Number.isFinite(cgpaValue);
                const hasValidFee = Number.isFinite(feeValue);
                const isPaid = isAdmissionLetter || doc.paymentStatus === 'PAID' || String(doc.paymentStatus) === 'UNLOCKED';
                return (
                  <div
                    key={doc.id}
                    className={`p-5 rounded-2xl border space-y-4 flex flex-col justify-between ${
                      isPaid
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-900 dark:text-emerald-400">
                          {doc.documentNumber}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                          }`}
                        >
                          {isPaid ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {isAdmissionLetter ? 'AVAILABLE • NO FEE' : isPaid ? 'PAID • UNLOCKED' : 'PAYMENT REQUIRED'}
                        </span>
                      </div>

                      <h3 className="font-black text-base text-slate-900 dark:text-white">{doc.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Programme: <strong>{doc.programmeName}</strong> • Classification: <strong>{doc.classification}</strong>
                      </p>
                      {!isAdmissionLetter && (hasValidCgpa || hasValidFee) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {hasValidCgpa && (
                            <>
                              CGPA: <strong>{cgpaValue.toFixed(2)}</strong>
                            </>
                          )}
                          {hasValidCgpa && hasValidFee && ' â€¢ '}
                          {hasValidFee && (
                            <>
                              Fee: <strong>â‚¦{feeValue.toLocaleString('en-NG')}</strong>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                      {isPaid ? (
                        <button
                          onClick={() =>
                            onOpenPrintModal(doc.type, {
                              ...doc,
                              photoUrl: doc.photoUrl || resolvedPhoto,
                              student,
                            })
                          }
                          className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Download className="w-4 h-4" /> View, Print &amp; Download {
                            String(doc.type) === 'ADMISSION_LETTER'
                              ? 'Admission Letter'
                              : doc.type === 'TRANSCRIPT'
                                ? 'Transcript'
                                : 'Certificate'
                          }
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePayInvoice(doc.invoiceId, false)}
                          disabled={loading}
                          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <CreditCard className="w-4 h-4" /> Pay ₦{Number(doc.feeAmount).toLocaleString('en-NG')} to Unlock Document
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Finance & Invoices */}
      {activeSection === 'finance' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Student Fee Invoices &amp; Bursary Clearance</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Settle tuition, transcript, certificate, and departmental levies securely via Remita.
            </p>
          </div>

          <WildcardFilterBar
            query={invoiceWildcard}
            onQueryChange={setInvoiceWildcard}
            placeholder="Wildcard filter invoices (*Tuition*, *Transcript*, INV/2025/*)..."
            totalCount={invoices.length}
            filteredCount={filteredInvoices.length}
            facets={[
              {
                key: 'status',
                label: 'Status',
                value: invoiceStatusFilter,
                onChange: setInvoiceStatusFilter,
                options: ['UNPAID', 'PARTIAL', 'PAID'].map((s) => ({ value: s, label: s })),
              },
            ]}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">{inv.invoiceNumber}</span>
                    <span
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full ${
                        inv.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-2">{inv.title}</h3>
                  <div className="text-2xl font-black text-emerald-950 dark:text-emerald-400 mt-1 tabular-nums">
                    ₦{inv.amount.toLocaleString('en-NG')}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Due Date: {inv.dueDate}</div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  {inv.status === 'PAID' ? (
                    <button
                      onClick={() =>
                        onOpenPrintModal('PAYMENT_RECEIPT', {
                          reference: `EDOCASTI-TX-${inv.id.slice(-6)}`,
                          amount: inv.amount,
                          paidAt: inv.createdAt,
                          channel: 'Remita Verified',
                          providerReference: 'RRR-8819-201',
                        })
                      }
                      className="w-full py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" /> Print / Download Receipt
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePayInvoice(inv.id)}
                      disabled={loading}
                      className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <CreditCard className="w-4 h-4" /> Pay ₦{inv.amount.toLocaleString('en-NG')} via Remita
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Flippable Student ID Card */}
      {activeSection === 'idcard' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div className="text-center">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Student Identity Verification Card</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click the ID card below to rotate between Front and Back sides. Upload your passport photo above if not yet set.
            </p>
          </div>

          <StudentIdCard
            student={{ ...(student || {}), fullName: student?.fullName || user?.fullName, photoUrl: resolvedPhoto }}
            settings={settings}
            interactive={true}
          />

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <label className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Update ID Passport Photo
              <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            </label>
            <button
              onClick={() => onOpenPrintModal('STUDENT_ID', { student: { ...(student || {}), photoUrl: resolvedPhoto } })}
              className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" /> Print / Download Full ID Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
