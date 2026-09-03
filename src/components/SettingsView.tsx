import React, { useState, useEffect } from "react";
import { 
  User, 
  Save, 
  Checkmark, 
  Moon, 
  Sun, 
  Notification, 
  Code, 
  Password, 
  Information,
  Settings as SettingsIcon,
  ChevronDown
} from "@carbon/icons-react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsViewProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function SettingsView({ 
  darkMode: propDarkMode, 
  onToggleDarkMode
}: SettingsViewProps) {
  const [name, setName] = useState(() => localStorage.getItem("user_name") || "Lern-Profi");
  const [grade, setGrade] = useState(() => localStorage.getItem("user_grade") || "5");
  const [showSaved, setShowSaved] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => propDarkMode ?? document.documentElement.classList.contains("dark"));
  const [notificationTime, setNotificationTime] = useState(() => localStorage.getItem("notification_time") || "08:00");
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => localStorage.getItem("notifications_enabled") === "true");
  
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem("dev_mode_enabled") === "true");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("custom_api_key") || "");
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("ai_provider") || "gemini");
  const [modelName, setModelName] = useState(() => localStorage.getItem("ai_model") || "");

  useEffect(() => {
    if (propDarkMode !== undefined) {
      setIsDarkMode(propDarkMode);
    }
  }, [propDarkMode]);

  const handleSave = () => {
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_grade", grade);
    localStorage.setItem("notification_time", notificationTime);
    localStorage.setItem("notifications_enabled", isNotificationsEnabled.toString());
    localStorage.setItem("dev_mode_enabled", isDevMode.toString());
    localStorage.setItem("custom_api_key", apiKey);
    localStorage.setItem("ai_provider", aiProvider);
    localStorage.setItem("ai_model", modelName);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const toggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      localStorage.setItem("dark_mode", newMode.toString());
      if (newMode) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      
      {/* Carbon Success Notification */}
      <AnimatePresence>
        {showSaved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="cds--inline-notification cds--inline-notification--success flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Checkmark size={18} className="text-[#24a148]" />
              <span className="text-xs font-semibold">Einstellungen erfolgreich gespeichert.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Tile */}
      <div className="cds--tile p-6 space-y-6">
        <div className="flex items-center gap-4 border-b border-[var(--cds-border-subtle-01)] pb-4">
          <div className="w-12 h-12 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[#0f62fe]">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--cds-text-primary)]">{name}</h3>
            <p className="text-xs font-mono text-[var(--cds-text-helper)]">Klasse {grade} • LernGenie System</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="cds--label">Benutzername</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cds--text-input"
              placeholder="Name eingeben"
            />
          </div>

          <div>
            <label className="cds--label">Klassenstufe</label>
            <div className="relative">
              <select 
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="cds--select pr-10"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                  <option key={g} value={g}>Klasse {g}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--cds-text-secondary)]">
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button 
            id="btn-save-profile-settings"
            onClick={handleSave}
            className="cds--btn cds--btn--primary"
          >
            <Save size={16} className="mr-2" />
            <span>Einstellungen speichern</span>
          </button>
        </div>
      </div>

      {/* Design System & Theme Tile */}
      <div className="cds--tile p-6 space-y-4">
        <div className="border-b border-[var(--cds-border-subtle-01)] pb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Erscheinungsbild
          </span>
          <h3 className="text-sm font-semibold text-[var(--cds-text-primary)]">
            Design & Farbschema
          </h3>
        </div>

        <div className="p-4 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--cds-text-primary)]">Aktives Theme</span>
            <span className="cds--tag cds--tag--blue text-xs font-mono">Standard</span>
          </div>
          <p className="text-[var(--cds-text-secondary)] leading-relaxed">
            Klares, kontrastreiches Interface mit präziser Linienführung, moderner Typografie und vollständiger Barrierefreiheit.
          </p>
        </div>

        {/* Dark Mode Switch */}
        <div className="flex items-center justify-between pt-3 pb-1 border-t border-[var(--cds-border-subtle-01)] gap-4">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[var(--cds-text-secondary)] shrink-0">
              {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-[var(--cds-text-primary)] block">Dunkles Farbschema</span>
              <span className="text-[11px] text-[var(--cds-text-secondary)] block">Umschalten zwischen hellem und dunklem Modus</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-[var(--cds-text-helper)] select-none">
              {isDarkMode ? "Ein" : "Aus"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={toggleDarkMode}
              className={`cds--toggle-btn ${isDarkMode ? "cds--toggle-btn--checked" : ""}`}
              aria-label="Dunkles Farbschema umschalten"
            >
              <span className="cds--toggle-thumb" />
            </button>
          </div>
        </div>

        {/* Notification toggle */}
        <div className="flex items-center justify-between pt-3 pb-1 border-t border-[var(--cds-border-subtle-01)] gap-4">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[var(--cds-text-secondary)] shrink-0">
              <Notification size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-[var(--cds-text-primary)] block">Lern-Erinnerungen</span>
              <span className="text-[11px] text-[var(--cds-text-secondary)] block">Tägliche Erinnerung an Lernziele</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-[var(--cds-text-helper)] select-none">
              {isNotificationsEnabled ? "Ein" : "Aus"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isNotificationsEnabled}
              onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
              className={`cds--toggle-btn ${isNotificationsEnabled ? "cds--toggle-btn--checked" : ""}`}
              aria-label="Lern-Erinnerungen umschalten"
            >
              <span className="cds--toggle-thumb" />
            </button>
          </div>
        </div>

        {isNotificationsEnabled && (
          <div className="pl-11 pt-2">
            <label className="cds--label">Erinnerungszeit</label>
            <input 
              type="time" 
              value={notificationTime}
              onChange={(e) => setNotificationTime(e.target.value)}
              className="cds--text-input max-w-xs font-mono"
            />
          </div>
        )}
      </div>

      {/* Developer Options Tile */}
      <div className="cds--tile p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--cds-border-subtle-01)] pb-3 gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Code size={18} className="text-[var(--cds-text-secondary)] shrink-0" />
            <h3 className="text-sm font-semibold text-[var(--cds-text-primary)] truncate">
              Erweiterte Entwickler-Optionen
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono text-[var(--cds-text-helper)] select-none">
              {isDevMode ? "Ein" : "Aus"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isDevMode}
              onClick={() => setIsDevMode(!isDevMode)}
              className={`cds--toggle-btn ${isDevMode ? "cds--toggle-btn--checked" : ""}`}
              aria-label="Entwicklermodus umschalten"
            >
              <span className="cds--toggle-thumb" />
            </button>
          </div>
        </div>

        {isDevMode && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="cds--label">KI-Provider</label>
              <div className="relative">
                <select 
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="cds--select pr-10"
                >
                  <option value="gemini">Google Gemini (Empfohlen)</option>
                  <option value="openrouter">OpenRouter API</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--cds-text-secondary)]">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div>
              <label className="cds--label">Eigener API-Key (Optional)</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="cds--text-input font-mono text-xs"
                placeholder="Standardmäßig wird der Server-Schlüssel verwendet"
              />
            </div>

            {aiProvider === 'openrouter' && (
              <div>
                <label className="cds--label">OpenRouter Modell-ID</label>
                <input 
                  type="text" 
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="cds--text-input font-mono text-xs"
                  placeholder="google/gemini-2.0-flash-exp:free"
                />
              </div>
            )}

            <p className="text-[11px] text-[var(--cds-text-helper)]">
              Benutzerdefinierte API-Keys werden ausschließlich verschlüsselt im lokalen Browserspeicher gehalten.
            </p>
          </div>
        )}
      </div>

      <div className="text-center text-xs font-mono text-[var(--cds-text-helper)] py-4">
        LernGenie v2.0 • KI-gestützte Lernplattform
      </div>

    </div>
  );
}
