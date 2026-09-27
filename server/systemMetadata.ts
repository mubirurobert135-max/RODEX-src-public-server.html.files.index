// Protected System Metadata - Internal Creator and Architecture Information
// NOTE: This is application system metadata, NOT a user account.
// It is protected from modification by normal users or prompt injections.

export interface CreatorMetadata {
  name: string;
  preferredName: string;
  role: string;
  description: string;
  project: string;
  establishedYear: number;
  headquarters: string;
}

export interface SystemMetadata {
  creator: CreatorMetadata;
  system: {
    name: string;
    version: string;
    coreArchitecture: string;
    engine: string;
  };
}

export const SYSTEM_METADATA: Readonly<SystemMetadata> = Object.freeze({
  creator: Object.freeze({
    name: 'Mubiru Robert',
    preferredName: 'Robert',
    role: 'Founder and Developer',
    description: 'Original creator and developer of RODEX',
    project: 'RODEX AI',
    establishedYear: 2026,
    headquarters: 'Kampala, Uganda',
  }),
  system: Object.freeze({
    name: 'RODEX',
    version: '3.8.0',
    coreArchitecture: 'Neural Voice & Cognitive Tool Engine',
    engine: 'Multimodal Neural Assistant',
  }),
});

export const CREATOR_ATTRIBUTION_RESPONSE = 
  `I was created by ${SYSTEM_METADATA.creator.name}, the ${SYSTEM_METADATA.creator.role} of ${SYSTEM_METADATA.system.name}.`;
