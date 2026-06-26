/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckSquare, 
  Square, 
  ArrowRight, 
  Clock, 
  Zap, 
  AlertTriangle, 
  Check, 
  Info,
  Play,
  TrendingUp,
  Award,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';
import { ChronosResponse, RecommendedAction, MicroStep, Task } from '../types';
import { formatLocalTime, formatLocalDate, formatDuration, calculateSprintSchedule } from '../utils';

interface IntelligencePanelProps {
  response: ChronosResponse | null;
  isLoading: boolean;
  loadingStep: string;
  onApplyAction: (action: RecommendedAction) => void;
  appliedActions: string[];
  onOnboardCenter: (title: string, dueDate: string, duration: number) => void;
  firstVisitCenter: boolean;
  onRunPresetScenario: (scenarioMessage: string) => void;
  tasks?: Task[];
  currentTime?: Date;
  deadlineModeActive?: boolean;
  connectionIssue?: boolean;
  onUpdateTaskDueDate?: (id: string, newDueDate: string) => void;
}

const HERO_SCENARIOS = [
  {
    id: 'briefing',
    title: 'Morning Briefing Plan',
    icon: '🌅',
    message: 'Give me my morning briefing. Which tasks are most urgent today, and when should I schedule deep focus blocks to make progress before my meetings start?',
    description: 'Prioritize your immediate workload, dodge upcoming conflicts, and secure optimal focus blocks.'
  },
  {
    id: 'overwhelmed',
    title: 'Feeling Overwhelmed',
    icon: '🧘',
    message: "I'm feeling incredibly overwhelmed today. I have too many things on my plate and I don't know where to start. Please help me clear the noise, pick the absolute top priorities, and give me tiny micro-steps to get started.",
    description: 'Ruthlessly filter out secondary noise, isolate your top priorities, and generate micro-steps.'
  },
  {
    id: 'goal_breakdown',
    title: 'Autonomous Goal Planner',
    icon: '🎯',
    message: 'I want to build a highly functional plan for my goal. Can you break this goal down into highly actionable micro-steps and schedule my first session?',
    description: 'Deconstruct huge, ambiguous long-term goals into a tight progression of 20-minute physical steps.'
  },
  {
    id: 'reschedule',
    title: 'Reschedule Today',
    icon: '⏳',
    message: "I got pulled into an urgent ad-hoc request this morning. Can you reschedule my focus blocks, avoid overlapping my afternoon meetings, and protect some buffer time for me to recover?",
    description: 'Pivot dynamically when ad-hoc work crashes your day. Safely shift focus targets with buffers.'
  }
];

