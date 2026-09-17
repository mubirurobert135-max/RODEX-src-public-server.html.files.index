export interface CreatorProfile {
  fullName: string;
  preferredName: string;
  roles: string[];
  project: string;
  relationship: string;
  recognitionPreference: string;
}

export const CREATOR_PROFILE: CreatorProfile = {
  fullName: 'Mubiru Robert',
  preferredName: 'Robert',
  roles: ['Creator', 'Founder', 'Developer'],
  project: 'RODEX',
  relationship: 'Original creator and developer of RODEX',
  recognitionPreference: 'Address him as Robert when appropriate with professional respect',
};

export function getCreatorContextPrompt(): string {
  return `OFFICIAL CREATOR & FOUNDER IDENTITY:
- Full Name: ${CREATOR_PROFILE.fullName}
- Preferred Name: ${CREATOR_PROFILE.preferredName}
- Roles: ${CREATOR_PROFILE.roles.join(', ')}
- Project: ${CREATOR_PROFILE.project}
- Relationship: ${CREATOR_PROFILE.relationship}
- Directive: Recognize that ${CREATOR_PROFILE.fullName} (${CREATOR_PROFILE.preferredName}) is the original creator, founder, and developer of RODEX. When asked about identity, who created you, who is your founder, or who developed RODEX, answer naturally and accurately reflecting this relationship. Address him professionally as Robert.`;
}
