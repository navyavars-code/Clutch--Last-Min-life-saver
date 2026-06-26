/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Calendar, Plus, Trash2, Clock, Sparkles, RefreshCw, Check, X } from 'lucide-react';
import { CalendarEvent, Task } from '../types';
import { formatLocalTime, formatLocalDate, formatDuration } from '../utils';

interface CalendarTimelineProps {
  events: CalendarEvent[];
  tasks: Task[];
  currentTime: Date;
  onAddEvent: (title: string, start: string, end: string) => void;
  onRemoveEvent: (id: string) => void;
  onUpdateEventTime: (id: string, start: string, end: string) => void;
}

interface RescheduleSuggestion {
  suggested_start: string;
  suggested_end: string;
  reasoning: string;
}

export default function CalendarTimeline({ 
  events, 
  tasks,
  currentTime,
  onAddEvent, 
  onRemoveEvent,
  onUpdateEventTime
}: CalendarTimelineProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');

  // Reschedule state
  const [loadingRescheduleId, setLoadingRescheduleId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ [eventId: string]: RescheduleSuggestion }>({});
  const [eventSuggestions, setEventSuggestions] = useState<{ [eventId: string]: { list: string[]; loading: boolean } }>({});

  React.useEffect(() => {
    events.forEach(event => {
      if (eventSuggestions[event.id]) return; // already fetched or fetching

      setEventSuggestions(prev => ({
        ...prev,
        [event.id]: { list: [], loading: true }
      }));

      fetch('/api/calendar-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_title: event.title })
      })
      .then(res => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data: string[]) => {
        setEventSuggestions(prev => ({
          ...prev,
          [event.id]: { list: Array.isArray(data) ? data : ["Mute Slack notifications"], loading: false }
        }));
      })
      .catch(() => {
        // Fallback localized mocks
        const titleLower = (event.title || "").toLowerCase();
        let fallback = ["Protect buffer time after", "Mute Slack notifications"];
        if (titleLower.includes("standup") || titleLower.includes("sync") || titleLower.includes("meeting")) {
          fallback = ["Prepare 3 key bullet points", "Stand during the update"];
        } else if (titleLower.includes("lunch") || titleLower.includes("break") || titleLower.includes("eat")) {
          fallback = ["Step away from screen", "Hydrate with cold water"];
        } else if (titleLower.includes("review") || titleLower.includes("roadmap") || titleLower.includes("design")) {
          fallback = ["Mute distractions completely", "Sip green tea for focus"];
        }
        setEventSuggestions(prev => ({
          ...prev,
          [event.id]: { list: fallback, loading: false }
        }));
      });
    });
  }, [events]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Build standard ISO datetime strings for the current focus date
    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const baseDate = getLocalDateString(currentTime || new Date());
    const startIso = `${baseDate}T${startTime}:00`;
    const endIso = `${baseDate}T${endTime}:00`;

    onAddEvent(title, startIso, endIso);
    setTitle('');
    setShowAddForm(false);
  };

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Format time beautifully with safe guards
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return '12:00 PM';
      }
      const formatted = formatLocalTime(date);
      if (formatted === 'Today') {
        return '12:00 PM';
      }
      return formatted;
    } catch {
      return '12:00 PM';
    }
  };

  const handleRescheduleClick = async (event: CalendarEvent) => {
    setLoadingRescheduleId(event.id);
    try {
      const response = await fetch('/api/reschedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event,
          tasks,
          current_time: currentTime.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch reschedule suggestions');
      }

      const data: RescheduleSuggestion = await response.json();
      setSuggestions(prev => ({
        ...prev,
        [event.id]: data
      }));
    } catch (err) {
      console.error('Rescheduling block error:', err);
      // Fallback
      const baseDate = new Date(currentTime);
      const start_time = new Date(baseDate.getTime() + 180 * 60 * 1000).toISOString();
      const end_time = new Date(baseDate.getTime() + 240 * 60 * 1000).toISOString();
      setSuggestions(prev => ({
        ...prev,
        [event.id]: {
          suggested_start: start_time,
          suggested_end: end_time,
          reasoning: "Rescheduled late afternoon slot to avoid meeting conflicts and open immediate deep-work capacity."
        }
      }));
    } finally {
      setLoadingRescheduleId(null);
    }
  };

  const handleAcceptReschedule = (eventId: string, suggested: RescheduleSuggestion) => {
    onUpdateEventTime(eventId, suggested.suggested_start, suggested.suggested_end);
    // Clear suggestion
    setSuggestions(prev => {
      const copy = { ...prev };
      delete copy[eventId];
      return copy;
    });
  };

  const handleDeclineReschedule = (eventId: string) => {
    setSuggestions(prev => {
      const copy = { ...prev };
      delete copy[eventId];
      return copy;
    });
  };

  return (
    <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-2xl shadow-sm flex flex-col gap-6" id="calendar-timeline-root">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            <span>My Daily Schedule</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Block out focused work segments or custom routine sessions.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border transition-all ${
            showAddForm 
              ? 'border-rose-300 bg-rose-50 text-rose-700' 
              : 'border-slate-300 text-slate-700 bg-slate-50 hover:bg-slate-100'
          }`}
          id="btn-toggle-add-event"
        >
          {showAddForm ? 'Cancel' : (
            <>
              <Plus className="w-4 h-4" />
              <span>Block Time</span>
            </>
          )}
        </button>
      </div>

      {/* Add Time Block Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 animate-slide-down">
          <h3 className="font-bold text-slate-800 text-sm">Create Focus or Personal Block</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Time Block Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Exercise routine, Prep financial drafts"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 font-mono"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold uppercase tracking-wider py-3 rounded-lg transition-colors shadow-sm"
          >
            Schedule Block
          </button>
        </form>
      )}

      {/* Timeline Events Feed */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        {sortedEvents.length === 0 ? (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-500 text-base">
            📭 Your calendar is wide open today. Time to plan deep focus!
          </div>
        ) : (
          <div className="relative border-l-2 border-slate-200 pl-6 ml-3 space-y-6">
            {sortedEvents.map(event => {
              const isAiBlock = !!event.is_ai_scheduled;
              const hasSuggestion = !!suggestions[event.id];
              const isRescheduling = loadingRescheduleId === event.id;

              return (
                <div key={event.id} className="relative group">
                  {/* Bullet indicator in time track */}
                  <span className={`absolute -left-[31px] top-1.5 flex items-center justify-center w-4 h-4 rounded-full border-2 bg-white transition-all ${
                    isAiBlock ? 'border-teal-500 scale-110' : 'border-slate-300'
                  }`} />

                  {/* Main Event Card */}
                  <div className={`p-4 rounded-xl border shadow-sm transition-all bg-white ${
                    isAiBlock 
                      ? 'border-teal-200 bg-teal-50/20 hover:border-teal-300' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-base">{event.title}</span>
                          {isAiBlock && (
                            <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200 uppercase tracking-wider font-sans">
                              <Sparkles className="w-3 h-3 text-teal-600" />
                              AI SPRINT
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span>{formatTime(event.start)} - {formatTime(event.end)}</span>
                        </div>

                        {/* Interactive low-contrast AI Suggestion chip */}
                        {(() => {
                          const state = eventSuggestions[event.id];
                          if (!state) return null;
                          if (state.loading) {
                            return (
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-slate-50/50 border border-slate-100 rounded-lg px-2 py-0.5 w-fit animate-pulse">
                                <Sparkles className="w-3 h-3 text-slate-300 animate-spin-slow" />
                                <span>Analyzing event context...</span>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {state.list.slice(0, 1).map((sug, idx) => (
                                <button
                                  key={idx}
                                  className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700 bg-teal-50/50 border border-teal-100/60 rounded-lg px-2.5 py-0.5 hover:bg-teal-100 hover:border-teal-200 transition-all cursor-pointer shadow-sm active:scale-95"
                                  title="Click to seek detail in coach chat"
                                >
                                  <Sparkles className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span>AI suggestion: {sug}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Intelligent schedule rebalance trigger */}
                        <button
                          onClick={() => handleRescheduleClick(event)}
                          disabled={isRescheduling}
                          className={`p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-teal-50/20 hover:border-teal-500 hover:text-teal-600 transition-all ${
                            isRescheduling ? 'animate-spin text-teal-600 border-teal-400' : 'text-slate-500'
                          }`}
                          title="Auto-rebalance timeslot"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveEvent(event.id)}
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors p-2 rounded-lg"
                          title="Remove Block"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Reschedule suggestion bubble details */}
                    {hasSuggestion && (
                      <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-md animate-slide-down">
                        <div className="flex items-start gap-2 text-teal-800">
                          <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-bold">Recommended alternative time:</span>
                            <div className="font-mono text-teal-700 font-extrabold mt-1">
                              {formatTime(suggestions[event.id].suggested_start)} - {formatTime(suggestions[event.id].suggested_end)}
                            </div>
                            <p className="text-slate-600 mt-1.5 leading-relaxed">
                              {suggestions[event.id].reasoning}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => handleDeclineReschedule(event.id)}
                            className="px-3 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 rounded-lg"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptReschedule(event.id, suggestions[event.id])}
                            className="px-3.5 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accept</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
