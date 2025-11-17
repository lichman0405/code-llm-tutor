import { Router, Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { getUserLLMConfig } from '../services/llm.service';
import axios from 'axios';

const router: Router = Router();

// ==================== User Profile API ====================

/**
 * GET /api/user/profile
 * Get complete user information
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        currentLevel: true,
        learningGoal: true,
        warmupCompleted: true,
        warmupData: true,
        algorithmProficiency: true,
        preferredLanguages: true,
        totalProblemsSolved: true,
        totalSubmissions: true,
        averageScore: true,
        learningVelocity: true,
        recentScores: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile (editable fields only)
 */
const updateProfileSchema = z.object({
  learningGoal: z.enum(['interview', 'interest', 'competition']).optional(),
  preferredLanguages: z.array(z.string()).optional(),
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const validationResult = updateProfileSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors[0].message });
    }

    const updateData: any = {};
    
    if (validationResult.data.learningGoal !== undefined) {
      updateData.learningGoal = validationResult.data.learningGoal;
    }
    
    if (validationResult.data.preferredLanguages !== undefined) {
      updateData.preferredLanguages = validationResult.data.preferredLanguages;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        currentLevel: true,
        learningGoal: true,
        algorithmProficiency: true,
        preferredLanguages: true,
        totalProblemsSolved: true,
        averageScore: true,
      },
    });

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update user information' });
  }
});

// ==================== LLM Configuration API ====================

/**
 * GET /api/user/llm-config/current
 * Get currently used LLM configuration (user config or system default)
 */
router.get('/llm-config/current', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get actually used configuration
    const config = await getUserLLMConfig(userId);

    res.json({
      success: true,
      data: {
        provider: config.provider,
        model: config.model,
        baseURL: config.baseURL,
        isUserConfig: config.isUserConfig,
        description: config.isUserConfig ? 'Using personal configuration' : 'Using system default configuration (DeepSeek)',
      },
    });
  } catch (error) {
    console.error('Get current LLM config error:', error);
    res.status(500).json({ error: 'Failed to get current LLM configuration' });
  }
});

/**
 * GET /api/user/llm-config
 * Get user's LLM configuration
 */
router.get('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const config = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return res.json({
        success: true,
        data: null,
      });
    }

    // Decrypt API Key (return masked version only)
    let maskedApiKey = null;
    if (config.apiKeyEncrypted) {
      try {
        const decryptedKey = decrypt(config.apiKeyEncrypted);
        maskedApiKey = decryptedKey.substring(0, 3) + '***' + decryptedKey.substring(decryptedKey.length - 6);
      } catch (error) {
        console.error('Decrypt API key error:', error);
      }
    }

    res.json({
      success: true,
      data: {
        id: config.id,
        provider: config.provider,
        apiKeyMasked: maskedApiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        customHeaders: config.customHeaders,
        totalRequests: config.totalRequests,
        totalTokens: config.totalTokens,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get LLM config error:', error);
    res.status(500).json({ error: 'Failed to get LLM configuration' });
  }
});

/**
 * POST /api/user/llm-config
 * Create or update user's LLM configuration
 */
const llmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'custom']),
  apiKey: z.string().optional(), // If not provided, keep existing key
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
});

router.post('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const validationResult = llmConfigSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors[0].message });
    }

    const { provider, apiKey, model, baseUrl, customHeaders } = validationResult.data;

    // Check if configuration already exists
    const existingConfig = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    const configData: any = {
      provider,
      model: model || null,
      baseUrl: baseUrl || null,
      customHeaders: customHeaders || null,
    };

    // If new API Key is provided, encrypt and store
    if (apiKey) {
      configData.apiKeyEncrypted = encrypt(apiKey);
    }

    let savedConfig;
    if (existingConfig) {
      // Update existing configuration
      savedConfig = await prisma.lLMConfig.update({
        where: { userId },
        data: configData,
      });
    } else {
      // Create new configuration
      savedConfig = await prisma.lLMConfig.create({
        data: {
          userId,
          ...configData,
        },
      });
    }

    // Return masked data
    let maskedApiKey = null;
    if (savedConfig.apiKeyEncrypted) {
      try {
        const decryptedKey = decrypt(savedConfig.apiKeyEncrypted);
        maskedApiKey = decryptedKey.substring(0, 3) + '***' + decryptedKey.substring(decryptedKey.length - 6);
      } catch (error) {
        console.error('Decrypt API key error:', error);
      }
    }

    res.json({
      success: true,
      data: {
        id: savedConfig.id,
        provider: savedConfig.provider,
        apiKeyMasked: maskedApiKey,
        model: savedConfig.model,
        baseUrl: savedConfig.baseUrl,
        customHeaders: savedConfig.customHeaders,
        totalRequests: savedConfig.totalRequests,
        totalTokens: savedConfig.totalTokens,
      },
    });
  } catch (error) {
    console.error('Save LLM config error:', error);
    res.status(500).json({ error: 'Failed to save LLM configuration' });
  }
});

/**
 * DELETE /api/user/llm-config
 * Delete user's LLM configuration (restore to system default)
 */
router.delete('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    await prisma.lLMConfig.deleteMany({
      where: { userId },
    });

    res.json({
      success: true,
      message: 'LLM configuration deleted, will use system default configuration',
    });
  } catch (error) {
    console.error('Delete LLM config error:', error);
    res.status(500).json({ error: 'Failed to delete LLM configuration' });
  }
});

/**
 * POST /api/user/llm-config/test
 * Test LLM connection
 */
router.post('/llm-config/test', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user configuration
    const config = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!config || !config.apiKeyEncrypted) {
      return res.status(400).json({ error: 'Please configure API Key first' });
    }

    // Decrypt API Key
    const apiKey = decrypt(config.apiKeyEncrypted);
    const baseUrl = config.baseUrl || (config.provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com');
    const model = config.model || (config.provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307');

    // Parse customHeaders
    const customHeaders = (config.customHeaders as Record<string, string>) || {};

    // Test connection
    if (config.provider === 'openai' || config.provider === 'custom') {
      // OpenAI format test
      const response = await axios.post(
        `${baseUrl}/v1/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...customHeaders,
          },
          timeout: 10000,
        }
      );

      res.json({
        success: true,
        message: 'LLM connection test successful',
        data: {
          model: response.data.model,
          provider: config.provider,
        },
      });
    } else if (config.provider === 'anthropic') {
      // Anthropic format test
      const response = await axios.post(
        `${baseUrl}/v1/messages`,
        {
          model,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            ...customHeaders,
          },
          timeout: 10000,
        }
      );

      res.json({
        success: true,
        message: 'LLM connection test successful',
        data: {
          model: response.data.model,
          provider: config.provider,
        },
      });
    }
  } catch (error: any) {
    console.error('Test LLM connection error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'LLM connection test failed',
      details: error.response?.data?.error?.message || error.message,
    });
  }
});

export default router;
