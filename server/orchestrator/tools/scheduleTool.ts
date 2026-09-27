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
