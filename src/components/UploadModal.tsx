import React, { useState, useRef } from "react";
import { 
  Close, 
  Upload, 
  Document, 
  Checkmark, 
  WarningAlt, 
  Idea, 
  Folder,
  TrashCan
} from "@carbon/icons-react";
import { extractTextFromImage, generateTopicContent } from "../services/gemini";
import { authFetch } from "../services/auth";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState(1);
  const [creationMode, setCreationMode] = useState<'upload' | 'generate'>('upload');
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(10);
  const [files, setFiles] = useState<{ id: string; name: string; content: string; type: string; status: 'pending' | 'processing' | 'completed' | 'error'; errorMsg?: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setIsProcessing(true);
    
    const initialFiles = Array.from(selectedFiles).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      content: "",
      type: f.type,
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...initialFiles]);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = initialFiles[i].id;
      
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
      
      try {
        const base64 = await fileToBase64(file);
        let extractedText = "";

        if (file.type.startsWith("image/")) {
          extractedText = await extractTextFromImage(base64.split(",")[1], file.type);
        } else {
          extractedText = "Extrahierter Text aus Dokument " + file.name;
        }

        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: extractedText, status: 'completed' } : f));
      } catch (error: any) {
        console.error("Extraction error:", error);
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error', errorMsg: error?.message || "Fehler bei der Extraktion" } : f));
      }
    }

    setIsProcessing(false);
  };

  const handleGenerateAI = async () => {
    if (!name) return;
    
    setIsProcessing(true);
    setProcessingMessage("KI generiert Lerninhalte...");
    
    const fileId = crypto.randomUUID();
    const newFile = {
      id: fileId,
      name: `KI-Inhalt: ${name}`,
      content: "",
      type: "text/markdown",
      status: 'processing' as const
    };
    
    setFiles(prev => [...prev, newFile]);
    
    try {
      const content = await generateTopicContent(name, grade);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content, status: 'completed' } : f));
    } catch (error) {
      console.error(error);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
    } finally {
      setIsProcessing(false);
      setProcessingMessage("");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSave = async () => {
    if (!name || files.length === 0) return;

    setIsProcessing(true);
    setProcessingMessage("Lernpaket wird gespeichert...");

    try {
      const packageId = crypto.randomUUID();
      
      const pkgResponse = await authFetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: packageId, name, grade })
      });

      if (!pkgResponse.ok) {
        throw new Error("Lernpaket konnte nicht erstellt werden.");
      }

      const completedFiles = files.filter(f => f.status === 'completed');
      for (const file of completedFiles) {
        const matResponse = await authFetch("/api/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            package_id: packageId,
            name: file.name,
            content_text: file.content,
            mime_type: file.type
          })
        });
        if (!matResponse.ok) {
          throw new Error(`Material "${file.name}" konnte nicht gespeichert werden.`);
        }
      }

      onSuccess();
      setName("");
      setGrade(10);
      setFiles([]);
      setStep(1);
    } catch (error: any) {
      console.error("Fehler beim Speichern des Lernpakets:", error);
      alert("Fehler beim Speichern: " + (error?.message || "Verbindungsfehler"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#161616]/70 z-50 flex items-center justify-center p-4">
      {/* Carbon Modal Container */}
      <div className="relative bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle-01)] w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Carbon Modal Header */}
        <div className="p-6 border-b border-[var(--cds-border-subtle-01)] flex items-start justify-between bg-[var(--cds-layer-02)]">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--cds-text-helper)] mb-1">
              Schritt {step} von 2 • {step === 1 ? "Konfiguration" : "Inhalte & Materialien"}
            </div>
            <h2 className="text-xl font-light text-[var(--cds-text-primary)]">
              Neues Lernpaket erstellen
            </h2>
          </div>

          <button 
            onClick={onClose}
            title="Schließen"
            className="w-8 h-8 flex items-center justify-center text-[var(--cds-text-secondary)] hover:text-[#da1e28] hover:bg-[var(--cds-layer-01)] transition-colors"
          >
            <Close size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="cds--label">Thema oder Fachgebiet</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Genetik & Vererbung, Weimarer Republik..."
                  className="cds--text-input"
                  autoFocus
                />
              </div>

              <div>
                <label className="cds--label">Erstellungsmethode</label>
                <div className="grid grid-cols-2 gap-3">
                  <div 
                    onClick={() => setCreationMode('upload')}
                    className={`cds--tile cds--tile--clickable p-4 flex flex-col justify-between ${
                      creationMode === 'upload' ? 'border-2 border-[#0f62fe]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--cds-text-primary)]">Eigene Dokumente</span>
                      <Upload size={18} className="text-[#0f62fe]" />
                    </div>
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                      Lade Skripte, Notizen oder Fotos hoch.
                    </p>
                  </div>

                  <div 
                    onClick={() => setCreationMode('generate')}
                    className={`cds--tile cds--tile--clickable p-4 flex flex-col justify-between ${
                      creationMode === 'generate' ? 'border-2 border-[#0f62fe]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[var(--cds-text-primary)]">KI Generierung</span>
                      <Idea size={18} className="text-[#0f62fe]" />
                    </div>
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                      Lass Lerninhalte automatisch erstellen.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="cds--label">Klassenstufe (1 - 13)</label>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {[...Array(13)].map((_, i) => (
                    <button
                      key={i + 1}
                      type="button"
                      onClick={() => setGrade(i + 1)}
                      className={`h-10 text-xs font-mono border transition-colors ${
                        grade === i + 1 
                          ? "bg-[#0f62fe] text-white border-[#0f62fe] font-bold" 
                          : "bg-[var(--cds-layer-02)] text-[var(--cds-text-primary)] border-[var(--cds-border-subtle-01)] hover:bg-[var(--cds-layer-01)]"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {creationMode === 'upload' ? (
                <div>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[var(--cds-border-subtle-01)] p-8 text-center hover:border-[#0f62fe] hover:bg-[var(--cds-layer-02)] transition-colors cursor-pointer"
                  >
                    <Upload size={32} className="text-[#0f62fe] mx-auto mb-3" />
                    <p className="text-sm font-semibold text-[var(--cds-text-primary)]">
                      Dateien auswählen oder per Drag & Drop ablegen
                    </p>
                    <p className="text-xs font-mono text-[var(--cds-text-helper)] mt-1">
                      PDF, DOCX, TXT, JPG, PNG (max. 10 MB)
                    </p>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      multiple 
                      className="hidden" 
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    />
                  </div>
                </div>
              ) : (
                <div className="cds--tile p-6 space-y-4 text-center">
                  <div className="w-12 h-12 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#0f62fe] mx-auto">
                    <Idea size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--cds-text-primary)]">
                      KI-Synthese für "{name}"
                    </h3>
                    <p className="text-xs text-[var(--cds-text-secondary)] mt-1 max-w-sm mx-auto">
                      Ein strukturiertes Lernskript wird passend für Klasse {grade} automatisch generiert.
                    </p>
                  </div>
                  <button
                    disabled={isProcessing || files.some(f => f.status === 'completed')}
                    onClick={handleGenerateAI}
                    className="cds--btn cds--btn--primary justify-center text-xs mx-auto disabled:opacity-40"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Generiere...</span>
                      </div>
                    ) : (
                      <span>{files.some(f => f.status === 'completed') ? 'Inhalt generiert' : 'Inhalte jetzt generieren'}</span>
                    )}
                  </button>
                </div>
              )}

              {/* Uploaded / Generated Materials List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
                    Materialien ({files.length})
                  </span>
                  <div className="divide-y divide-[var(--cds-border-subtle-01)] border border-[var(--cds-border-subtle-01)]">
                    {files.map((file) => (
                      <div key={file.id} className="p-3 bg-[var(--cds-layer-02)] flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <div className="shrink-0">
                            {file.status === 'processing' ? (
                              <div className="w-4 h-4 border-2 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin" />
                            ) : file.status === 'completed' ? (
                              <Checkmark size={16} className="text-[#24a148]" />
                            ) : file.status === 'error' ? (
                              <WarningAlt size={16} className="text-[#da1e28]" />
                            ) : (
                              <Document size={16} className="text-[var(--cds-text-secondary)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[var(--cds-text-primary)] truncate">{file.name}</p>
                            <p className="text-[11px] font-mono text-[var(--cds-text-helper)]">
                              {file.status === 'processing' ? 'Verarbeitung läuft...' : 
                               file.status === 'completed' ? 'Bereit' : 
                               file.status === 'error' ? `Fehler: ${file.errorMsg || 'Fehler'}` : 'Wartend'}
                            </p>
                          </div>
                        </div>

                        <button 
                          onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                          className="w-8 h-8 flex items-center justify-center text-[var(--cds-text-helper)] hover:text-[#da1e28] transition-colors shrink-0"
                          title="Entfernen"
                        >
                          <TrashCan size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Carbon Modal 50/50 Footer */}
        <div className="grid grid-cols-2 border-t border-[var(--cds-border-subtle-01)]">
          {step === 1 ? (
            <>
              <button 
                onClick={onClose}
                className="cds--btn cds--btn--secondary justify-center text-xs h-14"
              >
                Abbrechen
              </button>
              <button 
                disabled={!name}
                onClick={() => setStep(2)}
                className="cds--btn cds--btn--primary justify-center text-xs h-14 disabled:opacity-40"
              >
                Weiter
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setStep(1)}
                className="cds--btn cds--btn--secondary justify-center text-xs h-14"
              >
                Zurück
              </button>
              <button 
                disabled={!files.some(f => f.status === 'completed') || files.some(f => f.status === 'processing' || f.status === 'pending') || isProcessing}
                onClick={handleSave}
                className="cds--btn cds--btn--primary justify-center text-xs h-14 disabled:opacity-40"
              >
                {isProcessing ? (processingMessage || "Wird gespeichert...") : "Paket erstellen"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
