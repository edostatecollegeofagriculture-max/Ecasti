import React, { useState, useEffect, useMemo } from 'react';
import { NewsArticle, HeroSlide } from '../types';
import { api } from '../services/api';
import { readImageFileAsDataUrl } from '../utils/imageUpload';
import { matchesWildcard } from '../utils/wildcard';
import { WildcardFilterBar } from './WildcardFilterBar';
import {
  FileText,
  Sliders,
  Plus,
  CheckCircle,
  Eye,
  Trash2,
  Edit,
  Star,
  StarOff,
  MoveUp,
  MoveDown,
  AlertTriangle,
  Layers,
  X,
  Upload,
  Image as ImageIcon,
  Palette,
  RotateCcw,
} from 'lucide-react';
import { NewsArticleModal } from './NewsArticleModal';
import {
  HERO_COLOR_PRESETS,
  HERO_COLOR_CONTROLS,
  EMPTY_HERO_COLORS,
  getHeroSlideStyles,
  hasCustomHeroBackground,
} from '../utils/heroTheme';

export const ContentManagementModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'articles' | 'slides'>('articles');

  // Articles state
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [articleCategory, setArticleCategory] = useState<string>('');
  const [articleStatus, setArticleStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Article Modal Form
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    summary: '',
    content: '',
    category: 'Academics' as NewsArticle['category'],
    status: 'PUBLISHED' as NewsArticle['status'],
    author: 'Office of Information & Protocol',
    isFeaturedInSlider: false,
    imageUrl: '',
  });

  // Slides state
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [slideSearchQuery, setSlideSearchQuery] = useState('');
  const [slideActiveFilter, setSlideActiveFilter] = useState('');
  const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slideForm, setSlideForm] = useState({
    title: '',
    subtitle: '',
    badge: '2025/2026 Admissions Open',
    bgGradient: 'from-emerald-950 via-emerald-900 to-slate-950',
    accentColor: 'amber-400',
    imageUrl: '',
    ctaText: 'Apply for Admission Online',
    ctaTab: 'admissions',
    ctaSubSection: 'form',
    iconName: 'Sparkles',
    order: 1,
    isActive: true,
    ...EMPTY_HERO_COLORS,
  });

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [artRes, slideRes] = await Promise.all([api.getNews(), api.getSlides()]);

      if (artRes.success && artRes.articles) {
        setArticles(artRes.articles);
      }
      if (slideRes.success && slideRes.slides) {
        setSlides(slideRes.slides);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load CMS data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (articleCategory && a.category !== articleCategory) return false;
      if (articleStatus && a.status !== articleStatus) return false;
      return matchesWildcard(searchQuery, a.title, a.summary, a.category, a.author, a.status);
    });
  }, [articles, articleCategory, articleStatus, searchQuery]);

  const filteredSlides = useMemo(() => {
    return slides.filter((s) => {
      if (slideActiveFilter === 'ACTIVE' && !s.isActive) return false;
      if (slideActiveFilter === 'INACTIVE' && s.isActive) return false;
      return matchesWildcard(slideSearchQuery, s.title, s.subtitle, s.badge, s.ctaText, s.ctaTab);
    });
  }, [slides, slideActiveFilter, slideSearchQuery]);

  // Handle Article Create / Edit
  const openArticleModal = (article?: NewsArticle) => {
    if (article) {
      setEditingArticleId(article.id);
      setArticleForm({
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
        status: article.status,
        author: article.author,
        isFeaturedInSlider: article.isFeaturedInSlider,
        imageUrl: article.imageUrl || '',
      });
    } else {
      setEditingArticleId(null);
      setArticleForm({
        title: '',
        summary: '',
        content: '',
        category: 'Academics',
        status: 'PUBLISHED',
        author: 'Office of Information & Protocol',
        isFeaturedInSlider: false,
        imageUrl: '',
      });
    }
    setIsArticleModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleForm.title || !articleForm.summary || !articleForm.content) {
      showNotification('Please fill out all mandatory article fields.', 'error');
      return;
    }

    try {
      if (editingArticleId) {
        await api.updateNewsArticle(editingArticleId, articleForm);
        showNotification('Article updated successfully.');
      } else {
        await api.createNewsArticle(articleForm);
        showNotification('New article published successfully.');
      }
      setIsArticleModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error saving article.', 'error');
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await api.deleteNewsArticle(id);
      setConfirmDeleteKey(null);
      showNotification('Article removed from portal.');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error deleting article.', 'error');
    }
  };

  const handleToggleSliderFeatured = async (id: string) => {
    try {
      const res = await api.toggleNewsSlider(id);
      if (res.success) {
        showNotification(
          res.isFeaturedInSlider
            ? 'Article pinned to News Slide Show.'
            : 'Article unpinned from News Slide Show.'
        );
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Error toggling slider state.', 'error');
    }
  };

  // Handle Slide Create / Edit
  const openSlideModal = (slide?: HeroSlide) => {
    if (slide) {
      setEditingSlideId(slide.id);
      setSlideForm({
        title: slide.title,
        subtitle: slide.subtitle,
        badge: slide.badge,
        bgGradient: slide.bgGradient,
        accentColor: slide.accentColor,
        imageUrl: slide.imageUrl || '',
        ctaText: slide.ctaText,
        ctaTab: slide.ctaTab,
        ctaSubSection: slide.ctaSubSection,
        iconName: slide.iconName,
        order: slide.order,
        isActive: slide.isActive,
        bgColor: slide.bgColor || '',
        bgSecondaryColor: slide.bgSecondaryColor || '',
        textColor: slide.textColor || '',
        subtitleColor: slide.subtitleColor || '',
        accentHex: slide.accentHex || '',
        ctaBgColor: slide.ctaBgColor || '',
        ctaTextColor: slide.ctaTextColor || '',
        secondaryBtnBgColor: slide.secondaryBtnBgColor || '',
        secondaryBtnTextColor: slide.secondaryBtnTextColor || '',
        footerBarBgColor: slide.footerBarBgColor || '',
      });
    } else {
      setEditingSlideId(null);
      setSlideForm({
        title: '',
        subtitle: '',
        badge: 'College Announcement',
        bgGradient: 'from-emerald-950 via-emerald-900 to-slate-950',
        accentColor: 'amber-400',
        imageUrl: '',
        ctaText: 'Learn More',
        ctaTab: 'public',
        ctaSubSection: 'overview',
        iconName: 'Sparkles',
        order: slides.length + 1,
        isActive: true,
        ...EMPTY_HERO_COLORS,
      });
    }
    setIsSlideModalOpen(true);
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideForm.title || !slideForm.subtitle) {
      showNotification('Slide title and subtitle are required.', 'error');
      return;
    }

    try {
      if (editingSlideId) {
        await api.updateSlide(editingSlideId, slideForm);
        showNotification('Slide updated successfully.');
      } else {
        await api.createSlide(slideForm);
        showNotification('New slide added to slideshow.');
      }
      setIsSlideModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error saving slide.', 'error');
    }
  };

  const handleDeleteSlide = async (id: string) => {
    try {
      await api.deleteSlide(id);
      setConfirmDeleteKey(null);
      showNotification('Slide deleted.');
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error deleting slide.', 'error');
    }
  };

  const handleToggleSlideActive = async (slide: HeroSlide) => {
    try {
      await api.updateSlide(slide.id, { isActive: !slide.isActive });
      showNotification(`Slide is now ${!slide.isActive ? 'Active' : 'Inactive'}.`);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error updating slide.', 'error');
    }
  };

  const handleMoveSlide = async (slide: HeroSlide, direction: 'up' | 'down') => {
    const currentIndex = slides.findIndex((s) => s.id === slide.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= slides.length) return;

    const otherSlide = slides[targetIndex];
    try {
      await Promise.all([
        api.updateSlide(slide.id, { order: otherSlide.order }),
        api.updateSlide(otherSlide.id, { order: slide.order }),
      ]);
      loadData();
    } catch (err: any) {
      showNotification(err.message || 'Error reordering slides.', 'error');
    }
  };

  const handleArticleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, { maxDimension: 1200, quality: 0.85 });
      setArticleForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      showNotification('Article cover image loaded.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to read image.', 'error');
    }
  };

  const handleSlideImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, { maxDimension: 1400, quality: 0.85 });
      setSlideForm((prev) => ({ ...prev, imageUrl: dataUrl }));
      showNotification('Hero slide background image loaded.');
    } catch (err: any) {
      showNotification(err.message || 'Failed to read image.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Metrics */}
      <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-6 rounded-2xl border border-amber-500/30 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
              <Layers className="w-4 h-4" /> Integrated Publishing &amp; Portal Communications
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">
              Content Management System (CMS)
            </h2>
            <p className="text-xs sm:text-sm text-emerald-200 mt-1 max-w-2xl">
              Publish news bulletins with cover imagery, manage hero slideshow banners, and broadcast announcements across EDOCASTI.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openArticleModal()}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> New Article
            </button>
            <button
              onClick={() => openSlideModal()}
              className="px-4 py-2.5 bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl border border-emerald-600 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Slide
            </button>
          </div>
        </div>

        {/* CMS Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-emerald-800/60 text-xs">
          <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800">
            <div className="text-emerald-300">Total Published Articles</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
              {articles.filter((a) => a.status === 'PUBLISHED').length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800">
            <div className="text-emerald-300">Featured in Slide Show</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
              {articles.filter((a) => a.isFeaturedInSlider).length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800">
            <div className="text-emerald-300">Active Hero Slides</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
              {slides.filter((s) => s.isActive).length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-900/60 border border-emerald-800">
            <div className="text-emerald-300">Total Bulletin Views</div>
            <div className="text-xl font-black text-amber-400 mt-0.5 tabular-nums">
              {articles.reduce((acc, a) => acc + (a.views || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-3 border text-xs font-semibold rounded-xl flex items-center justify-between gap-2 ${
            statusMessage.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/70 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-100 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <span className="flex items-center gap-2">
            {statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            )}
            {statusMessage.text}
          </span>
          <button onClick={() => setStatusMessage(null)} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Segmented Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('articles')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'articles'
              ? 'bg-emerald-900 text-amber-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" /> News &amp; Press Articles ({articles.length})
        </button>

        <button
          onClick={() => setActiveTab('slides')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'slides'
              ? 'bg-emerald-900 text-amber-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" /> Hero Slide Show Manager ({slides.length})
        </button>
      </div>

      {/* ================= ARTICLES TAB ================= */}
      {activeTab === 'articles' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WildcardFilterBar
              className="flex-1"
              query={searchQuery}
              onQueryChange={setSearchQuery}
              placeholder="Wildcard filter articles (e.g. *Admissions*, Academic*, *Registrar*)..."
              totalCount={articles.length}
              filteredCount={filteredArticles.length}
              facets={[
                {
                  key: 'category',
                  label: 'Category',
                  value: articleCategory,
                  onChange: setArticleCategory,
                  options: [
                    { value: 'Admissions', label: 'Admissions' },
                    { value: 'Academics', label: 'Academics' },
                    { value: 'Research & Farm', label: 'Research & Farm' },
                    { value: 'Campus Life', label: 'Campus Life' },
                    { value: 'Notice', label: 'Notice' },
                  ],
                },
                {
                  key: 'status',
                  label: 'Status',
                  value: articleStatus,
                  onChange: setArticleStatus,
                  options: [
                    { value: 'PUBLISHED', label: 'Published' },
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'ARCHIVED', label: 'Archived' },
                  ],
                },
              ]}
            />
            <button
              onClick={() => openArticleModal()}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" /> Create Article
            </button>
          </div>

          {/* Articles Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold">
                  <tr>
                    <th className="p-3.5">Headline &amp; Cover</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Slide Show Pin</th>
                    <th className="p-3.5">Author &amp; Date</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading && articles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Loading articles...
                      </td>
                    </tr>
                  ) : filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">
                        No articles match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3.5 max-w-sm">
                          <div className="flex items-center gap-3">
                            {art.imageUrl ? (
                              <img
                                src={art.imageUrl}
                                alt={art.title}
                                className="w-12 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                                <ImageIcon className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                                {art.title}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 line-clamp-1 text-[11px] mt-0.5">
                                {art.summary}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                            {art.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              art.status === 'PUBLISHED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                : art.status === 'DRAFT'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {art.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <button
                            onClick={() => handleToggleSliderFeatured(art.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer border whitespace-nowrap ${
                              art.isFeaturedInSlider
                                ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-400 text-amber-900 dark:text-amber-300'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                            title="Toggle featured status in news slider"
                          >
                            {art.isFeaturedInSlider ? (
                              <>
                                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                                <span>Pinned</span>
                              </>
                            ) : (
                              <>
                                <StarOff className="w-3.5 h-3.5 text-slate-400" />
                                <span>Unpinned</span>
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="truncate max-w-[140px]">{art.author}</div>
                          <div>{new Date(art.publishedAt).toLocaleDateString()}</div>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedArticle(art)}
                              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition cursor-pointer"
                              title="Preview article"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openArticleModal(art)}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                              title="Edit article"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {confirmDeleteKey === `art-${art.id}` ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteArticle(art.id)}
                                  className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="px-1.5 py-1 bg-slate-200 dark:bg-slate-700 text-[10px] rounded cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteKey(`art-${art.id}`)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition cursor-pointer"
                                title="Delete article"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= HERO SLIDES TAB ================= */}
      {activeTab === 'slides' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WildcardFilterBar
              className="flex-1"
              query={slideSearchQuery}
              onQueryChange={setSlideSearchQuery}
              placeholder="Wildcard filter hero slides (e.g. *Agric*, Admission*)..."
              totalCount={slides.length}
              filteredCount={filteredSlides.length}
              facets={[
                {
                  key: 'active',
                  label: 'Visibility',
                  value: slideActiveFilter,
                  onChange: setSlideActiveFilter,
                  options: [
                    { value: 'ACTIVE', label: 'Active Only' },
                    { value: 'INACTIVE', label: 'Disabled Only' },
                  ],
                },
              ]}
            />
            <button
              onClick={() => openSlideModal()}
              className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" /> Add New Slide
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredSlides.map((slide, idx) => (
              <div
                key={slide.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs hover:border-emerald-600/50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveSlide(slide, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 cursor-pointer"
                      title="Move slide up"
                    >
                      <MoveUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSlide(slide, 'down')}
                      disabled={idx === filteredSlides.length - 1}
                      className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-200 cursor-pointer"
                      title="Move slide down"
                    >
                      <MoveDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {slide.imageUrl ? (
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-16 h-12 rounded-xl object-cover border border-emerald-700 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-emerald-950 text-amber-400 font-black flex items-center justify-center text-sm border border-emerald-800 shrink-0">
                      {idx + 1}
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        {slide.badge}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          slide.isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {slide.isActive ? 'Active' : 'Disabled'}
                      </span>
                      {slide.imageUrl && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          Custom Image
                        </span>
                      )}
                      {(slide.bgColor || slide.accentHex || slide.ctaBgColor) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                          <span
                            style={{ backgroundColor: slide.bgColor || '#022c22' }}
                            className="w-2.5 h-2.5 rounded-full border border-slate-300"
                          />
                          <span
                            style={{ backgroundColor: slide.accentHex || '#fbbf24' }}
                            className="w-2.5 h-2.5 rounded-full border border-slate-300"
                          />
                          Custom Theme
                        </span>
                      )}
                    </div>
                    <div className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base truncate">
                      {slide.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 max-w-xl">
                      {slide.subtitle}
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      CTA: <strong>{slide.ctaText}</strong> → /{slide.ctaTab} ({slide.ctaSubSection})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => handleToggleSlideActive(slide)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
                      slide.isActive
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {slide.isActive ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    onClick={() => openSlideModal(slide)}
                    className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition cursor-pointer"
                    title="Edit slide"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  {confirmDeleteKey === `sld-${slide.id}` ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDeleteKey(null)}
                        className="px-1.5 py-1 bg-slate-200 dark:bg-slate-700 text-[10px] rounded cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteKey(`sld-${slide.id}`)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-lg transition cursor-pointer"
                      title="Delete slide"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= ARTICLE CREATE / EDIT MODAL ================= */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-800/40 dark:border-emerald-600/30 overflow-hidden my-6">
            <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-5 flex items-center justify-between border-b border-amber-500/30">
              <div className="font-black text-base sm:text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>{editingArticleId ? 'Edit News Article' : 'Publish New College Bulletin'}</span>
              </div>
              <button
                onClick={() => setIsArticleModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Article Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  value={articleForm.title}
                  onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                  placeholder="e.g. Academic Board Releases 2025/2026 Admissions List"
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={articleForm.category}
                    onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Admissions">Admissions</option>
                    <option value="Academics">Academics</option>
                    <option value="Research & Farm">Research &amp; Farm</option>
                    <option value="Campus Life">Campus Life</option>
                    <option value="Notice">Notice</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Publishing Status
                  </label>
                  <select
                    value={articleForm.status}
                    onChange={(e) => setArticleForm({ ...articleForm, status: e.target.value as any })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="PUBLISHED">Published (Visible Publicly)</option>
                    <option value="DRAFT">Draft (Internal Only)</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
              </div>

              {/* Cover Image Upload & URL */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Bulletin Cover Image (Upload or URL)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {articleForm.imageUrl && (
                    <img
                      src={articleForm.imageUrl}
                      alt="Cover preview"
                      className="w-20 h-14 rounded-lg object-cover border border-slate-300 dark:border-slate-600"
                    />
                  )}
                  <label className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Upload Image
                    <input type="file" accept="image/*" onChange={handleArticleImageUpload} className="hidden" />
                  </label>
                  {articleForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setArticleForm({ ...articleForm, imageUrl: '' })}
                      className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={articleForm.imageUrl}
                  onChange={(e) => setArticleForm({ ...articleForm, imageUrl: e.target.value })}
                  placeholder="Or paste image URL (https://...)"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Author / Directorate
                </label>
                <input
                  type="text"
                  value={articleForm.author}
                  onChange={(e) => setArticleForm({ ...articleForm, author: e.target.value })}
                  placeholder="e.g. Office of the College Registrar"
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Executive Summary / Excerpt *
                </label>
                <textarea
                  rows={2}
                  required
                  value={articleForm.summary}
                  onChange={(e) => setArticleForm({ ...articleForm, summary: e.target.value })}
                  placeholder="Brief 1-2 sentence lead overview for news feeds and previews..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Article Content *
                </label>
                <textarea
                  rows={5}
                  required
                  value={articleForm.content}
                  onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                  placeholder="Comprehensive announcement, directives, and details..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredSliderCheck"
                  checked={articleForm.isFeaturedInSlider}
                  onChange={(e) => setArticleForm({ ...articleForm, isFeaturedInSlider: e.target.checked })}
                  className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="featuredSliderCheck" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  Pin this article to the News Slide Show ticker on the homepage
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsArticleModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {editingArticleId ? 'Save Changes' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= HERO SLIDE CREATE / EDIT MODAL ================= */}
      {isSlideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-800/40 dark:border-emerald-600/30 overflow-hidden my-6">
            <div className="bg-linear-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white p-5 flex items-center justify-between border-b border-amber-500/30">
              <div className="font-black text-base sm:text-lg flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>{editingSlideId ? 'Edit Hero Slide' : 'Add New Slide to Sequence'}</span>
              </div>
              <button
                onClick={() => setIsSlideModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSlide} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Slide Headline Title *
                </label>
                <input
                  type="text"
                  required
                  value={slideForm.title}
                  onChange={(e) => setSlideForm({ ...slideForm, title: e.target.value })}
                  placeholder="e.g. Modern Greenhouse Irrigation & Agro-Mechanization"
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subtitle Narrative *
                </label>
                <textarea
                  rows={2}
                  required
                  value={slideForm.subtitle}
                  onChange={(e) => setSlideForm({ ...slideForm, subtitle: e.target.value })}
                  placeholder="Compelling statement on the feature or announcement..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Live Mini Hero Color Preview */}
              {(() => {
                const miniStyles = getHeroSlideStyles(slideForm);
                const customBg = hasCustomHeroBackground(slideForm);
                return (
                  <div
                    style={miniStyles.containerStyle}
                    className={`relative overflow-hidden rounded-2xl border border-emerald-800/40 text-white ${
                      customBg ? '' : `bg-linear-to-r ${slideForm.bgGradient}`
                    }`}
                  >
                    <div
                      style={miniStyles.gradientLayerStyle}
                      className={`absolute inset-0 ${customBg ? '' : `bg-linear-to-r ${slideForm.bgGradient}`}`}
                    />
                    {slideForm.imageUrl && (
                      <>
                        <img
                          src={slideForm.imageUrl}
                          alt="Live slide preview"
                          className="absolute inset-0 w-full h-full object-cover opacity-45"
                        />
                        <div
                          style={miniStyles.imageTintStyle}
                          className={`absolute inset-0 ${
                            customBg ? '' : 'bg-linear-to-r from-slate-950/90 via-emerald-950/75 to-slate-950/55'
                          }`}
                        />
                      </>
                    )}
                    <div className="relative z-10 p-4 space-y-2">
                      <span
                        style={miniStyles.badgeStyle}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-bold"
                      >
                        <span
                          style={miniStyles.dotAccentStyle}
                          className="w-1.5 h-1.5 rounded-full bg-amber-400"
                        />
                        {slideForm.badge || 'Badge Label'}
                      </span>
                      <div style={miniStyles.titleStyle} className="text-sm font-black leading-snug">
                        {slideForm.title || 'Hero Headline Preview'}
                      </div>
                      <div style={miniStyles.subtitleStyle} className="text-[11px] text-emerald-100 line-clamp-2">
                        {slideForm.subtitle || 'Hero subtitle description preview...'}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          style={miniStyles.ctaStyle}
                          className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-bold"
                        >
                          {slideForm.ctaText || 'CTA Button'}
                        </span>
                        <span
                          style={miniStyles.secondaryBtnStyle}
                          className="px-3 py-1 rounded-lg bg-emerald-900/80 text-white text-[10px] font-semibold border border-emerald-600/70"
                        >
                          Official Bulletin
                        </span>
                      </div>
                    </div>
                    <div
                      style={miniStyles.footerBarStyle}
                      className="relative z-10 px-4 py-1.5 border-t border-emerald-800/40 bg-emerald-950/50 flex items-center justify-between text-[10px]"
                    >
                      <span style={miniStyles.dotAccentStyle} className="w-5 h-1 rounded-full bg-amber-400" />
                      <span style={miniStyles.subtitleStyle} className="text-emerald-200/80">
                        Notice &amp; Bottom Bar
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Hero Color Customizer */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    Hero Background, Text &amp; Button Colors
                  </span>
                  <button
                    type="button"
                    onClick={() => setSlideForm((prev) => ({ ...prev, ...EMPTY_HERO_COLORS }))}
                    className="px-2 py-1 text-[10px] font-bold rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset Colors
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {HERO_COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSlideForm((prev) => ({ ...prev, ...preset.colors }))}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-emerald-600 text-[10px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span className="flex items-center gap-0.5">
                        {preset.swatch.map((hex, i) => (
                          <span
                            key={i}
                            style={{ backgroundColor: hex }}
                            className="w-2.5 h-2.5 rounded-full border border-slate-300"
                          />
                        ))}
                      </span>
                      {preset.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {HERO_COLOR_CONTROLS.map(({ key, label, fallback }) => {
                    const val = slideForm[key] || '';
                    return (
                      <div key={key} className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 truncate">
                          {label}
                        </label>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1">
                          <input
                            type="color"
                            value={val || fallback}
                            onChange={(e) => setSlideForm((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                          />
                          <input
                            type="text"
                            value={val}
                            onChange={(e) => setSlideForm((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={fallback}
                            className="w-full text-[10px] font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hero Slide Background Photo */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Slide Background Image (Upload or URL)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {slideForm.imageUrl && (
                    <img
                      src={slideForm.imageUrl}
                      alt="Slide preview"
                      className="w-24 h-14 rounded-lg object-cover border border-slate-300 dark:border-slate-600"
                    />
                  )}
                  <label className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Upload Slide Photo
                    <input type="file" accept="image/*" onChange={handleSlideImageUpload} className="hidden" />
                  </label>
                  {slideForm.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setSlideForm({ ...slideForm, imageUrl: '' })}
                      className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={slideForm.imageUrl}
                  onChange={(e) => setSlideForm({ ...slideForm, imageUrl: e.target.value })}
                  placeholder="Or paste image URL (https://...)"
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Badge Label
                  </label>
                  <input
                    type="text"
                    value={slideForm.badge}
                    onChange={(e) => setSlideForm({ ...slideForm, badge: e.target.value })}
                    placeholder="e.g. 2025/2026 Admissions Open"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Emblem Icon
                  </label>
                  <select
                    value={slideForm.iconName}
                    onChange={(e) => setSlideForm({ ...slideForm, iconName: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Sparkles">Sparkles (General)</option>
                    <option value="Tractor">Tractor (Agriculture &amp; Mechanization)</option>
                    <option value="GraduationCap">Graduation Cap (Admissions / Graduation)</option>
                    <option value="BookOpen">Book Open (Academics &amp; Science)</option>
                    <option value="Award">Award (Accreditation &amp; Quality)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CTA Button Label
                  </label>
                  <input
                    type="text"
                    value={slideForm.ctaText}
                    onChange={(e) => setSlideForm({ ...slideForm, ctaText: e.target.value })}
                    placeholder="e.g. Apply Online"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Portal Tab
                  </label>
                  <select
                    value={slideForm.ctaTab}
                    onChange={(e) => setSlideForm({ ...slideForm, ctaTab: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="public">Public Info</option>
                    <option value="admissions">Admissions</option>
                    <option value="student">Student Portal</option>
                    <option value="lecturer">Lecturer Portal</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sub-section
                  </label>
                  <input
                    type="text"
                    value={slideForm.ctaSubSection}
                    onChange={(e) => setSlideForm({ ...slideForm, ctaSubSection: e.target.value })}
                    placeholder="e.g. form, programmes"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="slideActiveCheck"
                  checked={slideForm.isActive}
                  onChange={(e) => setSlideForm({ ...slideForm, isActive: e.target.checked })}
                  className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                />
                <label htmlFor="slideActiveCheck" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  Slide is Active and visible in homepage rotation
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSlideModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  {editingSlideId ? 'Save Slide' : 'Add Slide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Article Reader Modal Preview */}
      <NewsArticleModal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        article={selectedArticle}
      />
    </div>
  );
};
