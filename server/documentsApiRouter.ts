import { Router, Response } from 'express';
import { db, IssuedDocument, Invoice } from './db';
import { AuthenticatedRequest, authenticateToken, requireRoles } from './authMiddleware';
import { evaluateNdGraduationEligibilityFromPostgres } from './academicProgressionService';

export const documentsApiRouter = Router();

function computeHonoursClassification(cgpa: number): string {
  if (cgpa >= 3.5) return 'Distinction';
  if (cgpa >= 3.0) return 'Upper Credit';
  if (cgpa >= 2.5) return 'Lower Credit';
  if (cgpa >= 2.0) return 'Pass';
  return 'Probation / Incomplete';
}

// GET /documents-v2 â€” list all issued documents (registrar/admin view)
documentsApiRouter.get(
  '/',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (_req: AuthenticatedRequest, res: Response) => {
    const state = db.getState();
    const list = (state.issuedDocuments || []).map((doc) => {
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      const publishedResults = state.results
        .filter((r) => r.studentId === doc.studentId && r.status === 'PUBLISHED')
        .map((r) => {
          const crs = state.courses.find((c) => c.id === r.courseId);
          return {
            ...r,
            courseCode: crs?.code || r.courseId,
            courseTitle: crs?.title || 'Course',
            creditUnits: crs?.creditUnits || 3,
          };
        });
      return {
        ...doc,
        paymentStatus: inv?.status || 'UNPAID',
        resultsSnapshot: publishedResults,
      };
    });
    return res.json({ success: true, documents: list });
  }
);

// GET /documents-v2/my-documents â€” student's own documents
documentsApiRouter.get(
  '/my-documents',
  authenticateToken,
  (req: AuthenticatedRequest, res: Response) => {
    const state = db.getState();
    const student = state.students.find((s) => s.userId === req.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }
    const usr = state.users.find((u) => u.id === student.userId);
    const admissionApp = state.applications.find(
      (a) => a.userId === student.userId && a.status === 'ACCEPTED'
    );
    const programme = state.programmes.find((p) => p.id === student.programmeId);
    const department = state.departments.find((d) => d.id === student.departmentId);
    const school = state.schools.find((s) => s.id === student.schoolId);

    const admissionLetter = admissionApp
      ? [
          {
            id: `admission-${admissionApp.id}`,
            studentId: student.id,
            type: 'ADMISSION_LETTER',
            title: 'Official Admission Letter',
            documentNumber: admissionApp.applicationNumber,
            matricNumber: student.matricNumber,
            studentName: usr?.fullName || `${admissionApp.firstName} ${admissionApp.lastName}`,
            programmeName: programme?.name || 'National Diploma Programme',
            departmentName: department?.name || '',
            schoolName: school?.name || '',
            level: student.level,
            photoUrl: student.photoUrl || usr?.photoUrl || admissionApp.photoUrl || '',
            session: admissionApp.session,
            generatedAt: admissionApp.decisionAt || admissionApp.submittedAt,
            generatedBy: admissionApp.reviewedBy || 'Admissions Office',
            paymentStatus: 'NOT_REQUIRED',
            isUnlocked: true,
            remarks: 'Admission offer accepted. This letter confirms the student admission.',
          },
        ]
      : [];

    const issuedDocs = (state.issuedDocuments || [])
      .filter((d) => d.studentId === student.id)
      .map((doc) => {
        const inv = state.invoices.find((i) => i.id === doc.invoiceId);
        const paymentStatus = inv?.status || 'UNPAID';
        const isUnlocked = paymentStatus === 'PAID';
        const publishedResults = isUnlocked
          ? state.results
              .filter((r) => r.studentId === student.id && r.status === 'PUBLISHED')
              .map((r) => {
                const crs = state.courses.find((c) => c.id === r.courseId);
                return {
                  ...r,
                  courseCode: crs?.code || r.courseId,
                  courseTitle: crs?.title || 'Academic Course',
                  creditUnits: crs?.creditUnits || 3,
                };
              })
          : undefined;
        return {
          ...doc,
          photoUrl: doc.photoUrl || student.photoUrl || usr?.photoUrl || '',
          paymentStatus,
          resultsSnapshot: publishedResults,
        };
      });

    return res.json({ success: true, documents: [...admissionLetter, ...issuedDocs] });
  }
);

