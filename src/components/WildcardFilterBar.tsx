import React from 'react';
import { Search, X, Filter } from 'lucide-react';

export interface FilterFacet {
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  facets?: FilterFacet[];
  totalCount?: number;
  filteredCount?: number;
  onReset?: () => void;
  className?: string;
}

export const WildcardFilterBar: React.FC<Props> = ({
  query,
  onQueryChange,
  placeholder = 'Wildcard filter (supports * and ? e.g. AGT* or *Blessing*)...',
  facets = [],
  totalCount,
  filteredCount,
  onReset,
  className = '',
}) => {
  const hasActiveFilters = Boolean(query.trim()) || facets.some((f) => Boolean(f.value));

  const handleReset = () => {
    onQueryChange('');
    facets.forEach((f) => f.onChange(''));
    onReset?.();
  };

  return (
    <div
      className={`bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-2.5 ${className}`}
    >
      <div className="relative flex-1 min-w-[220px]">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {facets.map((facet) => (
        <div key={facet.key} className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
          <select
            aria-label={facet.label}
            value={facet.value}
            onChange={(e) => facet.onChange(e.target.value)}
            className="px-2.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-[210px]"
          >
            <option value="">{facet.label}: All</option>
            {facet.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {(totalCount !== undefined || filteredCount !== undefined) && (
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap px-1">
          {filteredCount ?? 0}
          {totalCount !== undefined ? ` / ${totalCount}` : ''} records
        </span>
      )}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
        >
          Reset
        </button>
      )}
    </div>
  );
};
