import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Download, 
  Renew, 
  Document, 
  Copy, 
  Checkmark,
  WarningAlt
} from "@carbon/icons-react";
import { StudyPackage } from "../types";
import { getCachedStudyGuide } from "../services/gemini";
import Markdown from "react-markdown";

interface StudyGuideViewProps {
  package: StudyPackage;
  onBack: () => void;
}

export default function StudyGuideView({ package: pkg, onBack }: StudyGuideViewProps) {
  const [guide, setGuide] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadGuide();
  }, []);

  const loadGuide = async (regenerate: boolean = false) => {
    setIsLoading(true);
    try {
      const generated = await getCachedStudyGuide(pkg.id, regenerate);
      setGuide(generated);
    } catch (error) {
      console.error("Error loading study guide:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([guide], { type: 'text/markdown;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = `Study_Guide_${pkg.name.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(guide);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-10 h-10 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono text-[var(--cds-text-secondary)]">Study Guide wird generiert...</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center cds--tile p-8 space-y-4">
        <div className="w-12 h-12 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#da1e28] mx-auto">
          <WarningAlt size={24} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)]">
          Study Guide konnte nicht erstellt werden
        </h3>
        <p className="text-xs text-[var(--cds-text-secondary)] max-w-sm mx-auto">
          Der KI-Service konnte keinen Leitfaden generieren. Bitte versuche es erneut oder prüfe die Quelltexte.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button onClick={onBack} className="cds--btn cds--btn--secondary text-xs">
            Zurück
          </button>
          <button onClick={() => loadGuide(false)} className="cds--btn cds--btn--primary text-xs">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      
      {/* Carbon Breadcrumb & Actions Header */}
      <div>
        <div className="cds--breadcrumb">
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)]">Lernpakete</button>
          <span className="cds--breadcrumb-separator">/</span>
          <button onClick={onBack} className="hover:underline text-[var(--cds-text-secondary)] truncate max-w-xs">{pkg.name}</button>
          <span className="cds--breadcrumb-separator">/</span>
          <span className="text-[var(--cds-text-primary)] font-medium">Study Guide</span>
        </div>

        <div className="border-b border-[var(--cds-border-subtle-01)] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="cds--tag cds--tag--blue text-xs font-mono">
                Klasse {pkg.grade}
              </span>
              <span className="text-xs font-mono text-[var(--cds-text-helper)]">
                Lernleitfaden & Skript
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-light text-[var(--cds-text-primary)] tracking-tight">
              {pkg.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadGuide(true)}
              title="Neu generieren"
              className="cds--btn cds--btn--ghost text-xs h-10 px-3"
            >
              <Renew size={16} className="mr-1.5" />
              <span>Neu generieren</span>
            </button>

            <button 
              onClick={handleCopy}
              title="Kopieren"
              className="cds--btn cds--btn--secondary text-xs h-10 px-3"
            >
              {copied ? <Checkmark size={16} className="mr-1.5 text-[#24a148]" /> : <Copy size={16} className="mr-1.5" />}
              <span>{copied ? "Kopiert" : "Kopieren"}</span>
            </button>

            <button 
              onClick={handleDownload}
              title="Herunterladen"
              className="cds--btn cds--btn--primary text-xs h-10 px-3"
            >
              <Download size={16} className="mr-1.5" />
              <span>Exportieren</span>
            </button>
          </div>
        </div>
      </div>

      {/* Guide Content Tile */}
      <div className="cds--tile p-6 sm:p-10">
        <div className="markdown-body">
          <Markdown>{guide}</Markdown>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="pt-4 flex justify-between items-center">
        <button 
          onClick={onBack}
          className="cds--btn cds--btn--tertiary text-xs"
        >
          <ArrowLeft size={16} className="mr-2" />
          <span>Zurück zur Paketübersicht</span>
        </button>

        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="cds--btn cds--btn--ghost text-xs"
        >
          <span>Nach oben scrollen</span>
        </button>
      </div>

    </div>
  );
}
