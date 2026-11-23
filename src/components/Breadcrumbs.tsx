import React from 'react';
import { Home, ChevronRight, Layers } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  tab?: string;
  subSection?: string;
  active?: boolean;
}

interface Props {
  tab: string;
  subSection?: string;
  onNavigate: (tab: string, subSection?: string) => void;
}

export const Breadcrumbs: React.FC<Props> = ({ tab, subSection, onNavigate }) => {
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: 'Home', tab: 'public' },
    ];

    switch (tab) {
      case 'public':
        if (subSection && subSection !== 'overview') {
          items.push({ label: 'College Info', tab: 'public' });
          if (subSection === 'programmes') items.push({ label: 'Schools & Programmes', active: true });
          else if (subSection === 'calendar') items.push({ label: 'Academic Calendar', active: true });
          else if (subSection === 'faq') items.push({ label: 'Frequently Asked Questions', active: true });
        } else {
          items.push({ label: 'Institutional Overview', active: true });
        }
        break;

      case 'admissions':
        items.push({ label: 'Admissions', tab: 'admissions' });
        if (subSection === 'form') {
          items.push({ label: 'Online Screening Form', active: true });
        } else if (subSection === 'screening') {
          items.push({ label: 'Applicant Screening Queue', active: true });
        } else {
          items.push({ label: 'Application Status & Screening', active: true });
        }
        break;

      case 'student':
        items.push({ label: 'Student Workspace', tab: 'student' });
        if (subSection === 'courses') {
          items.push({ label: 'Course Enrolment & Slips', active: true });
        } else if (subSection === 'results') {
          items.push({ label: 'Examination Results & Transcript', active: true });
        } else if (subSection === 'finance') {
          items.push({ label: 'Bursary Fees & Receipts', active: true });
        } else if (subSection === 'idcard') {
          items.push({ label: 'Student Identity Card', active: true });
        } else {
          items.push({ label: 'Enrolled Dashboard', active: true });
        }
        break;

      case 'lecturer':
        items.push({ label: 'Academic Faculty', tab: 'lecturer' });
        if (subSection === 'attendance') {
          items.push({ label: 'Farm & Lab Attendance Register', active: true });
        } else {
          items.push({ label: 'Continuous Assessment & Examination Marks', active: true });
        }
        break;

      case 'admin':
        items.push({ label: 'Institutional Admin', tab: 'admin' });
        if (subSection === 'settings') {
          items.push({ label: 'Academic & Session Settings', active: true });
        } else if (subSection === 'users') {
          items.push({ label: 'Users & RBAC Access Control', active: true });
        } else if (subSection === 'academics') {
          items.push({ label: 'Course Catalogue Offerings', active: true });
        } else if (subSection === 'results') {
          items.push({ label: 'Senate Result Moderation', active: true });
        } else if (subSection === 'finance') {
          items.push({ label: 'Bursary Collection Ledger', active: true });
        } else if (subSection === 'audit') {
          items.push({ label: 'Security & Activity Audit Trail', active: true });
        } else if (subSection === 'cms') {
          items.push({ label: 'Content Management (CMS)', active: true });
        } else {
          items.push({ label: 'Executive Analytics', active: true });
        }
        break;

      case 'builder':
        items.push({ label: 'Visual Page Builder', active: true });
        break;

      default:
        items.push({ label: tab, active: true });
    }

    return items;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2 text-xs transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center flex-wrap gap-1.5 text-slate-500 dark:text-slate-400">
        {breadcrumbs.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === breadcrumbs.length - 1;

          return (
            <React.Fragment key={index}>
              {!isFirst && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              )}
              {isLast || !item.tab ? (
                <span className="font-semibold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                  {isFirst && <Home className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </span>
              ) : (
                <button
                  onClick={() => onNavigate(item.tab!, item.subSection)}
                  className="hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition flex items-center gap-1 cursor-pointer font-medium"
                >
                  {isFirst && <Home className="w-3.5 h-3.5" />}
                  <span>{item.label}</span>
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
