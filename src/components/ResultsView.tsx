import React from "react";
import { CheckCircle2, AlertCircle, ArrowRight, RefreshCw, BarChart3, BrainCircuit, Sparkles, FileText, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { QuizResult, StudyPackage, AnalysisData } from "../types";

interface ResultsViewProps {
  result: QuizResult;
  package: StudyPackage;
  onBack: () => void;
  onShowFlashcards: () => void;
  onShowStudyGuide: () => void;
  onRetry: () => void;
}

export default function ResultsView({ result, package: pkg, onBack, onShowFlashcards, onShowStudyGuide, onRetry }: ResultsViewProps) {
  const analysis: AnalysisData = JSON.parse(result.analysis);

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="text-center mb-8 sm:mb-12">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 sm:w-24 sm:h-24 bg-indigo-600 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white mx-auto mb-4 sm:mb-6 shadow-2xl shadow-indigo-200"
        >
          <Sparkles size={40} />
        </motion.div>
        <h2 className="text-3xl sm:text-4xl font-black mb-2">Quiz abgeschlossen!</h2>
        <p className="text-gray-500 text-base sm:text-lg">Gute Arbeit bei "{pkg.name}"</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Score</p>
          <p className="text-4xl sm:text-5xl font-black text-indigo-600">{result.score}<span className="text-xl sm:text-2xl text-gray-300">/{result.total}</span></p>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 shadow-sm text-center">
          <p className="text-[10px] sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Genauigkeit</p>
          <p className="text-4xl sm:text-5xl font-black text-emerald-500">{Math.round(result.accuracy)}%</p>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 shadow-sm text-center flex flex-col justify-center">
          <p className="text-[10px] sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Status</p>
          <p className="text-xl sm:text-2xl font-black text-gray-800">
            {result.accuracy >= 80 ? "Exzellent!" : result.accuracy >= 50 ? "Gut gemacht" : "Weiter üben"}
          </p>
          <button 
            onClick={onShowStudyGuide}
            className="mt-3 min-h-[44px] text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-2 group"
          >
            <Sparkles size={14} className="group-hover:scale-110 transition-transform" /> 
            Study Guide generieren
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-12">
        {/* Strengths */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold">Deine Stärken</h3>
          </div>
          <ul className="space-y-2 sm:space-y-3">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-base text-gray-700 bg-emerald-50/30 p-3 rounded-xl border border-emerald-50">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-2 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>

        {/* Growth Areas */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <BrainCircuit size={20} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold">Lernbereiche</h3>
          </div>
          <ul className="space-y-2 sm:space-y-3">
            {analysis.growthAreas.map((g, i) => (
              <li key={i} className="flex items-start gap-3 text-base text-gray-700 bg-amber-50/30 p-3 rounded-xl border border-amber-50">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Next Steps */}
      <div className="bg-indigo-600 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3rem] text-white shadow-2xl shadow-indigo-200">
        <h3 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 flex items-center gap-3">
          <Sparkles /> Nächste Schritte
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onShowFlashcards}
            className="bg-white/10 hover:bg-white/20 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 text-left transition-all group relative overflow-hidden"
          >
            <BrainCircuit className="mb-3 sm:mb-4" size={28} />
            <h4 className="font-bold text-base sm:text-lg mb-1">Flashcards</h4>
            <p className="text-indigo-100 text-xs sm:text-sm mb-4">Wiederhole die wichtigsten Begriffe.</p>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Starten <ChevronRight size={14} />
            </span>
          </button>
          <button 
            onClick={onShowStudyGuide}
            className="bg-white/10 hover:bg-white/20 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/10 text-left transition-all group relative overflow-hidden"
          >
            <div className="absolute top-4 right-4 bg-emerald-400 text-indigo-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-sm">
              Empfohlen
            </div>
            <FileText className="mb-3 sm:mb-4" size={28} />
            <h4 className="font-bold text-base sm:text-lg mb-1">Study Guide</h4>
            <p className="text-indigo-100 text-xs sm:text-sm mb-4">Lies die Zusammenfassung des Stoffs.</p>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Generieren & Ansehen <ChevronRight size={14} />
            </span>
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8">
          <button 
            onClick={onRetry}
            className="flex-1 bg-white text-indigo-600 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
          >
            <RefreshCw size={18} />
            Quiz wiederholen
          </button>
          <button 
            onClick={onBack}
            className="flex-1 bg-indigo-500 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-400 transition-all"
          >
            Zurück zur Bibliothek
          </button>
        </div>
      </div>
    </div>
  );
}