export default function IntelligencePanel({
  response,
  isLoading,
  loadingStep,
  onApplyAction,
  appliedActions,
  onOnboardCenter,
  firstVisitCenter,
  onRunPresetScenario,
  tasks = [],
  currentTime = new Date(),
  deadlineModeActive = false,
  connectionIssue = false,
  onUpdateTaskDueDate
}: IntelligencePanelProps) {
  const [completedSteps, setCompletedSteps] = useState<{ [key: number]: boolean }>({});
  const [showFullAnalysis, setShowFullAnalysis] = useState(true); // Open by default for better legibility
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [conflictResolvedMsg, setConflictResolvedMsg] = useState<string | null>(null);

  // Active urgent task tab state
  const [activeTabTaskId, setActiveTabTaskId] = useState<string | null>(null);

  // Guided Center Onboarding State
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardTitle, setOnboardTitle] = useState('');
  const [onboardDueTime, setOnboardDueTime] = useState('17:00');
  const [onboardDuration, setOnboardDuration] = useState(90);

  // Reset steps completion when a new response or active tab changes
  useEffect(() => {
    setCompletedSteps({});
  }, [response, activeTabTaskId]);

  const [initialProgressAnim, setInitialProgressAnim] = useState(0);

  useEffect(() => {
    if (response) {
      setInitialProgressAnim(0);
      const duration = 2000; // 2 seconds
      const startTime = Date.now();
      let animFrameId: number;

      const updateAnim = () => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min((elapsed / duration) * 5, 5);
        setInitialProgressAnim(currentProgress);
        if (elapsed < duration) {
          animFrameId = requestAnimationFrame(updateAnim);
        }
      };

      animFrameId = requestAnimationFrame(updateAnim);
      return () => cancelAnimationFrame(animFrameId);
    }
  }, [response, activeTabTaskId]);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  // Onboarding submit
  const handleOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardTitle.trim()) return;

    const today = new Date(currentTime);
    const [hours, minutes] = onboardDueTime.split(':');
    today.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    onOnboardCenter(onboardTitle, today.toISOString(), onboardDuration);
  };

  // Determine Urgent Tasks Today
  const isDueToday = (dueDateStr: string) => {
    try {
      const due = new Date(dueDateStr);
      return due.getFullYear() === currentTime.getFullYear() &&
             due.getMonth() === currentTime.getMonth() &&
             due.getDate() === currentTime.getDate();
    } catch {
      return false;
    }
  };

  const urgentTasksToday = tasks.filter(t => t.status !== 'completed' && isDueToday(t.due_date));
  const sortedUrgentTasksToday = [...urgentTasksToday].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  // Find if there are tasks with conflicting (identical) deadlines
  const conflictingDeadlineGroups = (() => {
    const activePending = tasks.filter(t => t.status !== 'completed');
    const grouped: { [key: string]: Task[] } = {};
    
    activePending.forEach(task => {
      if (!task.due_date) return;
      try {
        const d = new Date(task.due_date);
        // Compare by precise minute
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(task);
      } catch (e) {
        // ignore invalid dates
      }
    });
    
    return Object.values(grouped).filter(group => group.length > 1);
  })();

  const handleResolveConflicts = (group: Task[]) => {
    if (!onUpdateTaskDueDate) return;
    
    // Sort tasks in group: shorter duration first, then alphabetically by title
    const sorted = [...group].sort((a, b) => {
      const durA = a.estimated_duration_mins || 45;
      const durB = b.estimated_duration_mins || 45;
      if (durA !== durB) return durA - durB;
      return a.title.localeCompare(b.title);
    });

    // Stagger them. The first task stays at its current deadline.
    // Each subsequent task is pushed back by cumulative duration plus 10 mins buffer
    let baseTime = new Date(sorted[0].due_date).getTime();
    
    sorted.forEach((task, index) => {
      if (index === 0) return;
      
      const prevDurationMins = sorted[index - 1].estimated_duration_mins || 45;
      const delayMs = (prevDurationMins + 10) * 60 * 1000;
      baseTime = baseTime + delayMs;
      
      onUpdateTaskDueDate(task.id, new Date(baseTime).toISOString());
    });

    setConflictResolvedMsg(`Staggered deadlines resolved! Adjusted "${sorted.slice(1).map(t => t.title).join(', ')}" sequentially after "${sorted[0].title}" so they can be completed without overlapping focus windows.`);
    setTimeout(() => {
      setConflictResolvedMsg(null);
    }, 10000);
  };

  // Set default active tab
  useEffect(() => {
    if (sortedUrgentTasksToday.length > 1 && (!activeTabTaskId || !sortedUrgentTasksToday.some(t => t.id === activeTabTaskId))) {
      setActiveTabTaskId(sortedUrgentTasksToday[0].id);
    }
  }, [sortedUrgentTasksToday, activeTabTaskId]);

  const activeTask = sortedUrgentTasksToday.find(t => t.id === activeTabTaskId) || sortedUrgentTasksToday[0];

  // Resolve micro-steps plan for current tab
  let activeMicroSteps = response?.micro_steps || [];
  if (sortedUrgentTasksToday.length > 1 && activeTask && response?.urgent_task_plans) {
    const matchedPlan = response.urgent_task_plans.find(p => 
      p.task_title.toLowerCase().includes(activeTask.title.toLowerCase()) || 
      activeTask.title.toLowerCase().includes(p.task_title.toLowerCase())
    );
    if (matchedPlan) {
      activeMicroSteps = matchedPlan.micro_steps;
    }
  }

  // Compute checklist progress
  const totalSteps = activeMicroSteps.length;
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  useEffect(() => {
    if (totalSteps > 0 && completedCount === totalSteps) {
      if (!hasCelebrated) {
        setShowCelebration(true);
        setHasCelebrated(true);
        const timer = setTimeout(() => {
          setShowCelebration(false);
        }, 8000);
        return () => clearTimeout(timer);
      }
    } else {
      if (completedCount < totalSteps) {
        setHasCelebrated(false);
        setShowCelebration(false);
      }
    }
  }, [completedCount, totalSteps, hasCelebrated]);

  const renderIntentBadge = (intent: string) => {
    const map: { [key: string]: { label: string; bg: string; text: string; emoji: string } } = {
      task_creation: { label: 'Task Creation', bg: 'bg-emerald-100 border-emerald-200', text: 'text-emerald-800', emoji: '📝' },
      rescheduling: { label: 'Rescheduling Sync', bg: 'bg-amber-100 border-amber-200', text: 'text-amber-800', emoji: '⏳' },
      anxiety_mitigation: { label: 'Cognitive Offloading', bg: 'bg-teal-100 border-teal-200', text: 'text-teal-800', emoji: '🧘' },
      daily_briefing: { label: 'Daily Strategy', bg: 'bg-indigo-100 border-indigo-200', text: 'text-indigo-800', emoji: '🌅' },
      goal_breakdown: { label: 'Goal Breakdown', bg: 'bg-blue-100 border-blue-200', text: 'text-blue-800', emoji: '🎯' }
    };
    const info = map[intent] || { label: intent, bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', emoji: '🤖' };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-bold uppercase tracking-wider ${info.bg} ${info.text}`}>
        <span>{info.emoji}</span>
        <span>{info.label}</span>
      </span>
    );
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'schedule_block': return <Clock className="w-4 h-4 text-teal-600" />;
      case 'create_task': return <CheckSquare className="w-4 h-4 text-teal-600" />;
      case 'modify_task': return <Zap className="w-4 h-4 text-amber-600" />;
      case 'trigger_notification': return <TrendingUp className="w-4 h-4 text-teal-600" />;
      default: return <Info className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className={`bg-white border p-6 md:p-8 h-full flex flex-col justify-between rounded-2xl shadow-sm transition-all duration-300 ${
      deadlineModeActive 
        ? 'border-rose-200 bg-rose-50/10' 
        : 'border-slate-200'
    }`} id="intelligence-panel-root">
      
      {/* Loading overlay with progressive steps */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-24 px-4 text-center flex-1 h-full"
            id="intelligence-loading-state"
          >
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin"></div>
              <Sparkles className="w-6 h-6 text-teal-600 absolute top-5 left-5 animate-pulse" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-1.5 tracking-wide animate-pulse">Consulting Clutch</h3>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">{loadingStep}</p>
            {connectionIssue && (
              <p className="text-rose-500 text-xs font-semibold mt-4 animate-pulse">
                Having trouble connecting. Retrying...
              </p>
            )}
          </motion.div>
        )}

        {/* Guided Onboarding */}
        {!isLoading && !response && firstVisitCenter && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col justify-center py-6"
            id="center-onboarding-container"
          >
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 md:p-8 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-600"></div>
              
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-4 h-4 text-teal-600" />
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Step {onboardStep} of 3 • Let's build your day
                </span>
              </div>

              <form onSubmit={handleOnboardSubmit} className="space-y-5">
                {onboardStep === 1 && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">What is your biggest milestone or chore today?</h3>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      Enter the single most important task on your plate. Clutch will design a highly actionable strategy to finish it with zero stress.
                    </p>
                    <input
                      type="text"
                      value={onboardTitle}
                      onChange={(e) => setOnboardTitle(e.target.value)}
                      placeholder="e.g., File family medical taxes"
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={!onboardTitle.trim()}
                      onClick={() => setOnboardStep(2)}
                      className="mt-6 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm tracking-wide py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 transition-all"
                    >
                      <span>Next Step</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {onboardStep === 2 && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">When is it due?</h3>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      Enter the target time so Clutch can map out rest breaks and schedules without overlapping your offline needs.
                    </p>
                    <input
                      type="time"
                      value={onboardDueTime}
                      onChange={(e) => setOnboardDueTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono text-center"
                      required
                    />
                    <div className="flex gap-2.5 mt-6">
                      <button
                        type="button"
                        onClick={() => setOnboardStep(1)}
                        className="w-1/3 border border-slate-200 hover:bg-white text-slate-600 font-bold text-xs py-3.5 rounded-xl"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnboardStep(3)}
                        className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <span>Next Step</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {onboardStep === 3 && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">How much active time do you need?</h3>
                    <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                      Estimate the total hours/minutes you will require to complete this.
                    </p>
                    <div className="space-y-4">
                      <div className="flex justify-between text-xs font-bold text-teal-700">
                        <span>Work Time Needed:</span>
                        <span>{onboardDuration} minutes</span>
                      </div>
                      <input
                        type="range"
                        min="30"
                        max="240"
                        step="15"
                        value={onboardDuration}
                        onChange={(e) => setOnboardDuration(parseInt(e.target.value))}
                        className="w-full accent-teal-600 cursor-pointer"
                      />
                    </div>
                    <div className="flex gap-2.5 mt-6">
                      <button
                        type="button"
                        onClick={() => setOnboardStep(2)}
                        className="w-1/3 border border-slate-200 hover:bg-white text-slate-600 font-bold text-xs py-3.5 rounded-xl"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Formulate Plan</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        )}

        {/* Empty State Scenarios (Select Blueprint) */}
        {!isLoading && !response && !firstVisitCenter && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col justify-start py-2"
            id="hero-scenarios-panel"
          >
            <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold text-slate-700 tracking-wide">Select a daily focus blueprint</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {HERO_SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  className="bg-slate-50 border border-slate-200/80 hover:border-teal-500/80 p-5 rounded-2xl transition-all flex flex-col justify-between group shadow-sm hover:shadow"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl p-1.5 bg-white border border-slate-100 rounded-lg">{sc.icon}</span>
                      <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{sc.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-5">{sc.description}</p>
                  </div>
                  <button
                    onClick={() => onRunPresetScenario(sc.message)}
                    className="w-full bg-white border border-slate-300 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 text-slate-700 text-xs font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Initiate Blueprint</span>
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Actionable Intelligence View */}
        {!isLoading && response && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 flex-1 h-full"
            id="intelligence-results-view"
          >
            {/* Header: intent and status */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-400 tracking-wide">AI coach strategy</span>
            </div>

            {/* Collapsed / Progressive disclosure for Assistant quote and insight */}
            <div className="space-y-4">
              {showFullAnalysis && (
                <div className="space-y-4 animate-slide-down">
                  {/* Assistant Response */}
                  <div className="bg-slate-50/70 p-6 border border-slate-200 relative overflow-hidden rounded-xl shadow-inner">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-teal-600"></div>
                    <p className="text-slate-800 text-base leading-relaxed font-medium italic whitespace-pre-line">
                      "{response.assistant_response}"
                    </p>
                  </div>

                  {/* Productivity Insight */}
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-5 flex gap-3.5 shadow-sm">
                    <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-800 tracking-wide">Routine and energy insight</h4>
                      <p className="text-sm text-slate-700 leading-relaxed mt-1">{response.productivity_insight}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className="w-full text-center py-2.5 border border-slate-200 hover:bg-slate-50 text-xs font-bold tracking-wide text-slate-500 hover:text-slate-800 rounded-xl transition-all"
                id="btn-toggle-full-analysis"
              >
                {showFullAnalysis ? "Hide analysis detail ↑" : "Read full strategy breakdown ↓"}
              </button>
            </div>

            {/* Deadline Conflicts alert box */}
            {conflictingDeadlineGroups.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl space-y-3.5 shadow-sm" id="deadline-conflict-resolver-box">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Deadline Conflict Detected</h4>
                    <p className="text-xs text-slate-700 leading-relaxed mt-1">
                      You have multiple tasks due at the exact same time. It's physically impossible to focus on both simultaneously. Clutch recommends staggering them sequentially to protect your focus integrity.
                    </p>
                    {conflictingDeadlineGroups.map((group, groupIdx) => {
                      const sampleDate = new Date(group[0].due_date);
                      const timeStr = sampleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                      return (
                        <div key={groupIdx} className="mt-3 bg-white/60 border border-amber-100 rounded-lg p-3 space-y-1 text-[11px] text-slate-700 font-mono">
                          <span className="font-bold text-amber-900">Conflict at {timeStr}:</span>
                          <ul className="list-disc pl-4 space-y-1 mt-1">
                            {group.map((t) => (
                              <li key={t.id}>
                                <span className="font-bold">{t.title}</span> (Est: {t.estimated_duration_mins}m)
                              </li>
                            ))}
                          </ul>
                          {onUpdateTaskDueDate && (
                            <button
                              onClick={() => handleResolveConflicts(group)}
                              className="mt-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all tracking-wider shadow-sm active:scale-95"
                            >
                              ⚡ Auto-prioritize & resolve sequentially
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {conflictResolvedMsg && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fade-in" id="conflict-resolution-success-msg">
                <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-emerald-800">{conflictResolvedMsg}</span>
              </div>
            )}

            {/* Summary Banner for Multiple Urgent Tasks */}
            {sortedUrgentTasksToday.length > 1 && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                <span className="text-xs font-bold text-rose-900">
                  You have <span className="text-rose-600 font-extrabold">{sortedUrgentTasksToday.length}</span> urgent tasks today. Sprints are generated for each task separately below.
                </span>
              </div>
            )}

            {/* Tabs for Multiple Urgent Tasks */}
            {sortedUrgentTasksToday.length > 1 && (
              <div className="flex border-b border-slate-100 overflow-x-auto gap-1">
                {sortedUrgentTasksToday.map((task, idx) => {
                  const isActive = (activeTabTaskId === task.id) || (!activeTabTaskId && idx === 0);
                  return (
                    <button
                      key={task.id}
                      onClick={() => setActiveTabTaskId(task.id)}
                      className={`px-4 py-2.5 text-xs font-bold tracking-wide border-t border-x rounded-t-lg transition-all whitespace-nowrap shrink-0 ${
                        isActive 
                          ? 'bg-slate-50 border-slate-200 border-b-transparent text-teal-700 font-black' 
                          : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      🎯 {task.title}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Recommended Actions */}
            {response.recommended_actions && response.recommended_actions.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 tracking-wide mb-3">Calendar action options</h4>
                <div className="space-y-3">
                  {response.recommended_actions.map((action, idx) => {
                    const actionKey = `${action.action_type}-${action.details.title}-${idx}`;
                    const isApplied = appliedActions.includes(actionKey);

                    return (
                      <div 
                        key={idx} 
                        className={`border rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-all shadow-sm ${
                          isApplied ? 'bg-slate-50 border-slate-200/60 opacity-40' : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex gap-3.5 items-start">
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-teal-600 shrink-0">
                            {getActionIcon(action.action_type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm">{action.details.title}</span>
                              <span className={`text-[10px] font-bold tracking-wide px-2 py-0.5 rounded-full border ${
                                action.details.priority === 'High' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                action.details.priority === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {action.details.priority}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed mt-1">
                              {action.details.reasoning}
                            </p>
                            {action.details.start_time && (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-teal-700 mt-2 bg-teal-50 w-fit px-2.5 py-1 border border-teal-200/50 rounded-lg font-mono">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {(() => {
                                    try {
                                      let duration = 45;
                                      if (action.details.start_time && action.details.end_time) {
                                        const s = new Date(action.details.start_time);
                                        const e = new Date(action.details.end_time);
                                        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
                                          duration = Math.round((e.getTime() - s.getTime()) / 60000);
                                        }
                                      }
                                      const match = action.details.reasoning.match(/(\d+)\s*min/i);
                                      if (match && match[1]) {
                                        duration = parseInt(match[1]);
                                      }
                                      if (duration <= 0 || isNaN(duration)) duration = 45;

                                      const schedule = calculateSprintSchedule(currentTime, duration, tasks || []);
                                      return schedule.displayString;
                                    } catch (err) {
                                      return `Starting now → 45m session`;
                                    }
                                  })()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => !isApplied && onApplyAction(action)}
                          disabled={isApplied}
                          className={`flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-lg border transition-all shrink-0 ${
                            isApplied 
                              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                              : 'border-teal-600 bg-teal-600 text-white hover:bg-teal-700'
                          }`}
                        >
                          {isApplied ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Applied</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Add to Calendar</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Micro-Steps Checklist */}
            {activeMicroSteps.length > 0 && (() => {
              const barWidth = completedCount > 0 ? progressPercent : initialProgressAnim;
              return (
                <div className="border-t border-slate-100 pt-5 mt-1">
                  {showCelebration && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-sm flex items-center justify-between gap-2 shadow-sm animate-bounce" id="sprint-celebration-banner">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎉</span>
                        <span>Sprint complete. Take a 5-minute break, then run the next sprint.</span>
                      </div>
                      <button 
                        onClick={() => setShowCelebration(false)} 
                        className="text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-500 tracking-wide flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-teal-600" />
                      <span>Actionable step-by-step checklist</span>
                      {sortedUrgentTasksToday.length > 1 && activeTask && (
                        <span className="text-teal-700 lowercase font-semibold text-xs">
                          (for {activeTask.title})
                        </span>
                      )}
                    </h4>
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                      {completedCount === 0 ? 'Start checking off items as you go' : `${progressPercent}% done`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 border border-slate-200/60 rounded-full h-2 mb-5 overflow-hidden">
                    <div 
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${barWidth}%` }}
                    ></div>
                  </div>

                  {/* Checklist items */}
                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {activeMicroSteps.map((step) => {
                      const isChecked = !!completedSteps[step.step_number];

                      return (
                        <button
                          key={step.step_number}
                          onClick={() => toggleStep(step.step_number)}
                          className={`w-full flex items-center justify-between text-left p-4 rounded-xl border transition-all text-sm shadow-sm ${
                            isChecked 
                              ? 'border-slate-200 bg-slate-50 text-slate-400 line-through opacity-60' 
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 max-w-[85%]">
                            <span className="mt-0.5 shrink-0">
                              {isChecked ? (
                                <motion.div
                                  initial={{ scale: 0, rotate: -20 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Check className="w-4 h-4 text-teal-600 stroke-[3]" />
                                </motion.div>
                              ) : (
                                <div className="w-4 h-4 rounded-md border border-slate-300 bg-white"></div>
                              )}
                            </span>
                            <span className="font-semibold leading-relaxed">
                              {step.step_number}. {step.description || 'Focus step'}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
                            {step.duration_mins ? formatDuration(step.duration_mins) : '~15m'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
