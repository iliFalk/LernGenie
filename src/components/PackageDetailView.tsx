import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Play, 
  Idea, 
  Document, 
  Trophy, 
  ChartLine, 
  Time, 
  ChevronRight, 
  Notebook, 
  Close, 
  Copy, 
  Checkmark,
  Calendar,
  Catalog,
  Edit
} from "@carbon/icons-react";
import { StudyPackage, QuizResult, Material } from "../types";
import { authFetch } from "../services/auth";
import { updateQuizNotes, updateMaterialContent } from "../services/gemini";
import { copyText } from "../services/clipboard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { MarkdownText } from "./MarkdownText";

interface PackageDetailViewProps {
  pkg: StudyPackage;
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  hardQuestions: boolean;
  onHardChange: (value: boolean) => void;
  onBack: () => void;
  onStartQuiz: (pkg: StudyPackage, regenerate?: boolean) => void;
  onShowFlashcards: () => void;
  onViewResultDetails: (result: QuizResult) => void;
  /** Keeps the library list and the open package in step after an edit. */
  onPackageUpdated: (pkg: StudyPackage) => void;
}

/** Preset lengths offered next to the quiz buttons. The server clamps onto 5-15. */
const QUESTION_PRESETS = [5, 10, 15];

/** Mirrors MAX_QUIZ_NOTES in src/ai/prompts.ts; the server cuts at the same number. */
const MAX_NOTES = 600;

