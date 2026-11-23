import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle, Shield, Award } from 'lucide-react';
import { InstitutionSettings } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { StudentIdCard } from './StudentIdCard';

export type PrintDocumentType =
  | 'ADMISSION_LETTER'
  | 'COURSE_REGISTRATION'
  | 'PAYMENT_RECEIPT'
  | 'RESULT_SLIP'
  | 'STUDENT_ID'
  | 'TRANSCRIPT'
  | 'FINAL_CERTIFICATE';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: PrintDocumentType;
  data: any;
  settings: InstitutionSettings | null;
}

export const PrintSlipModal: React.FC<Props> = ({ isOpen, onClose, type, data, settings }) => {
  const docRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !data) return null;

  const institutionName =
    settings?.institutionName || 'Edo State College of Agriculture, Science and Technology, Iguoriakhi';
  const shortName = settings?.shortName || 'EDOCASTI';
  const currentSession = settings?.currentSession || '2025/2026';

  const person = data.student || data.applicant || data;

  const studentPhoto = data.photoUrl || person.photoUrl || '';
  const studentName =
    person.fullName ||
    data.fullName ||
    data.studentName ||
    [person.firstName || data.firstName, person.lastName || data.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Student';
  const matricNumber =
    person.matricNumber ||
    data.matricNumber ||
    data.applicationNumber ||
    '';

  const admissionReference =
    data.applicationNumber ||
    person.applicationNumber ||
    data.documentNumber ||
    data.reference ||
    matricNumber ||
    'N/A';

  const admissionFirstName =
    person.firstName ||
    data.firstName ||
    studentName.split(' ')[0] ||
    'Applicant';

  const admissionLastName =
    person.lastName ||
    data.lastName ||
    '';

  const admissionProgramme =
    person.programmeName ||
    data.programmeName ||
    person.programme?.name ||
    data.programme?.name ||
    'National Diploma in Agricultural Technology';

  const admissionSession =
    data.session ||
    person.session ||
    currentSession;

  const admissionDate =
    data.decisionAt ||
    data.generatedAt ||
    person.decisionAt ||
    person.createdAt;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const htmlContent = docRef.current?.innerHTML || '';
    const title = `${shortName}_${type}_${(matricNumber || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; background: #ffffff; color: #0f172a; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div style="max-width: 820px; margin: 0 auto;">${htmlContent}</div>
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderOfficialSignature = (
    sigUrl: string | undefined,
    fallbackText: string,
    signerName: string,
    signerTitle: string
  ) => (
    <div className="text-center min-w-[160px]">
      <div className="h-12 flex items-end justify-center pb-1">
        {sigUrl ? (
          <img src={sigUrl} alt={signerTitle} className="max-h-11 object-contain" />
        ) : (
          <span className="font-serif italic text-lg text-slate-700">{fallbackText}</span>
        )}
      </div>
      <div className="border-t border-slate-400 pt-1 font-bold text-xs uppercase text-slate-900">
        {signerName}
      </div>
      <div className="text-[11px] text-slate-500">{signerTitle}</div>
    </div>
  );

  const renderOfficialStamp = () => (
    <div className="flex flex-col items-center justify-center">
      {settings?.schoolStampUrl ? (
        <img
          src={settings.schoolStampUrl}
          alt="Official School Stamp"
          className="w-24 h-24 object-contain"
        />
      ) : (
        <div className="w-24 h-24 rounded-full border-2 border-dashed border-emerald-800 flex flex-col items-center justify-center text-[9px] font-black text-emerald-900 uppercase text-center p-2 -rotate-6">
          <span>{shortName}</span>
          <span>OFFICIAL SEAL</span>
          <span>IGUORIAKHI</span>
        </div>
      )}
    </div>
  );

  const renderPassportBox = (label = 'Candidate Photo') => (
    <div className="w-24 h-28 rounded-xl border-2 border-emerald-800 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
      {studentPhoto ? (
        <img src={studentPhoto} alt={studentName} className="w-full h-full object-cover" />
      ) : (
        <div className="text-center p-2 text-[9px] font-bold text-slate-400 uppercase">{label}</div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <style>{`
        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          #printable-slip,
          #printable-slip * {
            visibility: visible !important;
          }

          #printable-slip {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            color: #0f172a !important;
          }

          .no-print {
            display: none !important;
          }

          tr, img {
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Modal Controls (Not printed) */}
        <div className="no-print p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Official Institutional Document Viewer
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Download Document
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div ref={docRef} className="p-6 sm:p-8 overflow-y-auto print:p-0 print:m-0 bg-white text-slate-900" id="printable-slip">
          {/* Institution Official Letterhead */}
          <div className="border-b-2 border-emerald-800 pb-4 text-center relative">
            <SchoolLogo size={68} className="mx-auto mb-2 shadow-xs" />
            <h1 className="text-xl font-black uppercase text-emerald-900 tracking-wide">
              {institutionName}
            </h1>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mt-0.5">
              {settings?.address || 'Iguoriakhi Main Campus, Edo State, Nigeria'}
            </p>
            <p className="text-[11px] text-slate-600 italic mt-0.5">
              &ldquo;{settings?.motto || 'Knowledge, Innovation & Food Security'}&rdquo;
            </p>
            <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap justify-center gap-3">
              <span>Email: {settings?.contactEmail || 'info@edocasti.edu.ng'}</span>
              <span>•</span>
              <span>Web: www.edocasti.edu.ng</span>
              <span>•</span>
              <span>Phone: {settings?.contactPhone || '+234 800 336 2278'}</span>
            </div>
          </div>

          {type === 'ADMISSION_LETTER' && (
            <div className="mt-6 space-y-4 text-slate-800 text-sm">
              <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-slate-500 uppercase block font-semibold">
                      Admission Reference:
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {admissionReference}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 uppercase block font-semibold">
                      Date of Offer:
                    </span>
                    <span className="font-semibold">
                      {admissionDate
                        ? new Date(admissionDate).toLocaleDateString('en-GB')
                        : 'Date not available'}
                    </span>
                  </div>
                </div>
                {renderPassportBox('Applicant Photo')}
              </div>

              <div className="text-center py-2">
                <h2 className="text-lg font-bold text-slate-900 uppercase underline tracking-wide">
                  Provisional Offer of Admission ({admissionSession})
                </h2>
              </div>

              <p>
                Dear{' '}
                <strong className="uppercase">
                  {admissionFirstName} {admissionLastName}
                </strong>,
              </p>

              <p className="leading-relaxed">
                I am pleased to inform you that following your satisfactory
                performance in the admissions screening exercise, the
                Admissions Committee and the Academic Board have offered you
                provisional admission into <strong>{institutionName}</strong>{' '}
                for the <strong>{admissionSession}</strong> academic session.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-200">
                <div>
                  <div className="text-xs text-slate-500">Admitted Programme:</div>
                  <div className="font-bold text-slate-900">
                    {admissionProgramme}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Campus / Registry:</div>
                  <div className="font-bold text-slate-900">
                    Iguoriakhi Main Campus
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">State / LGA:</div>
                  <div className="font-bold text-slate-900">
                    {person.stateOfOrigin || data.stateOfOrigin || 'Edo State'}
                    {' '}(
                    {person.lga || data.lga || 'Ovia South-West'})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Study Mode:</div>
                  <div className="font-bold text-slate-900">Full-Time</div>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                <div className="font-bold text-amber-900 uppercase">
                  Conditions of Admission:
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    This offer is provisional and subject to physical
                    verification of original WAEC/NECO certificates.
                  </li>
                  <li>
                    Acceptance and portal migration activate your
                    Matriculation Number and Student Profile.
                  </li>
                  <li>
                    Any false declaration automatically nullifies this
                    admission offer.
                  </li>
                </ul>
              </div>

              <div className="pt-4 flex flex-wrap justify-between items-end gap-4 border-t border-slate-200 mt-6">
                {renderOfficialSignature(
                  settings?.registrarSignatureUrl,
                  'Itohan Edokpayi',
                  'Barr. Itohan Edokpayi',
                  `Registrar, ${shortName}`
                )}
                {renderOfficialStamp()}
              </div>
            </div>
          )}

          {type === 'COURSE_REGISTRATION' && (
            <div className="mt-6 space-y-4 text-slate-800 text-sm">
              <div className="text-center py-1">
                <h2 className="text-base font-bold text-slate-900 uppercase underline">
                  Official Course Registration &amp; Examination Clearance Slip
                </h2>
                <p className="text-xs text-slate-600">{data.session || currentSession} | {data.semester || settings?.currentSemester}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
                  <div>
                    <span className="text-slate-500 block">Student Name:</span>
                    <span className="font-bold text-slate-900 uppercase">{studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Matriculation No:</span>
                    <span className="font-mono font-bold text-emerald-800">{matricNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Programme:</span>
                    <span className="font-bold text-slate-900">{person.programmeName || 'Agricultural Technology'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Study Level:</span>
                    <span className="font-bold text-slate-900">{person.level || data.level || 'ND I'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Clearance Status:</span>
                    <span className="font-bold text-emerald-700">
                      {data.status === 'APPROVED_BY_EXAM_OFFICER' || data.status === 'APPROVED_BY_HOD'
                        ? 'APPROVED BY EXAM OFFICER'
                        : data.status || 'SUBMITTED'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Credit Units:</span>
                    <span className="font-bold text-slate-900">{data.totalCredits || 0} Units</span>
                  </div>
                </div>
                {renderPassportBox('Student Photo')}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-900 text-white uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">S/N</th>
                      <th className="p-2.5">Course Code</th>
                      <th className="p-2.5">Course Title</th>
                      <th className="p-2.5 text-center">Units</th>
                      <th className="p-2.5">Lecturer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.coursesList?.map((crs: any, i: number) => (
                      <tr key={crs.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2.5 font-medium">{i + 1}</td>
                        <td className="p-2.5 font-bold font-mono text-emerald-800">{crs.code}</td>
                        <td className="p-2.5">{crs.title}</td>
                        <td className="p-2.5 text-center font-bold">{crs.creditUnits}</td>
                        <td className="p-2.5 text-slate-600">{crs.lecturerName || 'Assigned Faculty'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap justify-between items-end gap-4 pt-4 border-t border-slate-200 text-xs">
                {renderOfficialSignature(
                  settings?.registrarSignatureUrl,
                  'Exam Office Controller',
                  data.approvedBy || 'Examination Officer',
                  'Exam Officer / Registry Clearance'
                )}
                {renderOfficialStamp()}
              </div>
            </div>
          )}

          {type === 'PAYMENT_RECEIPT' && (
            <div className="mt-6 space-y-4 text-slate-800 text-sm">
              <div className="text-center py-1">
                <h2 className="text-base font-bold text-emerald-900 uppercase underline">
                  Official Bursary Electronic Payment Receipt
                </h2>
                <p className="text-xs text-slate-600 font-mono">Reference: {data.reference}</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs text-emerald-800 font-semibold uppercase">Amount Paid</div>
                  <div className="text-2xl font-black text-emerald-900 tabular-nums">
                    ₦{Number(data.amount).toLocaleString('en-NG')}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Status: VERIFIED &amp; CLEARED</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-emerald-200 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                  <span className="text-[10px] font-bold text-slate-600 mt-1 block">ELECTRONIC CONFIRMATION</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Payment Channel:</span>
                  <span className="font-semibold text-slate-900">{data.channel || 'Remita'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Provider Ref:</span>
                  <span className="font-mono font-semibold text-slate-900">{data.providerReference || 'RRR-9201-9281'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Date of Payment:</span>
                  <span className="font-semibold text-slate-900">{new Date(data.paidAt || Date.now()).toLocaleString('en-GB')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reconciled By:</span>
                  <span className="font-semibold text-slate-900">{data.verifiedBy || 'Bursary Revenue Reconciler'}</span>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-end border-t border-slate-200 text-xs">
                {renderOfficialSignature(
                  settings?.bursarSignatureUrl,
                  'Festus Ojo (FCA)',
                  'Mr. Festus Ojo (FCA)',
                  'Bursar / Chief Finance Officer'
                )}
                {renderOfficialStamp()}
              </div>
            </div>
          )}

          {type === 'RESULT_SLIP' && (
            <div className="mt-6 space-y-4 text-slate-800 text-sm">
              <div className="text-center py-1">
                <h2 className="text-base font-bold text-slate-900 uppercase underline">
                  Official Statement of Academic Results
                </h2>
                <p className="text-xs text-slate-600">{currentSession} Session | Approved by Examination Office &amp; Senate</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                  <div>
                    <span className="text-slate-500 block">Student Name:</span>
                    <span className="font-bold text-slate-900 uppercase">{studentName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Matriculation No:</span>
                    <span className="font-mono font-bold text-emerald-800">{matricNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Current CGPA:</span>
                    <span className="font-black text-emerald-800 text-sm tabular-nums">{Number(person.cgpa || data.cgpa || 0).toFixed(2)} / 5.00</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Academic Standing:</span>
                    <span className="font-bold text-emerald-700">{person.academicStatus || data.academicStatus || 'Good Standing'}</span>
                  </div>
                </div>
                {renderPassportBox('Student Photo')}
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800 text-white uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Course Code</th>
                      <th className="p-2.5">Course Title</th>
                      <th className="p-2.5 text-center">CA ({settings?.caMaxMarks || 40})</th>
                      <th className="p-2.5 text-center">Exam ({settings?.examMaxMarks || 60})</th>
                      <th className="p-2.5 text-center">Total (100)</th>
                      <th className="p-2.5 text-center">Grade</th>
                      <th className="p-2.5 text-center">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 tabular-nums">
                    {data.resultsList?.map((r: any, i: number) => (
                      <tr key={r.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2.5 font-bold font-mono text-emerald-800">{r.courseCode || r.courseId}</td>
                        <td className="p-2.5">{r.courseTitle || 'Academic Course'}</td>
                        <td className="p-2.5 text-center">{r.caScore}</td>
                        <td className="p-2.5 text-center">{r.examScore}</td>
                        <td className="p-2.5 text-center font-bold">{r.totalScore}</td>
                        <td className="p-2.5 text-center font-black text-emerald-800">{r.grade}</td>
                        <td className="p-2.5 text-center font-bold">{r.gradePoint?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-4 flex flex-wrap justify-between items-end gap-4 border-t border-slate-200 text-xs">
                {renderOfficialSignature(
                  settings?.registrarSignatureUrl,
                  'Dr. O. Iyoha',
                  'Examination Officer & Registrar',
                  'Academic Results Authority'
                )}
                {renderOfficialStamp()}
              </div>
            </div>
          )}

          {type === 'TRANSCRIPT' && (
            <div className="mt-6 space-y-5 text-slate-800 text-sm">
              <div className="flex flex-wrap justify-between items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Office of the Registrar • Academic Records Division
                  </span>
                  <h2 className="text-xl font-black text-slate-900 uppercase mt-0.5">
                    Official Academic Transcript
                  </h2>
                  <p className="text-xs font-mono text-slate-600">
                    Transcript Ref: <strong>{data.documentNumber}</strong> • Issued: {new Date(data.generatedAt || Date.now()).toLocaleDateString('en-GB')}
                  </p>
                </div>
                {renderPassportBox('Student Photo')}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">Full Name:</span>
                  <span className="font-bold text-slate-900 uppercase">{data.studentName || studentName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Matriculation No:</span>
                  <span className="font-mono font-bold text-emerald-800">{data.matricNumber || matricNumber}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Programme:</span>
                  <span className="font-bold text-slate-900">{data.programmeName || person.programmeName || 'Agricultural Technology'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department / School:</span>
                  <span className="font-bold text-slate-900">{data.departmentName || data.schoolName || 'Applied Sciences & Tech'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Cumulative GPA (CGPA):</span>
                  <span className="font-black text-emerald-800 tabular-nums">{Number(data.cgpa || person.cgpa || 0).toFixed(2)} / 5.00</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Honours Classification:</span>
                  <span className="font-bold text-amber-700">{data.classification || 'Upper Credit'}</span>
                </div>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-900 text-white uppercase text-[11px]">
                    <tr>
                      <th className="p-2.5">Session / Semester</th>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Course Title</th>
                      <th className="p-2.5 text-center">Units</th>
                      <th className="p-2.5 text-center">Score</th>
                      <th className="p-2.5 text-center">Grade</th>
                      <th className="p-2.5 text-center">GP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 tabular-nums">
                    {data.resultsSnapshot && data.resultsSnapshot.length > 0 ? (
                      data.resultsSnapshot.map((r: any, idx: number) => (
                        <tr key={r.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-2.5 text-slate-600">{r.session} ({r.semester})</td>
                          <td className="p-2.5 font-mono font-bold text-emerald-900">{r.courseCode}</td>
                          <td className="p-2.5">{r.courseTitle}</td>
                          <td className="p-2.5 text-center">{r.creditUnits || 3}</td>
                          <td className="p-2.5 text-center font-bold">{r.totalScore}</td>
                          <td className="p-2.5 text-center font-black text-emerald-800">{r.grade}</td>
                          <td className="p-2.5 text-center">{Number(r.gradePoint || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-slate-500">
                          No published course results recorded yet for this student.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data.remarks && (
                <div className="text-xs bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-emerald-950">
                  <strong>Registrar Remarks:</strong> {data.remarks}
                </div>
              )}

              <div className="pt-4 flex flex-wrap justify-between items-end gap-4 border-t border-slate-200">
                {renderOfficialSignature(
                  settings?.registrarSignatureUrl,
                  'Barr. I. Edokpayi',
                  'Barr. Itohan Edokpayi',
                  'College Registrar'
                )}
                {renderOfficialStamp()}
                {renderOfficialSignature(
                  settings?.rectorSignatureUrl,
                  'Prof. P. O. Aghimien',
                  'Prof. Patrick O. Aghimien',
                  'Rector / Provost'
                )}
              </div>
            </div>
          )}

          {type === 'FINAL_CERTIFICATE' && (
            <div className="mt-6 border-4 border-double border-emerald-900 p-6 sm:p-8 rounded-2xl bg-linear-to-b from-amber-50/40 via-white to-emerald-50/30 space-y-6 text-center">
              <div className="flex items-center justify-between gap-4">
                <div className="text-left text-[10px] font-mono text-slate-600">
                  <div>CERT NO: <strong>{data.documentNumber}</strong></div>
                  <div>MATRIC: <strong>{data.matricNumber || matricNumber}</strong></div>
                </div>
                <Award className="w-10 h-10 text-amber-600" />
                {renderPassportBox('Graduate Photo')}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-800">
                  By Authority of the Academic Board
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">
                  Final Graduation Certificate
                </h2>
                <p className="text-xs text-slate-600">This is to certify that</p>
                <div className="text-2xl font-black text-emerald-900 uppercase tracking-wide py-1 border-b-2 border-amber-400 inline-block px-6">
                  {data.studentName || studentName}
                </div>
              </div>

              <p className="text-sm text-slate-700 leading-relaxed max-w-2xl mx-auto">
                having completed the prescribed course of study, practical field requirements, and passed all
                approved examinations in <strong>{institutionName}</strong>, is hereby awarded the qualification in
              </p>

              <div className="space-y-1">
                <div className="text-xl font-black text-slate-900 uppercase">
                  {data.programmeName || person.programmeName || 'Agricultural Technology'}
                </div>
                <div className="text-sm font-bold text-amber-700 uppercase tracking-wider">
                  Classification: {data.classification || 'Upper Credit'} • CGPA: {Number(data.cgpa || person.cgpa || 0).toFixed(2)} / 5.00
                </div>
                <div className="text-xs text-slate-500">
                  Academic Session: {data.session || currentSession} • Awarded on {new Date(data.generatedAt || Date.now()).toLocaleDateString('en-GB')}
                </div>
              </div>

              <div className="pt-6 flex flex-wrap justify-between items-end gap-4 border-t border-slate-300">
                {renderOfficialSignature(
                  settings?.rectorSignatureUrl,
                  'Prof. P. O. Aghimien',
                  'Prof. Patrick O. Aghimien',
                  'Rector / Provost'
                )}
                {renderOfficialStamp()}
                {renderOfficialSignature(
                  settings?.registrarSignatureUrl,
                  'Barr. I. Edokpayi',
                  'Barr. Itohan Edokpayi',
                  'College Registrar'
                )}
              </div>
            </div>
          )}

          {type === 'STUDENT_ID' && (
            <div className="mt-6 space-y-6">
              <div className="no-print text-center text-xs text-slate-500">
                Click the ID card below to rotate between Front and Back views. Both sides are included when printing or downloading.
              </div>
              <div className="no-print">
                <StudentIdCard
                  student={{ ...(data.student || data), photoUrl: studentPhoto }}
                  settings={settings}
                  interactive={true}
                />
              </div>
              <div className="hidden print:grid grid-cols-1 gap-6">
                <StudentIdCard
                  student={{ ...(data.student || data), photoUrl: studentPhoto }}
                  settings={settings}
                  forceSide="front"
                  interactive={false}
                />
                <StudentIdCard
                  student={{ ...(data.student || data), photoUrl: studentPhoto }}
                  settings={settings}
                  forceSide="back"
                  interactive={false}
                />
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-[10px] text-slate-400 text-center">
            Official System Record generated from the {shortName} Integrated School Management Portal. Verify via portal.edocasti.edu.ng.
          </div>
        </div>
      </div>
    </div>
  );
};
