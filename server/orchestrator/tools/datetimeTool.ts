import { ToolDefinition } from '../types';

export const datetimeTool: ToolDefinition = {
  name: 'datetime_timezone',
  description: 'Retrieve high-precision current date, time, timezone conversions, or chronometer calculations anchored in 2026.',
  permissionLevel: 'safe',
  parameters: {
    targetTimeZone: {
      type: 'string',
      description: 'The IANA timezone identifier (e.g., "Africa/Kampala", "UTC", "America/New_York", "Europe/London", "Asia/Tokyo")',
      default: 'Africa/Kampala',
    },
    format: {
      type: 'string',
      description: 'Format style: "full", "time_only", "date_only", "iso"',
      enum: ['full', 'time_only', 'date_only', 'iso'],
      default: 'full',
    },
  },
  handler: async (params, context) => {
    const timeZone = params.targetTimeZone || context?.timeZone || 'Africa/Kampala';
    const now = new Date();

    try {
      const fullFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeStyle: 'medium',
      });
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        dateStyle: 'full',
      });

      const formatted = fullFormatter.format(now);
      const timeOnly = timeFormatter.format(now);
      const dateOnly = dateFormatter.format(now);

      const output = {
        iso: now.toISOString(),
        timeZone,
        formatted,
        timeOnly,
        dateOnly,
        year: 2026,
        eatTime: new Intl.DateTimeFormat('en-US', {
          timeZone: 'Africa/Kampala',
          dateStyle: 'full',
          timeStyle: 'medium',
        }).format(now),
        utcTime: now.toUTCString(),
      };

      return {
        success: true,
        output,
        message: `Current time in ${timeZone}: ${formatted}`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Invalid timezone '${timeZone}': ${err?.message}`,
      };
    }
  },
  examples: [
    { query: 'What time is it in Uganda?', params: { targetTimeZone: 'Africa/Kampala' } },
    { query: 'What is the current UTC date and time?', params: { targetTimeZone: 'UTC' } },
    { query: 'What time is it in Tokyo?', params: { targetTimeZone: 'Asia/Tokyo' } },
  ],
};
