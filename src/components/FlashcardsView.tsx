import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, RefreshCw, Sparkles, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPackage, Material } from "../types";
import { getCachedFlashcards } from "../services/gemini";
import { authFetch } from "../services/auth";

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
      console.error(error);
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
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Erstelle Flashcards...</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <X size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Fehler beim Erstellen der Flashcards</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
          Der KI-Service konnte keine Flashcards generieren. Bitte überprüfe deine Internetverbindung oder deinen API-Key in den Einstellungen.
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={onBack} className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-h-[44px]">
            Zurück
          </button>
          <button onClick={() => loadFlashcards(false)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors min-h-[44px]">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] min-w-[44px]">
          <ChevronLeft size={24} />
          Zurück
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black dark:text-white">Flashcards</h2>
          <p className="text-gray-400 dark:text-gray-500 text-sm font-bold uppercase tracking-widest">{pkg.name}</p>
        </div>
        <button 
          onClick={() => loadFlashcards(true)} 
          title="Neu generieren"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all min-h-[36px]"
        >
          <RefreshCw size={14} className="animate-hover-spin" />
          <span>Neu generieren</span>
        </button>
      </div>

      <div className="relative h-[320px] sm:h-[400px] w-full perspective-1000 mb-8 sm:mb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full h-full cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative w-full h-full preserve-3d"
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-indigo-100/30 dark:shadow-none border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center p-6 sm:p-12 text-center transition-colors">
                <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-black text-indigo-200 dark:text-indigo-900 uppercase tracking-[0.2em]">Frage</span>
                <BrainCircuit className="text-indigo-100 dark:text-indigo-900 absolute top-6 sm:top-8 right-6 sm:right-8" size={32} />
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white leading-tight">{cards[currentIndex]?.front}</h3>
                <p className="mt-6 sm:mt-8 text-indigo-400 dark:text-indigo-500 text-xs sm:text-sm font-bold animate-pulse">Tippen zum Umdrehen</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-indigo-600 dark:bg-indigo-700 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-indigo-100/50 dark:shadow-none flex flex-col items-center justify-center p-6 sm:p-12 text-center rotate-y-180 transition-colors">
                <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-black text-indigo-300 dark:text-indigo-400 uppercase tracking-[0.2em]">Antwort</span>
                <Sparkles className="text-indigo-400 dark:text-indigo-300 absolute top-6 sm:top-8 right-6 sm:right-8" size={32} />
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">{cards[currentIndex]?.back}</h3>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-4">
        <button 
          onClick={prevCard}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="text-gray-400 dark:text-gray-500 font-black text-base sm:text-lg">
          {currentIndex + 1} <span className="text-gray-200 dark:text-gray-700">/</span> {cards.length}
        </div>

        <button 
          onClick={nextCard}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
