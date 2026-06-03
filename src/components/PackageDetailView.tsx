import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, BrainCircuit, Sparkles, FileText, Award, Target, 
  HelpCircle, ChevronRight, BookOpen, Clock, Calendar, CheckCircle2,
  X, Copy
} from "lucide-react";
import { StudyPackage, QuizResult, Material } from "../types";
import { authFetch } from "../services/auth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

interface PackageDetailViewProps {
  pkg: StudyPackage;
  onBack: () => void;
  onStartQuiz: (pkg: StudyPackage, regenerate?: boolean) => void;
  onShowFlashcards: () => void;
  onShowStudyGuide: () => void;
  onViewResultDetails: (result: QuizResult) => void;
}

export default function PackageDetailView({ 
  pkg, 
  onBack, 
  onStartQuiz, 
  onShowFlashcards, 
  onShowStudyGuide,
  onViewResultDetails
}: PackageDetailViewProps) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [resultsRes, materialsRes] = await Promise.all([
          authFetch(`/api/results/${pkg.id}`),
          authFetch(`/api/packages/${pkg.id}/materials`)
        ]);
        
        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          // The API returns results ordered DESC, we reverse it for the progress chart if we want chronological order
          setResults(resultsData);
        }
        
        if (materialsRes.ok) {
          const materialsData = await materialsRes.json();
          setMaterials(materialsData);
        }
      } catch (err) {
        console.error("Failed to load package details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [pkg.id]);

  // Calculations
  const totalQuizzes = results.length;
  const avgAccuracy = totalQuizzes > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / totalQuizzes)
    : 0;
  const maxScore = totalQuizzes > 0 
    ? Math.max(...results.map(r => r.score))
    : 0;
  const totalCorrect = results.reduce((sum, r) => sum + r.score, 0);
  const totalAsked = results.reduce((sum, r) => sum + r.total, 0);

  // Prepare line chart data (chronological)
  const chartData = [...results].reverse().map((r, i) => ({
    name: `Quiz ${i + 1}`,
    accuracy: Math.round(r.accuracy),
    date: r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : ""
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Lade Paket-Details...</p>
      </div>
    );
  }

  return (
    <div className="pb-20 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <button 
            onClick={onBack}
            className="group flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-4"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Zurück zur Bibliothek
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight dark:text-white">{pkg.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">
                Klasse {pkg.grade}
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">
                Erstellt am {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString("de-DE") : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Study Actions & Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Quick Study Options */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-standard rounded-[32px] p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg">Lern-Modus</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
              Übe mit den bereits gespeicherten Quizfragen oder generiere neue Materialien mit KI.
            </p>

            <button 
              onClick={() => onStartQuiz(pkg, false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-md shadow-indigo-100 dark:shadow-none transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[48px]"
            >
              <BrainCircuit size={18} />
              Quiz starten (gespeichert)
            </button>

            <button 
              onClick={() => onStartQuiz(pkg, true)}
              className="w-full bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 border border-indigo-100 dark:border-indigo-900/55 transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[48px]"
            >
              <Sparkles size={18} />
              Weitere Fragen generieren
            </button>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button 
                onClick={onShowFlashcards}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3 px-3 rounded-2xl flex flex-col items-center justify-center gap-2 border border-gray-100 dark:border-gray-700 transition-all min-h-[72px]"
              >
                <BookOpen size={18} className="text-emerald-500" />
                <span className="text-xs">Flashcards</span>
              </button>
              <button 
                onClick={onShowStudyGuide}
                className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-semibold py-3 px-3 rounded-2xl flex flex-col items-center justify-center gap-2 border border-gray-100 dark:border-gray-700 transition-all min-h-[72px]"
              >
                <FileText size={18} className="text-amber-500" />
                <span className="text-xs">Lernzusammenfass.</span>
              </button>
            </div>
          </div>

          {/* Materials Section */}
          <div className="glass-standard rounded-[32px] p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-4 flex items-center gap-2">
              <BookOpen size={18} className="text-indigo-500" />
              Lernmaterialien
            </h3>
            {materials.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Keine Dokumente oder Materialien in diesem Paket.</p>
            ) : (
              <div className="space-y-3">
                {materials.map((m) => (
                  <button 
                    key={m.id} 
                    onClick={() => {
                      setSelectedMaterial(m);
                      setCopied(false);
                    }}
                    className="w-full text-left flex items-center gap-3 p-3 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 rounded-xl border border-gray-100/80 dark:border-gray-800/50 hover:border-indigo-100 dark:hover:border-indigo-900/40 transition-all cursor-pointer group active:scale-[0.99] min-h-[56px]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 flex items-center justify-center shrink-0 transition-colors">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{m.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {m.content_text ? `${Math.round(m.content_text.length / 100) / 10} KB` : "0 KB"} • Vorschau anzeigen
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Statistics & History */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-light p-4 rounded-2xl shadow-sm text-center">
              <Award size={18} className="text-indigo-500 mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Ø Genauigkeit</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{avgAccuracy}%</p>
            </div>
            
            <div className="glass-light p-4 rounded-2xl shadow-sm text-center">
              <Target size={18} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Beste Punkte</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{maxScore}</p>
            </div>

            <div className="glass-light p-4 rounded-2xl shadow-sm text-center">
              <HelpCircle size={18} className="text-amber-500 mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Gelöste Fragen</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{totalCorrect}/{totalAsked}</p>
            </div>

            <div className="glass-light p-4 rounded-2xl shadow-sm text-center">
              <Clock size={18} className="text-purple-500 mx-auto mb-2" />
              <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Versuche</p>
              <p className="text-2xl font-black text-gray-800 dark:text-white mt-1">{totalQuizzes}</p>
            </div>
          </div>

          {/* Performance chart */}
          {totalQuizzes > 0 && (
            <div className="glass-standard p-6 sm:p-8 rounded-[32px] shadow-sm">
              <h3 className="font-bold text-gray-850 dark:text-white text-lg mb-6 flex items-center gap-2">
                <Target size={18} className="text-indigo-500" />
                Lernkurve (Verlauf)
              </h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" className="dark:stroke-gray-800" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      dy={8}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                        padding: '8px 12px',
                        backgroundColor: '#1F2937',
                        color: '#FFFFFF'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#4F46E5" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#4F46E5', strokeWidth: 1.5, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Previous Attempts List */}
          <div className="glass-standard p-6 sm:p-8 rounded-[32px] shadow-sm">
            <h3 className="font-bold text-gray-850 dark:text-white text-lg mb-4 flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              Bisherige Versuche und Auswertungen
            </h3>
            {results.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400 dark:text-gray-500">Noch keine Quizzes absolviert.</p>
                <button 
                  onClick={() => onStartQuiz(pkg, false)}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-xl hover:bg-indigo-100/80 transition-colors"
                >
                  Erstes Quiz starten
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[300px] overflow-y-auto no-scrollbar">
                {results.map((r, index) => (
                  <div 
                    key={r.id} 
                    onClick={() => onViewResultDetails(r)}
                    className="flex items-center justify-between py-4 pr-1 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-xs font-black">#{totalQuizzes - index}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {r.score} von {r.total} richtig ({Math.round(r.accuracy)}%)
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {r.created_at ? new Date(r.created_at).toLocaleString("de-DE", { 
                            day: "2-digit", 
                            month: "2-digit", 
                            year: "numeric", 
                            hour: "2-digit", 
                            minute: "2-digit" 
                          }) : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Auswertung</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Material Preview Modal */}
      <AnimatePresence>
        {selectedMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMaterial(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Container */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              className="relative glass-heavy rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200/40 dark:border-gray-700/40 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-gray-800 dark:text-white text-base truncate pr-2">
                      {selectedMaterial.name}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-black tracking-wider mt-0.5">
                      {selectedMaterial.mime_type || "Dokument"} • {selectedMaterial.content_text ? `${Math.round(selectedMaterial.content_text.length / 100) / 10} KB` : "0 KB"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => {
                      if (selectedMaterial.content_text) {
                        navigator.clipboard.writeText(selectedMaterial.content_text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold ${
                      copied 
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" 
                        : "text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    title="Inhalt kopieren"
                  >
                    <Copy size={16} />
                    {copied && <span>Kopiert!</span>}
                  </button>
                  <button 
                    onClick={() => setSelectedMaterial(null)}
                    className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
                    title="Schließen"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="p-6 sm:p-8 overflow-y-auto max-h-[calc(85vh-140px)] prose prose-indigo dark:prose-invert max-w-none">
                <div className="markdown-body text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedMaterial.content_text ? (
                    <Markdown>{selectedMaterial.content_text}</Markdown>
                  ) : (
                    <p className="text-gray-400 dark:text-gray-500 italic text-center py-12">
                      Dieses Dokument enthält keine extrahierten Textinhalte.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-gray-200/40 dark:border-gray-700/40 flex justify-end gap-3 shrink-0">
                <button 
                  onClick={() => setSelectedMaterial(null)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer min-h-[38px] flex items-center justify-center"
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
