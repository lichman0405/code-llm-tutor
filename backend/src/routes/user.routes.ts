import { Router, Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { getUserLLMConfig } from '../services/llm.service';
import axios from 'axios';

const router: Router = Router();

// ==================== 用户画像 API ====================

/**
 * GET /api/user/profile
 * 获取用户完整信息
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
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

/**
 * PUT /api/user/profile
 * 更新用户画像 (仅可编辑字段)
 */
const updateProfileSchema = z.object({
  learningGoal: z.enum(['interview', 'interest', 'competition']).optional(),
  preferredLanguages: z.array(z.string()).optional(),
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
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
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// ==================== LLM 配置 API ====================

/**
 * GET /api/user/llm-config/current
 * 获取当前实际使用的LLM配置(用户配置或系统默认)
 */
router.get('/llm-config/current', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    // 获取实际使用的配置
    const config = await getUserLLMConfig(userId);

    res.json({
      success: true,
      data: {
        provider: config.provider,
        model: config.model,
        baseURL: config.baseURL,
        isUserConfig: config.isUserConfig,
        description: config.isUserConfig ? '使用个人配置' : '使用系统默认配置(DeepSeek)',
      },
    });
  } catch (error) {
    console.error('Get current LLM config error:', error);
    res.status(500).json({ error: '获取当前LLM配置失败' });
  }
});

/**
 * GET /api/user/llm-config
 * 获取用户的 LLM 配置
 */
router.get('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
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

    // 解密 API Key (仅返回脱敏版本)
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
    res.status(500).json({ error: '获取 LLM 配置失败' });
  }
});

/**
 * POST /api/user/llm-config
 * 创建或更新用户的 LLM 配置
 */
const llmConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'custom']),
  apiKey: z.string().optional(), // 如果不传则保持原有密钥
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
});

router.post('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    const validationResult = llmConfigSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.errors[0].message });
    }

    const { provider, apiKey, model, baseUrl, customHeaders } = validationResult.data;

    // 检查是否已有配置
    const existingConfig = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    const configData: any = {
      provider,
      model: model || null,
      baseUrl: baseUrl || null,
      customHeaders: customHeaders || null,
    };

    // 如果提供了新的 API Key,则加密存储
    if (apiKey) {
      configData.apiKeyEncrypted = encrypt(apiKey);
    }

    let savedConfig;
    if (existingConfig) {
      // 更新现有配置
      savedConfig = await prisma.lLMConfig.update({
        where: { userId },
        data: configData,
      });
    } else {
      // 创建新配置
      savedConfig = await prisma.lLMConfig.create({
        data: {
          userId,
          ...configData,
        },
      });
    }

    // 返回脱敏后的数据
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
    res.status(500).json({ error: '保存 LLM 配置失败' });
  }
});

/**
 * DELETE /api/user/llm-config
 * 删除用户的 LLM 配置 (恢复使用系统默认)
 */
router.delete('/llm-config', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    await prisma.lLMConfig.deleteMany({
      where: { userId },
    });

    res.json({
      success: true,
      message: 'LLM 配置已删除,将使用系统默认配置',
    });
  } catch (error) {
    console.error('Delete LLM config error:', error);
    res.status(500).json({ error: '删除 LLM 配置失败' });
  }
});

/**
 * POST /api/user/llm-config/test
 * 测试 LLM 连接
 */
router.post('/llm-config/test', authenticate, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: '未认证' });
    }

    // 获取用户配置
    const config = await prisma.lLMConfig.findUnique({
      where: { userId },
    });

    if (!config || !config.apiKeyEncrypted) {
      return res.status(400).json({ error: '请先配置 API Key' });
    }

    // 解密 API Key
    const apiKey = decrypt(config.apiKeyEncrypted);
    const baseUrl = config.baseUrl || (config.provider === 'openai' ? 'https://api.openai.com' : 'https://api.anthropic.com');
    const model = config.model || (config.provider === 'openai' ? 'gpt-3.5-turbo' : 'claude-3-haiku-20240307');

    // 解析 customHeaders
    const customHeaders = (config.customHeaders as Record<string, string>) || {};

    // 测试连接
    if (config.provider === 'openai' || config.provider === 'custom') {
      // OpenAI 格式测试
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
        message: 'LLM 连接测试成功',
        data: {
          model: response.data.model,
          provider: config.provider,
        },
      });
    } else if (config.provider === 'anthropic') {
      // Anthropic 格式测试
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
        message: 'LLM 连接测试成功',
        data: {
          model: response.data.model,
          provider: config.provider,
        },
      });
    }
  } catch (error: any) {
    console.error('Test LLM connection error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'LLM 连接测试失败',
      details: error.response?.data?.error?.message || error.message,
    });
  }
});

export default router;
