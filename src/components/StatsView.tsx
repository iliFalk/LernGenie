import React, { useEffect, useState } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from "recharts";
import { QuizResult } from "../types";
import { 
  ChartLine, 
  Trophy, 
  Checkmark, 
  Catalog, 
  Calendar 
} from "@carbon/icons-react";
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
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Failed to fetch results:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[var(--cds-border-subtle-01)] border-t-[#0f62fe] rounded-full animate-spin mb-3" />
        <p className="text-xs font-mono text-[var(--cds-text-secondary)]">Statistiken werden geladen...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="cds--tile p-12 text-center border-dashed border-2 border-[var(--cds-border-subtle-01)] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] flex items-center justify-center text-[var(--cds-text-secondary)] mb-4">
          <ChartLine size={32} />
        </div>
        <h3 className="text-lg font-semibold text-[var(--cds-text-primary)] mb-1">
          Noch keine Statistiken verfügbar
        </h3>
        <p className="text-xs text-[var(--cds-text-secondary)] max-w-xs">
          Absolviere dein erstes Quiz in einem beliebigen Lernpaket, um hier Auswertungen und Lernkurven zu sehen.
        </p>
      </div>
    );
  }

  const avgAccuracy = results.reduce((acc, curr) => acc + curr.accuracy, 0) / results.length;
  const totalQuestions = results.reduce((acc, curr) => acc + curr.total, 0);
  const correctAnswers = results.reduce((acc, curr) => acc + curr.score, 0);

  // Line chart data (Chronological)
  const lineData = [...results].reverse().map((r, i) => ({
    name: `Q${i + 1}`,
    accuracy: Math.round(r.accuracy),
    date: r.created_at ? new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : ""
  }));

  // Bar chart data (Grouped by Subject)
  const subjectStats = results.reduce((acc: any, curr) => {
    const rawSubject = curr.subject || "Allgemein";
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

  // Discrete color palette
  const PALETTE_COLORS = ['#0f62fe', '#198038', '#0072c3', '#6929c4', '#b28600', '#005d5d', '#9f1853'];

  return (
    <div className="space-y-6 pb-16">
      
      {/* 3 Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="cds--tile p-6 border-l-4 border-l-[#0f62fe]">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Ø Gesamtgenauigkeit
          </span>
          <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--cds-text-primary)] mt-2">
            {Math.round(avgAccuracy)}%
          </p>
        </div>

        <div className="cds--tile p-6 border-l-4 border-l-[#24a148]">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Richtig beantwortet
          </span>
          <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--cds-text-primary)] mt-2">
            {correctAnswers}
            <span className="text-base text-[var(--cds-text-helper)] ml-1">/{totalQuestions} Fragen</span>
          </p>
        </div>

        <div className="cds--tile p-6 border-l-4 border-l-[#8a3ffc]">
          <span className="text-xs font-mono uppercase tracking-wider text-[var(--cds-text-helper)] block">
            Absolvierte Quizzes
          </span>
          <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--cds-text-primary)] mt-2">
            {results.length}
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Accuracy over time */}
        <div className="cds--tile p-6">
          <div className="border-b border-[var(--cds-border-subtle-01)] pb-3 mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
              Genauigkeitsverlauf
            </h3>
            <span className="text-xs font-mono text-[var(--cds-text-helper)]">
              Score in %
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e0e0e0" className="dark:stroke-[#393939]" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#8d8d8d', fontFamily: 'monospace' }}
                  dy={6}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#8d8d8d', fontFamily: 'monospace' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '0px', 
                    border: '1px solid #393939', 
                    boxShadow: 'none',
                    padding: '6px 12px',
                    backgroundColor: '#161616',
                    color: '#f4f4f4',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="accuracy" 
                  stroke="#0f62fe" 
                  strokeWidth={2} 
                  dot={{ r: 3, fill: '#0f62fe', strokeWidth: 1, stroke: '#ffffff' }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accuracy by Subject */}
        <div className="cds--tile p-6">
          <div className="border-b border-[var(--cds-border-subtle-01)] pb-3 mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
              Leistung nach Fach / Bereich
            </h3>
            <span className="text-xs font-mono text-[var(--cds-text-helper)]">
              Ø Genauigkeit
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="2 2" horizontal={false} stroke="#e0e0e0" className="dark:stroke-[#393939]" />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#8d8d8d', fontFamily: 'monospace' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#8d8d8d' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '0px', 
                    border: '1px solid #393939', 
                    boxShadow: 'none',
                    padding: '6px 12px',
                    backgroundColor: '#161616',
                    color: '#f4f4f4',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="accuracy" fill="#0f62fe" barSize={16}>
                  {barData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE_COLORS[index % PALETTE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Historical Quiz Table */}
      <div className="cds--tile p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--cds-border-subtle-01)] bg-[var(--cds-layer-02)] flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[var(--cds-text-primary)]">
            Absolvierte Quiz-Einheiten
          </h3>
          <span className="text-xs font-mono text-[var(--cds-text-secondary)]">
            {results.length} Einträge
          </span>
        </div>

        <div className="divide-y divide-[var(--cds-border-subtle-01)]">
          {results.map((r, i) => (
            <div key={r.id || i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--cds-layer-02)] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-[var(--cds-layer-02)] border border-[var(--cds-border-subtle-01)] text-xs font-mono font-semibold flex items-center justify-center text-[var(--cds-text-primary)]">
                  #{results.length - i}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[var(--cds-text-primary)]">
                    {r.package_name || "Lernpaket"}
                  </h4>
                  <p className="text-[11px] font-mono text-[var(--cds-text-helper)] flex items-center gap-1.5 mt-0.5">
                    <Calendar size={12} />
                    {r.created_at ? new Date(r.created_at).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    }) : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto font-mono text-xs">
                <span className="text-[var(--cds-text-secondary)]">
                  {r.score}/{r.total} richtig
                </span>
                <span className={`cds--tag ${
                  r.accuracy >= 80 ? 'cds--tag--green' : r.accuracy >= 50 ? 'cds--tag--blue' : 'cds--tag--red'
                } text-[11px]`}>
                  {Math.round(r.accuracy)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
