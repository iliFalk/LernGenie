import React from "react";
import { BookOpen, ChevronRight, Trash2, Calendar, FileText } from "lucide-react";
import { StudyPackage } from "../types";
import { motion } from "motion/react";
import { authFetch } from "../services/auth";

interface LibraryProps {
  packages: StudyPackage[];
  onStartQuiz: (pkg: StudyPackage) => void;
  onDelete: () => void;
}

export default function Library({ packages, onStartQuiz, onDelete }: LibraryProps) {
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Möchtest du dieses Lernpaket wirklich löschen?")) {
      await authFetch(`/api/packages/${id}`, { method: "DELETE" });
      onDelete();
    }
  };

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 bg-white/50 dark:bg-gray-800/50 rounded-[40px] border-2 border-dashed border-gray-200/60 dark:border-gray-700/60 transition-colors">
        <div className="w-20 h-20 bg-gray-50/50 dark:bg-gray-900/50 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 mb-6">
          <BookOpen size={40} strokeWidth={1.5} />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Noch keine Lernpakete</h3>
        <p className="text-gray-400 dark:text-gray-500 max-w-[240px] text-center text-sm leading-relaxed">
          Lade deine Notizen oder Fotos hoch, um dein erstes Quiz zu erstellen.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      {packages.map((pkg, index) => (
        <motion.div
          key={pkg.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onStartQuiz(pkg)}
          className="group bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-indigo-900 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => handleDelete(e, pkg.id)}
              className="w-11 h-11 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            >
              <Trash2 size={20} />
            </button>
          </div>

          <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl sm:rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
              <FileText size={20} className="sm:hidden" />
              <FileText size={24} className="hidden sm:block" />
            </div>
            <div className="pr-8">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">{pkg.name}</h3>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md font-medium text-gray-700 dark:text-gray-300">Klasse {pkg.grade}</span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="sm:hidden" />
                  <Calendar size={14} className="hidden sm:block" />
                  {new Date(pkg.created_at!).toLocaleDateString('de-DE')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-50 dark:border-gray-700">
            <span className="text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
              Quiz starten
              <ChevronRight size={14} className="sm:hidden" />
              <ChevronRight size={16} className="hidden sm:block" />
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
