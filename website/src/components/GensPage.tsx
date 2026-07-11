import React, { useState, useEffect } from "react";
import { Heart, Lock, Calendar, AlertTriangle, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { MovieCard } from "./MovieCard";
import { tmdb, getImageUrl } from "../utils/tmdb";
import { Movie } from "../types";

export const GensPage: React.FC = () => {
  const { user, setCurrentView } = useApp();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessReason, setAccessReason] = useState("");

  useEffect(() => {
    checkAgeRestriction();
  }, [user]);

  const checkAgeRestriction = async () => {
    if (!user?.onboarding?.age) {
      setAccessDenied(true);
      setAccessReason("You must complete onboarding to access this page.");
      return;
    }

    try {
      const response = await fetch(`${process.env.VITE_API_BASE || ''}/api/auth/age-verification`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (!data.allowed) {
        setAccessDenied(true);
        setAccessReason(data.reason || "Age restriction applies to this content.");
      } else {
        fetchRomanceContent();
      }
    } catch (err) {
      setAccessDenied(true);
      setAccessReason("Unable to verify age restrictions.");
    }
  };

  const fetchRomanceContent = async () => {
    setLoading(true);
    try {
      // Fetch romance movies (genre ID 10749)
      const romanceData = await tmdb.discoverMoviesByGenre(10749, 1, "popularity.desc");
      
      // Fetch popular movies with adult content
      const popularData = await tmdb.getPopularMovies(1);
      
      // Combine and deduplicate
      const allMovies = [...romanceData.results, ...popularData].filter(
        (movie, index, self) => index === self.findIndex((m) => m.id === movie.id)
      );

      setMovies(allMovies.slice(0, 50)); // Limit to 50 movies
    } catch (err) {
      console.error("Failed to fetch Gens content:", err);
    } finally {
      setLoading(false);
    }
  };

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
              <p className="font-semibold text-white mb-2">Age Restriction Policy:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>Must be at least 18 years old</span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <span>Must be under 36 years old</span>
                </li>
                <li className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span>Age is calculated dynamically based on your registration date</span>
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
            <p className="text-neutral-400">Loading content...</p>
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-neutral-400">Youth • Romance • Mature Content</p>
          </div>
        </div>

        {/* Age Warning Banner */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-400">Age-Restricted Content</p>
            <p className="text-neutral-400">
              This page contains mature content. Access is restricted to users aged 18-35 based on your registration date.
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto">
        {movies.length === 0 ? (
          <div className="text-center py-20 text-neutral-500">
            <Heart className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>No content available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {movies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onClick={() => {
                  // Handle movie click - would need to integrate with player
                  console.log("Clicked movie:", movie);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
