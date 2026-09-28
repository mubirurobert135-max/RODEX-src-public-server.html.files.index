import { ToolDefinition } from '../types';

export interface ScheduledTask {
  id: string;
  userId: string;
  title: string;
  timeStr: string;
  dateStr?: string;
  category: 'reminder' | 'task' | 'meeting' | 'alarm';
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
}

// In-memory persistent schedule store with user-scoping
const userSchedules: Map<string, ScheduledTask[]> = new Map();

// Helper to parse dynamic relative/human time expressions into start/end ISO strings
function parseRelativeTime(timeStr: string): { start: string; end: string } {
  const now = new Date();
  let targetDate = new Date(now);
  
  const clean = timeStr.toLowerCase().trim();
  
  if (clean.includes('minute')) {
    const match = clean.match(/(\d+)\s*minute/);
    const mins = match ? parseInt(match[1], 10) : 30;
    targetDate.setMinutes(now.getMinutes() + mins);
  } else if (clean.includes('hour')) {
    const match = clean.match(/(\d+)\s*hour/);
    const hrs = match ? parseInt(match[1], 10) : 1;
    targetDate.setHours(now.getHours() + hrs);
  } else if (clean.includes('day')) {
    const match = clean.match(/(\d+)\s*day/);
    const days = match ? parseInt(match[1], 10) : 1;
    targetDate.setDate(now.getDate() + days);
  } else if (clean.includes('tomorrow')) {
    targetDate.setDate(now.getDate() + 1);
    const timeMatch = clean.match(/at\s*(\d+)(?::(\d+))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hrs = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hrs < 12) hrs += 12;
      if (ampm && ampm.toLowerCase() === 'am' && hrs === 12) hrs = 0;
      targetDate.setHours(hrs, mins, 0, 0);
    } else {
      targetDate.setHours(9, 0, 0, 0); // default 9 AM tomorrow
    }
  } else {
    const timeMatch = clean.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hrs = parseInt(timeMatch[1], 10);
      const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3];
      if (ampm && ampm.toLowerCase() === 'pm' && hrs < 12) hrs += 12;
      if (ampm && ampm.toLowerCase() === 'am' && hrs === 12) hrs = 0;
      targetDate.setHours(hrs, mins, 0, 0);
      if (targetDate.getTime() < now.getTime()) {
        targetDate.setDate(now.getDate() + 1);
      }
    } else {
      targetDate.setHours(now.getHours() + 1);
    }
  }
  
  const endEvent = new Date(targetDate);
  endEvent.setHours(targetDate.getHours() + 1); // 1 hour default
  
  return {
    start: targetDate.toISOString(),
    end: endEvent.toISOString()
  };
}

export const scheduleTool: ToolDefinition = {
  name: 'schedule_manager',
  description: 'Create, inspect, list, or cancel scheduled tasks, reminders, meetings, and alarms for the user.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'The schedule action: "create_reminder", "list_schedule", "cancel_task", "complete_task"',
      enum: ['create_reminder', 'list_schedule', 'cancel_task', 'complete_task'],
      required: true,
    },
    title: {
      type: 'string',
      description: 'The task title or reminder description (e.g. "Study for exam", "Team meeting", "Drink water")',
    },
    timeStr: {
      type: 'string',
      description: 'The target time or duration (e.g. "6:00 PM", "tomorrow at 8:00 AM", "in 30 minutes")',
    },
    category: {
      type: 'string',
      description: 'The category: "reminder", "task", "meeting", "alarm"',
      enum: ['reminder', 'task', 'meeting', 'alarm'],
    },
    taskId: {
      type: 'string',
      description: 'The ID of the task to complete or cancel',
    },
  },
  handler: async (params, context) => {
    const action = params?.action || 'list_schedule';
    const userId = context?.userId || 'usr_default';
    const userTasks = userSchedules.get(userId) || [];

    // Authenticated Google Calendar integration path
    if (context?.gmailAccessToken) {
      try {
        if (action === 'create_reminder') {
          const title = params?.title || 'Reminder';
          const timeStr = params?.timeStr || 'soon';
          const { start, end } = parseRelativeTime(timeStr);
          
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${context.gmailAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              summary: title,
              description: `Scheduled by RODEX AI for ${timeStr}`,
              start: { dateTime: start },
              end: { dateTime: end }
            })
          });
          
          if (response.ok) {
            const eventData = await response.json();
            return {
              success: true,
              output: eventData,
              message: `Event "${title}" has been successfully scheduled on your Google Calendar for ${timeStr}.`
            };
          }
        }

        if (action === 'list_schedule') {
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=' + new Date().toISOString(), {
            headers: {
              'Authorization': `Bearer ${context.gmailAccessToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const events = data.items || [];
            const list = events.map((e: any) => {
              const start = e.start?.dateTime || e.start?.date || '';
              const formattedStart = start ? new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
              return `"${e.summary}" at ${formattedStart || 'all day'}`;
            }).join(', ');
            
            return {
              success: true,
              output: events,
              message: events.length > 0 
                ? `Your upcoming Google Calendar schedule: ${list}.`
                : 'You have no upcoming events on your Google Calendar today.'
            };
          }
        }

        if (action === 'cancel_task') {
          const taskId = params?.taskId;
          if (taskId) {
            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${taskId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${context.gmailAccessToken}`
              }
            });
            
            if (response.ok) {
              return {
                success: true,
                output: { taskId },
                message: `Event has been successfully cancelled and removed from your Google Calendar.`
              };
            }
          }
        }
      } catch (err) {
        console.warn('[schedule_manager] Google Calendar sync failed, falling back to local database.', err);
      }
    }

    // Local in-memory fallback path
    if (action === 'create_reminder') {
      const title = params?.title || 'Reminder';
      const timeStr = params?.timeStr || 'soon';
      const category = (params?.category as any) || 'reminder';

      const newTask: ScheduledTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId,
        title,
        timeStr,
        category,
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      userTasks.unshift(newTask);
      userSchedules.set(userId, userTasks);

      return {
        success: true,
        output: newTask,
        message: `Scheduled reminder set: "${title}" for ${timeStr}.`,
      };
    }

    if (action === 'list_schedule') {
      const activeTasks = userTasks.filter((t) => t.status === 'active');
      return {
        success: true,
        output: { tasks: activeTasks, total: activeTasks.length },
        message: activeTasks.length > 0
          ? `You have ${activeTasks.length} active scheduled task(s): ${activeTasks.map((t) => `"${t.title}" at ${t.timeStr}`).join(', ')}.`
          : 'You currently have no pending reminders or scheduled tasks.',
      };
    }

    if (action === 'cancel_task') {
      const taskId = params?.taskId;
      const target = userTasks.find((t) => t.id === taskId || t.title.toLowerCase().includes((params?.title || '').toLowerCase()));
      if (target) {
        target.status = 'cancelled';
        return {
          success: true,
          output: target,
          message: `Cancelled task: "${target.title}".`,
        };
      }
      return {
        success: false,
        output: null,
        message: 'No matching scheduled task found to cancel.',
      };
    }

    return {
      success: true,
      output: userTasks,
      message: 'Schedule retrieved.',
    };
  },
  examples: [
    { query: 'Remind me at 6 PM to study', params: { action: 'create_reminder', title: 'Study', timeStr: '6:00 PM' } },
    { query: 'What are my reminders for today?', params: { action: 'list_schedule' } },
  ],
};
