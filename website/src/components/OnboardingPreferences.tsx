import React, { useState } from "react";
import { Sparkles, ArrowRight, X, Clock, Film, Star, Heart, Zap, Shield, Music, Tv, Ghost, Flame, Crown } from "lucide-react";

interface OnboardingPreferencesProps {
  isOpen: boolean;
  onComplete: (preferences: UserOnboardingData) => Promise<void>;
  onSkip?: () => void;
}

export interface UserOnboardingData {
  age: string;
  favoriteGenres: string[];
}

const GENRE_OPTIONS = [
  { id: "action", name: "Action", icon: Zap, color: "from-red-500 to-orange-500" },
  { id: "comedy", name: "Comedy", icon: Heart, color: "from-pink-500 to-rose-500" },
  { id: "drama", name: "Drama", icon: Star, color: "from-purple-500 to-indigo-500" },
  { id: "horror", name: "Horror", icon: Ghost, color: "from-gray-700 to-gray-900" },
  { id: "romance", name: "Romance", icon: Heart, color: "from-red-400 to-pink-500" },
  { id: "thriller", name: "Thriller", icon: Shield, color: "from-blue-600 to-cyan-500" },
  { id: "sci-fi", name: "Sci-Fi", icon: Crown, color: "from-violet-500 to-purple-600" },
  { id: "animation", name: "Animation", icon: Sparkles, color: "from-yellow-400 to-orange-400" },
  { id: "documentary", name: "Documentary", icon: Tv, color: "from-emerald-500 to-teal-500" },
  { id: "music", name: "Musical", icon: Music, color: "from-fuchsia-500 to-pink-500" },
  { id: "fantasy", name: "Fantasy", icon: Crown, color: "from-indigo-500 to-purple-500" },
  { id: "crime", name: "Crime", icon: Shield, color: "from-slate-700 to-gray-800" },
];

const AGE_RANGES = [
  { id: "13-17", label: "13-17" },
  { id: "18-24", label: "18-24" },
  { id: "25-34", label: "25-34" },
  { id: "35-44", label: "35-44" },
  { id: "45-54", label: "45-54" },
  { id: "55+", label: "55+" },
];

export const OnboardingPreferences: React.FC<OnboardingPreferencesProps> = ({
  isOpen,
  onComplete,
  onSkip,
}) => {
  const [age, setAge] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleGenre = (genreId: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genreId)
        ? prev.filter((id) => id !== genreId)
        : [...prev, genreId].slice(0, 5) // Max 5 genres
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!age || selectedGenres.length === 0) {
      return;
    }
    setSubmitting(true);
    await onComplete({ age, favoriteGenres: selectedGenres });
    setSubmitting(false);
  };

  const handleSkip = () => {
    if (onSkip) onSkip();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl animate-slide-up">
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 z-20 rounded-xl bg-white/5 p-2 text-neutral-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-[#39FF14]/10 to-transparent p-6 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-full bg-[#39FF14]/20 p-3">
              <Sparkles className="h-6 w-6 text-[#39FF14]" />
            </div>
            <div>
              <h2 className="font-sans text-2xl font-bold text-white">Personalize Your Experience</h2>
              <p className="text-sm text-neutral-400">Tell us about yourself to get tailored recommendations</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Age Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Your Age Range
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {AGE_RANGES.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => setAge(range.id)}
                  className={`relative px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    age === range.id
                      ? "bg-[#39FF14] text-black font-bold"
                      : "bg-white/5 text-neutral-300 hover:bg-white/10"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genre Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-4">
              Favorite Genres <span className="text-neutral-500">(Select up to 5)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {GENRE_OPTIONS.map((genre) => {
                const Icon = genre.icon;
                const isSelected = selectedGenres.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => toggleGenre(genre.id)}
                    disabled={!isSelected && selectedGenres.length >= 5}
                    className={`relative group p-4 rounded-xl text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-gradient-to-br " + genre.color + " text-white border-2 border-white/30"
                        : "bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/5"
                    } ${!isSelected && selectedGenres.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${isSelected ? "bg-white/20" : "bg-white/10"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="font-semibold text-sm">{genre.name}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="h-5 w-5 rounded-full bg-white/30 flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 px-6 py-3 rounded-xl text-sm font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={!age || selectedGenres.length === 0 || submitting}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#39FF14] text-black text-sm font-bold hover:bg-[#39FF14]/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Saving...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
