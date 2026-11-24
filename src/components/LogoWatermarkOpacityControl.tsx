import React, { useEffect, useState } from 'react';
import { Eye, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

/** Builder-only control for the global application logo watermark. */
export const LogoWatermarkOpacityControl: React.FC = () => {
  const { settings, refreshSettings } = useAuth();
  const [opacity, setOpacity] = useState(4);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOpacity(Math.round((settings?.logoWatermarkOpacity ?? 0.04) * 100));
  }, [settings?.logoWatermarkOpacity]);

  const saveOpacity = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const result = await api.updateSettings({
        ...settings,
        logoWatermarkOpacity: opacity / 100,
      });
      if (result.success) {
        await refreshSettings();
      }
    } catch (error) {
      console.error('Failed to save logo watermark opacity', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="Global background logo opacity"
      className="fixed bottom-5 right-5 z-[60] w-[min( calc(100vw-2.5rem), 19rem)] rounded-xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
        <Eye className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
        Background Logo Opacity
      </div>
      <div className="flex items-center gap-3">
        <input
          aria-label="Background logo opacity percentage"
          type="range"
          min="0"
          max="20"
          step="1"
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
          className="min-w-0 flex-1 accent-emerald-700"
        />
        <output className="w-10 text-right text-xs font-bold tabular-nums text-slate-700 dark:text-slate-200">
          {opacity}%
        </output>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-slate-500 dark:text-slate-400">Applies across all app pages.</p>
        <button
          type="button"
          onClick={saveOpacity}
          disabled={saving || !settings}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
};
