import React, { useState, useEffect } from 'react';
import { HeroSlide, NewsArticle } from '../types';
import { api } from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Calendar,
  BookOpen,
  Eye,
} from 'lucide-react';
import { NewsArticleModal } from './NewsArticleModal';
import { SchoolLogo } from './SchoolLogo';
import { getHeroSlideStyles, hasCustomHeroBackground } from '../utils/heroTheme';

interface Props {
  onNavigate: (tab: string, subSection?: string) => void;
}

export const NewsSlideShow: React.FC<Props> = ({ onNavigate }) => {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  // Load slides and featured news
  const loadContent = async () => {
    try {
      const [slidesRes, newsRes] = await Promise.all([
        api.getSlides({ activeOnly: true }).catch(() => ({ success: false, slides: [] })),
        api.getNews({ status: 'PUBLISHED' }).catch(() => ({ success: false, articles: [] })),
      ]);

      if (slidesRes.success && slidesRes.slides && slidesRes.slides.length > 0) {
        setSlides(slidesRes.slides);
      } else {
        // Fallback default slides
        setSlides([
          {
            id: 'slide-01',
            title: 'Excellence in Agricultural Mechanization & Food Security',
            subtitle: 'Empowering Nigeria’s next generation of agronomists, bio-environmental engineers, and agro-technologists with world-class practical skills at Iguoriakhi Main Campus.',
            badge: '2025/2026 Admissions Open',
            bgGradient: 'from-emerald-950 via-emerald-900 to-slate-950',
            accentColor: 'amber-400',
            ctaText: 'Apply for Admission Online',
            ctaTab: 'admissions',
            ctaSubSection: 'form',
            iconName: 'Sparkles',
            order: 1,
            isActive: true,
          },
          {
            id: 'slide-02',
            title: '1,500-Acre Demonstration Farms & Modernized Greenhouses',
            subtitle: 'From automated drip-line irrigation to high-yield cassava multiplication and commercial poultry breeding, experience cutting-edge hands-on technical education.',
            badge: 'Research & Field Practicum',
            bgGradient: 'from-green-950 via-emerald-900 to-amber-950',
            accentColor: 'amber-300',
            ctaText: 'Explore Academic Programmes',
            ctaTab: 'public',
            ctaSubSection: 'programmes',
            iconName: 'Tractor',
            order: 2,
            isActive: true,
          },
        ]);
      }

      if (newsRes.success && newsRes.articles) {
        setNews(newsRes.articles);
      }
    } catch (err) {
      console.error('Failed to load slideshow data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  // Keep the hero slideshow rotating continuously, including while the pointer is over it.
  useEffect(() => {
    if (slides.length < 2) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, [slides.length]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Avoid flashing the hard-coded fallback hero while the configured public slides load.
  // Keep the hero's footprint stable and neutral until its real slide/theme is ready.
  if (loading) {
    return (
      <div className="w-full" aria-busy="true" aria-label="Loading public highlights">
        <div className="relative min-h-[380px] sm:min-h-[440px] lg:min-h-[480px] overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-sm">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
              Loading campus highlights…
            </div>
          </div>
        </div>
        <div className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900" />
      </div>
    );
  }

  const currentSlide = slides[currentIndex] || slides[0];
  const heroStyles = getHeroSlideStyles(currentSlide);
  const hasSlideImage = Boolean(currentSlide?.imageUrl);
  const customBg = hasCustomHeroBackground(currentSlide) || hasSlideImage;
  const heroImageOverlay = currentSlide?.bgColor || currentSlide?.bgSecondaryColor
    ? `linear-gradient(90deg, ${currentSlide.bgColor || currentSlide.bgSecondaryColor}dd 0%, ${currentSlide.bgSecondaryColor || currentSlide.bgColor}99 65%, ${currentSlide.bgSecondaryColor || currentSlide.bgColor}66 100%)`
    : 'linear-gradient(90deg, rgba(2, 44, 34, 0.82) 0%, rgba(2, 44, 34, 0.48) 65%, rgba(2, 44, 34, 0.28) 100%)';

  // Find if there's a matching news article for the current slide
  const matchingArticle = news.find(
    (n) =>
      n.title.toLowerCase().includes(currentSlide?.badge.toLowerCase() || '') ||
      (currentSlide?.title && n.title.toLowerCase().includes(currentSlide.title.slice(0, 15).toLowerCase()))
  );

  return (
    <div className="w-full space-y-3">
      {/* Slideshow Frame */}
      <div
        style={heroStyles.containerStyle}
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl border-2 border-emerald-800/50 dark:border-amber-500/30 bg-slate-950 text-white min-h-[380px] sm:min-h-[440px] lg:min-h-[480px] flex flex-col justify-between"
      >
        {/* Configured slide image, with a readable colour overlay above it */}
        {hasSlideImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center transition-all duration-700 ease-in-out"
            style={{
              backgroundImage: `url(\"${currentSlide.imageUrl}\")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        {/* Background Image / Gradients & Geometric Accents */}
        <div
          style={hasSlideImage ? { background: heroImageOverlay } : heroStyles.gradientLayerStyle}
          className={`absolute inset-0 ${
            customBg
              ? ''
              : `bg-linear-to-br ${currentSlide?.bgGradient || 'from-emerald-950 via-emerald-900 to-slate-950'}`
          } transition-all duration-700 ease-in-out`}
        />
        {/* Hero background uses its configured colour treatment; slide image URLs are not rendered. */}
        <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:28px_28px] opacity-10 pointer-events-none" />

        {/* Heraldic Watermark Glow inside Slide */}
        <div className="absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -top-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* Top Header of Slideshow */}
        <div className="relative z-10 p-5 sm:p-7 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SchoolLogo variant="full" size={44} className="shrink-0 drop-shadow-lg" />
            <span
              style={heroStyles.badgeStyle}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-400/40 backdrop-blur-xs"
            >
              <span
                style={heroStyles.dotAccentStyle}
                className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"
              />
              {currentSlide?.badge || 'Campus Highlight'}
            </span>
            <span
              style={heroStyles.subtitleStyle}
              className="text-xs text-emerald-200/80 hidden sm:inline"
            >
              Slide {currentIndex + 1} of {slides.length}
            </span>
          </div>


        </div>

        {/* Slide Content Area */}
        <div className="relative z-10 px-6 sm:px-12 py-4 sm:py-6 max-w-4xl space-y-4 sm:space-y-6">
          <h2
            style={heroStyles.titleStyle}
            className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white drop-shadow-sm"
          >
            {currentSlide?.title}
          </h2>

          <p
            style={heroStyles.subtitleStyle}
            className="text-emerald-100/90 text-sm sm:text-base lg:text-lg leading-relaxed max-w-3xl font-medium"
          >
            {currentSlide?.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate(currentSlide.ctaTab, currentSlide.ctaSubSection)}
              style={heroStyles.ctaStyle}
              className="px-6 py-3 bg-amber-500 hover:brightness-110 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {currentSlide?.ctaText || 'Learn More'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {matchingArticle ? (
              <button
                onClick={() => setSelectedArticle(matchingArticle)}
                style={heroStyles.secondaryBtnStyle}
                className="px-5 py-3 bg-emerald-900/80 hover:brightness-110 text-white font-semibold text-xs sm:text-sm rounded-xl border border-emerald-600/80 transition flex items-center gap-2 cursor-pointer"
              >
                Read Official Bulletin{' '}
                <Eye
                  style={currentSlide?.accentHex ? { color: currentSlide.accentHex } : undefined}
                  className="w-4 h-4 text-amber-400"
                />
              </button>
            ) : (
              news.length > 0 && (
                <button
                  onClick={() => setSelectedArticle(news[0])}
                  style={heroStyles.secondaryBtnStyle}
                  className="px-5 py-3 bg-emerald-950/70 hover:brightness-110 text-emerald-200 hover:text-white font-semibold text-xs sm:text-sm rounded-xl border border-emerald-700/60 transition flex items-center gap-2 cursor-pointer"
                >
                  Latest News Bulletin{' '}
                  <BookOpen
                    style={currentSlide?.accentHex ? { color: currentSlide.accentHex } : undefined}
                    className="w-4 h-4 text-amber-400"
                  />
                </button>
              )
            )}
          </div>
        </div>

        {/* Bottom Slide Navigation Bar */}
        <div
          style={heroStyles.footerBarStyle}
          className="relative z-10 p-5 sm:p-7 flex items-center justify-between gap-4 border-t border-emerald-800/40 bg-emerald-950/50 backdrop-blur-xs"
        >
          {/* Slide Indicator Dots */}
          <div className="flex items-center gap-2">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setCurrentIndex(idx)}
                style={currentIndex === idx ? heroStyles.dotAccentStyle : undefined}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentIndex === idx
                    ? 'w-8 h-2 bg-amber-400'
                    : 'w-2 h-2 bg-emerald-600/60 hover:bg-emerald-400'
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Prev / Next Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              style={heroStyles.secondaryBtnStyle}
              className="p-2 sm:p-2.5 rounded-xl bg-emerald-900/80 hover:brightness-110 text-white border border-emerald-700 transition cursor-pointer"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToNext}
              style={heroStyles.secondaryBtnStyle}
              className="p-2 sm:p-2.5 rounded-xl bg-emerald-900/80 hover:brightness-110 text-white border border-emerald-700 transition cursor-pointer"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Article Reader Modal */}
      <NewsArticleModal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        article={selectedArticle}
      />
    </div>
  );
};
