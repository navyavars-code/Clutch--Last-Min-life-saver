/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Clock, 
  Calendar, 
  CheckSquare, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Play,
  Settings,
  MessageSquare,
  HelpCircle,
  Menu
} from 'lucide-react';
import { Task, CalendarEvent, UserProfile, ChronosResponse as ClutchResponse, ChronosRequest as ClutchRequest, RecommendedAction } from './types';
import { formatLocalTime, formatLocalDate, formatDuration, calculateSprintSchedule } from './utils';
import ConsolePanel from './components/ConsolePanel';
import IntelligencePanel from './components/IntelligencePanel';
import CalendarTimeline from './components/CalendarTimeline';
import TasksPanel from './components/TasksPanel';
import JSONInspector from './components/JSONInspector';

// Helper to create a date relative to today
const createRelativeDateStr = (hours: number, minutes: number): string => {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
};

// Set up realistic blocked calendar times for today
const INITIAL_CALENDAR: CalendarEvent[] = [
  {
    id: 'c-1',
    title: 'Daily Team Sync & Standup',
    start: createRelativeDateStr(9, 0),
    end: createRelativeDateStr(9, 45)
  },
  {
    id: 'c-2',
    title: 'Lunch with Sarah',
    start: createRelativeDateStr(12, 0),
    end: createRelativeDateStr(13, 0)
  },
  {
    id: 'c-3',
    title: 'Product Roadmap Review Meeting',
    start: createRelativeDateStr(14, 0),
    end: createRelativeDateStr(15, 30)
  }
];