export default function PackageDetailView({ 
  pkg, 
  questionCount,
  onQuestionCountChange,
  hardQuestions,
  onHardChange,
  onBack, 
  onStartQuiz, 
  onShowFlashcards, 
  onViewResultDetails,
  onPackageUpdated
}: PackageDetailViewProps) {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [copied, setCopied] = useState(false);

  // Wishes about the questions, and the edit state of the open material.
  const [notes, setNotes] = useState(pkg.quiz_notes ?? "");
  const [savedNotes, setSavedNotes] = useState(pkg.quiz_notes ?? "");
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [notesError, setNotesError] = useState("");
  const [editingMaterial, setEditingMaterial] = useState(false);
  const [materialDraft, setMaterialDraft] = useState("");
  const [materialState, setMaterialState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [materialError, setMaterialError] = useState("");

  useEffect(() => {
    setNotes(pkg.quiz_notes ?? "");
    setSavedNotes(pkg.quiz_notes ?? "");
    setNotesState("idle");
  }, [pkg.id, pkg.quiz_notes]);

  async function handleSaveNotes() {
    setNotesState("saving");
    setNotesError("");
    try {
      const saved = await updateQuizNotes(pkg.id, notes);
      setNotes(saved);
      setSavedNotes(saved);
      setNotesState("saved");
      onPackageUpdated({ ...pkg, quiz_notes: saved });
    } catch (err: any) {
      setNotesState("error");
      setNotesError(err?.message || "Speichern fehlgeschlagen");
    }
  }

  async function handleSaveMaterial() {
    if (!selectedMaterial) return;
    setMaterialState("saving");
    setMaterialError("");
    try {
      const saved = await updateMaterialContent(selectedMaterial.id, materialDraft);
      setMaterials((list) => list.map((m) => (m.id === selectedMaterial.id ? { ...m, content_text: saved } : m)));
      setSelectedMaterial((m) => (m ? { ...m, content_text: saved } : m));
      setMaterialState("saved");
      setEditingMaterial(false);
    } catch (err: any) {
      setMaterialState("error");
      setMaterialError(err?.message || "Speichern fehlgeschlagen");
    }
  }

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

  const totalQuizzes = results.length;
  const avgAccuracy = totalQuizzes > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.accuracy, 0) / totalQuizzes)
    : 0;
  const maxScore = totalQuizzes > 0 
    ? Math.max(...results.map(r => r.score))
    : 0;
  const totalCorrect = results.reduce((sum, r) => sum + r.score, 0);
  const totalAsked = results.reduce((sum, r) => sum + r.total, 0);

  const chartData = [...results].reverse().map((r, i) => ({
    name: `Q${i + 1}`,
    accuracy: Math.round(r.accuracy),
    date: r.created_at ? new Date(r.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : ""
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-4" />
        <p className="text-sm text-[var(--cds-text-secondary)] font-mono">Paket-Details werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="pb-16 max-w-6xl mx-auto space-y-6">
      
      {/* Carbon Breadcrumb & Back Navigation */}
      <div>
        <div className="cds--breadcrumb">
          <button 
            onClick={onBack} 
            className="hover:underline text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)]"
          >
            Bibliothek
          </button>
          <span className="cds--breadcrumb-separator">/</span>
          <span className="text-[var(--cds-text-primary)] font-medium truncate max-w-xs">{pkg.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--cds-border-subtle-01)]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
              {pkg.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="cds--tag cds--tag--blue text-xs font-mono">
                Klasse {pkg.grade}
              </span>
              <span className="cds--tag cds--tag--gray text-xs flex items-center gap-1.5 font-mono">
                <Calendar size={12} />
                {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString("de-DE") : ""}
              </span>
              <span className="cds--tag cds--tag--gray text-xs font-mono">
                {materials.length} {materials.length === 1 ? "Dokument" : "Dokumente"}
              </span>
            </div>
          </div>

          <button 
            onClick={onBack}
            className="cds--btn cds--btn--tertiary self-start sm:self-auto"
          >
            <ArrowLeft size={16} className="mr-2" />
            <span>Zurück</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Study Controls, Right Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Learning Actions & Document Materials */}
        <div className="lg:col-span-4 space-y-6">
          {/* Study Actions Card */}
          <div className="cds--tile space-y-4">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-secondary)] border-b border-[var(--cds-border-subtle-01)] pb-2">
              Quiz
            </h2>

            <p className="text-xs text-[var(--cds-text-secondary)] leading-relaxed">
              Die ersten 10 Fragen liegen bereit. Starte sie direkt, oder wähle eine andere Anzahl und erzeuge neue Fragen.
            </p>

            <div className="space-y-2 pt-1">
              <button 
                id="btn-start-saved-quiz"
                onClick={() => onStartQuiz(pkg, false)}
                className="cds--btn cds--btn--primary w-full justify-between"
              >
                <span>Quiz starten (gespeichert)</span>
                <Play size={18} />
              </button>

              <button 
                id="btn-generate-more-questions"
                onClick={() => onStartQuiz(pkg, true)}
                className="cds--btn cds--btn--secondary w-full justify-between"
              >
                <span>{questionCount} neue Fragen generieren</span>
                <Idea size={18} />
              </button>

              <div className="pt-2 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="chk-hard-questions"
                    checked={hardQuestions}
                    onChange={(e) => onHardChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#0f62fe]"
                  />
                  <span className="text-xs text-[var(--cds-text-primary)] leading-tight">
                    Schwerere Fragen
                    <span className="block text-[11px] text-[var(--cds-text-helper)]">
                      Zwei Schritte je Frage und feinere Optionen. Das Modell denkt länger, etwa 5 Minuten für 10 Fragen.
                    </span>
                  </span>
                </label>

                <div>
                  <label className="cds--label">Anzahl Fragen</label>
                  <div className="grid grid-cols-3 gap-1">
                    {QUESTION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => onQuestionCountChange(preset)}
                        className={`h-9 text-xs font-mono border transition-colors ${
                          questionCount === preset
                            ? "bg-[#0f62fe] text-white border-[#0f62fe] font-bold"
                            : "bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] border-[var(--cds-border-subtle-01)] hover:bg-[var(--cds-layer-01)]"
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-[var(--cds-text-helper)] mt-1.5 leading-tight">
                    Bereit liegen 10 Fragen. Jede andere Anzahl erzeugt neue Fragen.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[var(--cds-border-subtle-01)]">
              <button 
                id="btn-flashcards"
                onClick={onShowFlashcards}
                className="cds--btn cds--btn--tertiary w-full justify-center text-xs py-3"
              >
                <Notebook size={16} className="mr-1.5" />
                <span>Flashcards</span>
              </button>
            </div>
          </div>

          {/* Uploaded Materials Structured List */}
          <div className="cds--tile">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-secondary)] border-b border-[var(--cds-border-subtle-01)] pb-2 mb-3">
              Material ({materials.length})
            </h2>

            {materials.length === 0 ? (
              <p className="text-xs text-[var(--cds-text-secondary)] py-4 text-center">
                Kein Material im Paket hinterlegt.
              </p>
            ) : (
              <div className="divide-y divide-[var(--cds-border-subtle-01)]">
                {materials.map((m) => (
                  <div 
                    key={m.id}
                    onClick={() => {
                      setSelectedMaterial(m);
                      setCopied(false);
                      setEditingMaterial(false);
                      setMaterialState("idle");
                      setMaterialError("");
                    }}
                    className="py-3 px-2 flex items-center justify-between hover:bg-[var(--cds-layer-02)] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[var(--cds-text-secondary)] group-hover:text-[#0f62fe] shrink-0">
                        <Document size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[var(--cds-text-primary)] truncate group-hover:text-[#0f62fe]">
                          {m.name}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--cds-text-helper)]">
                          {m.content_text ? `${Math.round(m.content_text.length / 100) / 10} KB` : "0 KB"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--cds-text-helper)] group-hover:text-[#0f62fe] shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Wishes about the questions: the second half of "change the prompt". The source text
              lives in the material dialog, this block steers which parts it asks about. */}
          <div className="cds--tile space-y-3">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-secondary)] border-b border-[var(--cds-border-subtle-01)] pb-2">
              Fragen anpassen
            </h2>

            <div>
              <label className="cds--label" htmlFor="input-quiz-notes">
                Wünsche zu den Fragen
              </label>
              <textarea
                id="input-quiz-notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value.slice(0, MAX_NOTES));
                  setNotesState("idle");
                }}
                rows={4}
                placeholder="Zum Beispiel: mehr Fragen zu den Jahreszeiten, weniger zu einzelnen Wörtern. Oder: frage nach Ursache und Folge."
                className="w-full text-xs p-2 border border-[var(--cds-border-subtle-01)] bg-[var(--cds-field-01)] text-[var(--cds-text-primary)] resize-y leading-relaxed focus:outline-none focus:border-[#0f62fe]"
              />
              <p className="text-[11px] text-[var(--cds-text-helper)] mt-1 leading-tight">
                {notes.length}/{MAX_NOTES} Zeichen. Die Wünsche setzen den Akzent und wählen die Textstellen.
                Die Regeln bleiben: Wortgrenzen, vier Optionen, eine richtige Antwort, die Aufgabentypen.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                id="btn-save-quiz-notes"
                onClick={handleSaveNotes}
                disabled={notesState === "saving" || notes === savedNotes}
                className="cds--btn cds--btn--primary justify-center text-xs disabled:opacity-40"
              >
                <span>{notesState === "saving" ? "Speichert…" : "Wünsche speichern"}</span>
              </button>

              {notesState === "saved" && (
                <span className="text-[11px] font-mono text-[#24a148]">
                  Gespeichert. Der nächste Start erzeugt neue Fragen.
                </span>
              )}
              {notesState === "error" && (
                <span className="text-[11px] text-[#da1e28]">{notesError}</span>
              )}
            </div>

            <p className="text-[11px] text-[var(--cds-text-helper)] leading-tight border-t border-[var(--cds-border-subtle-01)] pt-2">
              Den Quelltext selbst änderst du im Material oben: Dokument öffnen, „Bearbeiten“.
            </p>
          </div>
        </div>

        {/* Right Column: Key Metrics & Progress */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Carbon 4-Tile Metric Dashboard */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="cds--tile p-4 border-l-4 border-l-[#0f62fe]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                Ø Genauigkeit
              </span>
              <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)] mt-1 block">
                {avgAccuracy}%
              </span>
            </div>

            <div className="cds--tile p-4 border-l-4 border-l-[#24a148]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                Beste Punkte
              </span>
              <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)] mt-1 block">
                {maxScore}
              </span>
            </div>

            <div className="cds--tile p-4 border-l-4 border-l-[#f1c21b]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                Richtig gelöst
              </span>
              <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)] mt-1 block">
                {totalCorrect}/{totalAsked}
              </span>
            </div>

            <div className="cds--tile p-4 border-l-4 border-l-[#8a3ffc]">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                Versuche
              </span>
              <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)] mt-1 block">
                {totalQuizzes}
              </span>
            </div>
          </div>

          {/* Performance Trend Chart */}
          {totalQuizzes > 0 && (
            <div className="cds--tile p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-[var(--cds-border-subtle-01)] pb-3">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
                  Lernkurve (Verlauf über {totalQuizzes} {totalQuizzes === 1 ? "Quiz" : "Quizzes"})
                </h3>
                <span className="text-xs font-mono text-[var(--cds-text-helper)]">
                  Genauigkeit in %
                </span>
              </div>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e0e0e0" className="dark:stroke-[#393939]" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#8d8d8d', fontFamily: 'monospace' }}
                      dy={6}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#8d8d8d', fontFamily: 'monospace' }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '0px', 
                        border: '1px solid #393939', 
                        boxShadow: 'none',
                        padding: '6px 12px',
                        backgroundColor: '#161616',
                        color: '#f4f4f4',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="#0f62fe" 
                      strokeWidth={2} 
                      dot={{ r: 3, fill: '#0f62fe', strokeWidth: 1, stroke: '#ffffff' }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Previous Attempts (Structured Table) */}
          <div className="cds--tile p-0 overflow-hidden">
            <div className="p-4 border-b border-[var(--cds-border-subtle-01)] bg-[var(--cds-layer-02)] flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
                Bisherige Versuche und Detailberichte
              </h3>
              <span className="text-xs font-mono text-[var(--cds-text-secondary)]">
                {results.length} Einträge
              </span>
            </div>

            {results.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[var(--cds-text-secondary)] mb-4">
                  Für dieses Lernpaket wurde noch kein Quiz abgeschlossen.
                </p>
                <button 
                  onClick={() => onStartQuiz(pkg, false)}
                  className="cds--btn cds--btn--primary"
                >
                  <span>Erstes Quiz starten</span>
                  <Play size={16} className="ml-2" />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--cds-border-subtle-01)]">
                {results.map((r, index) => (
                  <div 
                    key={r.id} 
                    onClick={() => onViewResultDetails(r)}
                    className="p-4 flex items-center justify-between hover:bg-[var(--cds-layer-02)] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] text-xs font-mono font-semibold flex items-center justify-center text-[var(--cds-text-primary)]">
                        #{totalQuizzes - index}
                      </div>

                      <div>
                        <p className="text-xs font-medium text-[var(--cds-text-primary)] group-hover:text-[#0f62fe]">
                          {r.score} von {r.total} korrekt ({Math.round(r.accuracy)}%)
                        </p>
                        <p className="text-[11px] font-mono text-[var(--cds-text-helper)] mt-0.5 flex items-center gap-1.5">
                          <Calendar size={12} />
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

                    <div className="flex items-center gap-2 text-xs font-medium text-[#0f62fe]">
                      <span className="hidden sm:inline">Auswertung</span>
                      <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Carbon Material Preview Modal */}
      <AnimatePresence>
        {selectedMaterial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Scrim / Backdrop */}
            <div 
              onClick={() => setSelectedMaterial(null)}
              className="absolute inset-0 bg-[#161616]/70"
            />

            {/* Dialog */}
            <div className="relative bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle-01)] w-full max-w-3xl z-10 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="h-14 px-6 border-b border-[var(--cds-border-subtle-01)] flex items-center justify-between bg-[var(--cds-layer-02)]">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                    Dokumentvorschau
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--cds-text-primary)] truncate max-w-md">
                    {selectedMaterial.name}
                  </h3>
                </div>

                <div className="flex items-center">
                  <button 
                    onClick={() => {
                      if (editingMaterial) {
                        setEditingMaterial(false);
                        return;
                      }
                      setMaterialDraft(selectedMaterial.content_text ?? "");
                      setMaterialError("");
                      setMaterialState("idle");
                      setEditingMaterial(true);
                    }}
                    title={editingMaterial ? "Bearbeiten abbrechen" : "Text bearbeiten"}
                    className={`w-10 h-10 flex items-center justify-center transition-colors ${
                      editingMaterial
                        ? "text-[#0f62fe] bg-[var(--cds-layer-01)]"
                        : "text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] hover:bg-[var(--cds-layer-01)]"
                    }`}
                  >
                    <Edit size={18} />
                  </button>

                  <button 
                    onClick={() => {
                      if (selectedMaterial.content_text) {
                        copyText(selectedMaterial.content_text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    title="In die Zwischenablage kopieren"
                    className="w-10 h-10 flex items-center justify-center text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] hover:bg-[var(--cds-layer-01)] transition-colors"
                  >
                    {copied ? <Checkmark size={18} className="text-[#24a148]" /> : <Copy size={18} />}
                  </button>

                  <button 
                    onClick={() => setSelectedMaterial(null)}
                    title="Schließen"
                    className="w-10 h-10 flex items-center justify-center text-[var(--cds-text-secondary)] hover:text-[#da1e28] hover:bg-[var(--cds-layer-01)] transition-colors"
                  >
                    <Close size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)] bg-[var(--cds-layer-01)]">
                {editingMaterial ? (
                  <div>
                    <label className="cds--label" htmlFor="input-material-text">
                      Quelltext
                    </label>
                    <textarea
                      id="input-material-text"
                      value={materialDraft}
                      onChange={(e) => {
                        setMaterialDraft(e.target.value);
                        setMaterialState("idle");
                      }}
                      rows={18}
                      spellCheck={false}
                      className="w-full text-xs font-mono p-3 border border-[var(--cds-border-subtle-01)] bg-[var(--cds-field-01)] text-[var(--cds-text-primary)] resize-y leading-relaxed focus:outline-none focus:border-[#0f62fe]"
                    />
                    <p className="text-[11px] text-[var(--cds-text-helper)] mt-1 leading-tight">
                      Nur der Text. Markdown bleibt erlaubt. Aus diesem Text entstehen Fragen und Karteikarten.
                    </p>
                    {materialState === "error" && (
                      <p className="text-[11px] text-[#da1e28] mt-1">{materialError}</p>
                    )}
                  </div>
                ) : (
                  <div className="markdown-body">
                    {selectedMaterial.content_text ? (
                      <MarkdownText>{selectedMaterial.content_text}</MarkdownText>
                    ) : (
                      <p className="text-sm text-[var(--cds-text-secondary)] italic text-center py-8">
                        Kein Textinhalt verfügbar.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {materialState === "saved" && !editingMaterial && (
                <div className="px-6 py-2 text-[11px] font-mono text-[#24a148] border-t border-[var(--cds-border-subtle-01)] bg-[var(--cds-layer-02)]">
                  Gespeichert. Die gespeicherten Fragen und Karteikarten sind verworfen.
                </div>
              )}

              {/* Carbon 50/50 Footer */}
              {editingMaterial ? (
                <div className="grid grid-cols-2 border-t border-[var(--cds-border-subtle-01)]">
                  <button
                    onClick={() => {
                      setEditingMaterial(false);
                      setMaterialState("idle");
                    }}
                    className="cds--btn cds--btn--secondary justify-center text-xs h-12"
                  >
                    Abbrechen
                  </button>
                  <button
                    id="btn-save-material"
                    onClick={handleSaveMaterial}
                    disabled={materialState === "saving" || !materialDraft.trim() || materialDraft === selectedMaterial.content_text}
                    className="cds--btn cds--btn--primary justify-center text-xs h-12 disabled:opacity-40"
                  >
                    {materialState === "saving" ? "Speichert…" : "Speichern"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 border-t border-[var(--cds-border-subtle-01)]">
                  <button
                    onClick={() => setSelectedMaterial(null)}
                    className="cds--btn cds--btn--secondary justify-center text-xs h-12"
                  >
                    Schließen
                  </button>
                  <button
                    onClick={() => {
                      if (selectedMaterial.content_text) {
                        copyText(selectedMaterial.content_text);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="cds--btn cds--btn--primary justify-center text-xs h-12"
                  >
                    {copied ? "Kopiert!" : "Inhalt kopieren"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
