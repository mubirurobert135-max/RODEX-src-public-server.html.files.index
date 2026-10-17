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
    // Live voice supplies a fresh browser-clock ISO timestamp. Prefer it over the
    // server clock so a host clock drift cannot make "what time is it?" stale.
    const clientClockIso = typeof context?.clientFormattedTime === 'string'
      ? context.clientFormattedTime.trim()
      : '';
    const isIsoTimestamp = /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(clientClockIso);
    const parsedClientClock = isIsoTimestamp ? new Date(clientClockIso) : null;
    const now = parsedClientClock && Number.isFinite(parsedClientClock.getTime())
      ? parsedClientClock
      : new Date();

    try {
      const fullFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        dateStyle: 'full',
        timeStyle: 'long',
      });
      // Spoken time is deliberately rounded to the minute; seconds caused
      // confusing speech like "ten twenty-seven and forty-five".
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
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
        year: Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(now)),
        clockSource: parsedClientClock && Number.isFinite(parsedClientClock.getTime()) ? 'client_clock' : 'server_clock',
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
        message: `The current time in ${timeZone} is ${timeOnly}.`,
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
