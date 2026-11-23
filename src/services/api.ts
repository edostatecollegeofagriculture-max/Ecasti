const API_BASE = '/api/v1';

export interface FeeCatalogItem {
  id: string;
  name: string;
  amount: number;
  feeType: 'ONE_TIME' | 'PER_SESSION';
  category: 'COMPULSORY' | 'OPTIONAL';
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramFeeSchedule {
  id: string;
  programmeId: string;
  session: string;
  level: string;
  status: 'DRAFT' | 'PUBLISHED';
  isActive: boolean;
  createdAt: string;
  publishedAt: string | null;
  createdBy: string;
  itemCount: number;
  totalAmount: number;
}

export interface ProgramFeeScheduleItem {
  id: string;
  scheduleId: string;
  feeCatalogItemId: string;
  baseAmountSnapshot: number;
  amountOverride: number | null;
  effectiveAmount: number;
  feeNameSnapshot: string;
  feeCategorySnapshot: 'COMPULSORY' | 'OPTIONAL';
  feeTypeSnapshot: 'ONE_TIME' | 'PER_SESSION';
  allocationPriority: number;
}

export interface StudentFeeObligation {
  id: string;
  student_id: string;
  programme_id: string;
  session: string;
  level: string;
  fee_catalog_item_id: string;
  fee_name_snapshot: string;
  fee_category_snapshot: 'COMPULSORY' | 'OPTIONAL';
  fee_type_snapshot: 'ONE_TIME' | 'PER_SESSION';
  amount_due: number | string;
  amount_paid: number | string;
  balance: number | string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  due_date?: string | null;
  [key: string]: unknown;
}

export interface FeePaymentRecord {
  id: string;
  receipt_number: string;
  student_id: string;
  amount: number | string;
  method: string;
  recorded_by: string;
  recorded_at: string;
  notes?: string | null;
  session?: string | null;
  allocation_category?: 'COMPULSORY' | 'OPTIONAL' | null;
  fee_catalog_item_id?: string | null;
  [key: string]: unknown;
}

export interface FeePaymentAllocation {
  id: string;
  payment_id: string;
  obligation_id: string;
  fee_catalog_item_id: string;
  fee_name_snapshot: string;
  fee_category_snapshot: 'COMPULSORY' | 'OPTIONAL';
  amount_allocated: number | string;
}
class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('edocasti_token') || localStorage.getItem('edocas_token');
  }

  public setToken(token: string | null) {
    this.token = token;

    if (token) {
      localStorage.setItem('edocasti_token', token);
    } else {
      localStorage.removeItem('edocasti_token');
    }

    // Always remove the legacy key to prevent an outdated token from being reused.
    localStorage.removeItem('edocas_token');
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Network request failed';
      throw new Error(`Unable to reach the EDOCASTI API at ${API_BASE}${endpoint}. Confirm that the portal server is running and open this portal from the same server address. (${detail})`);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  // Auth
  login(email: string, password: string) {
    return this.request<{ success: boolean; token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  registerApplicant(payload: { email: string; password: string; fullName: string; phone?: string; photoUrl?: string }) {
    return this.request<{ success: boolean; token: string; user: any }>('/auth/register-applicant', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getMe() {
    return this.request<{ success: boolean; user: any }>('/auth/me');
  }

  updateProfile(payload: { fullName?: string; phone?: string; photoUrl?: string }) {
    return this.request<{ success: boolean; user: any }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Settings
  getSettings() {
    return this.request<{ success: boolean; settings: any }>('/settings');
  }

  updateSettings(payload: any) {
    return this.request<{ success: boolean; settings: any }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Users
  getUsers(params?: { role?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<{ success: boolean; users: any[] }>(`/users${q ? `?${q}` : ''}`);
  }

  createUser(payload: any) {
    return this.request<{ success: boolean; user: any }>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  toggleUserStatus(id: string, payload: { isActive?: boolean; isLocked?: boolean }) {
    return this.request<{ success: boolean; message: string }>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  updateUser(id: string, payload: any) {
    return this.request<{ success: boolean; user: any }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteUser(id: string) {
    return this.request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Academics
  getSchools() {
    return this.request<{ success: boolean; schools: any[] }>('/academics/schools');
  }

  createSchool(payload: any) {
    return this.request<{ success: boolean; school: any }>('/academics/schools', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateSchool(id: string, payload: any) {
    return this.request<{ success: boolean; school: any }>(`/academics/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteSchool(id: string) {
    return this.request<{ success: boolean; message: string }>(`/academics/schools/${id}`, {
      method: 'DELETE',
    });
  }

  getDepartments() {
    return this.request<{ success: boolean; departments: any[] }>('/academics/departments');
  }

  createDepartment(payload: any) {
    return this.request<{ success: boolean; department: any }>('/academics/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateDepartment(id: string, payload: any) {
    return this.request<{ success: boolean; department: any }>(`/academics/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteDepartment(id: string) {
    return this.request<{ success: boolean; message: string }>(`/academics/departments/${id}`, {
      method: 'DELETE',
    });
  }

  getProgrammes() {
    return this.request<{ success: boolean; programmes: any[] }>('/academics/programmes');
  }

  createProgramme(payload: any) {
    return this.request<{ success: boolean; programme: any }>('/academics/programmes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateProgramme(id: string, payload: any) {
    return this.request<{ success: boolean; programme: any }>(`/academics/programmes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteProgramme(id: string) {
    return this.request<{ success: boolean; message: string }>(`/academics/programmes/${id}`, {
      method: 'DELETE',
    });
  }

  getCourses(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; courses: any[] }>(`/academics/courses${q ? `?${q}` : ''}`);
  }

  getMyCourses() {
    return this.request<{ success: boolean; courses: any[] }>('/academics/my-courses');
  }

  getLecturers() {
    return this.request<{ success: boolean; lecturers: any[] }>('/academics/lecturers');
  }

  createCourse(payload: any) {
    return this.request<{ success: boolean; course: any }>('/academics/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateCourse(id: string, payload: any) {
    return this.request<{ success: boolean; course: any }>(`/academics/courses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  assignCourseLecturer(courseId: string, payload: { lecturerId?: string; lecturerName?: string }) {
    return this.request<{ success: boolean; course: any }>(`/academics/courses/${courseId}/assign-lecturer`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  deleteCourse(id: string) {
    return this.request<{ success: boolean; message: string }>(`/academics/courses/${id}`, {
      method: 'DELETE',
    });
  }

  // Admissions
  getApplications(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; applications: any[] }>(`/admissions${q ? `?${q}` : ''}`);
  }

  getMyApplication() {
    return this.request<{ success: boolean; application: any }>('/admissions/my-application');
  }

  submitApplication(payload: any) {
    return this.request<{ success: boolean; application: any }>('/admissions/apply', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateApplication(id: string, payload: any) {
    return this.request<{ success: boolean; application: any }>(`/admissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteApplication(id: string) {
    return this.request<{ success: boolean; message: string }>(`/admissions/${id}`, {
      method: 'DELETE',
    });
  }

  reviewApplication(id: string, payload: { status: string; screeningNotes?: string }) {
    return this.request<{ success: boolean; application: any }>(`/admissions/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  acceptOffer(id: string) {
    return this.request<{ success: boolean; message: string; student: any; token?: string; user?: any }>(`/admissions/${id}/accept-offer`, {
      method: 'POST',
    });
  }

  migrateApplicantToStudent(id: string) {
    return this.request<{ success: boolean; student: any; application: any }>(`/admissions/${id}/migrate-student`, {
      method: 'POST',
    });
  }

  // Students
  getStudents(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; students: any[] }>(`/students${q ? `?${q}` : ''}`);
  }

  getMyStudentProfile() {
    return this.request<{ success: boolean; student: any }>('/students/me');
  }

  createStudent(payload: any) {
    return this.request<{ success: boolean; student: any }>('/students', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateStudent(id: string, payload: any) {
    return this.request<{ success: boolean; student: any }>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteStudent(id: string) {
    return this.request<{ success: boolean; message: string }>(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // Registrations
  getRegistrations(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; registrations: any[] }>(`/registrations${q ? `?${q}` : ''}`);
  }

  getMyRegistration() {
    return this.request<{ success: boolean; registration: any }>('/registrations/my-registration');
  }

  registerCourses(courseIds: string[]) {
    return this.request<{ success: boolean; registration: any }>('/registrations/register', {
      method: 'POST',
      body: JSON.stringify({ courseIds }),
    });
  }

  approveRegistration(id: string) {
    return this.request<{ success: boolean; registration: any }>(`/registrations/${id}/approve`, {
      method: 'PATCH',
    });
  }

  approveRegistrationsBulk(payload: {
    registrationIds?: string[];
    session?: string;
    semester?: string;
  }) {
    return this.request<{
      success: boolean;
      approvedCount: number;
    }>('/registrations/approve-bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  rejectRegistration(id: string) {
    return this.request<{ success: boolean; registration: any }>(`/registrations/${id}/reject`, {
      method: 'PATCH',
    });
  }

  updateRegistration(id: string, payload: any) {
    return this.request<{ success: boolean; registration: any }>(`/registrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteRegistration(id: string) {
    return this.request<{ success: boolean; message: string }>(`/registrations/${id}`, {
      method: 'DELETE',
    });
  }

  // Results
  getResults(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; results: any[] }>(`/results${q ? `?${q}` : ''}`);
  }

  getMyResults() {
    return this.request<{ success: boolean; results: any[] }>('/results/my-results');
  }

  submitScore(payload: any) {
    return this.request<{ success: boolean; result: any }>('/results/score-entry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  publishResult(id: string) {
    return this.request<{ success: boolean; result: any }>(`/results/${id}/publish`, {
      method: 'PATCH',
    });
  }

  approveResultsBulk(payload: { resultIds?: string[]; courseId?: string }) {
    return this.request<{ success: boolean; approvedCount: number; skippedCount?: number }>('/results/approve-bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateResult(id: string, payload: any) {
    return this.request<{ success: boolean; result: any }>(`/results/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteResult(id: string) {
    return this.request<{ success: boolean; message: string }>(`/results/${id}`, {
      method: 'DELETE',
    });
  }

  // Transcripts & Final Certificates
  getIssuedDocuments() {
    return this.request<{ success: boolean; documents: any[] }>('/documents');
  }

  getMyDocuments() {
    return this.request<{ success: boolean; documents: any[] }>('/documents/my-documents');
  }

  generateDocument(payload: {
    studentId: string;
    type: 'TRANSCRIPT' | 'FINAL_CERTIFICATE';
    feeAmount?: number;
    remarks?: string;
    classification?: string;
  }) {
    return this.request<{ success: boolean; document: any; invoice: any }>('/documents/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateIssuedDocument(id: string, payload: any) {
    return this.request<{ success: boolean; document: any }>(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteIssuedDocument(id: string) {
    return this.request<{ success: boolean; message: string }>(`/documents/${id}`, {
      method: 'DELETE',
    });
  }

  // New PostgreSQL Fee Management API
  // Kept separate from the legacy Finance and Remita endpoints.

  getNewFeeCatalog(params?: { includeInactive?: boolean }) {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();

    return this.request<{
      success: boolean;
      items: FeeCatalogItem[];
    }>(`/fees/catalog${query ? `?${query}` : ''}`);
  }

  createNewFeeCatalogItem(payload: {
    name: string;
    amount: number;
    feeType: 'ONE_TIME' | 'PER_SESSION';
    category: 'COMPULSORY' | 'OPTIONAL';
    description?: string;
  }) {
    return this.request<{
      success: boolean;
      item: FeeCatalogItem;
    }>('/fees/catalog', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateNewFeeCatalogItem(
    id: string,
    payload: Partial<{
      name: string;
      amount: number;
      feeType: 'ONE_TIME' | 'PER_SESSION';
      category: 'COMPULSORY' | 'OPTIONAL';
      isActive: boolean;
      description: string;
    }>
  ) {
    return this.request<{
      success: boolean;
      item: FeeCatalogItem;
    }>(`/fees/catalog/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  deleteNewFeeCatalogItem(id: string) {
    return this.request<{
      success: boolean;
      result: { deleted?: boolean; deactivated?: boolean };
    }>(`/fees/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  getNewFeeSchedules(params?: { includeInactive?: boolean }) {
    const query = new URLSearchParams(
      params as Record<string, string>
    ).toString();

    return this.request<{
      success: boolean;
      schedules: ProgramFeeSchedule[];
    }>(`/fees/schedules${query ? `?${query}` : ''}`);
  }

  getNewFeeSchedule(id: string) {
    return this.request<{
      success: boolean;
      schedule?: ProgramFeeSchedule;
      items?: ProgramFeeScheduleItem[];
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(id)}`);
  }

  createNewFeeSchedule(payload: {
    programmeId: string;
    session: string;
    level: string;
  }) {
    return this.request<{
      success: boolean;
      schedule?: ProgramFeeSchedule;
      [key: string]: unknown;
    }>('/fees/schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  addNewFeeScheduleItem(
    scheduleId: string,
    payload: {
      feeCatalogItemId: string;
      amountOverride?: number | null;
      allocationPriority?: number;
    }
  ) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(scheduleId)}/items`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateNewFeeScheduleItem(
    scheduleId: string,
    itemId: string,
    payload: {
      amountOverride?: number | null;
      allocationPriority?: number;
    }
  ) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(
      `/fees/schedules/${encodeURIComponent(scheduleId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  }

  removeNewFeeScheduleItem(scheduleId: string, itemId: string) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(
      `/fees/schedules/${encodeURIComponent(scheduleId)}/items/${encodeURIComponent(itemId)}`,
      { method: 'DELETE' }
    );
  }

  cloneNewFeeSchedule(
    id: string,
    payload?: {
      programmeId?: string;
      session?: string;
      level?: string;
    }
  ) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(id)}/clone`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  publishNewFeeSchedule(id: string) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    });
  }

  unpublishNewFeeSchedule(id: string) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(id)}/unpublish`, {
      method: 'POST',
    });
  }

  setNewFeeScheduleActive(id: string, active: boolean) {
    return this.request<{
      success: boolean;
      [key: string]: unknown;
    }>(`/fees/schedules/${encodeURIComponent(id)}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
  }

  getMyFeeObligations() {
    return this.request<{
      success: boolean;
      studentId: string;
      obligations: StudentFeeObligation[];
    }>('/fees/students/me/fees');
  }

  getStudentFeeObligations(studentId: string) {
    return this.request<{
      success: boolean;
      studentId: string;
      obligations: StudentFeeObligation[];
    }>(`/fees/students/${encodeURIComponent(studentId)}/fees`);
  }

  recordNewFeePayment(
    payload: {
      studentId: string;
      amount: number;
      method: string;
      notes?: string;
      session?: string;
      allocationCategory?: 'COMPULSORY' | 'OPTIONAL';
      feeCatalogItemId?: string;
    },
    idempotencyKey: string
  ) {
    return this.request<{
      success: boolean;
      payment: FeePaymentRecord;
    }>('/fees/payments', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
  }

  getMyNewFeePaymentHistory() {
    return this.request<{
      success: boolean;
      studentId: string;
      payments: FeePaymentRecord[];
      allocations: FeePaymentAllocation[];
    }>('/fees/students/me/payments');
  }

  getStudentNewFeePaymentHistory(studentId: string) {
    return this.request<{
      success: boolean;
      studentId: string;
      payments: FeePaymentRecord[];
      allocations: FeePaymentAllocation[];
    }>(`/fees/students/${encodeURIComponent(studentId)}/payments`);
  }
  // Finance
  getFeeSchedules() {
    return this.request<{ success: boolean; feeSchedules: any[] }>('/finance/fee-schedules');
  }

  createFeeSchedule(payload: any) {
    return this.request<{ success: boolean; feeSchedule: any }>('/finance/fee-schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateFeeSchedule(id: string, payload: any) {
    return this.request<{ success: boolean; feeSchedule: any }>(`/finance/fee-schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteFeeSchedule(id: string) {
    return this.request<{ success: boolean; message: string }>(`/finance/fee-schedules/${id}`, {
      method: 'DELETE',
    });
  }

  getInvoices(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; invoices: any[] }>(`/finance/invoices${q ? `?${q}` : ''}`);
  }

  createInvoice(payload: any) {
    return this.request<{ success: boolean; invoice: any }>('/finance/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  payInvoice(invoiceId: string, channel?: string) {
    return this.request<{ success: boolean; transaction: any; invoice: any }>('/finance/pay', {
      method: 'POST',
      body: JSON.stringify({ invoiceId, channel }),
    });
  }

  getPayments() {
    return this.request<{ success: boolean; payments: any[] }>('/finance/payments');
  }

  updateInvoice(id: string, payload: any) {
    return this.request<{ success: boolean; invoice: any }>(`/finance/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteInvoice(id: string) {
    return this.request<{ success: boolean; message: string }>(`/finance/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  deletePayment(id: string) {
    return this.request<{ success: boolean; message: string }>(`/finance/payments/${id}`, {
      method: 'DELETE',
    });
  }

  // Attendance
  getAttendance(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; attendance: any[] }>(`/attendance${q ? `?${q}` : ''}`);
  }

  recordAttendance(payload: any) {
    return this.request<{ success: boolean; session: any }>('/attendance', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateAttendanceSession(id: string, payload: any) {
    return this.request<{ success: boolean; session: any }>(`/attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteAttendanceSession(id: string) {
    return this.request<{ success: boolean; message: string }>(`/attendance/${id}`, {
      method: 'DELETE',
    });
  }

  // Support
  getSupportTickets() {
    return this.request<{ success: boolean; tickets: any[] }>('/support');
  }

  createSupportTicket(payload: any) {
    return this.request<{ success: boolean; ticket: any }>('/support', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  replySupportTicket(id: string, message: string) {
    return this.request<{ success: boolean; ticket: any }>(`/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  updateSupportTicket(id: string, payload: any) {
    return this.request<{ success: boolean; ticket: any }>(`/support/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  deleteSupportTicket(id: string) {
    return this.request<{ success: boolean; message: string }>(`/support/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit
  getAuditLogs(params?: any) {
    const q = new URLSearchParams(params).toString();
    return this.request<{ success: boolean; logs: any[] }>(`/audit${q ? `?${q}` : ''}`);
  }

  // Dashboard Stats
  getDashboardStats() {
    return this.request<{ success: boolean; stats: any }>('/dashboard/stats');
  }

  // Global Search
  globalSearch(q: string) {
    return this.request<{
      success: boolean;
      query: string;
      results: {
        students: any[];
        applicants: any[];
        courses: any[];
        documents: any[];
        sections: any[];
      };
    }>(`/search?q=${encodeURIComponent(q)}`);
  }

  // Content Management System (CMS) - News
  getNews(params?: { category?: string; status?: string; sliderOnly?: boolean; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<{ success: boolean; articles: any[] }>(`/cms/news${q ? `?${q}` : ''}`);
  }

  getNewsArticle(id: string) {
    return this.request<{ success: boolean; article: any }>(`/cms/news/${id}`);
  }

  createNewsArticle(payload: any) {
    return this.request<{ success: boolean; article: any }>('/cms/news', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateNewsArticle(id: string, payload: any) {
    return this.request<{ success: boolean; article: any }>(`/cms/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteNewsArticle(id: string) {
    return this.request<{ success: boolean; message: string }>(`/cms/news/${id}`, {
      method: 'DELETE',
    });
  }

  toggleNewsSlider(id: string) {
    return this.request<{ success: boolean; isFeaturedInSlider: boolean }>(`/cms/news/${id}/toggle-slider`, {
      method: 'PATCH',
    });
  }

  // Content Management System (CMS) - Slides
  getSlides(params?: { activeOnly?: boolean }) {
    const q = new URLSearchParams(params as any).toString();
    return this.request<{ success: boolean; slides: any[] }>(`/cms/slides${q ? `?${q}` : ''}`);
  }

  createSlide(payload: any) {
    return this.request<{ success: boolean; slide: any }>('/cms/slides', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  updateSlide(id: string, payload: any) {
    return this.request<{ success: boolean; slide: any }>(`/cms/slides/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  deleteSlide(id: string) {
    return this.request<{ success: boolean; message: string }>(`/cms/slides/${id}`, {
      method: 'DELETE',
    });
  }

  // Page Builder Content
  getPageContent() {
    return this.request<{ success: boolean; pageContent: any }>('/cms/page-content');
  }

  updatePageContent(payload: any) {
    return this.request<{ success: boolean; pageContent: any }>('/cms/page-content', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  getRetryableAdmissionFeeActivations(limit = 50) {
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 50, 1), 200);

    return this.request<{
      success: boolean;
      items: Array<{
        applicationId: string;
        studentId: string;
        programmeId: string;
        academicSession: string;
        level: string;
        status: 'PENDING' | 'FAILED';
        attempts: number;
        lastError: string | null;
        activatedAt: string;
      }>;
    }>(`/admissions/fee-activation-retries?limit=${safeLimit}`);
  }

  retryAdmissionFeeActivation(applicationId: string) {
    return this.request<{
      success: boolean;
      feeActivationPending?: boolean;
      message: string;
      applicationId?: string;
      studentId?: string;
    }>(`/admissions/${encodeURIComponent(applicationId)}/retry-fee-activation`, {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
