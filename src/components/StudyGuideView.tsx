import React, { useState, useEffect } from "react";
import { ChevronLeft, FileText, Download, Share2, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import { StudyPackage, Material } from "../types";
import { getCachedStudyGuide } from "../services/gemini";
import { authFetch } from "../services/auth";
import Markdown from "react-markdown";

interface StudyGuideViewProps {
  package: StudyPackage;
  onBack: () => void;
}

export default function StudyGuideView({ package: pkg, onBack }: StudyGuideViewProps) {
  const [guide, setGuide] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGuide();
  }, []);

  const loadGuide = async (regenerate: boolean = false) => {
    setIsLoading(true);
    try {
      const generated = await getCachedStudyGuide(pkg.id, regenerate);
      setGuide(generated);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([guide], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Study_Guide_${pkg.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <div className="w-12 h-12 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Erstelle Study Guide...</p>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Fehler beim Erstellen des Study Guides</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
          Der KI-Service konnte keinen Study Guide generieren. Bitte überprüfe deine Internetverbindung oder deinen API-Key in den Einstellungen.
        </p>
        <div className="flex justify-center gap-4">
          <button onClick={onBack} className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors min-h-[44px]">
            Zurück
          </button>
          <button onClick={() => loadGuide(false)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors min-h-[44px]">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-10">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 dark:text-gray-400 font-bold hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors min-h-[44px] min-w-[44px]">
          <ChevronLeft size={24} />
          Zurück
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => loadGuide(true)}
            className="p-3 bg-white dark:bg-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700 shadow-sm transition-all min-h-[44px] min-w-[44px]"
            title="Neu generieren"
          >
            <RefreshCw size={20} />
          </button>
          <button 
            onClick={handleDownload}
            className="p-3 bg-white dark:bg-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700 shadow-sm transition-all min-h-[44px] min-w-[44px]"
            title="Herunterladen"
          >
            <Download size={20} />
          </button>
          <button className="p-3 bg-white dark:bg-gray-800 rounded-2xl text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700 shadow-sm transition-all min-h-[44px] min-w-[44px]">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[3rem] shadow-2xl shadow-indigo-100/20 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="bg-indigo-600 dark:bg-indigo-700 p-8 sm:p-12 text-white relative overflow-hidden transition-colors">
          <Sparkles className="absolute top-6 sm:top-10 right-6 sm:right-10 text-indigo-400 dark:text-indigo-300 opacity-50" size={60} />
          <div className="relative z-10">
            <span className="inline-block px-3 py-1 bg-white/20 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4">
              Zusammenfassung
            </span>
            <h2 className="text-2xl sm:text-4xl font-black mb-2">{pkg.name}</h2>
            <p className="text-indigo-100 dark:text-indigo-200 text-base sm:text-lg">Dein persönlicher Study Guide für Klasse {pkg.grade}</p>
          </div>
        </div>
        
        <div className="p-6 sm:p-12 prose prose-indigo dark:prose-invert max-w-none">
          <div className="markdown-body text-base dark:text-gray-300">
            <Markdown>{guide}</Markdown>
          </div>
        </div>
      </div>
    </div>
  );
}
