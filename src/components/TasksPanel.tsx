/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckSquare, Square, Trash2, Plus, FolderOpen, Eye, EyeOff, RefreshCw, Clock, Check, X } from 'lucide-react';
import { Task } from '../types';
import { formatLocalTime, formatLocalDate, formatDuration } from '../utils';

interface TasksPanelProps {
  tasks: Task[];
  onAddTask: (title: string, description: string, duration: number, dueDate?: string) => void;
  onRemoveTask: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onUpdateTaskDueDate: (id: string, newDueDate: string) => void;
  currentTime: Date;
  deadlineModeActive: boolean;
  urgentTaskId: string | null;
}

// Helpers for Date calculations in Local Timezone
const getFormattedDate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getNextNearestHour = (d: Date) => {
  const result = new Date(d);
  result.setHours(result.getHours() + 1);
  result.setMinutes(0);
  result.setSeconds(0);
  return result;
};

const getUpcomingSaturday = (d: Date) => {
  const result = new Date(d);
  const day = result.getDay();
  const daysToAdd = (6 - day + 7) % 7 || 7;
  result.setDate(result.getDate() + daysToAdd);
  return getFormattedDate(result);
};

const parseRescheduleTimeSlot = (timeSlot: string, current: Date): string => {
  const target = new Date(current);
  if (timeSlot.toLowerCase().includes('tomorrow')) {
    target.setDate(target.getDate() + 1);
  } else if (timeSlot.toLowerCase().includes('day after')) {
    target.setDate(target.getDate() + 2);
  }
  
  const timeMatch = timeSlot.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (timeMatch) {
    let hrs = parseInt(timeMatch[1]);
    const mins = parseInt(timeMatch[2]);
    const ampm = timeMatch[3];
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && hrs < 12) hrs += 12;
      if (ampm.toUpperCase() === 'AM' && hrs === 12) hrs = 0;
    }
    target.setHours(hrs, mins, 0, 0);
  } else {
    target.setHours(15, 0, 0, 0);
  }
  return target.toISOString();
};

