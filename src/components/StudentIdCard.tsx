import React, { useState } from 'react';
import { InstitutionSettings, Student } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { RotateCw, ShieldCheck, Phone, UserCheck } from 'lucide-react';

interface Props {
  student: Partial<Student> & {
    fullName?: string;
    matricNumber?: string;
    programmeName?: string;
    departmentName?: string;
    level?: string;
    photoUrl?: string;
  };
  settings?: InstitutionSettings | null;
  forceSide?: 'front' | 'back';
  interactive?: boolean;
  className?: string;
}

export const StudentIdCard: React.FC<Props> = ({
  student,
  settings,
  forceSide,
  interactive = true,
  className = '',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipped = forceSide ? forceSide === 'back' : isFlipped;

  const photo = student.photoUrl;
  const initials = (student.fullName || 'ST')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`w-full max-w-[440px] mx-auto select-none ${className}`}>
      {interactive && !forceSide && (
        <div className="flex items-center justify-between mb-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">
            {flipped ? 'Back View — Security, Stamp & Emergency Bio' : 'Front View — Student Identity Credential'}
          </span>
          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
          >
            <RotateCw className="w-3.5 h-3.5" /> Click card to flip
          </button>
        </div>
      )}

      <div
        onClick={() => {
          if (interactive && !forceSide) setIsFlipped((prev) => !prev);
        }}
        role={interactive && !forceSide ? 'button' : undefined}
        tabIndex={interactive && !forceSide ? 0 : undefined}
        onKeyDown={(e) => {
          if (interactive && !forceSide && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsFlipped((prev) => !prev);
          }
        }}
        style={{ perspective: '1200px' }}
        className={`w-full aspect-[1.586/1] ${interactive && !forceSide ? 'cursor-pointer' : ''}`}
      >
        <div
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
          className="relative w-full h-full"
        >
          {/* FRONT SIDE */}
          <div
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl border-2 border-emerald-900 bg-linear-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white p-4 sm:p-5 flex flex-col justify-between"
          >
            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
              <SchoolLogo size={200} variant="watermark" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-emerald-700/60 pb-2.5 relative z-10">
              <div className="flex items-center gap-2.5">
                <SchoolLogo size={38} className="shrink-0 bg-white/10 rounded-lg p-0.5" />
                <div>
                  <div className="text-[11px] font-black tracking-wider text-amber-300 uppercase">
                    {settings?.shortName || 'EDOCASTI'} • IGUORIAKHI
                  </div>
                  <div className="text-[9px] text-emerald-100 leading-tight max-w-[230px]">
                    {settings?.institutionName || 'Edo State College of Agriculture, Science and Technology'}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shrink-0">
                Student ID
              </span>
            </div>

            {/* Body */}
            <div className="flex items-center gap-3.5 my-auto py-2 relative z-10">
              <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-2 border-amber-400 bg-slate-100 overflow-hidden flex items-center justify-center shrink-0 shadow-md">
                {photo ? (
                  <img
                    src={photo}
                    alt={student.fullName || 'Student Passport'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-emerald-900 font-black text-xl tracking-wider">{initials}</div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                  Matriculation No.
                </div>
                <div className="font-mono text-xs sm:text-sm font-black text-amber-300 truncate">
                  {student.matricNumber || 'EDOCASTI/ND/2025/0000'}
                </div>
                <div className="text-sm sm:text-base font-extrabold text-white leading-tight truncate pt-0.5">
                  {student.fullName || 'Registered Student'}
                </div>
                <div className="text-[11px] text-emerald-100 truncate">
                  {student.programmeName || 'Agricultural Technology'}
                </div>
                <div className="flex items-center gap-3 pt-1 text-[10px] text-emerald-200">
                  <span>
                    Level: <strong className="text-white">{student.level || 'ND I'}</strong>
                  </span>
                  <span>
                    Session: <strong className="text-white">{settings?.currentSession || '2025/2026'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-end justify-between border-t border-emerald-700/60 pt-2 relative z-10 text-[9px] text-emerald-200">
              <div>
                <div>Valid Academic Credential</div>
                <div className="font-semibold text-amber-300">{student.departmentName || 'Academic Registry'}</div>
              </div>
              <div className="text-right">
                {settings?.registrarSignatureUrl ? (
                  <img
                    src={settings.registrarSignatureUrl}
                    alt="Registrar Signature"
                    className="h-6 object-contain ml-auto brightness-150 contrast-125 bg-white/90 px-1.5 rounded"
                  />
                ) : (
                  <div className="font-serif italic text-xs text-amber-200">Barr. I. Edokpayi</div>
                )}
                <div className="text-[8px] uppercase tracking-wider text-emerald-300">College Registrar</div>
              </div>
            </div>
          </div>

          {/* BACK SIDE */}
          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-5 flex flex-col justify-between"
          >
            {/* Magnetic Strip */}
            <div className="-mx-5 -mt-5 h-7 bg-slate-900 flex items-center justify-between px-4 text-[9px] font-mono text-amber-300 tracking-widest mb-2">
              <span>{settings?.shortName || 'EDOCASTI'} SECURITY CREDENTIAL</span>
              <span>{student.matricNumber || 'EDOCASTI'}</span>
            </div>

            <div className="grid grid-cols-12 gap-3 items-start text-[10px] flex-1">
              <div className="col-span-8 space-y-1.5">
                <div className="font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Cardholder Terms & Verification
                </div>
                <p className="text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                  This card remains the property of{' '}
                  <strong>{settings?.institutionName || 'EDOCASTI, Iguoriakhi'}</strong>. Present on request for
                  examinations, demonstration farm access, and library clearance.
                </p>
                <div className="pt-1 space-y-0.5 text-[10px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    <span>Emergency: {student.emergencyContact || settings?.contactPhone || '+234 800 336 2278'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    <span>
                      Next of Kin: {student.nextOfKin || 'Verified Guardian'} • Gender: {student.gender || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Official Editable Stamp */}
              <div className="col-span-4 flex flex-col items-center justify-center text-center">
                {settings?.schoolStampUrl ? (
                  <img
                    src={settings.schoolStampUrl}
                    alt="Official School Stamp"
                    className="w-16 h-16 object-contain"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-emerald-700 dark:border-emerald-400 flex flex-col items-center justify-center text-[8px] font-black text-emerald-800 dark:text-emerald-300 rotate-[-8deg] p-1">
                    <span>REGISTRAR</span>
                    <span className="text-[7px]">EDOCASTI</span>
                    <span>VERIFIED</span>
                  </div>
                )}
                <span className="text-[8px] text-slate-500 mt-1 uppercase font-semibold">Official Seal</span>
              </div>
            </div>

            {/* Footer Barcode & Signature */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex items-end justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-[1.5px] h-5">
                  {(student.matricNumber || 'EDOCASTI2025').split('').map((ch, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 dark:bg-slate-200 h-full"
                      style={{ width: `${(ch.charCodeAt(0) % 3) + 1}px` }}
                    />
                  ))}
                  {(student.matricNumber || 'EDOCASTI2025').split('').map((ch, idx) => (
                    <div
                      key={`b-${idx}`}
                      className="bg-slate-900 dark:bg-slate-200 h-full"
                      style={{ width: `${((ch.charCodeAt(0) + 1) % 3) + 1}px` }}
                    />
                  ))}
                </div>
                <div className="text-[8px] font-mono text-slate-500">
                  If found, return to Registrar, {settings?.address || 'Iguoriakhi, Edo State'}
                </div>
              </div>

              <div className="text-right shrink-0">
                {settings?.rectorSignatureUrl ? (
                  <img
                    src={settings.rectorSignatureUrl}
                    alt="Rector Signature"
                    className="h-5 object-contain ml-auto"
                  />
                ) : (
                  <div className="font-serif italic text-[10px] text-emerald-800 dark:text-emerald-400">
                    Prof. P. O. Aghimien
                  </div>
                )}
                <div className="text-[8px] text-slate-500 uppercase">Rector / Provost</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
