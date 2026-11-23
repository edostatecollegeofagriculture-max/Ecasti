import React from 'react';
import { NewsArticle } from '../types';
import { X, Calendar, User, Eye, Tag, Share2, Printer, Bookmark } from 'lucide-react';
import { SchoolLogo } from './SchoolLogo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  article: NewsArticle | null;
}

export const NewsArticleModal: React.FC<Props> = ({ isOpen, onClose, article }) => {
  if (!isOpen || !article) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-800/30 dark:border-emerald-600/30 overflow-hidden my-8">
        {/* Header Ribbon */}
        <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-5 flex items-start justify-between gap-4 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <SchoolLogo size={42} />
            <div>
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                EDOCASTI Official College Bulletin
              </span>
              <div className="text-xs text-emerald-200">
                Edo State College of Agriculture, Science and Technology
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition cursor-pointer"
            aria-label="Close article"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Article Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {article.category}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              {new Date(article.publishedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {article.author}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              {article.views || 1} views
            </span>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
            {article.title}
          </h1>

          {/* Lead Excerpt */}
          <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border-l-4 border-amber-500 text-slate-800 dark:text-amber-100 text-sm sm:text-base leading-relaxed font-medium">
            {article.summary}
          </div>

          {/* Full Content */}
          <div className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed space-y-4 whitespace-pre-line">
            {article.content}
          </div>

          {/* Footer note */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div>
              Published by the <strong>Directorate of Information & Protocol</strong>, EDOCASTI Iguoriakhi Main Campus.
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-200"
              >
                <Printer className="w-3.5 h-3.5" /> Print Article
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
