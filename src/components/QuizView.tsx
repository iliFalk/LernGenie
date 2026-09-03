import React, { useState } from "react";
import { 
  Close, 
  Checkmark, 
  ArrowRight, 
  Idea, 
  WarningAlt,
  CheckmarkFilled,
  WarningFilled
} from "@carbon/icons-react";
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
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Carbon Quiz Header & Progress Bar */}
      <div className="cds--tile p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onCancel} 
              title="Quiz abbrechen"
              className="w-8 h-8 flex items-center justify-center text-[var(--cds-text-secondary)] hover:text-[#da1e28] hover:bg-[var(--cds-layer-02)] transition-colors"
            >
              <Close size={18} />
            </button>
            <span className="text-xs font-mono font-medium text-[var(--cds-text-primary)]">
              Frage {currentIndex + 1} von {questions.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="cds--tag cds--tag--green text-xs font-mono">
              <Checkmark size={12} className="mr-1" />
              {correctCount} Richtig
            </span>
            <span className="cds--tag cds--tag--red text-xs font-mono">
              {incorrectCount} Falsch
            </span>
          </div>
        </div>

        {/* Carbon Progress Track */}
        <div className="h-1.5 w-full bg-[var(--cds-layer-02)] overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
            className="h-full bg-[#0f62fe]"
          />
        </div>
      </div>

      {/* Carbon Question Tile */}
      <motion.div 
        key={currentIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className="cds--tile p-6 sm:p-8 space-y-6"
      >
        {/* Topic Tag & Question */}
        <div>
          <span className="cds--tag cds--tag--blue text-xs font-mono mb-3">
            {currentQuestion.topic || "Thema"}
          </span>
          <h2 className="text-lg sm:text-xl font-normal leading-snug text-[var(--cds-text-primary)] mt-2">
            {currentQuestion.text}
          </h2>
        </div>

        {/* Options List */}
        <div className="space-y-2">
          {currentQuestion.options.map((option, i) => {
            let borderClass = "border-[var(--cds-border-subtle-01)]";
            let bgClass = "bg-[var(--cds-layer-01)] hover:bg-[var(--cds-layer-02)]";
            let textClass = "text-[var(--cds-text-primary)]";
            let indicatorBg = "bg-[var(--cds-layer-02)] text-[var(--cds-text-secondary)]";

            if (isAnswered) {
              if (i === currentQuestion.correctIndex) {
                borderClass = "border-l-4 border-l-[#24a148] border-[#24a148]";
                bgClass = "bg-[var(--cds-layer-02)]";
                textClass = "text-[var(--cds-text-primary)] font-medium";
                indicatorBg = "bg-[#24a148] text-white";
              } else if (i === selectedOption) {
                borderClass = "border-l-4 border-l-[#da1e28] border-[#da1e28]";
                bgClass = "bg-[var(--cds-layer-02)]";
                textClass = "text-[var(--cds-text-primary)]";
                indicatorBg = "bg-[#da1e28] text-white";
              } else {
                bgClass = "opacity-40 bg-[var(--cds-layer-01)]";
              }
            } else if (selectedOption === i) {
              borderClass = "border-l-4 border-l-[#0f62fe] border-[#0f62fe]";
              bgClass = "bg-[var(--cds-layer-02)]";
              indicatorBg = "bg-[#0f62fe] text-white";
            }

            return (
              <button
                key={i}
                onClick={() => handleOptionSelect(i)}
                disabled={isAnswered}
                className={`w-full p-4 text-left text-sm transition-colors flex items-center justify-between border ${borderClass} ${bgClass} ${textClass} min-h-[48px]`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 text-xs font-mono font-bold flex items-center justify-center ${indicatorBg}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1">{option}</span>
                </div>

                {isAnswered && i === currentQuestion.correctIndex && (
                  <Checkmark size={18} className="text-[#24a148] shrink-0 ml-2" />
                )}
                {isAnswered && i === selectedOption && i !== currentQuestion.correctIndex && (
                  <Close size={18} className="text-[#da1e28] shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Hint / Explanation Area */}
        <div className="space-y-3 pt-2">
          {!isAnswered && !showHint && (
            <button
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-2 text-xs font-mono text-[#0f62fe] hover:underline"
            >
              <Idea size={16} />
              <span>Hinweis anzeigen</span>
            </button>
          )}

          {showHint && !isAnswered && (
            <div className="cds--inline-notification cds--inline-notification--warning flex items-start gap-3 text-xs">
              <Idea size={18} className="text-[#f1c21b] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Hinweis:</span>
                <p className="text-[var(--cds-text-secondary)]">{currentQuestion.hint}</p>
              </div>
            </div>
          )}

          {isAnswered && (
            <div className={`cds--inline-notification ${
              selectedOption === currentQuestion.correctIndex 
                ? "cds--inline-notification--success" 
                : "cds--inline-notification--error"
            } flex items-start gap-3 text-xs`}>
              {selectedOption === currentQuestion.correctIndex ? (
                <Checkmark size={18} className="text-[#24a148] shrink-0 mt-0.5" />
              ) : (
                <Close size={18} className="text-[#da1e28] shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-semibold block mb-1">
                  {selectedOption === currentQuestion.correctIndex ? "Korrekt beantwortet" : "Leider inkorrekt"}
                </span>
                <p className="text-[var(--cds-text-secondary)] leading-relaxed">
                  <strong className="text-[var(--cds-text-primary)]">Erklärung:</strong> {currentQuestion.explanation}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-[var(--cds-border-subtle-01)]">
          {!isAnswered ? (
            <button
              disabled={selectedOption === null}
              onClick={handleConfirmAnswer}
              className="cds--btn cds--btn--primary w-full justify-center disabled:opacity-40"
            >
              <span>Antwort bestätigen</span>
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="cds--btn cds--btn--primary w-full justify-between"
            >
              <span>{currentIndex < questions.length - 1 ? "Nächste Frage" : "Ergebnisse anzeigen"}</span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
