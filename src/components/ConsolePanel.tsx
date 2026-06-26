/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, Settings, Clock, Zap, MessageSquare, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types';

interface ConsolePanelProps {
  userMessage: string;
  setUserMessage: (msg: string) => void;
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onAnalyze: () => void;
  isLoading: boolean;
  customPlaceholder?: string;
  showOnlySettings?: boolean; // Prop to render only preferences
}

const SCENARIOS = [
  {
    id: 'briefing',
    title: 'Morning Briefing Plan',
    icon: '🌅',
    message: 'Give me my morning briefing. Which tasks are most urgent today, and when should I schedule deep focus blocks to make progress before my meetings start?',
    description: 'Prioritize daily work and secure optimal focus times.'
  },
  {
    id: 'overwhelmed',
    title: 'Feeling Overwhelmed',
    icon: '🧘',
    message: "I'm feeling incredibly overwhelmed today. I have too many things on my plate and I don't know where to start. Please help me clear the noise, pick the absolute top priorities, and give me tiny micro-steps to get started.",
    description: 'Reduce mental clutter and break goals into simple steps.'
  },
  {
    id: 'goal_breakdown',
    title: 'Autonomous Goal Planner',
    icon: '🎯',
    message: 'I want to build a highly functional plan for my goal. Can you break this goal down into highly actionable micro-steps and schedule my first session?',
    description: 'Deconstruct a big, ambiguous project into friendly, 20-minute chunks.'
  },
  {
    id: 'reschedule',
    title: 'Reschedule Today',
    icon: '⏳',
    message: "I got pulled into an urgent ad-hoc request this morning. Can you reschedule my focus blocks, avoid overlapping my afternoon meetings, and protect some buffer time for me to recover?",
    description: 'Rebalance calendar times dynamically with comfortable rest buffers.'
  }
];

const PLACEHOLDERS = [
  "I have a presentation due tomorrow, where do I start?",
  "I am overwhelmed — what should I drop today?",
  "I keep procrastinating on my task. What should I do now?",
  "I have 2 hours left. What do I do first?"
];

