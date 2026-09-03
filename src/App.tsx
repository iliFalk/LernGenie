/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Folder, 
  ChartLine, 
  Settings as SettingsIcon, 
  Add, 
  Search, 
  Notification, 
  Moon, 
  Sun, 
  User, 
  Menu, 
  Close,
  Education,
  Catalog,
  Information
} from "@carbon/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPackage, Question, QuizResult } from "./types";
import { getCachedQuiz, analyzePerformance } from "./services/gemini";
import { authFetch } from "./services/auth";

// Components
import Library from "./components/Library";
import UploadModal from "./components/UploadModal";
import QuizView from "./components/QuizView";
import ResultsView from "./components/ResultsView";
import FlashcardsView from "./components/FlashcardsView";
import StudyGuideView from "./components/StudyGuideView";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import PackageDetailView from "./components/PackageDetailView";

type ViewState = "library" | "quiz" | "results" | "flashcards" | "study-guide" | "stats" | "settings" | "package-detail";

export default function App() {
  const [view, setView] = useState<ViewState>("library");
  const [packages, setPackages] = useState<StudyPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<StudyPackage | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<Question[]>([]);
  const [quizResults, setQuizResults] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("dark_mode") === "true");
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);

  useEffect(() => {
    fetchPackages();
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  const fetchPackages = async () => {
    try {
      const res = await authFetch("/api/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(data);
      } else {
        console.error("Failed to fetch packages:", res.status, res.statusText);
      }
    } catch (err) {
      console.error("Failed to fetch packages:", err);
    }
  };

  const handleStartQuiz = async (pkg: StudyPackage, regenerate: boolean = false) => {
    setIsLoading(true);
    setLoadingMessage(regenerate ? "Generiere neue Quizfragen..." : "Lade Quiz...");
    try {
      const questions = await getCachedQuiz(pkg.id, regenerate);
      setActiveQuiz(questions);
      setSelectedPackage(pkg);
      setView("quiz");
    } catch (error: any) {
      console.error(error);
      alert("Fehler bei der Quiz-Generierung: " + (error?.message || "unbekannter Fehler"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (results: { question: Question; isCorrect: boolean }[]) => {
    if (!selectedPackage) return;
    
    setIsLoading(true);
    setLoadingMessage("Analysiere deine Performance...");
    
    try {
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

      await authFetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result)
      });

      setQuizResults(result);
      setView("results");
    } catch (error: any) {
      console.error("Failed to process quiz completion:", error);
      alert("Fehler beim Speichern der Antworten: " + (error?.message || "Verbindungsfehler"));
      setView("library");
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowFlashcards = async () => {
    if (!selectedPackage) return;
    setView("flashcards");
  };

  const handleShowStudyGuide = async () => {
    if (!selectedPackage) return;
    setView("study-guide");
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("dark_mode", next.toString());
  };

  return (
    <div className={`min-h-screen bg-[var(--cds-background)] text-[var(--cds-text-primary)] font-sans transition-colors ${darkMode ? 'dark' : ''} overflow-x-hidden`}>

      {/* ==========================================================================
          CARBON DESIGN SYSTEM UI SHELL: FOOTER (No Header)
          Height: 48px (3rem), Background: #161616, Border-Top: #393939
          ========================================================================== */}
      <footer className="fixed bottom-0 left-0 right-0 h-12 bg-[#161616] border-t border-[#393939] z-50 flex items-center justify-between px-0 select-none">
        
        {/* Left Section: Menu trigger + Brand */}
        <div className="flex items-center h-full">
          <button 
            id="menu-toggle"
            onClick={() => setIsSideNavOpen(!isSideNavOpen)}
            className="w-12 h-12 flex items-center justify-center text-white hover:bg-[#393939] border-r border-[#393939] transition-colors focus:outline-2 focus:outline-[#0f62fe] focus:outline-offset-[-2px] lg:hidden"
            aria-label="Side navigation toggle"
          >
            {isSideNavOpen ? <Close size={20} /> : <Menu size={20} />}
          </button>

          <div 
            onClick={() => {
              setView("library");
              setIsSideNavOpen(false);
            }}
            className="flex items-center h-full px-4 text-white hover:bg-[#262626] transition-colors cursor-pointer"
          >
            <span className="text-[#0f62fe] mr-2">
              <Education size={20} />
            </span>
            <span className="font-semibold text-sm tracking-tight text-white">LernGenie</span>
          </div>
        </div>

        {/* Center: Current Context Breadcrumb (Hidden on small mobile) */}
        <div className="hidden md:flex items-center text-xs text-[#c6c6c6] font-mono">
          <span className="hover:text-white cursor-pointer" onClick={() => setView("library")}>Lernpakete</span>
          <span className="mx-2 text-[#6f6f6f]">/</span>
          <span className="text-white font-medium capitalize">
            {view === "library" && "Bibliothek"}
            {view === "package-detail" && (selectedPackage?.name || "Detail")}
            {view === "quiz" && "Quiz-Modus"}
            {view === "results" && "Auswertung"}
            {view === "flashcards" && "Flashcards"}
            {view === "study-guide" && "Study Guide"}
            {view === "stats" && "Statistiken"}
            {view === "settings" && "Einstellungen"}
          </span>
        </div>

        {/* Right Section: Global Action Bar */}
        <div className="flex items-center h-full">
          {/* Quick Add (Visible on Desktop Footer) */}
          <button 
            id="btn-footer-new-pkg"
            onClick={() => setIsUploadModalOpen(true)}
            className="hidden sm:flex items-center gap-2 h-12 px-4 text-xs font-normal text-white bg-[#0f62fe] hover:bg-[#0353e9] transition-colors focus:outline-2 focus:outline-white focus:outline-offset-[-2px]"
          >
            <Add size={16} />
            <span>Neues Paket</span>
          </button>

          {/* Dark / Light Toggle */}
          <button 
            id="btn-theme-toggle"
            onClick={toggleDarkMode}
            title={darkMode ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln"}
            className="w-12 h-12 flex items-center justify-center text-white hover:bg-[#393939] border-l border-[#393939] transition-colors focus:outline-2 focus:outline-[#0f62fe] focus:outline-offset-[-2px]"
            aria-label="Theme toggle"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Settings / Profile Action */}
          <button 
            id="btn-footer-settings"
            onClick={() => {
              setView("settings");
              setIsSideNavOpen(false);
            }}
            title="Einstellungen"
            className={`w-12 h-12 flex items-center justify-center text-white hover:bg-[#393939] border-l border-[#393939] transition-colors focus:outline-2 focus:outline-[#0f62fe] focus:outline-offset-[-2px] ${view === "settings" ? "bg-[#393939]" : ""}`}
            aria-label="Settings"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </footer>

      {/* ==========================================================================
          SIDENAV
          Width: 256px (16rem), Top: 0, Bottom: 48px (3rem), Left: 0
          ========================================================================== */}
      
      {/* Mobile Backdrop Overlay */}
      {isSideNavOpen && (
        <div 
          onClick={() => setIsSideNavOpen(false)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      <aside 
        className={`fixed top-0 left-0 bottom-12 w-64 bg-[var(--cds-layer-01)] border-r border-[var(--cds-border-subtle-01)] z-40 flex flex-col transition-transform duration-200 ease-in-out ${
          isSideNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* SideNav Brand Header */}
        <div className="h-12 border-b border-[var(--cds-border-subtle-01)] px-4 flex items-center gap-2 bg-[var(--cds-layer-02)]">
          <Education size={20} className="text-[#0f62fe]" />
          <span className="font-semibold text-sm tracking-tight text-[var(--cds-text-primary)]">LernGenie</span>
        </div>

        {/* Navigation Category Label */}
        <div className="px-4 pt-4 pb-2 text-[11px] font-mono tracking-wider uppercase text-[var(--cds-text-helper)]">
          Navigation
        </div>

        <nav className="flex-1 space-y-0.5">
          <button 
            id="nav-library-btn"
            onClick={() => {
              setView("library");
              setIsSideNavOpen(false);
            }}
            className={`w-full h-12 flex items-center gap-3 px-4 text-sm transition-colors border-l-4 ${
              view === "library" || view === "package-detail" || view === "quiz" || view === "results" || view === "flashcards" || view === "study-guide"
                ? "border-[#0f62fe] bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] font-semibold" 
                : "border-transparent text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-02)] hover:text-[var(--cds-text-primary)]"
            }`}
          >
            <Folder size={18} />
            <span>Bibliothek</span>
          </button>

          <button 
            id="nav-stats-btn"
            onClick={() => {
              setView("stats");
              setIsSideNavOpen(false);
            }}
            className={`w-full h-12 flex items-center gap-3 px-4 text-sm transition-colors border-l-4 ${
              view === "stats" 
                ? "border-[#0f62fe] bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] font-semibold" 
                : "border-transparent text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-02)] hover:text-[var(--cds-text-primary)]"
            }`}
          >
            <ChartLine size={18} />
            <span>Statistiken</span>
          </button>

          <button 
            id="nav-settings-btn"
            onClick={() => {
              setView("settings");
              setIsSideNavOpen(false);
            }}
            className={`w-full h-12 flex items-center gap-3 px-4 text-sm transition-colors border-l-4 ${
              view === "settings" 
                ? "border-[#0f62fe] bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] font-semibold" 
                : "border-transparent text-[var(--cds-text-secondary)] hover:bg-[var(--cds-layer-02)] hover:text-[var(--cds-text-primary)]"
            }`}
          >
            <SettingsIcon size={18} />
            <span>Einstellungen</span>
          </button>
        </nav>

        {/* SideNav Footer / System Info */}
        <div className="p-4 border-t border-[var(--cds-border-subtle-01)] bg-[var(--cds-layer-02)]">
          <div className="flex items-center justify-between text-xs text-[var(--cds-text-secondary)]">
            <span className="font-mono text-[11px]">v2.0</span>
            <span className="cds--tag cds--tag--blue text-[10px]">Aktiv</span>
          </div>
          <p className="text-[11px] text-[var(--cds-text-helper)] mt-1.5 leading-tight">
            Produktivitäts- & Lernplattform
          </p>
        </div>
      </aside>

      {/* ==========================================================================
          MAIN CONTENT WORKSPACE
          Left offset: 256px on desktop (lg:pl-64), Bottom offset: 48px (pb-16)
          ========================================================================== */}
      <main className="lg:pl-64 pt-6 sm:pt-8 pb-16 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {view === "library" && (
              <motion.div
                key="library"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Page Header */}
                <div className="border-b border-[var(--cds-border-subtle-01)] pb-6 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <div className="cds--breadcrumb">
                      <span>LernGenie</span>
                      <span className="cds--breadcrumb-separator">/</span>
                      <span className="text-[var(--cds-text-primary)] font-medium">Bibliothek</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
                      Deine Lernpakete
                    </h1>
                    <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
                      Wähle ein Thema aus oder erstelle mit KI ein neues Lernpaket aus deinen Dokumenten.
                    </p>
                  </div>

                  <button 
                    id="btn-create-package"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="cds--btn cds--btn--primary"
                  >
                    <span>Neues Lernpaket</span>
                    <Add size={18} className="ml-3" />
                  </button>
                </div>

                <Library 
                  packages={packages} 
                  onStartQuiz={(pkg) => {
                    setSelectedPackage(pkg);
                    setView("package-detail");
                  }}
                  onDelete={fetchPackages}
                />
              </motion.div>
            )}

            {view === "package-detail" && selectedPackage && (
              <motion.div
                key="package-detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <PackageDetailView
                  pkg={selectedPackage}
                  onBack={() => setView("library")}
                  onStartQuiz={(pkg, regenerate) => handleStartQuiz(pkg, regenerate)}
                  onShowFlashcards={handleShowFlashcards}
                  onShowStudyGuide={handleShowStudyGuide}
                  onViewResultDetails={(result) => {
                    setQuizResults(result);
                    setView("results");
                  }}
                />
              </motion.div>
            )}

            {view === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="border-b border-[var(--cds-border-subtle-01)] pb-6 mb-8">
                  <div className="cds--breadcrumb">
                    <span className="cursor-pointer hover:underline" onClick={() => setView("library")}>LernGenie</span>
                    <span className="cds--breadcrumb-separator">/</span>
                    <span className="text-[var(--cds-text-primary)] font-medium">Statistiken</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
                    Deine Statistiken
                  </h1>
                  <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
                    Verfolge deinen Lernfortschritt, deine Genauigkeit und deine Erfolge im Detail.
                  </p>
                </div>
                <StatsView />
              </motion.div>
            )}

            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="border-b border-[var(--cds-border-subtle-01)] pb-6 mb-8">
                  <div className="cds--breadcrumb">
                    <span className="cursor-pointer hover:underline" onClick={() => setView("library")}>LernGenie</span>
                    <span className="cds--breadcrumb-separator">/</span>
                    <span className="text-[var(--cds-text-primary)] font-medium">Einstellungen</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
                    System-Einstellungen
                  </h1>
                  <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
                    Konfiguriere Design-Präferenzen, KI-Modelle und Benachrichtigungen.
                  </p>
                </div>
                <SettingsView 
                  darkMode={darkMode} 
                  onToggleDarkMode={toggleDarkMode}
                />
              </motion.div>
            )}

            {view === "quiz" && activeQuiz.length > 0 && (
              <QuizView 
                questions={activeQuiz} 
                onComplete={handleQuizComplete}
                onCancel={() => setView("package-detail")}
              />
            )}

            {view === "results" && quizResults && selectedPackage && (
              <ResultsView 
                result={quizResults}
                package={selectedPackage}
                onBack={() => setView("package-detail")}
                onShowFlashcards={handleShowFlashcards}
                onShowStudyGuide={handleShowStudyGuide}
                onRetry={() => handleStartQuiz(selectedPackage, false)}
                onRegenerate={() => handleStartQuiz(selectedPackage, true)}
              />
            )}

            {view === "flashcards" && selectedPackage && (
              <FlashcardsView 
                package={selectedPackage}
                onBack={() => setView("package-detail")}
              />
            )}

            {view === "study-guide" && selectedPackage && (
              <StudyGuideView 
                package={selectedPackage}
                onBack={() => setView("package-detail")}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Carbon Upload Modal */}
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          fetchPackages();
        }}
      />

      {/* Carbon Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#161616]/70 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-6"
          >
            <div className="bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle-01)] p-8 max-w-sm w-full flex flex-col items-center text-center">
              {/* Loading Spinner */}
              <div className="w-12 h-12 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-4" />
              <h3 className="text-base font-semibold text-[var(--cds-text-primary)] mb-1">{loadingMessage}</h3>
              <p className="text-xs text-[var(--cds-text-secondary)]">KI-Verarbeitung läuft...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
