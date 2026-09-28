import { ToolDefinition } from '../types';

export const whatsappTool: ToolDefinition = {
  name: 'whatsapp_service',
  description: 'Official WhatsApp Cloud API integration to send messages securely.',
  permissionLevel: 'elevated',
  parameters: {
    action: {
      type: 'string',
      description: 'The WhatsApp action: "send_message"',
      enum: ['send_message'],
      required: true,
    },
    to: {
      type: 'string',
      description: 'Recipient phone number in E.164 format (e.g. "+256701234567")',
      required: true,
    },
    message: {
      type: 'string',
      description: 'The message body content',
      required: true,
    },
  },
  handler: async (params) => {
    const to = params.to;
    const message = params.message;

    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      return {
        success: false,
        output: null,
        error: 'WhatsApp Business Cloud API is not configured. Please add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in environment variables.',
        message: "I couldn't send the WhatsApp message because the official WhatsApp Business integration is not connected."
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          output: data,
          message: `WhatsApp message successfully sent to ${to}: "${message}"`
        };
      } else {
        const errText = await response.text();
        return {
          success: false,
          output: null,
          error: `WhatsApp API error: ${errText}`,
          message: "I couldn't send the WhatsApp message because the Meta API returned an error."
        };
      }
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: err?.message || 'WhatsApp connection failed',
        message: 'A connection failure occurred while communicating with Meta Graph API.'
      };
    }
  }
};
