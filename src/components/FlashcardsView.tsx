import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, RefreshCw, Sparkles, BrainCircuit } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { StudyPackage, Material } from "../types";
import { generateFlashcards } from "../services/gemini";

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

  const loadFlashcards = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/packages/${pkg.id}/materials`);
      const materials: Material[] = await res.json();
      const content = materials.map(m => m.content_text).join("\n\n");
      const generated = await generateFlashcards(content);
      setCards(generated);
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
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Erstelle Flashcards...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 font-bold hover:text-indigo-600 transition-colors min-h-[44px] min-w-[44px]">
          <ChevronLeft size={24} />
          Zurück
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-black">Flashcards</h2>
          <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">{pkg.name}</p>
        </div>
        <div className="w-20"></div>
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
              <div className="absolute inset-0 backface-hidden bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-indigo-100/30 border border-gray-100 flex flex-col items-center justify-center p-6 sm:p-12 text-center">
                <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-black text-indigo-200 uppercase tracking-[0.2em]">Frage</span>
                <BrainCircuit className="text-indigo-100 absolute top-6 sm:top-8 right-6 sm:right-8" size={32} />
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 leading-tight">{cards[currentIndex]?.front}</h3>
                <p className="mt-6 sm:mt-8 text-indigo-400 text-xs sm:text-sm font-bold animate-pulse">Tippen zum Umdrehen</p>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden bg-indigo-600 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-indigo-100/50 flex flex-col items-center justify-center p-6 sm:p-12 text-center rotate-y-180">
                <span className="absolute top-6 sm:top-8 left-6 sm:left-8 text-[10px] sm:text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">Antwort</span>
                <Sparkles className="text-indigo-400 absolute top-6 sm:top-8 right-6 sm:right-8" size={32} />
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">{cards[currentIndex]?.back}</h3>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-4">
        <button 
          onClick={prevCard}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:shadow-lg transition-all border border-gray-100"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="text-gray-400 font-black text-base sm:text-lg">
          {currentIndex + 1} <span className="text-gray-200">/</span> {cards.length}
        </div>

        <button 
          onClick={nextCard}
          className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:shadow-lg transition-all border border-gray-100"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}