// POST /documents-v2/generate â€” gated document generation
documentsApiRouter.post(
  '/generate',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  async (req: AuthenticatedRequest, res: Response) => {
    const { studentId, type, feeAmount, remarks, classification } = req.body;

    // 1. Input validation
    if (!studentId || !type || !['TRANSCRIPT', 'FINAL_CERTIFICATE'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid studentId and document type (TRANSCRIPT or FINAL_CERTIFICATE) are required.',
      });
    }

    const state = db.getState();
    const student = state.students.find((s) => s.id === studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const usr = state.users.find((u) => u.id === student.userId);
    const prog = state.programmes.find((p) => p.id === student.programmeId);
    const dept = state.departments.find((d) => d.id === student.departmentId);
    const sch = state.schools.find((s) => s.id === student.schoolId);
    const app = state.applications.find((a) => a.userId === student.userId);

    // 2. Duplicate-issuance guard
    const existing = (state.issuedDocuments || []).find(
      (d) => d.studentId === studentId && d.type === type
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `${type === 'TRANSCRIPT' ? 'Transcript' : 'Final Certificate'} has already been generated for this student.`,
      });
    }

    // 3. GRADUATION GATE â€” FINAL_CERTIFICATE requires current_stage === 'GRADUATED'
    if (type === 'FINAL_CERTIFICATE') {
      try {
        const eligibility = await evaluateNdGraduationEligibilityFromPostgres(state, studentId);
        if (eligibility.currentStage !== 'GRADUATED') {
          db.logAudit({
            userId: req.user!.id,
            userEmail: req.user!.email,
            action: 'DOCUMENT_GENERATION_BLOCKED_NOT_GRADUATED',
            resource: 'DOCUMENT',
            details: { studentId, type, currentStage: eligibility.currentStage },
            ipAddress: req.ip,
          });
          return res.status(409).json({
            success: false,
            message: 'Final certificate can only be issued to graduated students.',
            currentStage: eligibility.currentStage,
          });
        }
      } catch (evaluationError) {
        if (
          evaluationError instanceof Error &&
          evaluationError.message.includes('No progression record')
        ) {
          return res.status(409).json({
            success: false,
            message: 'Cannot verify graduation status: no academic progression record on file.',
          });
        }
        throw evaluationError;
      }
    }

    // 4. FEE GATE - dual ledger. Checks BOTH studentFeeObligations AND state.invoices.
    //    Either source of debt blocks document generation. inv-doc-* invoices are
    //    THIS document's own post-issuance fee and are excluded from the gate.
    const unpaidObligations = (state.studentFeeObligations || []).filter(
      (o) => o.studentId === studentId && o.balance > 0
    );
    const unpaidInvoices = (state.invoices || []).filter(
      (i) => i.studentId === studentId && i.status !== 'PAID' && i.id.indexOf('inv-doc-') !== 0
    );

    if (unpaidObligations.length > 0 || unpaidInvoices.length > 0) {
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        action: 'DOCUMENT_GENERATION_BLOCKED_UNPAID_FEES',
        resource: 'DOCUMENT',
        details: {
          studentId,
          type,
          unpaidObligationCount: unpaidObligations.length,
          unpaidInvoiceCount: unpaidInvoices.length,
          totalObligationBalance: unpaidObligations.reduce((sum, o) => sum + o.balance, 0),
          totalInvoiceBalance: unpaidInvoices.reduce((sum, i) => sum + (i.amount - i.amountPaid), 0),
        },
        ipAddress: req.ip,
      });
      return res.status(409).json({
        success: false,
        message: 'Cannot generate ' + (type === 'FINAL_CERTIFICATE' ? 'certificate' : 'transcript') + ': ' + (unpaidObligations.length + unpaidInvoices.length) + ' unpaid fee item(s).',
        unpaidObligations: unpaidObligations.map((o) => ({
          kind: 'OBLIGATION',
          id: o.id,
          feeName: o.feeNameSnapshot,
          session: o.session,
          level: o.level,
          amountDue: o.amountDue,
          amountPaid: o.amountPaid,
          balance: o.balance,
        })),
        unpaidInvoices: unpaidInvoices.map((i) => ({
          kind: 'INVOICE',
          id: i.id,
          feeName: i.title,
          session: i.session,
          amountDue: i.amount,
          amountPaid: i.amountPaid,
          balance: i.amount - i.amountPaid,
        })),
      });
    }
