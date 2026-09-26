import { ToolDefinition } from '../types';

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
  relationship?: string;
}

// In-memory secured sandbox Android Contacts database
const mockContactsDatabase: ContactRecord[] = [
  {
    id: 'ct-1',
    name: 'Johnathan Vance',
    phone: '+256 701 234 567',
    email: 'johnathan.vance@techcorp.ug',
    company: 'TechCorp Uganda',
    relationship: 'Colleague',
  },
  {
    id: 'ct-2',
    name: 'Sarah Nalubega',
    phone: '+256 772 345 678',
    email: 'sarah.nalubega@fintech.africa',
    company: 'Fintech Africa',
    relationship: 'Security Lead',
  },
  {
    id: 'ct-3',
    name: 'David Mukasa',
    phone: '+256 788 456 789',
    email: 'david.mukasa@cloudsystems.ug',
    company: 'Cloud Systems Ltd',
    relationship: 'DevOps Architect',
  },
  {
    id: 'ct-4',
    name: 'Princess Ruth Komuntale',
    phone: '+256 750 999 888',
    email: 'komuntale@toororoyal.ug',
    company: 'Kingdom of Tooro',
    relationship: 'Royal Patron',
  },
];

export const contactsTool: ToolDefinition = {
  name: 'contacts_service',
  description:
    'Android Contacts Integration to search contacts, find phone numbers, email addresses, and initiate authorized calling or messaging.',
  permissionLevel: 'elevated',
  parameters: {
    action: {
      type: 'string',
      description: 'The contact action: search | find_by_name | get_phone | get_email | initiate_call | list_recent',
      required: true,
      enum: ['search', 'find_by_name', 'get_phone', 'get_email', 'initiate_call', 'list_recent'],
    },
    nameQuery: {
      type: 'string',
      description: 'Contact name or partial query (e.g. "John", "Sarah")',
      required: false,
    },
    actionContext: {
      type: 'string',
      description: 'Context of action e.g. "call", "email", "lookup"',
      required: false,
    },
  },
  handler: async (params, context) => {
    const action = params?.action;
    const query = (params?.nameQuery || '').trim().toLowerCase();

    switch (action) {
      case 'get_phone':
      case 'find_by_name':
      case 'search': {
        if (!query) {
          return {
            success: false,
            output: null,
            error: 'Contact name required.',
            message: 'Whose contact information would you like me to find?',
          };
        }

        const matches = mockContactsDatabase.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            (c.relationship && c.relationship.toLowerCase().includes(query))
        );

        if (matches.length === 0) {
          return {
            success: false,
            output: null,
            error: `No contact found matching "${params.nameQuery}".`,
            message: `I could not find "${params.nameQuery}" in your contacts.`,
          };
        }

        const best = matches[0];

        // Specific phone lookup
        if (action === 'get_phone') {
          return {
            success: true,
            output: { name: best.name, phone: best.phone },
            message: `${best.name}'s phone number is ${best.phone}.`,
          };
        }

        return {
          success: true,
          output: best,
          message: `${best.name}: Phone ${best.phone} | Email ${best.email} (${best.relationship || 'Contact'})`,
        };
      }

      case 'get_email': {
        if (!query) {
          return {
            success: false,
            output: null,
            error: 'Contact name required.',
            message: 'Whose email address would you like me to find?',
          };
        }

        const matches = mockContactsDatabase.filter((c) =>
          c.name.toLowerCase().includes(query)
        );

        if (matches.length === 0) {
          return {
            success: false,
            output: null,
            error: `No email found for "${params.nameQuery}".`,
            message: `I could not find an email address for "${params.nameQuery}".`,
          };
        }

        const best = matches[0];
        return {
          success: true,
          output: { name: best.name, email: best.email },
          message: `${best.name}'s email address is ${best.email}.`,
        };
      }

      case 'initiate_call': {
        if (!query) {
          return {
            success: false,
            output: null,
            error: 'Contact name or number required to call.',
          };
        }

        const contact = mockContactsDatabase.find((c) =>
          c.name.toLowerCase().includes(query)
        );

        const targetPhone = contact ? contact.phone : query;
        const targetName = contact ? contact.name : query;

        return {
          success: true,
          output: { targetName, targetPhone, intent: 'android.intent.action.CALL' },
          message: `Calling ${targetName} at ${targetPhone}...`,
        };
      }

      case 'list_recent': {
        const list = mockContactsDatabase.map((c) => `• ${c.name} (${c.phone})`).join('\n');
        return {
          success: true,
          output: mockContactsDatabase,
          message: `Your contacts:\n${list}`,
        };
      }

      default:
        return {
          success: false,
          output: null,
          error: `Unknown contacts action: ${action}`,
        };
    }
  },
};
