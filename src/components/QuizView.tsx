import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, ArrowRight, Lightbulb, Info, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Question } from "../types";

interface QuizViewProps {
  questions: Question[];
  onComplete: (results: { question: Question; isCorrect: boolean }[]) => void;
  onCancel: () => void;
}

export default function QuizView({ questions, onComplete, onCancel }: QuizViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [results, setResults] = useState<{ question: Question; isCorrect: boolean }[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);

  const currentQuestion = questions[currentIndex];

  const handleOptionSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isAnswered) return;
    
    const isCorrect = selectedOption === currentQuestion.correctIndex;
    setIsAnswered(true);
    setResults([...results, { question: currentQuestion, isCorrect }]);
    
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowHint(false);
      setIsAnswered(false);
    } else {
      onComplete(results);
    }
  };

  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header / Progress */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={24} />
        </button>
        <div className="flex-1 mx-8">
          <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
            <span>Frage {currentIndex + 1} von {questions.length}</span>
            <div className="flex gap-4">
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> {correctCount}
              </span>
              <span className="text-rose-600 flex items-center gap-1">
                <AlertCircle size={14} /> {incorrectCount}
              </span>
            </div>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-indigo-600 rounded-full"
            />
          </div>
        </div>
      </div>

      {/* Question Card */}
      <motion.div 
        key={currentIndex}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl shadow-indigo-100/20 border border-gray-100"
      >
        <div className="mb-6 sm:mb-8">
          <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 sm:mb-4">
            {currentQuestion.topic}
          </span>
          <h3 className="text-xl sm:text-2xl font-bold leading-tight">{currentQuestion.text}</h3>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {currentQuestion.options.map((option, i) => {
            let state = "default";
            if (isAnswered) {
              if (i === currentQuestion.correctIndex) state = "correct";
              else if (i === selectedOption) state = "incorrect";
              else state = "dimmed";
            } else if (selectedOption === i) {
              state = "selected";
            }

            return (
              <button
                key={i}
                onClick={() => handleOptionSelect(i)}
                disabled={isAnswered}
                className={`w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left text-sm sm:text-base font-medium transition-all flex items-center justify-between border-2 ${
                  state === "default" ? "bg-white border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30" :
                  state === "selected" ? "bg-indigo-50 border-indigo-600 text-indigo-700" :
                  state === "correct" ? "bg-emerald-50 border-emerald-500 text-emerald-700" :
                  state === "incorrect" ? "bg-rose-50 border-rose-500 text-rose-700" :
                  "bg-white border-gray-50 text-gray-400 opacity-50"
                }`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-bold ${
                    state === "selected" ? "bg-indigo-600 text-white" :
                    state === "correct" ? "bg-emerald-500 text-white" :
                    state === "incorrect" ? "bg-rose-500 text-white" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                </div>
                {state === "correct" && <CheckCircle2 size={18} className="shrink-0" />}
                {state === "incorrect" && <AlertCircle size={18} className="shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Feedback Area */}
        <div className="mt-6 sm:mt-8 space-y-4">
          <AnimatePresence>
            {!isAnswered && !showHint && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setShowHint(true)}
                className="flex items-center gap-2 text-indigo-600 font-bold text-xs sm:text-sm hover:underline"
              >
                <Lightbulb size={14} />
                Brauchst du einen Hinweis?
              </motion.button>
            )}

            {showHint && !isAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-amber-50 border border-amber-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex gap-3"
              >
                <Lightbulb className="text-amber-500 shrink-0" size={18} />
                <p className="text-xs sm:text-sm text-amber-800 italic">{currentQuestion.hint}</p>
              </motion.div>
            )}

            {isAnswered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl ${selectedOption === currentQuestion.correctIndex ? "bg-emerald-50 border border-emerald-100" : "bg-rose-50 border border-rose-100"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {selectedOption === currentQuestion.correctIndex ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1 uppercase text-[10px] tracking-widest">
                      <CheckCircle2 size={12} /> Richtig!
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold flex items-center gap-1 uppercase text-[10px] tracking-widest">
                      <AlertCircle size={12} /> Nicht ganz
                    </span>
                  )}
                </div>
                <p className="text-gray-800 text-xs sm:text-sm leading-relaxed">
                  <span className="font-bold">Erklärung:</span> {currentQuestion.explanation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Button */}
        <div className="mt-8 sm:mt-10">
          {!isAnswered ? (
            <button
              disabled={selectedOption === null}
              onClick={handleConfirmAnswer}
              className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Antwort bestätigen
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              {currentIndex < questions.length - 1 ? "Nächste Frage" : "Ergebnisse ansehen"}
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
