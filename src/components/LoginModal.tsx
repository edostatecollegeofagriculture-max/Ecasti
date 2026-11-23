import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, AlertCircle, Upload } from 'lucide-react';
import { readImageFileAsDataUrl } from '../utils/imageUpload';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { login, registerApplicant } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, { maxDimension: 480, quality: 0.85 });
      setPhotoUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Could not process selected photo.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        await registerApplicant({ email, password, fullName, phone, photoUrl });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        <div className="p-6 bg-linear-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🌾</span>
              <span className="font-bold text-base tracking-wide text-amber-300">EDOCASTI PORTAL</span>
            </div>
            <h2 className="text-lg font-bold mt-1">
              {isRegistering ? 'Create Applicant Account' : 'Portal Sign In'}
            </h2>
            <p className="text-xs text-emerald-200">
              {isRegistering
                ? 'Sign up for 2025/2026 ND & HND Admission Screening'
                : 'Enter your institutional email and secure credentials'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-2 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isRegistering && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="w-14 h-16 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Passport Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold text-center px-1">Photo</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Passport Photograph (Required for ID & Admission Letter)
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                    Used on your Admission Letter, Student ID Card, and Transcript.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg cursor-pointer">
                    <Upload className="w-3 h-3" /> {photoUrl ? 'Change Photo' : 'Upload Passport'}
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Surname First)
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Omoregie Osaretin David"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +234 803 123 4567"
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isRegistering ? 'Email Address' : 'Institutional / Applicant Email'}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student.agric@edocasti.edu.ng"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? (
              'Authenticating...'
            ) : isRegistering ? (
              <>
                <UserPlus className="w-4 h-4" /> Create Account & Proceed
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Secure Sign In
              </>
            )}
          </button>

          {!isRegistering && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-2">
                Quick Access Logins (Password: <code>Password123!</code>):
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                {[
                  { label: 'Super Admin', email: 'superadmin@edocasti.edu.ng' },
                  { label: 'Dean of Academics', email: 'dean@edocasti.edu.ng' },
                  { label: 'HOD Agric', email: 'hod.agric@edocasti.edu.ng' },
                  { label: 'Exam Officer', email: 'examofficer@edocasti.edu.ng' },
                  { label: 'Lecturer', email: 'lecturer.agric@edocasti.edu.ng' },
                  { label: 'Registrar', email: 'registrar@edocasti.edu.ng' },
                  { label: 'Bursar', email: 'bursar@edocasti.edu.ng' },
                  { label: 'Admissions Officer', email: 'admissions@edocasti.edu.ng' },
                  { label: 'Student (Blessing)', email: 'student.agric@edocasti.edu.ng' },
                  { label: 'Applicant (Jerry)', email: 'applicant.jerry@gmail.com' },
                ].map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillQuickDemo(acc.email)}
                    className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 dark:text-slate-200 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-left font-medium truncate cursor-pointer"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center pt-2 text-xs">
            {isRegistering ? (
              <button
                type="button"
                onClick={() => setIsRegistering(false)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Already have an account? Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                New applicant? Create an admission account
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
