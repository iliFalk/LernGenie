import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  Renew, 
  Idea, 
  Close, 
  Notebook,
  Help
} from "@carbon/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPackage } from "../types";
import { getCachedFlashcards } from "../services/gemini";

interface FlashcardsViewProps {
  package: StudyPackage;
  onBack: () => void;
}

export default function FlashcardsView({ package: pkg, onBack }: FlashcardsViewProps) {
  const [cards, setCards] = useState<{ front: string; back: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFlashcards();
  }, []);

  const loadFlashcards = async (regenerate: boolean = false) => {
    setIsLoading(true);
    try {
      const generated = await getCachedFlashcards(pkg.id, regenerate);
      setCards(generated);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (error) {
      console.error("Error loading flashcards:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono text-[var(--cds-text-secondary)]">Flashcards werden generiert...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center cds--tile p-8 space-y-4">
        <div className="w-12 h-12 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#da1e28] mx-auto">
          <Close size={24} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">
          Keine Flashcards verfügbar
        </h3>
        <p className="text-xs text-[var(--cds-text-secondary)] max-w-sm mx-auto">
          Die Flashcards konnten nicht geladen werden. Bitte prüfe deine Verbindung oder versuche eine Neugenerierung.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={onBack} className="cds--btn cds--btn--secondary text-xs">
            Zurück
          </button>
          <button onClick={() => loadFlashcards(false)} className="cds--btn cds--btn--primary text-xs">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Carbon Breadcrumbs & Header */}
      <div>
        <div className="cds--breadcrumb">
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)]">Lernpakete</button>
          <span className="cds--breadcrumb-separator">/</span>
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)] truncate max-w-xs">{pkg.name}</button>
          <span className="cds--breadcrumb-separator">/</span>
          <span className="text-[var(--cds-text-primary)] font-medium">Flashcards</span>
        </div>

        <div className="border-b border-[var(--cds-border-subtle-01)] pb-4 flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="cds--btn cds--btn--tertiary text-xs h-10 px-3"
          >
            <ArrowLeft size={16} className="mr-2" />
            <span>Zurück</span>
          </button>

          <div className="text-center">
            <h2 className="text-base font-semibold text-[var(--cds-text-primary)]">
              Karteikarten-Training
            </h2>
            <span className="text-[11px] font-mono text-[var(--cds-text-helper)]">
              {pkg.name}
            </span>
          </div>

          <button 
            onClick={() => loadFlashcards(true)} 
            title="Neu generieren"
            className="cds--btn cds--btn--ghost text-xs h-10 px-3"
          >
            <Renew size={16} className="mr-2" />
            <span className="hidden sm:inline">Neu generieren</span>
          </button>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div className="relative h-72 sm:h-80 w-full perspective-1000">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full cursor-pointer select-none"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative w-full h-full preserve-3d"
            >
              {/* Front: Question */}
              <div className="absolute inset-0 backface-hidden cds--tile p-8 flex flex-col justify-between border-2 border-[var(--cds-border-subtle-01)] hover:border-[#0f62fe] transition-colors">
                <div className="flex items-center justify-between border-b border-[var(--cds-border-subtle-01)] pb-3">
                  <span className="cds--tag cds--tag--blue text-[11px] font-mono uppercase tracking-wider">
                    Vorderseite • Frage
                  </span>
                  <Notebook size={18} className="text-[#0f62fe]" />
                </div>

                <div className="my-auto text-center px-4">
                  <h3 className="text-lg sm:text-xl font-normal text-[var(--cds-text-primary)] leading-relaxed">
                    {cards[currentIndex]?.front}
                  </h3>
                </div>

                <div className="pt-3 border-t border-[var(--cds-border-subtle-01)] text-center">
                  <span className="text-xs font-mono text-[var(--cds-text-helper)]">
                    Klicken zum Umdrehen
                  </span>
                </div>
              </div>

              {/* Back: Answer */}
              <div className="absolute inset-0 backface-hidden bg-[#0f62fe] text-white p-8 flex flex-col justify-between rotate-y-180 border-2 border-[#0043ce]">
                <div className="flex items-center justify-between border-b border-white/20 pb-3">
                  <span className="px-2 py-0.5 bg-[#0043ce] text-white text-[11px] font-mono uppercase tracking-wider">
                    Rückseite • Antwort
                  </span>
                  <Idea size={18} className="text-white" />
                </div>

                <div className="my-auto text-center px-4">
                  <h3 className="text-lg sm:text-xl font-normal text-white leading-relaxed">
                    {cards[currentIndex]?.back}
                  </h3>
                </div>

                <div className="pt-3 border-t border-white/20 text-center">
                  <span className="text-xs font-mono text-blue-100">
                    Klicken für Frage
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Toolbar */}
      <div className="cds--tile p-3 flex items-center justify-between">
        <button 
          onClick={prevCard}
          className="cds--btn cds--btn--secondary text-xs h-10 px-4"
          aria-label="Vorherige Karte"
        >
          <ArrowLeft size={16} className="mr-2" />
          <span>Zurück</span>
        </button>
        
        <div className="font-mono text-xs font-semibold text-[var(--cds-text-primary)]">
          {currentIndex + 1} <span className="text-[var(--cds-text-helper)]">/</span> {cards.length}
        </div>

        <button 
          onClick={nextCard}
          className="cds--btn cds--btn--primary text-xs h-10 px-4"
          aria-label="Nächste Karte"
        >
          <span>Weiter</span>
          <ArrowRight size={16} className="ml-2" />
        </button>
      </div>

    </div>
  );
}