export default function ConsolePanel({
  userMessage,
  setUserMessage,
  userProfile,
  setUserProfile,
  onAnalyze,
  isLoading,
  customPlaceholder,
  showOnlySettings = false
}: ConsolePanelProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  // Rotate placeholder every 4 seconds when not focused and message is empty
  useEffect(() => {
    if (isFocused || userMessage) return;
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isFocused, userMessage]);

  const handleSelectScenario = (msg: string) => {
    setUserMessage(msg);
  };

  const handleUpdatePreferences = (key: keyof UserProfile['preferences'], value: number) => {
    setUserProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value
      }
    }));
  };

  const handleTogglePeakEnergy = (time: string) => {
    setUserProfile(prev => {
      const current = prev.peak_energy_times;
      const updated = current.includes(time)
        ? current.filter(t => t !== time)
        : [...current, time];
      return { ...prev, peak_energy_times: updated };
    });
  };

  if (showOnlySettings) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6 shadow-sm" id="settings-panel-root">
        <div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-600" />
            <span>My Focus Preferences</span>
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Customize working schedules, buffers, and energetic windows to help Clutch organize your day without stress.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shift hours card */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-4">
            <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600" /> Working hours & routine
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">Start Time</label>
                <input
                  type="text"
                  value={userProfile.working_hours[0].start}
                  onChange={(e) => setUserProfile(prev => {
                    const updated = [...prev.working_hours];
                    updated[0] = { ...updated[0], start: e.target.value };
                    return { ...prev, working_hours: updated };
                  })}
                  placeholder="09:00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">End Time</label>
                <input
                  type="text"
                  value={userProfile.working_hours[0].end}
                  onChange={(e) => setUserProfile(prev => {
                    const updated = [...prev.working_hours];
                    updated[0] = { ...updated[0], end: e.target.value };
                    return { ...prev, working_hours: updated };
                  })}
                  placeholder="18:00"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 font-mono"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Limits task planning to this active window.
            </p>
          </div>

          {/* Peak energy card */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-4">
            <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-teal-600" /> Peak energy periods
            </h4>
            <p className="text-xs text-slate-500">Clutch schedules highly demanding focus blocks when your energy is at its peak.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {['Morning', 'Early Afternoon', 'Late Afternoon', 'Evening'].map(time => {
                const isChecked = userProfile.peak_energy_times.includes(time);
                return (
                  <button
                    key={time}
                    onClick={() => handleTogglePeakEnergy(time)}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      isChecked
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Focus duration and buffers slider card */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/60 space-y-5">
          <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
            <Settings className="w-4 h-4 text-teal-600" /> Durations & rests
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>FOCUS BLOCK DURATION</span>
                <span className="font-bold text-teal-700">{userProfile.preferences.focus_block_duration_mins} mins</span>
              </div>
              <input
                type="range"
                min="30"
                max="120"
                step="15"
                value={userProfile.preferences.focus_block_duration_mins}
                onChange={(e) => handleUpdatePreferences('focus_block_duration_mins', parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                Length of continuous work segments before taking a break.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>REST & BUFFER TIME</span>
                <span className="font-bold text-teal-700">{userProfile.preferences.buffer_time_mins} mins</span>
              </div>
              <input
                type="range"
                min="5"
                max="45"
                step="5"
                value={userProfile.preferences.buffer_time_mins}
                onChange={(e) => handleUpdatePreferences('buffer_time_mins', parseInt(e.target.value))}
                className="w-full accent-teal-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 leading-normal">
                Comfortable breathing room scheduled between consecutive events.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" id="console-panel-root">
      {/* Ask Clutch Panel */}
      <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm flex flex-col gap-6" id="message-console-card">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
            <span>Consult Your AI Coach</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Explain what is causing you stress or select an action template below to let Clutch auto-organize your workload.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative w-full">
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full min-h-[120px] bg-slate-50 border border-slate-300 rounded-xl p-4 text-base text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 resize-none leading-relaxed font-sans transition-all duration-200"
              id="textarea-user-message"
            />
            {!userMessage && !isFocused && (
              <div className="absolute top-4 left-4 right-4 text-slate-400 pointer-events-none select-none transition-all duration-500 ease-in-out transform translate-y-0 opacity-100 flex flex-col justify-start">
                <div 
                  key={placeholderIndex} 
                  className="animate-fade-in-up text-sm md:text-base leading-relaxed font-sans text-slate-400"
                >
                  {customPlaceholder || PLACEHOLDERS[placeholderIndex]}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-3 text-xs text-slate-600 bg-teal-50/50 p-4 border border-teal-100 rounded-xl leading-relaxed">
            <AlertCircle className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> Your active checklist, routine timers, and today's commitments are sent alongside your question for highly accurate, stress-free advice.
            </span>
          </div>

          <button
            onClick={onAnalyze}
            disabled={isLoading || !userMessage.trim()}
            className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl font-bold text-sm tracking-wide transition-all shadow-sm ${
              isLoading || !userMessage.trim()
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                : 'bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.99]'
            }`}
            id="btn-analyze-context"
          >
            <Sparkles className="w-4 h-4" />
            {isLoading ? 'Thinking...' : 'Formulate Stress-Free Plan'}
          </button>
        </div>
      </div>

      {/* Scenario Templates */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Quick Action Blueprints</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="scenarios-list">
          {SCENARIOS.map(sc => {
            const isSelected = userMessage === sc.message;
            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc.message)}
                className={`p-4 text-left border rounded-xl transition-all flex gap-3 items-start h-full ${
                  isSelected
                    ? 'border-teal-500 bg-teal-50/60 shadow-sm ring-1 ring-teal-500/10'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
                id={`scenario-btn-${sc.id}`}
              >
                <span className="text-2xl shrink-0 p-1.5 bg-slate-100 rounded-lg">{sc.icon}</span>
                <div className="min-w-0 flex-1">
                  <h4 className={`font-bold text-sm leading-tight transition-colors ${
                    isSelected ? 'text-teal-700' : 'text-slate-800'
                  }`}>
                    {sc.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sc.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
