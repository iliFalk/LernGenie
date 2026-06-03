import React, { useEffect, useState } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from "recharts";
import { QuizResult } from "../types";
import { TrendingUp, Target, Award, Clock, ArrowLeft } from "lucide-react";
import { authFetch } from "../services/auth";

interface ExtendedResult extends QuizResult {
  package_name: string;
  subject?: string;
}

export default function StatsView() {
  const [results, setResults] = useState<ExtendedResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const res = await authFetch("/api/results");
      const data = await res.json();
      setResults(data);
    } catch (error) {
      console.error("Failed to fetch results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
          <TrendingUp size={32} />
        </div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Noch keine Statistiken</h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
          Schließe dein erstes Quiz ab, um deinen Lernfortschritt hier zu verfolgen.
        </p>
      </div>
    );
  }

  const avgAccuracy = results.reduce((acc, curr) => acc + curr.accuracy, 0) / results.length;
  const totalQuestions = results.reduce((acc, curr) => acc + curr.total, 0);
  const correctAnswers = results.reduce((acc, curr) => acc + curr.score, 0);

  // Prepare data for line chart (Accuracy over time)
  const lineData = results.map((r, i) => ({
    name: `Quiz ${i + 1}`,
    accuracy: Math.round(r.accuracy),
    date: r.created_at ? new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ""
  }));

  // Prepare data for bar chart grouped by Subject (Fach)
  const subjectStats = results.reduce((acc: any, curr) => {
    const rawSubject = curr.subject || "Sonstiges";
    if (!acc[rawSubject]) {
      acc[rawSubject] = { name: rawSubject, totalAccuracy: 0, count: 0, score: 0, total: 0 };
    }
    acc[rawSubject].totalAccuracy += curr.accuracy;
    acc[rawSubject].count += 1;
    acc[rawSubject].score += curr.score;
    acc[rawSubject].total += curr.total;
    return acc;
  }, {});

  const barData = Object.values(subjectStats).map((s: any) => ({
    name: s.name,
    accuracy: Math.round(s.totalAccuracy / s.count),
    quizzesCount: s.count,
    correctRatio: `${s.score}/${s.total}`,
    ratioPercent: s.total > 0 ? Math.round((s.score / s.total) * 100) : 0
  })).sort((a: any, b: any) => b.accuracy - a.accuracy);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#06B6D4'];

  return (
    <div className="space-y-8 pb-20 lg:pb-12">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <Award size={20} />
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ø Genauigkeit</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(avgAccuracy)}%</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
              <Target size={20} />
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Richtige Antworten</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{correctAnswers} / {totalQuestions}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Versuche</span>
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{results.length}</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Line Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
            <TrendingUp size={20} className="text-indigo-600 dark:text-indigo-400" />
            Lernfortschritt (nach Datum)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6'} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                  domain={[0, 100]}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    padding: '12px',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1F2937' : '#FFFFFF',
                    color: document.documentElement.classList.contains('dark') ? '#FFFFFF' : '#000000'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#4F46E5" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
            <Award size={20} className="text-emerald-600 dark:text-emerald-400" />
            Performance nach Schulfach
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={document.documentElement.classList.contains('dark') ? '#374151' : '#F3F4F6'} />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: document.documentElement.classList.contains('dark') ? '#9CA3AF' : '#4B5563', fontWeight: 600 }}
                  width={110}
                />
                <Tooltip 
                  cursor={{ fill: document.documentElement.classList.contains('dark') ? '#374151' : '#F9FAFB' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    padding: '12px',
                    backgroundColor: document.documentElement.classList.contains('dark') ? '#1F2937' : '#FFFFFF',
                    color: document.documentElement.classList.contains('dark') ? '#FFFFFF' : '#000000'
                  }}
                />
                <Bar dataKey="accuracy" radius={[0, 8, 8, 0]} barSize={24}>
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Subject Overview Section */}
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors">
        <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-white">
          Detaillierte Fächer-Übersicht
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {barData.map((item: any, i) => {
            const barFill = COLORS[i % COLORS.length];
            return (
              <div 
                key={item.name} 
                className="p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-extrabold text-gray-800 dark:text-white text-base">
                      {item.name}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {item.quizzesCount} {item.quizzesCount === 1 ? 'Quiz' : 'Quizzes'} absolviert
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span 
                      className="text-sm font-black px-2.5 py-1 rounded-xl"
                      style={{ backgroundColor: `${barFill}15`, color: barFill }}
                    >
                      {item.accuracy}% Ø
                    </span>
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mt-1">
                      {item.correctRatio} richtig
                    </span>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${item.accuracy}%`, backgroundColor: barFill }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
