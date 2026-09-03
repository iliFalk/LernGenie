import React from "react";
import { 
  Checkmark, 
  Close, 
  ArrowRight, 
  Renew, 
  Idea, 
  Document, 
  Notebook, 
  ChevronRight,
  ChartLine,
  Education
} from "@carbon/icons-react";
import { QuizResult, StudyPackage, AnalysisData } from "../types";

interface ResultsViewProps {
  result: QuizResult;
  package: StudyPackage;
  onBack: () => void;
  onShowFlashcards: () => void;
  onShowStudyGuide: () => void;
  onRetry: () => void;
  onRegenerate: () => void;
}

export default function ResultsView({ 
  result, 
  package: pkg, 
  onBack, 
  onShowFlashcards, 
  onShowStudyGuide, 
  onRetry, 
  onRegenerate 
}: ResultsViewProps) {
  let analysis: Partial<AnalysisData> | null = null;
  try {
    analysis = JSON.parse(result.analysis);
  } catch (e) {
    console.error("Failed to parse quiz analysis:", e);
  }

  const strengths = Array.isArray(analysis?.strengths)
    ? analysis.strengths
    : (Array.isArray((analysis as any)?.Strengths)
        ? (analysis as any).Strengths
        : (Array.isArray((analysis as any)?.staerken)
            ? (analysis as any).staerken
            : []));

  const growthAreas = Array.isArray(analysis?.growthAreas)
    ? analysis.growthAreas
    : (Array.isArray((analysis as any)?.GrowthAreas)
        ? (analysis as any).GrowthAreas
        : (Array.isArray((analysis as any)?.lernbereiche)
            ? (analysis as any).lernbereiche
            : []));

  const finalStrengths = strengths.length > 0 
    ? strengths 
    : ["Hervorragendes Engagement beim Durcharbeiten des Quizzes!", "Grundverständnis der behandelten Lerninhalte ist vorhanden."];

  const finalGrowthAreas = growthAreas.length > 0 
    ? growthAreas 
    : ["Wiederhole die Schwerpunkte regelmäßig, um Langzeitwissen aufzubauen.", "Nutze die Flashcards und den Study Guide zur gezielten Vorbereitung."];

  const statusTag = result.accuracy >= 80 
    ? { label: "Exzellent", class: "cds--tag--green" }
    : result.accuracy >= 50 
      ? { label: "Solide Leistung", class: "cds--tag--blue" }
      : { label: "Übungsbedarf", class: "cds--tag--red" };

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      
      {/* Carbon Breadcrumb & Heading */}
      <div>
        <div className="cds--breadcrumb">
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)]">Lernpakete</button>
          <span className="cds--breadcrumb-separator">/</span>
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)] truncate max-w-xs">{pkg.name}</button>
          <span className="cds--breadcrumb-separator">/</span>
          <span className="text-[var(--cds-text-primary)] font-medium">Auswertung</span>
        </div>

        <div className="border-b border-[var(--cds-border-subtle-01)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block mb-1">
              Ergebnisbericht
            </span>
            <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
              Quiz abgeschlossen
            </h1>
            <p className="text-sm text-[var(--cds-text-secondary)] mt-1">
              Detaillierte Auswertung für das Lernpaket "{pkg.name}"
            </p>
          </div>

          <button 
            onClick={onBack}
            className="cds--btn cds--btn--tertiary self-start sm:self-auto"
          >
            <span>Zurück zum Paket</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Score Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cds--tile p-6 border-l-4 border-l-[#0f62fe]">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Erreichte Punkte
          </span>
          <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--cds-text-primary)] mt-2">
            {result.score}
            <span className="text-lg text-[var(--cds-text-helper)] ml-1">/{result.total}</span>
          </p>
        </div>

        <div className="cds--tile p-6 border-l-4 border-l-[#24a148]">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Genauigkeit
          </span>
          <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--cds-text-primary)] mt-2">
            {Math.round(result.accuracy)}%
          </p>
        </div>

        <div className="cds--tile p-6 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Bewertung & Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span className={`cds--tag ${statusTag.class} text-xs font-mono`}>
              {statusTag.label}
            </span>
          </div>
          <p className="text-xs text-[var(--cds-text-secondary)] mt-2">
            Basierend auf automatischem KI-Assessment.
          </p>
        </div>
      </div>

      {/* Strengths & Growth Areas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Strengths Card */}
        <div className="cds--tile p-6 border-t-2 border-t-[#24a148] space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--cds-border-subtle-01)] pb-3">
            <Checkmark size={18} className="text-[#24a148]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
              Identifizierte Stärken
            </h3>
          </div>
          <ul className="space-y-2.5">
            {finalStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--cds-text-secondary)] bg-[var(--cds-layer-02)] p-3 border border-[var(--cds-border-subtle-01)]">
                <span className="w-1.5 h-1.5 bg-[#24a148] mt-1.5 shrink-0" />
                <span className="leading-relaxed">{s}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Growth Areas Card */}
        <div className="cds--tile p-6 border-t-2 border-t-[#f1c21b] space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--cds-border-subtle-01)] pb-3">
            <Idea size={18} className="text-[#f1c21b]" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
              Fokus- und Lernbereiche
            </h3>
          </div>
          <ul className="space-y-2.5">
            {finalGrowthAreas.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--cds-text-secondary)] bg-[var(--cds-layer-02)] p-3 border border-[var(--cds-border-subtle-01)]">
                <span className="w-1.5 h-1.5 bg-[#f1c21b] mt-1.5 shrink-0" />
                <span className="leading-relaxed">{g}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>

      {/* Recommended Next Actions */}
      <div className="cds--tile p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
            Empfohlene nächste Schritte
          </h3>
          <p className="text-xs text-[var(--cds-text-secondary)] mt-1">
            Festige dein Wissen mit weiteren Lernwerkzeugen oder starte eine erneute Überprüfung.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={onShowFlashcards}
            className="cds--tile cds--tile--clickable p-5 flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#0f62fe] mb-3">
                <Notebook size={18} />
              </div>
              <h4 className="text-sm font-semibold text-[var(--cds-text-primary)] mb-1">
                Flashcards trainieren
              </h4>
              <p className="text-xs text-[var(--cds-text-secondary)]">
                Gehe die Kernbegriffe und Definitionen Karte für Karte durch.
              </p>
            </div>
            <div className="pt-3 border-t border-[var(--cds-border-subtle-01)] flex items-center justify-between text-xs font-medium text-[#0f62fe] mt-4">
              <span>Jetzt öffnen</span>
              <ChevronRight size={16} />
            </div>
          </div>

          <div 
            onClick={onShowStudyGuide}
            className="cds--tile cds--tile--clickable p-5 flex flex-col justify-between"
          >
            <div>
              <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#0f62fe] mb-3">
                <Document size={18} />
              </div>
              <h4 className="text-sm font-semibold text-[var(--cds-text-primary)] mb-1">
                Study Guide lesen
              </h4>
              <p className="text-xs text-[var(--cds-text-secondary)]">
                Lies die strukturierte KI-Zusammenfassung und Erklärungen des Lernstoffs.
              </p>
            </div>
            <div className="pt-3 border-t border-[var(--cds-border-subtle-01)] flex items-center justify-between text-xs font-medium text-[#0f62fe] mt-4">
              <span>Guide ansehen</span>
              <ChevronRight size={16} />
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[var(--cds-border-subtle-01)]">
          <button 
            onClick={onRetry}
            className="cds--btn cds--btn--secondary justify-center text-xs"
          >
            <Renew size={16} className="mr-2" />
            <span>Quiz wiederholen</span>
          </button>
          <button 
            onClick={onRegenerate}
            className="cds--btn cds--btn--primary justify-center text-xs"
          >
            <Idea size={16} className="mr-2" />
            <span>Neue Fragen erstellen</span>
          </button>
          <button 
            onClick={onBack}
            className="cds--btn cds--btn--tertiary justify-center text-xs"
          >
            <span>Zurück zur Übersicht</span>
          </button>
        </div>
      </div>

    </div>
  );
}
