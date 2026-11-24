import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Course,
  Student,
  AssessmentResult,
  Department,
  Programme,
  CourseRegistration,
} from '../types';
import { CheckCircle, Users, Award, Check, Save } from 'lucide-react';
import { WildcardFilterBar } from '../components/WildcardFilterBar';
import { matchesWildcard } from '../utils/wildcard';

export const LecturerPortal: React.FC = () => {
  const { user, settings } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [registrations, setRegistrations] = useState<CourseRegistration[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [studentWildcard, setStudentWildcard] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('');
  const [filterProgId, setFilterProgId] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterEnrolledOnly, setFilterEnrolledOnly] = useState('');

  const [scoreInputs, setScoreInputs] = useState<Record<string, { ca: number; exam: number }>>({});
  const [activeTab, setActiveTab] = useState<'scores' | 'attendance'>('scores');
  const [attendanceTopic, setAttendanceTopic] = useState('');
  const [attendanceType, setAttendanceType] = useState<'Lecture' | 'Laboratory' | 'Field Practical'>(
    'Field Practical'
  );
  const [attendanceChecks, setAttendanceChecks] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const isLecturer = user?.role === 'LECTURER';
      const courseRequest = isLecturer ? api.getMyCourses() : api.getCourses();

      const [crsRes, stdRes, deptRes, progRes, regRes] = await Promise.all([
        courseRequest,
        api.getStudents(),
        isLecturer ? Promise.resolve({ success: true, departments: [] }) : api.getDepartments(),
        isLecturer ? Promise.resolve({ success: true, programmes: [] }) : api.getProgrammes(),
        api.getRegistrations().catch(() => ({ success: false, registrations: [] })),
      ]);

      const availableCourses = crsRes.success ? crsRes.courses : [];
      setCourses(availableCourses);
      setSelectedCourse((current) => {
        if (!availableCourses.length) return null;
        return availableCourses.find((course: Course) => course.id === current?.id) || availableCourses[0];
      });

      if (deptRes.success) setDepartments(deptRes.departments);
      if (progRes.success) setProgrammes(progRes.programmes);
      if (regRes.success) setRegistrations(regRes.registrations || []);

      if (stdRes.success) {
        setStudents(stdRes.students || []);
        const checks: Record<string, boolean> = {};
        (stdRes.students || []).forEach((student: Student) => {
          checks[student.id] = true;
        });
        setAttendanceChecks(checks);
      }
    } catch (err: any) {
      console.error(err);
      setCourses([]);
      setSelectedCourse(null);
      setStudents([]);
      setResults([]);
      setLoadError(err?.message || 'Unable to load lecturer workspace data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCourse(null);
    setCourses([]);
    setStudents([]);
    setResults([]);
    setScoreInputs({});
    setRegistrations([]);
    loadData();
    // Reload when the active account or role changes, not merely when the user object is recreated.
  }, [user?.id, user?.role]);

  const loadCourseResults = async (courseId: string) => {
    try {
      const res = await api.getResults({ courseId });
      if (res.success) {
        setResults(res.results || []);
        const matrix: Record<string, { ca: number; exam: number }> = {};
        (res.results || []).forEach((result: AssessmentResult) => {
          matrix[result.studentId] = { ca: result.caScore, exam: result.examScore };
        });
        setScoreInputs(matrix);
      } else {
        setResults([]);
        setScoreInputs({});
      }
    } catch (err: any) {
      console.error(err);
      setResults([]);
      setScoreInputs({});
      setLoadError(err?.message || 'Unable to load scores for this course.');
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      loadCourseResults(selectedCourse.id);
    } else {
      setResults([]);
      setScoreInputs({});
    }
  }, [selectedCourse?.id]);

  const handleScoreChange = (studentId: string, field: 'ca' | 'exam', val: number) => {
    const current = scoreInputs[studentId] || { ca: 0, exam: 0 };
    const max = field === 'ca' ? settings?.caMaxMarks || 40 : settings?.examMaxMarks || 60;
    const clamped = Math.max(0, Math.min(Number.isFinite(val) ? val : 0, max));
    setScoreInputs((previous) => ({
      ...previous,
      [studentId]: { ...current, [field]: clamped },
    }));
  };

  const handleSaveScore = async (student: Student) => {
    if (!selectedCourse) return;
    const scores = scoreInputs[student.id] || { ca: 0, exam: 0 };
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.submitScore({
        courseId: selectedCourse.id,
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName,
        session: settings?.currentSession,
        semester: settings?.currentSemester,
        caScore: scores.ca,
        examScore: scores.exam,
      });
      if (res.success) {
        await loadCourseResults(selectedCourse.id);
        setSaveSuccess(
          `Score submitted for ${student.fullName} (${student.matricNumber}) — Pending HOD review and approval before Exam Officer moderation.`
        );
        setTimeout(() => setSaveSuccess(null), 3500);
      }
    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'Unable to submit this score.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAllVisible = async (visibleStudents: Student[]) => {
    if (!selectedCourse || visibleStudents.length === 0) return;
    setLoading(true);
    setLoadError(null);
    let savedCount = 0;
    try {
      for (const student of visibleStudents) {
        const scores = scoreInputs[student.id] || { ca: 0, exam: 0 };
        await api.submitScore({
          courseId: selectedCourse.id,
          studentId: student.id,
          matricNumber: student.matricNumber,
          studentName: student.fullName,
          session: settings?.currentSession,
          semester: settings?.currentSemester,
          caScore: scores.ca,
          examScore: scores.exam,
        });
        savedCount += 1;
      }
      await loadCourseResults(selectedCourse.id);
      setSaveSuccess(
        `Saved ${savedCount} student scores for ${selectedCourse.code} — submitted for HOD review before Exam Officer moderation.`
      );
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setLoadError(`${err?.message || 'Unable to save all scores.'} ${savedCount} of ${visibleStudents.length} scores were saved.`);
      await loadCourseResults(selectedCourse.id);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordAttendance = async (visibleStudents: Student[]) => {
    if (!selectedCourse || !attendanceTopic.trim()) return;
    setLoading(true);
    setLoadError(null);
    try {
      const records = visibleStudents.map((student) => ({
        studentId: student.id,
        matricNumber: student.matricNumber,
        studentName: student.fullName || 'Student',
        isPresent: !!attendanceChecks[student.id],
      }));
      const res = await api.recordAttendance({
        courseId: selectedCourse.id,
        type: attendanceType,
        topic: attendanceTopic.trim(),
        records,
      });
      if (res.success) {
        setSaveSuccess(`Attendance for '${attendanceTopic}' registered (${records.length} students).`);
        setAttendanceTopic('');
        setTimeout(() => setSaveSuccess(null), 3500);
      }
    } catch (err: any) {
      console.error(err);
      setLoadError(err?.message || 'Unable to record attendance.');
    } finally {
      setLoading(false);
    }
  };

  const enrolledStudentIds = new Set(
    selectedCourse
      ? registrations
          .filter((registration) => registration.courseIds?.includes(selectedCourse.id))
          .map((registration) => registration.studentId)
      : []
  );

  const filteredStudents = students.filter((student) => {
    if (filterDeptId && student.departmentId !== filterDeptId) return false;
    if (filterProgId && student.programmeId !== filterProgId) return false;
    if (filterLevel && student.level !== filterLevel) return false;
    if (filterEnrolledOnly === 'ENROLLED' && !enrolledStudentIds.has(student.id)) return false;
    return matchesWildcard(
      studentWildcard,
      student.matricNumber,
      student.fullName,
      student.programmeName,
      student.departmentName,
      student.level
    );
  });

  const levelOptions = Array.from(new Set(students.map((student) => student.level).filter(Boolean))).map(
    (level) => ({ value: level, label: level })
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Academic Faculty Workspace
          </span>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            Course Assessments, Examination Marks &amp; Attendance
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            View assigned courses, enter CA and examination marks, and submit attendance records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Course:</label>
          <select
            value={selectedCourse?.id || ''}
            onChange={(event) => {
              const course = courses.find((item) => item.id === event.target.value);
              setSelectedCourse(course || null);
            }}
            disabled={!courses.length}
            className="text-xs p-2.5 font-bold border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs disabled:opacity-50"
          >
            {!courses.length && <option value="">No courses assigned</option>}
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.title} ({course.level} • {course.creditUnits} Units)
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200">
          {loadError}
        </div>
      )}
      {saveSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {user?.role === 'LECTURER' && courses.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <h2 className="font-bold text-slate-900 dark:text-white">No courses assigned</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Your assigned courses will appear here after your Head of Department assigns them.
          </p>
        </div>
      ) : (
        <>
          <WildcardFilterBar
            query={studentWildcard}
            onQueryChange={setStudentWildcard}
            placeholder="Wildcard filter student or matric (e.g. *Blessing*, EDOCASTI/ND/2024/*)..."
            totalCount={students.length}
            filteredCount={filteredStudents.length}
            facets={[
              ...(user?.role === 'LECTURER' ? [] : [
                {
                  key: 'dept',
                  label: 'Department',
                  value: filterDeptId,
                  onChange: setFilterDeptId,
                  options: departments.map((department) => ({ value: department.id, label: department.name })),
                },
                {
                  key: 'prog',
                  label: 'Programme',
                  value: filterProgId,
                  onChange: setFilterProgId,
                  options: programmes.map((programme) => ({ value: programme.id, label: programme.name })),
                },
              ]),
              {
                key: 'level',
                label: 'Class/Level',
                value: filterLevel,
                onChange: setFilterLevel,
                options: levelOptions,
              },
              {
                key: 'enrolled',
                label: 'Scope',
                value: filterEnrolledOnly,
                onChange: setFilterEnrolledOnly,
                options: [{ value: 'ENROLLED', label: 'Registered in Course' }],
              },
            ]}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('scores')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'scores'
                    ? 'bg-emerald-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Award className="w-4 h-4" /> Continuous Assessment &amp; Exam Scores
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'bg-emerald-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Users className="w-4 h-4" /> Practical Farm &amp; Lab Attendance
              </button>
            </div>
            {activeTab === 'scores' && filteredStudents.length > 0 && (
              <button
                onClick={() => handleSaveAllVisible(filteredStudents)}
                disabled={loading || !selectedCourse}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" /> Save All Visible Scores ({filteredStudents.length})
              </button>
            )}
          </div>

          {activeTab === 'scores' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Grade Roster: {selectedCourse?.code} ({selectedCourse?.title})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    CA Max: {settings?.caMaxMarks || 40} | Exam Max: {settings?.examMaxMarks || 60}. Submitted scores must be approved by the HOD, then moderated and published by the Exam Officer before student release.
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg tabular-nums">
                  Showing {filteredStudents.length} Students
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3">Matric Number</th>
                      <th className="p-3">Student &amp; Class</th>
                      <th className="p-3 text-center">CA ({settings?.caMaxMarks || 40})</th>
                      <th className="p-3 text-center">Exam ({settings?.examMaxMarks || 60})</th>
                      <th className="p-3 text-center">Total</th>
                      <th className="p-3 text-center">Grade</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                    {filteredStudents.map((student) => {
                      const entry = scoreInputs[student.id] || { ca: 0, exam: 0 };
                      const total = entry.ca + entry.exam;
                      let grade = 'F';
                      if (total >= 70) grade = 'A';
                      else if (total >= 60) grade = 'B';
                      else if (total >= 50) grade = 'C';
                      else if (total >= 45) grade = 'D';
                      else if (total >= 40) grade = 'E';
                      const existingResult = results.find((result) => result.studentId === student.id);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">{student.matricNumber}</td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 dark:text-white uppercase">{student.fullName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{student.level} • {student.programmeName}</div>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={settings?.caMaxMarks || 40}
                              value={entry.ca}
                              disabled={loading || existingResult?.status === 'PUBLISHED'}
                              onChange={(event) => handleScoreChange(student.id, 'ca', Number(event.target.value))}
                              className="w-16 p-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded text-center font-bold text-xs disabled:opacity-60"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={settings?.examMaxMarks || 60}
                              value={entry.exam}
                              disabled={loading || existingResult?.status === 'PUBLISHED'}
                              onChange={(event) => handleScoreChange(student.id, 'exam', Number(event.target.value))}
                              className="w-16 p-1.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded text-center font-bold text-xs disabled:opacity-60"
                            />
                          </td>
                          <td className="p-3 text-center font-bold text-slate-900 dark:text-white text-sm">{total}</td>
                          <td className="p-3 text-center font-black text-emerald-800 dark:text-emerald-400 text-sm">{grade}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              existingResult?.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : existingResult
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}>
                              {existingResult?.status === 'PUBLISHED' ? 'Approved' : existingResult ? 'Pending Exam Officer' : 'Not Entered'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleSaveScore(student)}
                              disabled={loading || !selectedCourse || existingResult?.status === 'PUBLISHED'}
                              className="px-3 py-1 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold rounded text-xs cursor-pointer shadow-2xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Save Score
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!filteredStudents.length && (
                      <tr><td colSpan={8} className="p-6 text-center text-slate-500">No students match the current filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Record Attendance: {selectedCourse?.code}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Log student physical presence for demonstration farms, workshops, or lectures.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Session Type</label>
                  <select
                    value={attendanceType}
                    onChange={(event) => setAttendanceType(event.target.value as typeof attendanceType)}
                    className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Field Practical">College Research Farm Field Practical</option>
                    <option value="Laboratory">Science Laboratory Practical</option>
                    <option value="Lecture">Lecture Hall Theoretical Session</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Session Topic / Practical Objective</label>
                  <input
                    type="text"
                    value={attendanceTopic}
                    onChange={(event) => setAttendanceTopic(event.target.value)}
                    placeholder="e.g. Soil sampling, tractor maintenance, Python programming lab"
                    className="w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg"
                  />
                </div>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-bold text-[11px]">
                    <tr>
                      <th className="p-3 w-12 text-center">Present</th>
                      <th className="p-3">Matric Number</th>
                      <th className="p-3">Student Name</th>
                      <th className="p-3">Class / Programme</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!attendanceChecks[student.id]}
                            onChange={(event) => setAttendanceChecks((previous) => ({
                              ...previous,
                              [student.id]: event.target.checked,
                            }))}
                            className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-900 dark:text-emerald-400">{student.matricNumber}</td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white uppercase">{student.fullName}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{student.level} • {student.programmeName || 'Agricultural Technology'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => handleRecordAttendance(filteredStudents)}
                  disabled={loading || !attendanceTopic.trim() || !selectedCourse}
                  className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" /> Register &amp; Archive Attendance Session
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