export default function TasksPanel({ 
  tasks, 
  onAddTask, 
  onRemoveTask, 
  onToggleStatus, 
  onUpdateTaskDueDate,
  currentTime,
  deadlineModeActive,
  urgentTaskId
}: TasksPanelProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFullBacklog, setShowFullBacklog] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(45);
  
  // Compound Deadline states
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');

  // Inline Rescheduling state
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [rescheduleSuggestions, setRescheduleSuggestions] = useState<{
    [taskId: string]: Array<{ time_slot: string; reasoning: string }>;
  }>({});

  // Pre-fill form when opened
  useEffect(() => {
    if (showAddForm) {
      setSelectedDate(getFormattedDate(currentTime));
      const nextHour = getNextNearestHour(currentTime);
      setSelectedHour(String(nextHour.getHours()).padStart(2, '0'));
      setSelectedMinute('00');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate) return;

    // Combine into localized ISO string format
    const combinedIso = `${selectedDate}T${selectedHour}:${selectedMinute}:00`;
    onAddTask(
      title,
      description,
      duration,
      combinedIso
    );

    // Reset
    setTitle('');
    setDescription('');
    setDuration(45);
    setShowAddForm(false);
  };

  const handleChipClick = (chipType: 'today' | 'tomorrow' | 'weekend' | 'nextweek') => {
    let dateStr = '';
    const now = new Date(currentTime);
    if (chipType === 'today') {
      dateStr = getFormattedDate(now);
    } else if (chipType === 'tomorrow') {
      dateStr = getFormattedDate(new Date(now.getTime() + 24 * 60 * 60 * 1000));
    } else if (chipType === 'weekend') {
      dateStr = getUpcomingSaturday(now);
    } else if (chipType === 'nextweek') {
      dateStr = getFormattedDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
    setSelectedDate(dateStr);
  };

  const handleInlineReschedule = async (task: Task) => {
    setLoadingTaskId(task.id);
    try {
      const res = await fetch('/api/reschedule-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_title: task.title, duration: task.estimated_duration_mins })
      });
      if (!res.ok) throw new Error('Failed to fetch reschedule suggestions');
      const data = await res.json();
      setRescheduleSuggestions(prev => ({
        ...prev,
        [task.id]: data.options || []
      }));
    } catch (err) {
      console.error('Inline rescheduling error:', err);
      // Hard fallback
      setRescheduleSuggestions(prev => ({
        ...prev,
        [task.id]: [
          { time_slot: "Tomorrow at 10:00 AM", reasoning: "Bypasses morning email clutter and matches peak focus window." },
          { time_slot: "Tomorrow at 3:00 PM", reasoning: "Provides a quiet slot after standard client meetings wrap up." },
          { time_slot: "Day after at 11:30 AM", reasoning: "Leverages a natural open gap between team sync and afternoon review." }
        ]
      }));
    } finally {
      setLoadingTaskId(null);
    }
  };

  const handleApplyReschedule = (taskId: string, timeSlot: string) => {
    const newDueDate = parseRescheduleTimeSlot(timeSlot, currentTime);
    onUpdateTaskDueDate(taskId, newDueDate);
    // Clear suggestions
    setRescheduleSuggestions(prev => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
  };

  const handleCancelReschedule = (taskId: string) => {
    setRescheduleSuggestions(prev => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
  };

  // Sort tasks: pending first, then by due date
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  // Top priorities to display
  const pendingTasks = sortedTasks.filter(t => t.status !== 'completed');
  const completedTasksList = sortedTasks.filter(t => t.status === 'completed');

  const formatDueDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return 'Today';
      }
      const dStr = formatLocalDate(date);
      const tStr = formatLocalTime(date);
      if (dStr === 'Today' && tStr === 'Today') {
        return 'Today';
      }
      return `${dStr} ${tStr}`;
    } catch {
      return 'Today';
    }
  };

  const getUrgencySignal = (dueDateStr: string) => {
    const now = new Date(currentTime);
    const due = new Date(dueDateStr);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 0 && diffHours <= 24) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-rose-200">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Urgent</span>
        </span>
      );
    } else if (diffHours > 24 && diffHours <= 48) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Due soon</span>
        </span>
      );
    }
    return null;
  };

  const hoursOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutesOptions = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  return (
    <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm flex flex-col gap-6" id="tasks-panel-root">
      
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-teal-600" />
            <span>My checklist & goals</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Check off completed items or ask Clutch to rearrange them around conflicts.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-1.5 text-xs font-bold tracking-wide px-4 py-2.5 rounded-xl border transition-all ${
            showAddForm 
              ? 'border-rose-300 bg-rose-50 text-rose-700' 
              : 'border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100'
          }`}
          id="btn-toggle-add-task"
        >
          {showAddForm ? 'Cancel' : (
            <>
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </>
          )}
        </button>
      </div>

      {/* Task Creation Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-slide-down">
          <h3 className="font-bold text-slate-800 text-sm">Add new goal or deadline</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Task title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Review medication schedules, Finalize presentation"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Details & context (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add links, helpful reminders, or step-by-step notes..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 h-20 resize-none"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Estimated duration (mins)</label>
              <input
                type="number"
                min="5"
                max="480"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Due date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Quick date picker</label>
            <div className="flex gap-2 flex-wrap">
              {['today', 'tomorrow', 'weekend', 'nextweek'].map((chip) => {
                const labelMap = { today: 'Today', tomorrow: 'Tomorrow', weekend: 'This weekend', nextweek: 'Next week' };
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleChipClick(chip as any)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:border-teal-500 hover:bg-teal-50/20 text-xs font-medium text-slate-600 hover:text-teal-700 transition-all"
                  >
                    {labelMap[chip as keyof typeof labelMap]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Due hour</label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
              >
                {hoursOptions.map(hr => (
                  <option key={hr} value={hr}>{hr}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 tracking-wide mb-1">Due minute</label>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
              >
                {minutesOptions.map(m => (
                  <option key={m} value={m}>{m}m</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold tracking-wide py-3 rounded-lg transition-colors shadow-sm"
          >
            Create task
          </button>
        </form>
      )}

      {/* Task List Containers */}
      <div className="space-y-6">
        
        {/* Core Checklist Priorities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
            <h3 className="font-bold text-slate-500 text-xs tracking-wide">Active checklist ({pendingTasks.length})</h3>
          </div>
          
          {pendingTasks.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 text-base">
              🎉 All clear! You have completed every task on your checklist.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingTasks.map(task => {
                const isUrgentTask = task.id === urgentTaskId;
                const shouldDim = deadlineModeActive && !isUrgentTask;
                const isLoadingReschedule = loadingTaskId === task.id;
                const suggestions = rescheduleSuggestions[task.id];

                return (
                  <div 
                    key={task.id} 
                    className={`bg-white border rounded-xl p-5 transition-all duration-200 flex flex-col gap-4 shadow-sm border-slate-200 hover:border-slate-300 ${
                      shouldDim ? 'opacity-50' : ''
                    } ${isUrgentTask ? 'ring-2 ring-rose-400 border-rose-300' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {/* Giant Accessible Checkbox Target */}
                        <button 
                          onClick={() => onToggleStatus(task.id)}
                          className="mt-1 text-slate-400 hover:text-teal-600 transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-100"
                          title="Mark Complete"
                          id={`task-check-${task.id}`}
                        >
                          <Square className="w-6 h-6 text-slate-300" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-base truncate">{task.title || 'Untitled task'}</h4>
                            {getUrgencySignal(task.due_date)}
                          </div>
                          {task.description && (
                            <p className="text-sm text-slate-600 leading-relaxed mt-1.5">{task.description || ''}</p>
                          )}
                          <div className="flex items-center gap-3 mt-3 text-xs font-semibold text-slate-500 flex-wrap">
                            <span className="bg-slate-100 px-2 py-1 rounded-md">⏱️ {task.estimated_duration_mins ? formatDuration(task.estimated_duration_mins) : '~30m'}</span>
                            <span className="bg-slate-100 px-2 py-1 rounded-md">📅 Due: {formatDueDate(task.due_date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleInlineReschedule(task)}
                          disabled={isLoadingReschedule}
                          className={`p-2.5 rounded-lg border border-slate-200 hover:border-teal-500 hover:text-teal-600 bg-slate-50 hover:bg-teal-50/20 transition-all ${
                            isLoadingReschedule ? 'animate-spin text-teal-600 border-teal-300 bg-teal-50' : 'text-slate-500'
                          }`}
                          title="Instant AI Reschedule"
                          id={`task-resched-${task.id}`}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveTask(task.id)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors p-2.5 rounded-lg"
                          title="Remove Goal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Loading Inline suggestions */}
                    {isLoadingReschedule && (
                      <div className="text-xs text-teal-600 animate-pulse flex items-center gap-1.5 font-medium ml-12">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Clutch is searching for non-conflicting time slots...</span>
                      </div>
                    )}

                    {/* Inline Suggestions Card */}
                    {suggestions && suggestions.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 ml-12 animate-slide-down shadow-inner">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold tracking-wide text-slate-500 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-teal-600" />
                            Alternative schedule options
                          </span>
                          <button 
                            onClick={() => handleCancelReschedule(task.id)}
                            className="text-xs text-rose-500 hover:text-rose-700 font-bold"
                          >
                            Dismiss
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                          {suggestions.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              onClick={() => handleApplyReschedule(task.id, opt.time_slot)}
                              className="text-left p-3 rounded-lg bg-white border border-slate-200 hover:border-teal-500 hover:bg-teal-50/20 transition-all shadow-sm"
                            >
                              <div className="font-bold text-teal-700 text-xs">{opt.time_slot}</div>
                              <div className="text-slate-500 mt-1 text-[11px] leading-normal">{opt.reasoning}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Checklist Section */}
        {completedTasksList.length > 0 && (
          <div className="border-t border-slate-200 pt-6">
            <button
              onClick={() => setShowFullBacklog(!showFullBacklog)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-xs font-bold tracking-wide py-1"
              id="btn-toggle-backlog"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Completed tasks & archive ({completedTasksList.length})</span>
              {showFullBacklog ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>

            {showFullBacklog && (
              <div className="space-y-3 mt-4 animate-slide-down">
                {completedTasksList.map(task => {
                  return (
                    <div 
                      key={task.id} 
                      className="border border-slate-100 bg-slate-50/80 p-4 rounded-xl flex items-center justify-between gap-4 transition-all opacity-70"
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Completed Checkbox */}
                        <button 
                          onClick={() => onToggleStatus(task.id)}
                          className="text-teal-600 transition-colors shrink-0 p-1 rounded-lg hover:bg-slate-200"
                          title="Mark Pending"
                        >
                          <CheckSquare className="w-5 h-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-slate-500 text-base tracking-wide truncate line-through">
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                            <span>⏱️ Completed</span>
                            <span>Due was {formatDueDate(task.due_date)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => onRemoveTask(task.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-lg"
                        title="Delete Permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
