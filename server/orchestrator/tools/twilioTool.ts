import { ToolDefinition } from '../types';

export const twilioTool: ToolDefinition = {
  name: 'twilio_service',
  description: 'Programmable SMS and calling services through Twilio. Send text messages and initiate voice calls.',
  permissionLevel: 'elevated',
  parameters: {
    action: {
      type: 'string',
      description: 'The Twilio action to perform: "send_sms" or "make_call"',
      enum: ['send_sms', 'make_call'],
      required: true,
    },
    to: {
      type: 'string',
      description: 'The recipient phone number (E.164 format, e.g. "+256701234567")',
      required: true,
    },
    message: {
      type: 'string',
      description: 'The body of the SMS message to send',
    },
  },
  handler: async (params) => {
    const action = params.action;
    const to = params.to;
    const message = params.message || '';

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+1234567890';

    if (!accountSid || !authToken) {
      return {
        success: false,
        output: null,
        error: 'Twilio integration is not configured. Please add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in environment variables.',
        message: "I couldn't perform this action because the Twilio messaging service is not connected."
      };
    }

    try {
      if (action === 'send_sms') {
        const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Body: message
          })
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            output: data,
            message: `SMS successfully sent to ${to}: "${message}"`
          };
        } else {
          const errText = await response.text();
          return {
            success: false,
            output: null,
            error: `Twilio API error: ${errText}`,
            message: "I couldn't send the SMS because the Twilio service returned an error."
          };
        }
      }

      if (action === 'make_call') {
        const authString = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: fromNumber,
            Url: 'http://demo.twilio.com/docs/voice.xml'
          })
        });

        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            output: data,
            message: `Voice call successfully initiated to ${to}.`
          };
        } else {
          const errText = await response.text();
          return {
            success: false,
            output: null,
            error: `Twilio API error: ${errText}`,
            message: "I couldn't make the call because the Twilio voice service returned an error."
          };
        }
      }
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'Twilio connection failed',
        message: 'A connection failure occurred while communicating with Twilio.'
      };
    }

    return {
      success: false,
      output: null,
      message: 'Unsupported Twilio action.'
    };
  }
};
