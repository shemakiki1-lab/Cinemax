import React, { useState, useEffect, useCallback } from "react";
import { Heart, Lock, Calendar, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { MovieCard } from "./MovieCard";
import { tmdb } from "../utils/tmdb";
import { Movie } from "../types";

const API_BASE =
  (typeof import.meta === "object" && (import.meta as any).env?.VITE_API_BASE_URL)
    ? String((import.meta as any).env.VITE_API_BASE_URL).replace(/\/+$/, "")
    : "";

// TMDB genre IDs: Romance = 10749, Drama = 18
const ROMANCE_GENRE_ID = 10749;
const DRAMA_GENRE_ID = 18;

export const GensPage: React.FC = () => {
  const { user, setCurrentView, setSelectedMovie } = useApp();
  const [romance, setRomance] = useState<Movie[]>([]);
  const [dramas, setDramas] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessReason, setAccessReason] = useState("");

  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const [romanceData, dramaData] = await Promise.all([
        tmdb.discoverMoviesByGenre(ROMANCE_GENRE_ID, 1, "popularity.desc"),
        tmdb.discoverMoviesByGenre(DRAMA_GENRE_ID, 1, "vote_average.desc"),
      ]);
      setRomance((romanceData.results || []).slice(0, 24));
      setDramas((dramaData.results || []).slice(0, 24));
    } catch (err) {
      console.error("Failed to fetch Gens content:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const checkAgeRestriction = async () => {
      if (!user) {
        setAccessDenied(true);
        setAccessReason("Please sign in to access this page.");
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/age-verification`, {
          credentials: "include",
        });
        const data = await response.json();
        if (cancelled) return;

        if (!data.allowed) {
          setAccessDenied(true);
          setAccessReason(data.reason || "Age restriction applies to this content.");
        } else {
          setAccessDenied(false);
          fetchContent();
        }
      } catch {
        if (!cancelled) {
          setAccessDenied(true);
          setAccessReason("Unable to verify age at this time. Please try again later.");
        }
      }
    };

    checkAgeRestriction();
    return () => {
      cancelled = true;
    };
  }, [user, fetchContent]);

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-8 text-center">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
            <p className="text-neutral-300 mb-6">{accessReason}</p>
            <div className="bg-black/30 rounded-xl p-4 text-left text-sm text-neutral-400">
              <p className="font-semibold text-white mb-2">Access Policy</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>You must be at least 18 years old to enter Gens.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>
                    Your age is recalculated automatically from your date of birth,
                    so access unlocks the day you turn 18.
                  </span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentView("home")}
              className="mt-6 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-white p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#39FF14]/30 border-t-[#39FF14] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-neutral-400">Loading content…</p>
          </div>
        </div>
      </div>
    );
  }

  const renderRow = (title: string, subtitle: string, items: Movie[]) => (
    <section className="max-w-7xl mx-auto mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-neutral-500 text-sm">No content available.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {items.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onClick={() => setSelectedMovie(movie)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-4 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-red-500 rounded-2xl flex items-center justify-center">
            <Heart className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent">
              Gens
            </h1>
            <p className="text-neutral-400">Romance & top-rated drama for the 18+ crowd</p>
          </div>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-400">18+ Only</p>
            <p className="text-neutral-400">
              Gens is restricted to users aged 18 and over. Your age is recalculated
              from your date of birth each visit, so access opens automatically the
              day you become eligible.
            </p>
          </div>
        </div>
      </div>

      {renderRow("Romance", "Curated from TMDB — Romance genre", romance)}
      {renderRow("Top-Rated Drama", "Highly rated dramas from TMDB", dramas)}
    </div>
  );
};