export default function App() {
  // Real-time local clock ticking
  const [currentTime, setCurrentTime] = useState<Date>(() => {
    return new Date();
  });

  // Check if first-time user flow is needed (localStorage has no tasks)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    return localStorage.getItem('clutch_completed_onboarding') === 'true';
  });

  // Onboarding text input state
  const [onboardingInput, setOnboardingInput] = useState<string>('');

  // Check if center panel first-visit onboarding is needed
  const [firstVisitCenter, setFirstVisitCenter] = useState<boolean>(() => {
    return localStorage.getItem('clutch_completed_center_onboarding') !== 'true';
  });

  // Core Active Tab state to eliminate 3-column congestion
  const [activeTab, setActiveTab] = useState<'plan' | 'tasks' | 'schedule' | 'ask' | 'settings'>('plan');

  // App core state loading from localStorage
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('clutch_tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch {
        // ignore fallback to empty
      }
    }
    return []; // Empty triggers full-screen onboarding
  });

  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('clutch_calendar');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return INITIAL_CALENDAR;
  });

  const [userProfile, setUserProfile] = useState<UserProfile>({
    working_hours: [{ start: '09:00', end: '18:00' }],
    peak_energy_times: ['Morning', 'Late Afternoon'],
    preferences: {
      focus_block_duration_mins: 90,
      buffer_time_mins: 15,
      notification_leads_mins: 10
    }
  });

  const [userMessage, setUserMessage] = useState<string>(
    'Give me my morning briefing. Which tasks are most urgent today, and when should I schedule deep focus blocks to make progress before my meetings start?'
  );

  // Custom follow-up placeholder state
  const [customPlaceholder, setCustomPlaceholder] = useState<string>('');

  // Clutch engine outputs
  const [apiResponse, setApiResponse] = useState<ClutchResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [appliedActions, setAppliedActions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState<boolean>(false);

  // Payload tracking for inspect bar
  const [inputPayload, setInputPayload] = useState<any>(null);
  const [outputPayload, setOutputPayload] = useState<any>(null);

  // Proactive briefing on load triggered tracking
  const [proactiveBriefingTriggered, setProactiveBriefingTriggered] = useState(false);

  // Track the task ID that triggered the active Deadline Mode
  const [lastTriggeredDeadlineTaskId, setLastTriggeredDeadlineTaskId] = useState<string | null>(null);

  // DevMode check for Inspect panel Gating and manual override
  const [isDevMode] = useState(() => {
    return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('devmode') === 'true';
  });
  const [simulateDeadlineMode, setSimulateDeadlineMode] = useState(false);

  // Persist state updates to localStorage
  useEffect(() => {
    localStorage.setItem('clutch_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('clutch_calendar', JSON.stringify(calendarEvents));
  }, [calendarEvents]);

  // Clock ticks every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(prev => new Date(prev.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync Input Payload
  useEffect(() => {
    const currentPayload: ClutchRequest = {
      current_time: currentTime.toISOString(),
      user_profile: userProfile,
      tasks: tasks,
      calendar_events: calendarEvents,
      user_message: userMessage
    };
    setInputPayload(currentPayload);
  }, [currentTime, userProfile, tasks, calendarEvents, userMessage]);

  // Console log on every task list load/update
  useEffect(() => {
    tasks.forEach(task => {
      const dueTime = new Date(task.due_date).getTime();
      const diffMs = dueTime - currentTime.getTime();
      const hoursRemaining = (diffMs / (1000 * 60 * 60)).toFixed(2);
      console.log(`Deadline check: ${task.title} — ${hoursRemaining} hours left`);
    });
  }, [tasks, currentTime]);

  // Determine nearest deadline task within 8 hours (Deadline Mode)
  const getUrgentTask = (): Task | null => {
    if (isDevMode && simulateDeadlineMode) {
      const pending = tasks.filter(t => t.status !== 'completed');
      return pending[0] || {
        id: 'simulated-urgent-task',
        title: 'ISRO Hackathon Submission',
        description: 'Simulated Demo task',
        due_date: new Date(currentTime.getTime() + 5 * 60 * 60 * 1000).toISOString(),
        estimated_duration_mins: 90,
        status: 'pending'
      };
    }

    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    if (pendingTasks.length === 0) return null;

    let minDiffMs = Infinity;
    let urgent: Task | null = null;

    pendingTasks.forEach(task => {
      const dueTime = new Date(task.due_date).getTime();
      const diffMs = dueTime - currentTime.getTime();
      
      if (diffMs > 0 && diffMs <= 8 * 60 * 60 * 1000) {
        if (diffMs < minDiffMs) {
          minDiffMs = diffMs;
          urgent = task;
        }
      }
    });

    return urgent;
  };

  const urgentTask = getUrgentTask();
  const deadlineModeActive = (isDevMode && simulateDeadlineMode) || urgentTask !== null;

  // Apply beautiful warm tinted backgrounds to document.body dynamically
  useEffect(() => {
    if (deadlineModeActive) {
      document.body.style.backgroundColor = '#FEF2F2'; // Soft warm rose-50
    } else {
      document.body.style.backgroundColor = '#FAF9F6'; // Warm Alabaster
    }
  }, [deadlineModeActive]);

  // Proactive Briefing on load
  useEffect(() => {
    if (hasCompletedOnboarding && tasks.length > 0 && !firstVisitCenter && !proactiveBriefingTriggered && !isLoading && !apiResponse && !deadlineModeActive) {
      setProactiveBriefingTriggered(true);
      const proactivePrompt = `Given these tasks ${JSON.stringify(tasks)} and this calendar ${JSON.stringify(calendarEvents)}, give me a 3-sentence morning briefing: what's most urgent, when should I work on it today, and what one thing would most reduce my stress if done first?`;
      handleAnalyze(proactivePrompt);
    }
  }, [hasCompletedOnboarding, tasks, firstVisitCenter, proactiveBriefingTriggered, calendarEvents, isLoading, apiResponse, deadlineModeActive]);

  // Trigger Deadline Mode AI Action
  useEffect(() => {
    if (deadlineModeActive && urgentTask && urgentTask.id !== lastTriggeredDeadlineTaskId && !isLoading) {
      setLastTriggeredDeadlineTaskId(urgentTask.id);
      
      const diffMs = new Date(urgentTask.due_date).getTime() - currentTime.getTime();
      const hoursLeft = (diffMs / (1000 * 60 * 60)).toFixed(1);
      
      const deadlinePrompt = `I have ${hoursLeft} hours left to complete "${urgentTask.title}". Break this into 20-minute focused chunks I can realistically finish right now. Be direct, not motivational.`;
      
      // Auto switch to plan tab to display generated micro-steps
      setActiveTab('plan');
      handleAnalyze(deadlinePrompt);
    }
  }, [deadlineModeActive, urgentTask, lastTriggeredDeadlineTaskId, isLoading]);

  // Reset trigger task when deadline mode deactivates
  useEffect(() => {
    if (!deadlineModeActive) {
      setLastTriggeredDeadlineTaskId(null);
    }
  }, [deadlineModeActive]);

  // Call Express Backend for Clutch AI analysis
  const handleAnalyze = async (customMessage?: string, customTasks?: Task[]) => {
    setIsLoading(true);
    setErrorMessage(null);
    setConnectionIssue(false);
    setAppliedActions([]);
    
    // Automatically shift to AI Plan tab when formulating starts
    setActiveTab('plan');

    const messageToSend = customMessage || userMessage;

    const steps = [
      'Deconstructing pending tasks and deadlines...',
      'Mapping available calendar gaps against focus preferences...',
      'Synthesizing cognitive energy peaks and daily load...',
      'Generating empathetic autonomous recommendations...'
    ];

    let currentStepIndex = 0;
    setLoadingStep(steps[currentStepIndex]);

    const phraseTimer = setInterval(() => {
      currentStepIndex = (currentStepIndex + 1) % steps.length;
      setLoadingStep(steps[currentStepIndex]);
    }, 2200);

    const payload: ClutchRequest = {
      current_time: currentTime.toISOString(),
      user_profile: userProfile,
      tasks: customTasks || tasks,
      calendar_events: calendarEvents,
      user_message: messageToSend
    };
    setInputPayload(payload);

    const runCall = async () => {
      const response = await fetch('/api/clutch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server returned an error status.');
      }

      const data: ClutchResponse = await response.json();
      setApiResponse(data);
      setOutputPayload(data);
      setUserMessage('');
      setCustomPlaceholder('Ask a follow-up, or pick an action template.');
    };

    try {
      await runCall();
    } catch (err: any) {
      console.warn('Initial clutch call failed, scheduling silent retry in 3 seconds...', err);
      setConnectionIssue(true);
      
      // Wait exactly 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        await runCall();
        setConnectionIssue(false); // cleared on success
      } catch (retryErr: any) {
        console.error('Clutch Engine Retry Error:', retryErr);
        setConnectionIssue(false);
        // User-friendly, direct, muted error message
        setErrorMessage('Having trouble connecting. Please check your network and try again in a moment.');
      }
    } finally {
      clearInterval(phraseTimer);
      setIsLoading(false);
    }
  };

  // Full-Screen First-Time Onboarding Submit
  const handleFirstTimeOnboardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingInput.trim()) return;

    const initialOnboardTask: Task = {
      id: `t-onboard-${Date.now()}`,
      title: onboardingInput,
      description: 'Your primary focus milestone.',
      due_date: new Date(currentTime.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      estimated_duration_mins: 90,
      status: 'pending'
    };

    const newTasks = [initialOnboardTask];
    setTasks(newTasks);
    localStorage.setItem('clutch_tasks', JSON.stringify(newTasks));

    localStorage.setItem('clutch_completed_onboarding', 'true');
    setHasCompletedOnboarding(true);

    const goalMessage = `I want to build a highly functional plan for my goal: "${onboardingInput}". Can you break this goal down into highly actionable micro-steps and schedule my first session?`;
    setUserMessage(goalMessage);
    
    localStorage.setItem('clutch_completed_center_onboarding', 'true');
    setFirstVisitCenter(false);
    
    setProactiveBriefingTriggered(true);
    setActiveTab('plan');
    handleAnalyze(goalMessage, newTasks);
  };

  // Guided Center Panel Onboarding Complete
  const handleCenterPanelOnboard = (title: string, dueDate: string, duration: number) => {
    const centerTask: Task = {
      id: `t-center-${Date.now()}`,
      title,
      description: 'Isolated high-urgency milestone.',
      due_date: dueDate,
      estimated_duration_mins: duration,
      status: 'pending'
    };

    const updatedTasks = [...tasks, centerTask];
    setTasks(updatedTasks);
    localStorage.setItem('clutch_tasks', JSON.stringify(updatedTasks));
    localStorage.setItem('clutch_completed_center_onboarding', 'true');
    setFirstVisitCenter(false);
    
    setProactiveBriefingTriggered(true);
    setActiveTab('plan');

    const proactivePrompt = `Given these tasks ${JSON.stringify(updatedTasks)} and this calendar ${JSON.stringify(calendarEvents)}, give me a 3-sentence morning briefing: what's most urgent, when should I work on it today, and what one thing would most reduce my stress if done first?`;
    handleAnalyze(proactivePrompt, updatedTasks);
  };

  // Run Scenario Trigger from Hero cards
  const handleRunPresetScenario = (message: string) => {
    setUserMessage(message);
    setActiveTab('plan');
    handleAnalyze(message);
  };

  // Reset state to template base-case
  const handleResetDemo = () => {
    localStorage.removeItem('clutch_tasks');
    localStorage.removeItem('clutch_calendar');
    localStorage.removeItem('clutch_completed_onboarding');
    localStorage.removeItem('clutch_completed_center_onboarding');

    setTasks([]);
    setCalendarEvents(INITIAL_CALENDAR);
    setApiResponse(null);
    setOutputPayload(null);
    setAppliedActions([]);
    setErrorMessage(null);
    setHasCompletedOnboarding(false);
    setFirstVisitCenter(true);
    setProactiveBriefingTriggered(false);
    setLastTriggeredDeadlineTaskId(null);
    setOnboardingInput('');
    setCustomPlaceholder('');
    setActiveTab('plan');
    setUserMessage('Give me my morning briefing. Which tasks are most urgent today, and when should I schedule deep focus blocks to make progress before my meetings start?');
  };

  // Tasks handlers
  const handleAddTask = (title: string, description: string, duration: number, dueDate?: string) => {
    const newTask: Task = {
      id: `t-${Date.now()}`,
      title,
      description,
      due_date: dueDate || new Date(currentTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      estimated_duration_mins: duration,
      status: 'pending'
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleRemoveTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleToggleTaskStatus = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: t.status === 'completed' ? 'pending' : 'completed'
        };
      }
      return t;
    }));
  };

  const handleUpdateTaskDueDate = (id: string, newDueDate: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: newDueDate } : t));
  };

  // Calendar handlers
  const handleAddCalendarEvent = (title: string, start: string, end: string) => {
    const newEvent: CalendarEvent = {
      id: `c-${Date.now()}`,
      title,
      start,
      end
    };
    setCalendarEvents(prev => [...prev, newEvent]);
  };

  const handleRemoveCalendarEvent = (id: string) => {
    setCalendarEvents(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateEventTime = (id: string, startIso: string, endIso: string) => {
    setCalendarEvents(prev => prev.map(ev => {
      if (ev.id === id) {
        return {
          ...ev,
          start: startIso,
          end: endIso
        };
      }
      return ev;
    }));
  };

  // Lock in AI Recommendations locally
  const handleApplyAction = (action: RecommendedAction) => {
    const actionKey = `${action.action_type}-${action.details.title}-${appliedActions.length}`;

    if (action.action_type === 'schedule_block') {
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

      const schedule = calculateSprintSchedule(currentTime, duration, tasks);
      const start = schedule.start.toISOString();
      const end = schedule.end.toISOString();
      
      const newEvent: CalendarEvent = {
        id: `c-ai-${Date.now()}`,
        title: action.details.title,
        start,
        end,
        is_ai_scheduled: true
      };
      setCalendarEvents(prev => [...prev, newEvent]);
    } else if (action.action_type === 'create_task') {
      const durationStr = action.details.reasoning.match(/(\d+)\s*min/);
      const duration = durationStr ? parseInt(durationStr[1]) : 45;
      
      const newTask: Task = {
        id: `t-ai-${Date.now()}`,
        title: action.details.title,
        description: action.details.reasoning,
        due_date: new Date(currentTime.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        estimated_duration_mins: duration,
        status: 'pending'
      };
      setTasks(prev => [...prev, newTask]);
    } else if (action.action_type === 'modify_task') {
      const match = tasks.find(t => t.title.toLowerCase().includes(action.details.title.toLowerCase()));
      if (match) {
        setTasks(prev => prev.map(t => {
          if (t.id === match.id) {
            return {
              ...t,
              title: action.details.title,
              estimated_duration_mins: t.estimated_duration_mins
            };
          }
          return t;
        }));
      }
    }

    setAppliedActions(prev => [...prev, actionKey]);
  };

  // Format countdown text for header
  const getCountdownText = (dueDateStr: string) => {
    const diffMs = new Date(dueDateStr).getTime() - currentTime.getTime();
    if (diffMs <= 0) return "00:00:00 remaining";
    
    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const h = hours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    const s = seconds.toString().padStart(2, '0');
    return `${h}:${m}:${s} left`;
  };

  // Render Full Screen First-Time Onboarding
  if (!hasCompletedOnboarding) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 border-8 border-slate-200" id="fullscreen-onboarding-root">
        <div className="max-w-md w-full space-y-8 text-center bg-white p-10 border border-slate-200 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-600"></div>
          
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-800">CLUTCH</h1>
            <p className="text-sm text-teal-700 font-bold tracking-wide">Your stress-free personal guide</p>
          </div>

          <form onSubmit={handleFirstTimeOnboardSubmit} className="space-y-6 pt-4">
            <div className="text-left space-y-2">
              <label className="block text-base font-bold text-slate-800 leading-snug">
                What's the one task or deadline you absolutely cannot miss this week?
              </label>
              <p className="text-sm text-slate-500 leading-relaxed">
                Enter your most critical task. Clutch will generate step-by-step, easy guides to help you get it done without feeling overwhelmed.
              </p>
              <input
                type="text"
                value={onboardingInput}
                onChange={(e) => setOnboardingInput(e.target.value)}
                placeholder="e.g., Deliver tax files to agent"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3.5 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!onboardingInput.trim()}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm py-4 rounded-xl transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 shadow"
            >
              Let's build your plan
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen font-sans text-slate-800 selection:bg-teal-500/10 flex flex-col justify-between p-4 md:p-8 border-4 md:border-8 transition-colors duration-500 ${
        deadlineModeActive ? 'bg-[#FFF5F5] border-rose-200' : 'bg-[#FAF9F6] border-slate-200'
      }`} 
      id="app-root"
      style={{ transition: 'all 0.5s ease-in-out' }}
    >
      {/* Dev Mode Controls Panel */}
      {isDevMode && (
        <div className="max-w-4xl mx-auto w-full bg-white border border-slate-200 p-4 mb-6 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-sm" id="devmode-bar">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-mono font-bold tracking-wider text-slate-500">Clutch hackathon workspace</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const now = currentTime;
                const demoTasks: Task[] = [
                  {
                    id: 't-demo-1',
                    title: 'ISRO Hackathon Submission',
                    description: 'Deploy finalized code and review final presentation deck.',
                    due_date: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
                    estimated_duration_mins: 90,
                    status: 'pending'
                  },
                  {
                    id: 't-demo-2',
                    title: 'Samsung Treasure Hunt Test',
                    description: 'Verify API routes, test navigation mechanics, and validate token credentials.',
                    due_date: new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString(),
                    estimated_duration_mins: 120,
                    status: 'pending'
                  },
                  {
                    id: 't-demo-3',
                    title: 'Client proposal draft',
                    description: 'Assemble scope items, cost forecasts, and executive highlights.',
                    due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                    estimated_duration_mins: 60,
                    status: 'pending'
                  }
                ];
                const demoCalendar: CalendarEvent[] = [
                  {
                    id: 'c-demo-1',
                    title: 'Team standup',
                    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
                    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 45).toISOString()
                  },
                  {
                    id: 'c-demo-2',
                    title: 'Product review',
                    start: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0).toISOString(),
                    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30).toISOString()
                  }
                ];
                setTasks(demoTasks);
                setCalendarEvents(demoCalendar);
                setHasCompletedOnboarding(true);
                setFirstVisitCenter(false);
                const proactivePrompt = `Given these tasks ${JSON.stringify(demoTasks)} and this calendar ${JSON.stringify(demoCalendar)}, give me a 3-sentence morning briefing: what's most urgent, when should I work on it today, and what one thing would most reduce my stress if done first?`;
                handleAnalyze(proactivePrompt);
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
              id="btn-load-demo-data"
            >
              Load Demo Data
            </button>
            <button
              onClick={() => {
                const pending = tasks.filter(t => t.status !== 'completed');
                if (pending.length > 0) {
                  const sorted = [...pending].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
                  const nearest = sorted[0];
                  const newDue = new Date(currentTime.getTime() + 45 * 60 * 1000).toISOString();
                  handleUpdateTaskDueDate(nearest.id, newDue);
                } else {
                  const newDue = new Date(currentTime.getTime() + 45 * 60 * 1000).toISOString();
                  handleAddTask('ISRO Hackathon Submission', 'Deploy finalized code and review presentation.', 90, newDue);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
              id="btn-trigger-deadline-mode"
            >
              ⚡ Trigger Deadline Mode
            </button>
            <button
              onClick={handleResetDemo}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
              id="btn-reset-app-dev"
            >
              ↺ Reset app
            </button>
            <button
              onClick={() => setSimulateDeadlineMode(!simulateDeadlineMode)}
              className={`font-bold text-xs px-4 py-2 rounded-xl border transition-all active:scale-95 ${
                simulateDeadlineMode
                  ? 'bg-rose-100 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              id="btn-simulate-deadline-mode"
            >
              {simulateDeadlineMode ? 'Disable Simulation' : 'Simulate Deadline Mode'}
            </button>
          </div>
        </div>
      )}

      {/* Header section */}
      <header className={`border-b pb-6 mb-8 transition-colors duration-500 ${deadlineModeActive ? 'border-rose-200 bg-[#FFF5F5]' : 'border-slate-200'}`} id="app-header">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-800 mt-1">CLUTCH</h1>
            <span className="text-sm text-teal-700 font-semibold tracking-tight block mt-1">AI that shows up when it matters.</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 text-center md:text-right">
            <div>
              {deadlineModeActive && urgentTask ? (
                <div className="text-2xl md:text-3xl font-extrabold tracking-wide text-rose-600 font-mono animate-pulse" id="countdown-clock">
                  {getCountdownText(urgentTask.due_date)}
                </div>
              ) : (
                <div className="text-2xl md:text-3xl font-bold tracking-wider text-slate-800 font-mono" id="dynamic-simulated-clock">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
              )}
              {(() => {
                const dueWithin24Hours = tasks.filter(t => {
                  if (t.status === 'completed') return false;
                  const dueTime = new Date(t.due_date).getTime();
                  const diffMs = dueTime - currentTime.getTime();
                  return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
                });
                const watchCount = dueWithin24Hours.length;
                if (watchCount === 0) return null;
                return (
                  <div className="text-[10px] text-teal-700 font-bold mt-1 tracking-wider">
                    {watchCount === 1 ? 'Watching 1 deadline today' : watchCount === 2 ? 'Watching 2 deadlines today' : `Watching ${watchCount} deadlines today`}
                  </div>
                );
              })()}
            </div>

            {isDevMode && (
              <button
                onClick={handleResetDemo}
                className="p-2.5 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-sm"
                title="Reset Companion State"
                id="btn-reset-demo"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto py-2 flex-1 w-full flex flex-col gap-6" id="app-main-content">
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl flex items-start gap-3 text-sm animate-pulse" id="global-error-banner">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Coach Engine Communication Issue</p>
              <p className="mt-0.5 text-rose-600">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Urgent Deadline Mode Banner */}
        {deadlineModeActive && urgentTask && (() => {
          const urgentTasksCount = tasks.filter(t => {
            if (t.status === 'completed') return false;
            const due = new Date(t.due_date).getTime();
            const diffMs = due - currentTime.getTime();
            return diffMs > 0 && diffMs <= 8 * 60 * 60 * 1000;
          }).length;
          return (
            <div className="bg-rose-100 border border-rose-200 text-rose-900 px-5 py-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse shadow-sm" id="deadline-mode-banner">
              <div className="flex items-center gap-3">
                <span className="flex h-3.5 w-3.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
                </span>
                <span className="text-sm font-bold">
                  {urgentTasksCount >= 2 
                    ? `Attention: You have ${urgentTasksCount} urgent sprints today. Let's tackle them step-by-step.`
                    : `Focus Mode is active for "${urgentTask.title}". Let's finish this!`
                  }
                </span>
              </div>
              <div className="text-xs font-bold text-rose-800 bg-white border border-rose-200 px-3 py-1.5 rounded-lg shrink-0">
                Time left: {getCountdownText(urgentTask.due_date)}
              </div>
            </div>
          );
        })()}

        {/* --- SPACIOUS TOP TAB NAVIGATION BAR --- */}
        <div className="bg-white border border-slate-200 p-2 rounded-2xl shadow-sm flex flex-wrap gap-1.5" id="tab-navigation-bar">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'plan'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>🌅 AI plan guide</span>
          </button>
          
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'tasks'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>📝 My checklist</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'schedule'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📅 My schedule</span>
          </button>

          <button
            onClick={() => setActiveTab('ask')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'ask'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>💬 Ask AI coach</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'settings'
                ? 'bg-teal-600 text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>⚙️ Focus preference</span>
          </button>
        </div>

        {/* --- DYNAMIC TAB VIEWPORTS --- */}
        <div className="w-full min-h-[400px]" id="tab-viewport">
          
          {/* Tab 1: AI Plan Guide */}
          {activeTab === 'plan' && (
            <div className="animate-fade-in">
              <IntelligencePanel
                response={apiResponse}
                isLoading={isLoading}
                loadingStep={loadingStep}
                onApplyAction={handleApplyAction}
                appliedActions={appliedActions}
                onOnboardCenter={handleCenterPanelOnboard}
                firstVisitCenter={firstVisitCenter}
                onRunPresetScenario={handleRunPresetScenario}
                tasks={tasks}
                currentTime={currentTime}
                deadlineModeActive={deadlineModeActive}
                connectionIssue={connectionIssue}
                onUpdateTaskDueDate={handleUpdateTaskDueDate}
              />
            </div>
          )}

          {/* Tab 2: Checklist & Tasks */}
          {activeTab === 'tasks' && (
            <div className="animate-fade-in">
              <TasksPanel
                tasks={tasks}
                onAddTask={handleAddTask}
                onRemoveTask={handleRemoveTask}
                onToggleStatus={handleToggleTaskStatus}
                onUpdateTaskDueDate={handleUpdateTaskDueDate}
                currentTime={currentTime}
                deadlineModeActive={deadlineModeActive}
                urgentTaskId={urgentTask ? urgentTask.id : null}
              />
            </div>
          )}

          {/* Tab 3: Daily Schedule timeline */}
          {activeTab === 'schedule' && (
            <div className="animate-fade-in">
              <CalendarTimeline
                events={calendarEvents}
                tasks={tasks}
                currentTime={currentTime}
                onAddEvent={handleAddCalendarEvent}
                onRemoveEvent={handleRemoveCalendarEvent}
                onUpdateEventTime={handleUpdateEventTime}
              />
            </div>
          )}

          {/* Tab 4: Ask Coach chat */}
          {activeTab === 'ask' && (
            <div className="animate-fade-in">
              <ConsolePanel
                userMessage={userMessage}
                setUserMessage={setUserMessage}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                onAnalyze={() => handleAnalyze()}
                isLoading={isLoading}
                customPlaceholder={customPlaceholder}
                showOnlySettings={false}
              />
            </div>
          )}

          {/* Tab 5: Preferences */}
          {activeTab === 'settings' && (
            <div className="animate-fade-in">
              <ConsolePanel
                userMessage={userMessage}
                setUserMessage={setUserMessage}
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                onAnalyze={() => handleAnalyze()}
                isLoading={isLoading}
                customPlaceholder={customPlaceholder}
                showOnlySettings={true}
              />
            </div>
          )}

        </div>

        {/* Collapsible raw protocol debugger for hackers */}
        {isDevMode && (
          <JSONInspector
            inputPayload={inputPayload}
            outputPayload={outputPayload}
          />
        )}
      </main>

      {/* Warm and friendly footer */}
      <footer className="mt-8 flex flex-col md:flex-row items-center justify-between border-t border-slate-200 pt-6 max-w-4xl mx-auto w-full" id="app-footer">
        <div className="flex gap-8 mb-4 md:mb-0">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tasks remaining</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5">
              {tasks.filter(t => t.status !== 'completed').length.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Rests & Buffer</span>
            <span className="text-xl font-bold text-slate-800 mt-0.5">
              {formatDuration(userProfile.preferences.buffer_time_mins)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Focus Segments</span>
            <span className="text-xl font-bold text-teal-700 mt-0.5">
              {formatDuration(userProfile.preferences.focus_block_duration_mins)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold text-slate-500 tracking-tight">Clutch Companion Ready</span>
        </div>
      </footer>
    </div>
  );
}
