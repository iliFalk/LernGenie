import React from "react";
import { Document, ArrowRight, TrashCan, Calendar, Catalog } from "@carbon/icons-react";
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
      try {
        const res = await authFetch(`/api/packages/${id}`, { method: "DELETE" });
        if (res.ok) {
          onDelete();
        } else {
          alert("Fehler beim Löschen des Lernpakets.");
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert("Netzwerkfehler: Konnte das Lernpaket nicht löschen.");
      }
    }
  };

  if (packages.length === 0) {
    return (
      <div className="cds--tile p-12 text-center border-dashed border-2 border-[var(--cds-border-subtle-01)] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[var(--cds-text-secondary)] mb-4">
          <Catalog size={32} />
        </div>
        <h3 className="text-lg font-medium text-[var(--cds-text-primary)] mb-1">
          Noch keine Lernpakete vorhanden
        </h3>
        <p className="text-sm text-[var(--cds-text-secondary)] max-w-sm mb-6">
          Lade Notizen, Vorlesungsfolien oder Fotos hoch, um dein erstes KI-gestütztes Quizpaket zu generieren.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {packages.map((pkg, index) => (
        <motion.div
          key={pkg.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          onClick={() => onStartQuiz(pkg)}
          className="cds--tile cds--tile--clickable group flex flex-col justify-between h-56 p-5 relative"
        >
          {/* Top Bar: Icon + Action */}
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-10 h-10 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#0f62fe] group-hover:bg-[#0f62fe] group-hover:text-white transition-colors shrink-0">
                <Document size={20} />
              </div>

              <button 
                onClick={(e) => handleDelete(e, pkg.id)}
                title="Lernpaket löschen"
                className="w-8 h-8 flex items-center justify-center text-[var(--cds-text-helper)] hover:text-[#da1e28] hover:bg-[var(--cds-layer-02)] transition-colors"
              >
                <TrashCan size={16} />
              </button>
            </div>

            {/* Package Title */}
            <h3 className="font-semibold text-base text-[var(--cds-text-primary)] group-hover:text-[#0f62fe] transition-colors line-clamp-2 mb-2">
              {pkg.name}
            </h3>

            {/* Tags / Metadata */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="cds--tag cds--tag--blue text-xs">
                Klasse {pkg.grade}
              </span>
              <span className="cds--tag cds--tag--gray text-xs flex items-center gap-1.5">
                <Calendar size={12} />
                {new Date(pkg.created_at!).toLocaleDateString('de-DE')}
              </span>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="pt-3 border-t border-[var(--cds-border-subtle-01)] flex items-center justify-between text-xs font-medium text-[#0f62fe]">
            <span>Paket öffnen</span>
            <ArrowRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
