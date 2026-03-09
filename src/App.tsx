/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BookOpen, Plus, Library as LibraryIcon, ChevronRight, Settings, Search, FileText, Camera, Upload, Trash2, X, BrainCircuit, Sparkles, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, BarChart3, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPackage, Material, Question, QuizResult, AnalysisData } from "./types";
import { extractTextFromImage, generateQuiz, analyzePerformance, generateFlashcards, generateStudyGuide } from "./services/gemini";

// Components
import Library from "./components/Library";
import UploadModal from "./components/UploadModal";
import QuizView from "./components/QuizView";
import ResultsView from "./components/ResultsView";
import FlashcardsView from "./components/FlashcardsView";
import StudyGuideView from "./components/StudyGuideView";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";

type ViewState = "library" | "quiz" | "results" | "flashcards" | "study-guide" | "stats" | "settings";

export default function App() {
  const [view, setView] = useState<ViewState>("library");
  const [packages, setPackages] = useState<StudyPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<StudyPackage | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Question[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    const res = await fetch("/api/packages");
    const data = await res.json();
    setPackages(data);
  };

  const handleStartQuiz = async (pkg: StudyPackage) => {
    setIsLoading(true);
    setLoadingMessage("Analysiere Lernmaterialien...");
    try {
      const res = await fetch(`/api/packages/${pkg.id}/materials`);
      const materials: Material[] = await res.json();
      const fullContent = materials.map(m => m.content_text).join("\n\n");
      
      setLoadingMessage("Generiere Quizfragen...");
      const questions = await generateQuiz(fullContent, pkg.grade);
      setActiveQuiz(questions);
      setSelectedPackage(pkg);
      setView("quiz");
    } catch (error) {
      console.error(error);
      alert("Fehler bei der Quiz-Generierung.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (results: { question: Question; isCorrect: boolean }[]) => {
    if (!selectedPackage) return;
    
    setIsLoading(true);
    setLoadingMessage("Analysiere deine Performance...");
    
    const score = results.filter(r => r.isCorrect).length;
    const total = results.length;
    const accuracy = (score / total) * 100;
    
    const analysis = await analyzePerformance(results);
    
    const result: QuizResult = {
      id: crypto.randomUUID(),
      package_id: selectedPackage.id,
      score,
      total,
      accuracy,
      analysis: JSON.stringify(analysis)
    };

    await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    });

    setQuizResults(result);
    setView("results");
    setIsLoading(false);
  };

  const handleShowFlashcards = async () => {
    if (!selectedPackage) return;
    setView("flashcards");
  };

  const handleShowStudyGuide = async () => {
    if (!selectedPackage) return;
    setView("study-guide");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Sidebar (Desktop) */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 p-6 flex-col z-20">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <GraduationCap size={24} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">LernGenie</h1>
        </div>

        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => setView("library")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === "library" ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <LibraryIcon size={20} />
            <span>Bibliothek</span>
          </button>
          <button 
            onClick={() => setView("stats")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === "stats" ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <BarChart3 size={20} />
            <span>Statistiken</span>
          </button>
          <button 
            onClick={() => setView("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === "settings" ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <Settings size={20} />
            <span>Einstellungen</span>
          </button>
        </nav>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
        {/* Floating Action Button above footer */}
        {view === "library" && (
          <div className="flex justify-center mb-4">
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 transition-transform border border-indigo-500 min-h-[44px]"
            >
              <Plus size={24} />
              <span className="text-sm">Neues Paket</span>
            </button>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="bg-white border-t border-gray-200 px-6 py-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <button 
            onClick={() => setView("library")}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] ${view === "library" ? "text-indigo-600" : "text-gray-400"}`}
          >
            <LibraryIcon size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Bibliothek</span>
          </button>
          <button 
            onClick={() => setView("stats")}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] ${view === "stats" ? "text-indigo-600" : "text-gray-400"}`}
          >
            <BarChart3 size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Stats</span>
          </button>
          <button 
            onClick={() => setView("settings")}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] ${view === "settings" ? "text-indigo-600" : "text-gray-400"}`}
          >
            <Settings size={24} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Settings</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-100 px-6 py-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <GraduationCap size={18} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">LernGenie</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen pb-40 lg:pb-0 pt-[calc(4rem+env(safe-area-inset-top))] lg:pt-0">
        <div className="max-w-5xl mx-auto p-4 sm:p-8 pt-8 lg:pt-12">
          <AnimatePresence mode="wait">
            {view === "library" && (
              <motion.div
                key="library"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Deine Lernpakete</h2>
                    <p className="text-gray-500 text-sm sm:text-base">Wähle ein Thema oder erstelle ein neues Lernpaket.</p>
                  </div>
                  <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="hidden sm:flex bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold items-center gap-2 shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    <Plus size={20} />
                    Neues Paket
                  </button>
                </div>

                <Library 
                  packages={packages} 
                  onStartQuiz={handleStartQuiz}
                  onDelete={fetchPackages}
                />
              </motion.div>
            )}

            {view === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Deine Statistiken</h2>
                  <p className="text-gray-500 text-sm sm:text-base">Verfolge deinen Lernfortschritt und deine Erfolge.</p>
                </div>
                <StatsView />
              </motion.div>
            )}

            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Einstellungen</h2>
                  <p className="text-gray-500 text-sm sm:text-base">Passe dein Lernerlebnis individuell an.</p>
                </div>
                <SettingsView />
              </motion.div>
            )}

            {view === "quiz" && activeQuiz.length > 0 && (
              <QuizView 
                questions={activeQuiz} 
                onComplete={handleQuizComplete}
                onCancel={() => setView("library")}
              />
            )}

            {view === "results" && quizResults && selectedPackage && (
              <ResultsView 
                result={quizResults}
                package={selectedPackage}
                onBack={() => setView("library")}
                onShowFlashcards={handleShowFlashcards}
                onShowStudyGuide={handleShowStudyGuide}
                onRetry={() => handleStartQuiz(selectedPackage)}
              />
            )}

            {view === "flashcards" && selectedPackage && (
              <FlashcardsView 
                package={selectedPackage}
                onBack={() => setView("results")}
              />
            )}

            {view === "study-guide" && selectedPackage && (
              <StudyGuideView 
                package={selectedPackage}
                onBack={() => setView("results")}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchPackages();
        }}
      />

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center px-safe py-safe"
          >
            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
            <p className="text-xl font-bold text-gray-800 mb-2">{loadingMessage}</p>
            <p className="text-gray-500">Das dauert nur einen Moment...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
