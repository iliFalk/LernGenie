import React, { useState, useRef } from "react";
import { X, Upload, Camera, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { extractTextFromImage } from "../services/gemini";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ isOpen, onClose, onSuccess }: UploadModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(10);
  const [files, setFiles] = useState<{ id: string; name: string; content: string; type: string; status: 'pending' | 'processing' | 'completed' | 'error' }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setIsProcessing(true);
    
    // Add all files to the list with pending status first
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
      
      // Update status to processing
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f));
      
      try {
        const base64 = await fileToBase64(file);
        let extractedText = "";

        if (file.type.startsWith("image/")) {
          extractedText = await extractTextFromImage(base64.split(",")[1], file.type);
        } else {
          extractedText = "Beispieltext aus Dokument " + file.name;
        }

        // Update status to completed and add content
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content: extractedText, status: 'completed' } : f));
      } catch (error) {
        console.error(error);
        // Update status to error
        setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
      }
    }

    setIsProcessing(false);
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
    setProcessingMessage("Speichere Lernpaket...");

    const packageId = crypto.randomUUID();
    
    // Create package
    await fetch("/api/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: packageId, name, grade })
    });

    // Create materials (only completed ones)
    const completedFiles = files.filter(f => f.status === 'completed');
    for (const file of completedFiles) {
      await fetch("/api/materials", {
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
    }

    setIsProcessing(false);
    onSuccess();
    // Reset state
    setName("");
    setGrade(10);
    setFiles([]);
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
      >
        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold">Neues Lernpaket</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name des Themas</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Photosynthese, Französische Revolution..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Klassenstufe (1-13)</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {[...Array(13)].map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setGrade(i + 1)}
                      className={`py-2 rounded-lg font-medium transition-all ${grade === i + 1 ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button 
                  disabled={!name}
                  onClick={() => setStep(2)}
                  className="w-full bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Weiter zum Upload
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-3xl p-6 sm:p-10 flex flex-col items-center justify-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <p className="font-bold text-gray-900 text-center">Dateien auswählen oder ablegen</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">PDF, Word, JPG, PNG (max. 10MB)</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple 
                  className="hidden" 
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Dateien ({files.length})</h4>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="shrink-0">
                            {file.status === 'processing' ? (
                              <Loader2 size={18} className="text-indigo-500 animate-spin" />
                            ) : file.status === 'completed' ? (
                              <CheckCircle2 size={18} className="text-emerald-500" />
                            ) : file.status === 'error' ? (
                              <AlertCircle size={18} className="text-red-500" />
                            ) : (
                              <FileText size={18} className="text-gray-400" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{file.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                              {file.status === 'processing' ? 'Wird verarbeitet...' : 
                               file.status === 'completed' ? 'Bereit' : 
                               file.status === 'error' ? 'Fehler' : 'Warten...'}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                          className="text-gray-400 hover:text-red-500 shrink-0 ml-2"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  onClick={() => setStep(1)}
                  className="order-2 sm:order-1 flex-1 bg-gray-100 text-gray-700 py-3 sm:py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Zurück
                </button>
                <button 
                  disabled={!files.some(f => f.status === 'completed') || files.some(f => f.status === 'processing' || f.status === 'pending') || isProcessing}
                  onClick={handleSave}
                  className="order-1 sm:order-2 flex-[2] bg-indigo-600 text-white py-3 sm:py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      {processingMessage || "Verarbeite..."}
                    </>
                  ) : (
                    "Paket erstellen"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
