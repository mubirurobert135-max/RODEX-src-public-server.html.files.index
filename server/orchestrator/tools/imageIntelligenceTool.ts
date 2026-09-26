import { ToolDefinition, ToolExecutionContext, ToolExecutionResult } from '../types';
import { MediaGroundingService } from '../../mediaService';
import { ContextMemoryManager } from '../contextMemory';

export const imageIntelligenceTool: ToolDefinition = {
  name: 'image_intelligence',
  description:
    'Comprehensive multimodal image intelligence: generates high-fidelity images, edits existing images with object addition/removal/background changes/lighting improvements, analyzes visual content, and applies style transformations.',
  permissionLevel: 'safe',
  parameters: {
    action: {
      type: 'string',
      description: 'Image operation type: "generate", "edit", "transform", "analyze", "remove_background", "add_object", "remove_object", "style_transfer"',
      required: true,
      enum: [
        'generate',
        'edit',
        'transform',
        'analyze',
        'remove_background',
        'add_object',
        'remove_object',
        'style_transfer',
      ],
      default: 'generate',
    },
    prompt: {
      type: 'string',
      description: 'Detailed natural language instruction for image generation, edit, or transformation',
      required: true,
    },
    aspectRatio: {
      type: 'string',
      description: 'Desired aspect ratio: "1:1" (square), "16:9" (landscape), "9:16" (portrait / poster)',
      enum: ['1:1', '16:9', '9:16'],
      default: '1:1',
    },
    style: {
      type: 'string',
      description: 'Visual style: "realistic", "professional_graphic", "cinematic", "illustration", "poster", "logo", "minimalist", "cyberpunk", "branding"',
    },
    sourceImageBase64: {
      type: 'string',
      description: 'Optional base64 image data to edit, transform, or analyze. If omitted, uses active conversation image.',
    },
    preserveRestOfImage: {
      type: 'boolean',
      description: 'Whether to preserve regions outside the requested modification strictly',
      default: true,
    },
  },
  examples: [
    { query: 'Create an image of a futuristic city with glowing spires', params: { action: 'generate', prompt: 'A futuristic city with glowing neon spires, flying vehicles, cinematic lighting, 8k resolution', aspectRatio: '16:9' } },
    { query: 'Generate a professional logo for a solar energy startup', params: { action: 'generate', prompt: 'A clean, modern, minimalist logo for a solar energy startup, vector style, white background, bold branding', aspectRatio: '1:1' } },
    { query: 'Remove the tree and keep everything else the same', params: { action: 'remove_object', prompt: 'Remove the tree in the foreground. Inpaint the area naturally and preserve all other elements and lighting', preserveRestOfImage: true } },
    { query: 'Add a realistic giraffe to the background', params: { action: 'add_object', prompt: 'Add a realistic giraffe standing naturally in the background landscape, matching the scene lighting and depth of field' } },
    { query: 'Turn this image into a professional poster', params: { action: 'style_transfer', prompt: 'Transform this image into a high-impact professional graphic poster with clean typography layout and cinematic grading', aspectRatio: '9:16' } },
    { query: 'Change the background to a modern office', params: { action: 'edit', prompt: 'Replace the existing background with a sleek, modern architectural office interior with glass windows and soft ambient light, keeping the subject identical' } },
  ],
  handler: async (params: any, context: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const {
      action = 'generate',
      prompt,
      aspectRatio = '1:1',
      style,
      preserveRestOfImage = true,
    } = params;

    const sessionState = ContextMemoryManager.getSessionState('default');
    let sourceData = params.sourceImageBase64;
    let mimeType = 'image/jpeg';

    // If sourceImageBase64 is not explicitly passed, check active conversation image memory
    if (!sourceData && sessionState.lastImage?.url) {
      const lastUrl = sessionState.lastImage.url;
      if (lastUrl.startsWith('data:')) {
        const parts = lastUrl.split(',');
        sourceData = parts[1];
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }
    }

    try {
      // 1. Image Analysis / Understanding Mode
      if (action === 'analyze') {
        if (!sourceData) {
          return {
            success: false,
            output: null,
            error: 'No image found in conversation or upload to analyze.',
          };
        }

        const analysisRes = await MediaGroundingService.analyzeImage({
          image: { data: sourceData, mimeType },
          prompt,
        });

        if (analysisRes.success) {
          return {
            success: true,
            output: {
              analysis: analysisRes.text,
              modelUsed: analysisRes.modelUsed,
              action: 'analyze',
            },
            message: analysisRes.text,
            metadata: {
              analysis: analysisRes.text,
              prompt,
            },
          };
        }

        return {
          success: false,
          output: null,
          error: analysisRes.error || 'Unable to analyze image.',
        };
      }

      // 2. Image Generation Mode
      if (action === 'generate' || (!sourceData && (action === 'edit' || action === 'transform'))) {
        let enhancedPrompt = prompt;
        if (style) {
          enhancedPrompt = `${prompt}, style: ${style}, high quality, ultra detailed, professional composition`;
        }

        const genResult = await MediaGroundingService.generateOrEditImage({
          prompt: enhancedPrompt,
          aspectRatio,
        });

        if (genResult.success && genResult.imageUrl) {
          // Update session context memory with newly generated image
          ContextMemoryManager.updateSessionState('default', {
            lastImage: {
              url: genResult.imageUrl,
              prompt,
              type: 'generated',
              aspectRatio,
              model: genResult.modelUsed,
              timestamp: Date.now(),
            },
            lastTopic: `Image: ${prompt.slice(0, 30)}`,
          });

          return {
            success: true,
            output: {
              imageUrl: genResult.imageUrl,
              prompt,
              aspectRatio,
              modelUsed: genResult.modelUsed,
              action: 'generate',
            },
            message: `I have synthesized the requested image for you: "${prompt}".`,
            metadata: {
              imageUrl: genResult.imageUrl,
              aspectRatio,
              prompt,
            },
          };
        }

        return {
          success: false,
          output: null,
          error: genResult.error || 'Image generation failed to render.',
        };
      }

      // 2. Image Editing / Transformation Mode (with source image in conversation or upload)
      let editDirective = prompt;
      if (action === 'remove_background') {
        editDirective = 'Remove the background completely and isolate the main subject cleanly on a transparent/neutral background.';
      } else if (action === 'remove_object') {
        editDirective = `Carefully remove the requested object (${prompt}). Seamlessly inpaint the background, preserving all lighting, shadows, and other elements intact.`;
      } else if (action === 'add_object') {
        editDirective = `Naturally insert ${prompt} into the image, strictly matching the perspective, lighting, color temperature, and shadows of the existing scene.`;
      } else if (action === 'style_transfer' || action === 'transform') {
        editDirective = `Transform the visual style into: ${prompt}. Retain the core subject identity and composition.`;
      }

      if (preserveRestOfImage) {
        editDirective += ' Strictly preserve all unmentioned regions of the original image without distortion.';
      }

      const editResult = await MediaGroundingService.generateOrEditImage({
        prompt: editDirective,
        sourceImage: sourceData ? { data: sourceData, mimeType } : undefined,
        aspectRatio,
      });

      if (editResult.success && editResult.imageUrl) {
        ContextMemoryManager.updateSessionState('default', {
          lastImage: {
            url: editResult.imageUrl,
            prompt,
            type: 'edited',
            aspectRatio,
            model: editResult.modelUsed,
            timestamp: Date.now(),
          },
          lastTopic: `Edited image: ${prompt.slice(0, 30)}`,
        });

        return {
          success: true,
          output: {
            imageUrl: editResult.imageUrl,
            prompt,
            isEdit: true,
            modelUsed: editResult.modelUsed,
            action,
          },
          message: `I have updated the image: "${prompt}".`,
          metadata: {
            imageUrl: editResult.imageUrl,
            aspectRatio,
            prompt,
            isEdit: true,
          },
        };
      }

      return {
        success: false,
        output: null,
        error: editResult.error || 'Image editing could not be completed.',
      };
    } catch (err: any) {
      console.error('[Image Intelligence Tool Handler Error]', err);
      return {
        success: false,
        output: null,
        error: err?.message || 'Image intelligence system error.',
      };
    }
  },
};
