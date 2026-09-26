import { GoogleGenAI } from '@google/genai';
import { getResolvedGeminiApiKey } from './geminiConfig';

export interface GroundedSearchResult {
  text: string;
  sources: Array<{ title: string; url: string; domain?: string }>;
  searchQueries: string[];
  searchEntryPoint?: string;
  modelUsed: string;
}

export interface GroundedMapsResult {
  text: string;
  sources: Array<{ title: string; url: string; domain?: string }>;
  places?: Array<{ title?: string; address?: string; uri?: string }>;
  modelUsed: string;
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  mimeType?: string;
  operationId?: string;
  aspectRatio: '16:9' | '9:16';
  prompt: string;
  modelUsed: string;
  error?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  mimeType?: string;
  prompt: string;
  modelUsed: string;
  isEdit?: boolean;
  error?: string;
}

export class MediaGroundingService {
  private static getClient(): GoogleGenAI {
    const apiKey = getResolvedGeminiApiKey();
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build-rodex',
        },
      },
    });
  }

  /**
   * Google Search Grounding with gemini-3.5-flash
   */
  public static async executeSearchGrounding(query: string): Promise<GroundedSearchResult> {
    const ai = this.getClient();
    const model = 'gemini-3.5-flash';

    try {
      const response = await ai.models.generateContent({
        model,
        contents: query,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || 'No information retrieved.';
      const sources: Array<{ title: string; url: string; domain?: string }> = [];
      const searchQueries: string[] = [];

      const candidate = response.candidates?.[0];
      const metadata = candidate?.groundingMetadata;

      if (metadata?.webSearchQueries) {
        searchQueries.push(...metadata.webSearchQueries);
      }

      if (metadata?.groundingChunks) {
        for (const chunk of metadata.groundingChunks) {
          if (chunk.web?.uri) {
            try {
              const parsed = new URL(chunk.web.uri);
              sources.push({
                title: chunk.web.title || parsed.hostname,
                url: chunk.web.uri,
                domain: parsed.hostname.replace(/^www\./, ''),
              });
            } catch (_) {
              sources.push({
                title: chunk.web.title || chunk.web.uri,
                url: chunk.web.uri,
              });
            }
          }
        }
      }

      return {
        text,
        sources,
        searchQueries,
        searchEntryPoint: metadata?.searchEntryPoint?.renderedContent,
        modelUsed: model,
      };
    } catch (err: any) {
      console.error('[Search Grounding Error]', err);
      // Fallback to standard fast generation
      const fallbackRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
      });
      return {
        text: fallbackRes.text || 'Search grounding unavailable at this moment.',
        sources: [],
        searchQueries: [query],
        modelUsed: 'gemini-2.5-flash (fallback)',
      };
    }
  }

  /**
   * Google Maps Grounding with gemini-3.5-flash
   */
  public static async executeMapsGrounding(query: string): Promise<GroundedMapsResult> {
    const ai = this.getClient();
    const model = 'gemini-3.5-flash';

    try {
      const response = await ai.models.generateContent({
        model,
        contents: query,
        config: {
          tools: [{ googleMaps: {} } as any],
        },
      });

      const text = response.text || 'No location details found.';
      const sources: Array<{ title: string; url: string; domain?: string }> = [];
      const places: Array<{ title?: string; address?: string; uri?: string }> = [];

      const candidate = response.candidates?.[0];
      const metadata = candidate?.groundingMetadata;

      if (metadata?.groundingChunks) {
        for (const chunk of metadata.groundingChunks) {
          if ((chunk as any).maps?.uri) {
            const uri = (chunk as any).maps.uri;
            const title = (chunk as any).maps.title || 'Google Maps Location';
            places.push({ title, uri, address: (chunk as any).maps.address });
            sources.push({ title, url: uri, domain: 'maps.google.com' });
          } else if (chunk.web?.uri) {
            sources.push({ title: chunk.web.title || chunk.web.uri, url: chunk.web.uri });
          }
        }
      }

      return {
        text,
        sources,
        places,
        modelUsed: model,
      };
    } catch (err: any) {
      console.error('[Maps Grounding Error]', err);
      const fallbackRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Provide location and mapping details for: ${query}`,
      });
      return {
        text: fallbackRes.text || 'Location query could not be completed.',
        sources: [],
        places: [],
        modelUsed: 'gemini-2.5-flash (fallback)',
      };
    }
  }

  /**
   * Veo 3 Video Generation (Text to Video & Image to Video)
   * Uses veo-3.1-fast-generate-preview with aspect ratio 16:9 or 9:16
   */
  public static async generateVideo(params: {
    prompt: string;
    image?: { data: string; mimeType: string };
    aspectRatio?: '16:9' | '9:16';
  }): Promise<VideoGenerationResult> {
    const ai = this.getClient();
    const model = 'veo-3.1-fast-generate-preview';
    const ratio = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    try {
      const videoConfig: any = {
        aspectRatio: ratio,
        personGeneration: 'ALLOW_ADULT',
      };

      let operation: any;
      if (params.image && params.image.data) {
        operation = await (ai.models as any).generateVideos({
          model,
          prompt: params.prompt || 'Animate this photo with cinematic, fluid motion',
          image: {
            imageBytes: params.image.data,
            mimeType: params.image.mimeType || 'image/jpeg',
          },
          config: videoConfig,
        });
      } else {
        operation = await (ai.models as any).generateVideos({
          model,
          prompt: params.prompt,
          config: videoConfig,
        });
      }

      // Poll until the video generation is completed
      let attempts = 0;
      while (!operation.done && attempts < 24) {
        attempts++;
        await new Promise((r) => setTimeout(r, 4000));
        operation = await (ai.operations as any).getVideosOperation({ operation });
      }

      if (operation.response?.generatedVideos?.[0]?.video?.uri) {
        const downloadUri = operation.response.generatedVideos[0].video.uri;
        return {
          success: true,
          videoUrl: downloadUri,
          mimeType: 'video/mp4',
          aspectRatio: ratio,
          prompt: params.prompt,
          modelUsed: model,
        };
      }

      // If operation returned error or didn't finish
      if (operation.error) {
        throw new Error(operation.error.message || 'Video generation operation failed');
      }

      return {
        success: false,
        aspectRatio: ratio,
        prompt: params.prompt,
        modelUsed: model,
        error: 'Video generation timed out or could not be finalized.',
      };
    } catch (err: any) {
      console.warn('[Veo Video Generation Warning]', err?.message);

      // Attempt fallback with veo-2.0-generate-001 or return descriptive error
      try {
        const fallbackOp = await (ai.models as any).generateVideos({
          model: 'veo-2.0-generate-001',
          prompt: params.prompt,
          config: { aspectRatio: ratio },
        });
        return {
          success: true,
          operationId: fallbackOp.name,
          aspectRatio: ratio,
          prompt: params.prompt,
          modelUsed: 'veo-2.0-generate-001',
        };
      } catch (fallbackErr: any) {
        return {
          success: false,
          aspectRatio: ratio,
          prompt: params.prompt,
          modelUsed: model,
          error: err?.message || 'Video generation service currently busy.',
        };
      }
    }
  }

  /**
   * Real Multimodal Image Generation & Editing using supported Gemini models
   * Uses gemini-3.1-flash-lite-image / gemini-3.1-flash-image
   */
  public static async generateOrEditImage(params: {
    prompt: string;
    sourceImage?: { data: string; mimeType: string };
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  }): Promise<ImageGenerationResult> {
    const ai = this.getClient();
    const ratio = params.aspectRatio || '1:1';
    const isEdit = Boolean(params.sourceImage && params.sourceImage.data);

    try {
      if (isEdit && params.sourceImage) {
        // IMAGE EDITING / MODIFICATION MODE
        const contents: any = {
          parts: [
            {
              inlineData: {
                data: params.sourceImage.data,
                mimeType: params.sourceImage.mimeType || 'image/jpeg',
              },
            },
            {
              text: params.prompt,
            },
          ],
        };

        let response: any;
        let modelUsed = 'gemini-3.1-flash-lite-image';

        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents,
            config: {
              imageConfig: {
                aspectRatio: ratio as any,
              },
            },
          });
        } catch (liteErr: any) {
          console.warn('[Flash Lite Image Edit Warning, falling back to Flash Image]', liteErr?.message);
          modelUsed = 'gemini-3.1-flash-image';
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents,
            config: {
              imageConfig: {
                aspectRatio: ratio as any,
              },
            },
          });
        }

        // Iterate through all response parts to locate the real inline image
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            return {
              success: true,
              imageUrl,
              mimeType: mime,
              prompt: params.prompt,
              modelUsed,
              isEdit: true,
            };
          }
        }

        // If model returned text commentary instead of an inline image
        const textFallback = response.text || '';
        return {
          success: false,
          prompt: params.prompt,
          modelUsed,
          isEdit: true,
          error: textFallback || 'Image model did not return image data for the requested edit.',
        };
      } else {
        // IMAGE GENERATION MODE
        const contents: any = {
          parts: [
            {
              text: params.prompt,
            },
          ],
        };

        let response: any;
        let modelUsed = 'gemini-3.1-flash-lite-image';

        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite-image',
            contents,
            config: {
              imageConfig: {
                aspectRatio: ratio as any,
              },
            },
          });
        } catch (liteErr: any) {
          console.warn('[Flash Lite Image Gen Warning, falling back to Flash Image]', liteErr?.message);
          modelUsed = 'gemini-3.1-flash-image';
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents,
            config: {
              imageConfig: {
                aspectRatio: ratio as any,
              },
            },
          });
        }

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            return {
              success: true,
              imageUrl,
              mimeType: mime,
              prompt: params.prompt,
              modelUsed,
              isEdit: false,
            };
          }
        }

        const textFallback = response.text || '';
        return {
          success: false,
          prompt: params.prompt,
          modelUsed,
          isEdit: false,
          error: textFallback || 'Image model did not produce an image output.',
        };
      }
    } catch (err: any) {
      console.error('[RODEX Image Engine Error]', err);
      return {
        success: false,
        prompt: params.prompt,
        modelUsed: 'gemini-3.1-flash-lite-image',
        isEdit,
        error: err?.message || 'Failed to synthesize or edit image.',
      };
    }
  }

  /**
   * Multimodal Image Analysis / Understanding using gemini-3.8-flash
   */
  public static async analyzeImage(params: {
    image: { data: string; mimeType: string };
    prompt?: string;
  }): Promise<{ text: string; modelUsed: string; success: boolean; error?: string }> {
    const ai = this.getClient();
    const model = 'gemini-3.8-flash';

    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                data: params.image.data,
                mimeType: params.image.mimeType || 'image/jpeg',
              },
            },
            {
              text: params.prompt || 'Analyze this image in detail and describe the objects, people, background, colors, layout, and composition.',
            },
          ],
        },
      });

      return {
        text: response.text || 'Image analysis completed.',
        modelUsed: model,
        success: true,
      };
    } catch (err: any) {
      console.error('[RODEX Image Analyze Error]', err);
      return {
        text: 'Failed to inspect image.',
        modelUsed: model,
        success: false,
        error: err?.message || 'Image analysis error',
      };
    }
  }
}
