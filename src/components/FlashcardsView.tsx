import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Renew,
  Add,
  Subtract,
  Notebook,
  Checkmark,
  Close,
  Idea,
  Trophy,
  Restart
} from "@carbon/icons-react";
import { motion } from "motion/react";
import { StudyPackage } from "../types";
import { getCachedFlashcards } from "../services/gemini";
import LoadingOverlay, { FLASHCARDS_ESTIMATE_MS } from "./LoadingOverlay";

interface FlashcardsViewProps {
  package: StudyPackage;
  onBack: () => void;
}

type Mark = "known" | "unknown";
/** Charts are cheap to render wrong: `train` walks the whole set, `repeat` only the missed cards. */
type Phase = "train" | "repeat" | "stats";

/** How many new cards a click adds. The server clamps onto 5-15. */
const ADD_PRESETS = [5, 10, 15];

export default function FlashcardsView({ package: pkg, onBack }: FlashcardsViewProps) {
  const [cards, setCards] = useState<{ front: string; back: string }[]>([]);
  const [phase, setPhase] = useState<Phase>("train");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [repeatQueue, setRepeatQueue] = useState<number[]>([]);
  const [repeatMarks, setRepeatMarks] = useState<Record<number, Mark>>({});
  const [addCount, setAddCount] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadFlashcards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.id]);

  const startSession = (list: { front: string; back: string }[]) => {
    setCards(list);
    setPhase("train");
    setIndex(0);
    setFlipped(false);
    setMarks({});
    setRepeatMarks({});
    setRepeatQueue([]);
  };

  const loadFlashcards = async (regenerate: boolean = false, more?: number) => {
    // An append keeps the round in progress: the stored order is preserved and new cards land at
    // the end, so the marks already given stay on their cards. A fresh load starts a new round.
    const keepingRound = !!more;
    setIsLoading(!more);
    setIsAdding(!!more);
    setError("");
    try {
      const list = await getCachedFlashcards(pkg.id, regenerate, more);
      if (keepingRound) {
        setCards(list);
      } else {
        startSession(list);
      }
    } catch (err: any) {
      setError(err?.message || "Die Karten konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
      setIsAdding(false);
    }
  };

  const queue = phase === "repeat" ? repeatQueue : cards.map((_, i) => i);
  const current = queue[index];
  const card = current === undefined ? undefined : cards[current];

  const markCard = (value: Mark) => {
    if (!card || !flipped) return;
    // The state update is async, so the last card of a pass must count its own mark here.
    const nextMarks: Record<number, Mark> =
      phase === "repeat" ? marks : { ...marks, [current]: value };

    if (phase === "repeat") {
      setRepeatMarks((prev) => ({ ...prev, [current]: value }));
    } else {
      setMarks(nextMarks);
    }

    if (index + 1 < queue.length) {
      setFlipped(false);
      setIndex(index + 1);
      return;
    }

    // Last card of the pass: a repeat pass follows when the first pass missed something.
    setFlipped(false);
    if (phase === "train") {
      const missedCards = cards.map((_, i) => i).filter((i) => nextMarks[i] !== "known");
      if (missedCards.length > 0) {
        setRepeatQueue(missedCards);
        setRepeatMarks({});
        setIndex(0);
        setPhase("repeat");
        return;
      }
    }
    setPhase("stats");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 max-w-sm mx-auto">
        <LoadingOverlay message="Flashcards werden generiert..." estimateMs={FLASHCARDS_ESTIMATE_MS} variant="plain" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center cds--tile p-8 space-y-4">
        <div className="w-12 h-12 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#da1e28] mx-auto">
          <Close size={24} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">Keine Flashcards verfügbar</h3>
        <p className="text-xs text-[var(--cds-text-secondary)] max-w-sm mx-auto">
          Die Flashcards konnten nicht geladen werden. Bitte prüfe deine Verbindung oder versuche eine Neugenerierung.
        </p>
        {error && <p className="text-[11px] text-[#da1e28]">{error}</p>}
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={onBack} className="cds--btn cds--btn--secondary text-xs">Zurück</button>
          <button onClick={() => loadFlashcards(false)} className="cds--btn cds--btn--primary text-xs">Erneut versuchen</button>
        </div>
      </div>
    );
  }

  const knownCount = Object.values(marks).filter((m) => m === "known").length;
  const seenCount = Object.keys(marks).length;
  const missed = cards.map((_, i) => i).filter((i) => marks[i] === "unknown");
  const learnedOnRepeat = missed.filter((i) => repeatMarks[i] === "known").length;
  const accuracy = seenCount > 0 ? Math.round((knownCount / seenCount) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div>
        <div className="cds--breadcrumb">
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)]">Lernpakete</button>
          <span className="cds--breadcrumb-separator">/</span>
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)] truncate max-w-xs">{pkg.name}</button>
          <span className="cds--breadcrumb-separator">/</span>
          <span className="text-[var(--cds-text-primary)] font-medium">Flashcards</span>
        </div>

        <div className="border-b border-[var(--cds-border-subtle-01)] pb-3 flex items-center justify-between gap-3">
          <button onClick={onBack} className="cds--btn cds--btn--tertiary text-xs h-9 px-3">
            <ArrowLeft size={16} className="mr-2" />
            <span>Zurück</span>
          </button>

          <div className="text-center">
            <h2 className="text-base font-semibold text-[var(--cds-text-primary)]">Karteikarten-Training</h2>
            <span className="text-[11px] font-mono text-[var(--cds-text-helper)]">
              {cards.length} Karten · {knownCount} gekonnt · {missed.length} offen
            </span>
          </div>

          <button
            onClick={() => loadFlashcards(true)}
            title="Alle Karten neu erzeugen"
            className="cds--btn cds--btn--ghost text-xs h-9 px-3"
          >
            <Renew size={16} className="mr-2" />
            <span className="hidden sm:inline">Alles neu</span>
          </button>
        </div>
      </div>

      {/* Add more cards from the same material */}
      <div className="cds--tile flex flex-wrap items-center justify-between gap-3" style={{ padding: "8px 12px" }}>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)]">
            Weitere Karten
          </span>
          <div className="flex">
            {ADD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAddCount(preset)}
                className={`h-8 w-10 text-xs font-mono border transition-colors ${
                  addCount === preset
                    ? "bg-[#0f62fe] text-white border-[#0f62fe] font-bold"
                    : "bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] border-[var(--cds-border-subtle-01)] hover:bg-[var(--cds-layer-01)]"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdding && <span className="text-[11px] font-mono text-[var(--cds-text-secondary)]">Erzeugt {addCount} Karten…</span>}
          <button
            id="btn-add-flashcards"
            onClick={() => loadFlashcards(false, addCount)}
            disabled={isAdding}
            className="cds--btn cds--btn--secondary text-xs h-9 disabled:opacity-40"
          >
            <Add size={16} className="mr-2" />
            <span>Karten hinzufügen</span>
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-[#da1e28]">{error}</p>}

      {/* Training and repeat passes */}
      {phase !== "stats" && card && (
        <>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--cds-text-helper)]">
            <span className="whitespace-nowrap">
              {phase === "repeat" ? "Wiederholung" : "Durchgang"} {index + 1} / {queue.length}
            </span>
            <div className="h-1 flex-1 bg-[var(--cds-layer-02)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((index + (flipped ? 0.5 : 0)) / queue.length) * 100}%` }}
                transition={{ duration: 0.2 }}
                className={`h-full ${phase === "repeat" ? "bg-[#f1c21b]" : "bg-[#0f62fe]"}`}
              />
            </div>
          </div>

          {/* The card: one face visible, the other turned away. The height follows the
              viewport so the card and both marks stay on one screen. */}
          <div className="fc-scene w-full" style={{ height: "clamp(13rem, 34vh, 19rem)" }}>
            <div
              className="fc-card cursor-pointer select-none"
              onClick={() => setFlipped((v) => !v)}
              role="button"
              tabIndex={0}
              aria-label="Karte umdrehen"
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setFlipped((v) => !v);
                }
              }}
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 24 }}
                className="fc-card"
              >
                {/* Front: question */}
                <div className="fc-face cds--tile flex flex-col justify-between border border-[var(--cds-border-strong-01)] shadow-[0_2px_6px_rgba(22,22,22,0.12)] p-6">
                  <div className="flex items-center justify-between border-b border-[var(--cds-border-subtle-01)] pb-2">
                    <span className="cds--tag cds--tag--blue text-[11px] font-mono uppercase tracking-wider">Frage</span>
                    <span className="text-[11px] font-mono text-[var(--cds-text-helper)]">
                      {current! + 1} / {cards.length}
                    </span>
                  </div>
                  <div className="my-auto text-center px-2">
                    <p className="text-xl sm:text-2xl font-normal text-[var(--cds-text-primary)] leading-snug">
                      {card.front}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[var(--cds-border-subtle-01)] text-center">
                    <span className="text-[11px] font-mono text-[var(--cds-text-helper)]">Tippen zum Umdrehen</span>
                  </div>
                </div>

                {/* Back: answer */}
                <div className="fc-face fc-face--back cds--tile flex flex-col justify-between border border-[#0f62fe] border-l-4 shadow-[0_2px_6px_rgba(22,22,22,0.12)] p-6">
                  <div className="flex items-center justify-between border-b border-[var(--cds-border-subtle-01)] pb-2">
                    <span className="cds--tag cds--tag--green text-[11px] font-mono uppercase tracking-wider">Antwort</span>
                    <Idea size={18} className="text-[#0f62fe]" />
                  </div>
                  <div className="my-auto text-center px-2">
                    <p className="text-lg sm:text-xl font-normal text-[var(--cds-text-primary)] leading-snug">
                      {card.back}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[var(--cds-border-subtle-01)] text-center">
                    <span className="text-[11px] font-mono text-[var(--cds-text-helper)]">
                      Jetzt bewerten: − noch nicht, + gekonnt
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Two marks under the card, enabled once the answer is visible. */}
          <div className="grid grid-cols-2 gap-3">
            <button
              id="btn-card-unknown"
              onClick={() => markCard("unknown")}
              disabled={!flipped}
              className="h-14 flex items-center justify-center text-sm border border-[#da1e28] text-[#da1e28] bg-[var(--cds-layer-01)] hover:bg-[#fff1f1] transition-colors disabled:opacity-40"
            >
              <Subtract size={20} className="mr-2" />
              <span>Kenne ich nicht</span>
            </button>
            <button
              id="btn-card-known"
              onClick={() => markCard("known")}
              disabled={!flipped}
              className="cds--btn cds--btn--primary justify-center text-sm h-14 disabled:opacity-40"
            >
              <Add size={20} className="mr-2" />
              <span>Kenne ich</span>
            </button>
          </div>

        </>
      )}

      {/* Result of the round */}
      {phase === "stats" && (
        <div className="space-y-4">
          <div className="cds--tile space-y-3">
            <div className="flex items-center gap-3 border-b border-[var(--cds-border-subtle-01)] pb-2">
              <Trophy size={20} className="text-[#f1c21b]" />
              <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
                Ergebnis
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="border-l-4 border-l-[#24a148] bg-[var(--cds-layer-02)] px-3 py-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">Gekonnt</span>
                <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)]">{knownCount}</span>
              </div>
              <div className="border-l-4 border-l-[#da1e28] bg-[var(--cds-layer-02)] px-3 py-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">Nicht gekonnt</span>
                <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)]">{missed.length}</span>
              </div>
              <div className="border-l-4 border-l-[#0f62fe] bg-[var(--cds-layer-02)] px-3 py-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">Quote</span>
                <span className="text-2xl font-mono font-semibold text-[var(--cds-text-primary)]">{accuracy}%</span>
              </div>
            </div>

            <p className="text-xs text-[var(--cds-text-secondary)]">
              {cards.length} Karten im Durchgang. Im Wiederholungs-Durchgang danach gekonnt: {learnedOnRepeat} von {missed.length}.
            </p>
          </div>

          {missed.length > 0 && (
            <div className="cds--tile p-0 overflow-hidden">
              <div className="p-3 border-b border-[var(--cds-border-subtle-01)] bg-[var(--cds-layer-02)]">
                <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
                  Offene Karten ({missed.length})
                </h3>
              </div>
              <div className="divide-y divide-[var(--cds-border-subtle-01)]">
                {missed.map((i) => (
                  <div key={i} className="p-3 flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {repeatMarks[i] === "known" ? (
                        <Checkmark size={16} className="text-[#24a148]" />
                      ) : (
                        <Close size={16} className="text-[#da1e28]" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--cds-text-primary)] leading-snug">{cards[i].front}</p>
                      <p className="text-xs text-[var(--cds-text-secondary)] leading-snug mt-0.5">{cards[i].back}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => startSession(cards)}
              className="cds--btn cds--btn--primary text-xs h-11"
            >
              <Restart size={16} className="mr-2" />
              <span>Von vorn üben</span>
            </button>
            {missed.length > 0 && (
              <button
                onClick={() => {
                  setRepeatQueue(missed);
                  setRepeatMarks({});
                  setIndex(0);
                  setPhase("repeat");
                }}
                className="cds--btn cds--btn--secondary text-xs h-11"
              >
                <Notebook size={16} className="mr-2" />
                <span>Nur die offenen Karten</span>
              </button>
            )}
            <button onClick={onBack} className="cds--btn cds--btn--tertiary text-xs h-11">
              <span>Zurück zum Paket</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
