import fs from 'fs';
import { resolveRodexDataFile, writeRodexJson } from '../services/persistentStorage';

export interface UserPersonalizationProfile {
  userId: string;
  preferredName: string;
  honorific: string; // e.g. "Mr. Robert", "Robert"
  responseStyle: 'concise' | 'balanced' | 'detailed';
  tone: 'professional' | 'conversational' | 'technical';
  timezone: string;
  technicalSpecialty: string;
  frequentlyUsedCommands: string[];
  customDirectives: string[];
  updatedAt: string;
}

export class UserProfileService {
  private static instance: UserProfileService | null = null;
  private filePath: string;
  private profile: UserPersonalizationProfile;

  private constructor() {
    this.filePath = resolveRodexDataFile('.rodex_profile.json', '.rodex_profile.json');
    this.profile = this.loadProfile();
  }

  public static getInstance(): UserProfileService {
    if (!this.instance) {
      this.instance = new UserProfileService();
    }
    return this.instance;
  }

  private loadProfile(): UserPersonalizationProfile {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[UserProfileService] Error reading profile, using defaults:', err);
    }

    return {
      userId: 'Robert',
      preferredName: 'Robert',
      honorific: 'Mr. Robert',
      responseStyle: 'balanced',
      tone: 'professional',
      timezone: 'Africa/Kampala',
      technicalSpecialty: 'Full-stack & AI Systems Engineering',
      frequentlyUsedCommands: ['Open YouTube', 'Play music on Spotify', 'System status', 'Check weather'],
      customDirectives: [
        'Always recognize Mubiru Robert as creator, founder, and developer of RODEX.',
        'Prioritize factual, verified information.',
      ],
      updatedAt: new Date().toISOString(),
    };
  }

  private saveProfile(): void {
    try {
      writeRodexJson(this.filePath, this.profile);
    } catch (err) {
      console.error('[UserProfileService] Error saving profile:', err);
    }
  }

  public getProfile(): UserPersonalizationProfile {
    return { ...this.profile };
  }

  public updateProfile(updates: Partial<Omit<UserPersonalizationProfile, 'userId' | 'updatedAt'>>): UserPersonalizationProfile {
    this.profile = {
      ...this.profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveProfile();
    return { ...this.profile };
  }

  public addFrequentCommand(cmd: string): void {
    if (!this.profile.frequentlyUsedCommands.includes(cmd)) {
      this.profile.frequentlyUsedCommands = [cmd, ...this.profile.frequentlyUsedCommands].slice(0, 10);
      this.saveProfile();
    }
  }

  public buildPersonalizationPromptSnippet(): string {
    return `USER PERSONALIZATION PROFILE:
- Preferred Name: ${this.profile.preferredName}
- Honorific / Address: ${this.profile.honorific}
- Preferred Response Depth: ${this.profile.responseStyle.toUpperCase()}
- Conversational Tone: ${this.profile.tone}
- Primary Specialization: ${this.profile.technicalSpecialty}
Always respect these personal preferences when formulating responses.`;
  }
}

export const globalUserProfile = UserProfileService.getInstance();
