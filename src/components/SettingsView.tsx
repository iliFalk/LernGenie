import React, { useState, useEffect } from "react";
import { User, GraduationCap, Moon, Bell, Shield, LogOut, ChevronRight, Save, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface SettingsViewProps {
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export default function SettingsView({ darkMode: propDarkMode, onToggleDarkMode }: SettingsViewProps) {
  const [name, setName] = useState(() => localStorage.getItem("user_name") || "Lern-Profi");
  const [grade, setGrade] = useState(() => localStorage.getItem("user_grade") || "5");
  const [showSaved, setShowSaved] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => propDarkMode ?? document.documentElement.classList.contains("dark"));
  const [notificationTime, setNotificationTime] = useState(() => localStorage.getItem("notification_time") || "08:00");
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(() => localStorage.getItem("notifications_enabled") === "true");

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
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const toggleDarkMode = () => {
    if (onToggleDarkMode) {
      onToggleDarkMode();
      localStorage.setItem("dark_mode", (!isDarkMode).toString());
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
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Profile Section */}
      <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <User size={40} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
            <p className="text-gray-500 dark:text-gray-400">Klasse {grade} • LernGenie Premium</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Dein Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all"
              placeholder="Wie möchtest du genannt werden?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Deine Klassenstufe</label>
            <select 
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all appearance-none bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <option key={g} value={g}>Klasse {g}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100 dark:shadow-none"
          >
            {showSaved ? (
              <>
                <CheckCircle2 size={20} />
                Gespeichert!
              </>
            ) : (
              <>
                <Save size={20} />
                Änderungen speichern
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Präferenzen</span>
        </div>
        
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          <button 
            onClick={toggleDarkMode}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <Moon size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900 dark:text-white">Dark Mode</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Augenschonend bei Nacht</div>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}>
              <motion.div 
                animate={{ x: isDarkMode ? 24 : 4 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
              />
            </div>
          </button>

          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <Bell size={20} />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 dark:text-white">Benachrichtigungen</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Lern-Erinnerungen und Tipps</div>
                </div>
              </div>
              <button 
                onClick={() => setIsNotificationsEnabled(!isNotificationsEnabled)}
                className={`w-12 h-6 rounded-full relative transition-colors ${isNotificationsEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <motion.div 
                  animate={{ x: isNotificationsEnabled ? 24 : 4 }}
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
            
            {isNotificationsEnabled && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="pl-14 pt-2"
              >
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Erinnerungszeit</label>
                <input 
                  type="time" 
                  value={notificationTime}
                  onChange={(e) => setNotificationTime(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all"
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 py-4">
        LernGenie v1.0.0 • Made with ❤️ for Students
      </div>
    </div>
  );
}
