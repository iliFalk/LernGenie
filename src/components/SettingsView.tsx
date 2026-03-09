import React, { useState, useEffect } from "react";
import { User, GraduationCap, Moon, Bell, Shield, LogOut, ChevronRight, Save, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

export default function SettingsView() {
  const [name, setName] = useState(() => localStorage.getItem("user_name") || "Lern-Profi");
  const [grade, setGrade] = useState(() => localStorage.getItem("user_grade") || "5");
  const [showSaved, setShowSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("user_name", name);
    localStorage.setItem("user_grade", grade);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 lg:pb-0">
      {/* Profile Section */}
      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <User size={40} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{name}</h3>
            <p className="text-gray-500">Klasse {grade} • LernGenie Premium</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Dein Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              placeholder="Wie möchtest du genannt werden?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Deine Klassenstufe</label>
            <select 
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all appearance-none bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => (
                <option key={g} value={g}>Klasse {g}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-100"
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
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Präferenzen</span>
        </div>
        
        <div className="divide-y divide-gray-50">
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Moon size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">Dark Mode</div>
                <div className="text-xs text-gray-500">Augenschonend bei Nacht</div>
              </div>
            </div>
            <div className="w-12 h-6 bg-gray-200 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
            </div>
          </button>

          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Bell size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">Benachrichtigungen</div>
                <div className="text-xs text-gray-500">Lern-Erinnerungen und Tipps</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300" />
          </button>

          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                <Shield size={20} />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">Datenschutz</div>
                <div className="text-xs text-gray-500">Deine Daten sind sicher</div>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button className="w-full px-6 py-5 flex items-center gap-4 text-red-500 hover:bg-red-50 transition-colors">
          <LogOut size={20} />
          <span className="font-bold">Abmelden</span>
        </button>
      </div>

      <div className="text-center text-xs text-gray-400 py-4">
        LernGenie v1.0.0 • Made with ❤️ for Students
      </div>
    </div>
  );
}
