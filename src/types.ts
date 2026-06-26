/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string; // ISO date string
  estimated_duration_mins: number;
  status: 'pending' | 'completed' | 'in_progress';
}

export interface CalendarEvent {
  id: string;
  start: string; // ISO timestamp
  end: string; // ISO timestamp
  title: string;
  is_ai_scheduled?: boolean;
}

export interface UserProfile {
  working_hours: { start: string; end: string }[]; // e.g., [{"start": "09:00", "end": "17:00"}]
  peak_energy_times: string[]; // e.g., ["morning", "afternoon"]
  preferences: {
    focus_block_duration_mins: number;
    buffer_time_mins: number;
    notification_leads_mins: number;
  };
}

export interface RecommendedAction {
  action_type: 'schedule_block' | 'create_task' | 'modify_task' | 'trigger_notification';
  details: {
    task_id?: string;
    title: string;
    start_time?: string; // ISO timestamp
    end_time?: string; // ISO timestamp
    priority: 'High' | 'Medium' | 'Low';
    reasoning: string;
  };
}

export interface MicroStep {
  step_number: number;
  description: string;
  duration_mins: number;
  completed?: boolean;
}

export interface UrgentTaskPlan {
  task_title: string;
  micro_steps: MicroStep[];
}

export interface ChronosResponse {
  intent_detected: 'task_creation' | 'rescheduling' | 'anxiety_mitigation' | 'daily_briefing' | 'goal_breakdown';
  assistant_response: string;
  recommended_actions: RecommendedAction[];
  micro_steps: MicroStep[];
  productivity_insight: string;
  urgent_task_plans?: UrgentTaskPlan[];
}

export interface ChronosRequest {
  current_time: string; // ISO timestamp
  user_profile: UserProfile;
  tasks: Task[];
  calendar_events: CalendarEvent[];
  user_message: string;
}