// 5. Resolve fee
    const defaultFee =
      type === 'TRANSCRIPT'
        ? state.settings.transcriptFee || 10000
        : state.settings.certificateFee || 25000;
    const resolvedFee = feeAmount !== undefined ? Number(feeAmount) : defaultFee;

    // 6. Create invoice (post-issuance charge â€” UNPAID until paid)
    const inv: Invoice = {
      id: 'inv-doc-' + Date.now(),
      invoiceNumber: `INV/${state.settings.currentSession.slice(0, 4)}/${Math.floor(10000 + Math.random() * 90000)}`,
      studentId: student.id,
      session: state.settings.currentSession,
      title:
        type === 'TRANSCRIPT'
          ? 'Official Academic Transcript Processing Fee'
          : 'Final Graduation Certificate Issuance Fee',
      amount: resolvedFee,
      amountPaid: 0,
      status: resolvedFee <= 0 ? 'PAID' : 'UNPAID',
      dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    state.invoices.push(inv);

    // 7. Build the issued document
    const docNumber = `${type === 'TRANSCRIPT' ? 'TRN' : 'CERT'}/EDOCASTI/${new Date().getFullYear()}/${String((state.issuedDocuments?.length || 0) + 1).padStart(4, '0')}`;
    const doc: IssuedDocument = {
      id: 'doc-' + Date.now(),
      studentId: student.id,
      matricNumber: student.matricNumber,
      studentName: usr?.fullName || 'Student',
      programmeName: prog?.name || 'National Diploma Programme',
      departmentName: dept?.name || '',
      schoolName: sch?.name || '',
      level: student.level,
      photoUrl: student.photoUrl || usr?.photoUrl || app?.photoUrl || '',
      type,
      documentNumber: docNumber,
      title:
        type === 'TRANSCRIPT'
          ? 'Official Academic Transcript'
          : 'Final Diploma / Graduation Certificate',
      session: state.settings.currentSession,
      cgpa: student.cgpa,
      classification: classification || computeHonoursClassification(student.cgpa),
      remarks: remarks || 'Completed all academic & practical requirements in good standing.',
      feeAmount: resolvedFee,
      invoiceId: inv.id,
      generatedBy: `${req.user!.fullName} (${req.user!.role})`,
      generatedAt: new Date().toISOString(),
    };

    if (!state.issuedDocuments) state.issuedDocuments = [];
    state.issuedDocuments.unshift(doc);
    db.saveState();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: `${type}_GENERATED`,
      resource: 'ISSUED_DOCUMENT',
      details: { documentNumber: docNumber, studentId: student.id, feeAmount: resolvedFee },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      document: { ...doc, paymentStatus: inv.status },
      invoice: inv,
    });
  }
);

// PUT /documents-v2/:id â€” update document classification/remarks/fee
documentsApiRouter.put(
  '/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const doc = (state.issuedDocuments || []).find((d) => d.id === id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    const { classification, remarks, feeAmount } = req.body;
    if (classification !== undefined) doc.classification = classification;
    if (remarks !== undefined) doc.remarks = remarks;
    if (feeAmount !== undefined) {
      doc.feeAmount = Number(feeAmount);
      const inv = state.invoices.find((i) => i.id === doc.invoiceId);
      if (inv && inv.status !== 'PAID') inv.amount = Number(feeAmount);
    }
    db.saveState();
    return res.json({ success: true, document: doc });
  }
);

// DELETE /documents-v2/:id
documentsApiRouter.delete(
  '/:id',
  authenticateToken,
  requireRoles('SUPER_ADMIN', 'INSTITUTION_ADMIN', 'REGISTRAR'),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const state = db.getState();
    const idx = (state.issuedDocuments || []).findIndex((d) => d.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }
    state.issuedDocuments.splice(idx, 1);
    db.saveState();
    return res.json({ success: true, message: 'Issued document deleted.' });
  }
);