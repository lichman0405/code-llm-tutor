import { Router } from 'express';
import { verifyToken } from '../services/auth.service';
import { createLLMService, extractJSON } from '../services/llm.service';
import { prisma } from '../lib/prisma';
import { z } from 'zod';

const router = Router();

// Generate problem request schema
const generateProblemSchema = z.object({
  difficulty: z.number().min(1).max(10).optional(),
  algorithmTypes: z.array(z.string()).optional(),
  forceNew: z.boolean().optional(), // Whether to force generate new problem
});

/**
 * POST /api/problems/generate
 * Generate new problem (based on user level)
 */
router.post('/generate', async (req, res) => {
  try {
    // Verify token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    // Get user information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        currentLevel: true,
        algorithmProficiency: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Parse request parameters
    const validationResult = generateProblemSchema.safeParse(req.body);
    const { difficulty, algorithmTypes, forceNew } = validationResult.success
      ? validationResult.data
      : { difficulty: undefined, algorithmTypes: undefined, forceNew: false };

    // Use user's current level or specified difficulty
    const targetDifficulty = difficulty || user.currentLevel;
    
    // Intelligently select algorithm types (prioritize weak areas)
    let targetAlgorithmTypes: string[];
    if (algorithmTypes) {
      targetAlgorithmTypes = algorithmTypes;
    } else {
      const proficiency = user.algorithmProficiency as Record<string, number>;
      if (proficiency && Object.keys(proficiency).length > 0) {
        // Select 2-3 algorithm types with lowest proficiency
        targetAlgorithmTypes = Object.entries(proficiency)
          .sort((a, b) => a[1] - b[1]) // Sort by proficiency ascending
          .slice(0, 2)
          .map(([type]) => type);
      } else {
        targetAlgorithmTypes = ['array', 'string']; // Default basic types
      }
    }

    // [Hybrid Mode] If not forcing new problem, first try to find suitable problem from database
    if (!forceNew) {
      const existingProblem = await prisma.problem.findFirst({
        where: {
          difficulty: targetDifficulty,
          algorithmTypes: { hasSome: targetAlgorithmTypes },
          // Only find public problems or user's own problems
          OR: [
            { isPublic: true },
            { creatorId: userId }
          ],
          // And user hasn't submitted yet
          NOT: {
            submissions: {
              some: { userId }
            }
          }
        },
        include: {
          _count: {
            select: { submissions: true }
          }
        }
      });

      // If found existing problem, return directly
      if (existingProblem) {
        console.log('Reusing existing problem:', existingProblem.id, existingProblem.title, 'for user:', userId);
        return res.json({
          problem: {
            id: existingProblem.id,
            title: existingProblem.title,
            description: existingProblem.description,
            difficulty: existingProblem.difficulty,
            algorithmTypes: existingProblem.algorithmTypes,
            examples: existingProblem.examples,
            expectedComplexity: existingProblem.expectedComplexity,
          },
          isNew: false,
        });
      }
    }

    // If no suitable problem, call LLM to generate new problem
    console.log('Generating new problem with LLM...');
    
    // Create user-specific LLM service
    const userLLMService = await createLLMService(userId);
    
    const problemJsonString = await userLLMService.generateProblem(
      targetDifficulty,
      targetAlgorithmTypes,
      user.currentLevel,
      user.algorithmProficiency as Record<string, number>
    );

    // Parse LLM returned JSON
    let problemData;
    try {
      const jsonString = extractJSON(problemJsonString);
      problemData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse LLM response:', problemJsonString);
      return res.status(500).json({ error: 'LLM response format error' });
    }

    // Save problem to database
    const problem = await prisma.problem.create({
      data: {
        title: problemData.title,
        description: problemData.description,
        difficulty: targetDifficulty,
        algorithmTypes: targetAlgorithmTypes,
        examples: problemData.examples || [],
        testCases: problemData.testCases || [],
        standardSolutions: [],
        basicHints: problemData.hints || [],
        expectedComplexity: problemData.timeComplexity || 'O(n)',
        generatedBy: 'LLM',
        generationPrompt: `Difficulty: ${targetDifficulty}, Types: ${targetAlgorithmTypes.join(', ')}`,
        creatorId: userId, // Save creator
        isPublic: false,   // Default private
      },
    });

    res.json({
      problem: {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        algorithmTypes: problem.algorithmTypes,
        examples: problemData.examples || [],
        inputFormat: problemData.inputFormat,
        outputFormat: problemData.outputFormat,
        expectedComplexity: problem.expectedComplexity,
        hints: problemData.hints || [],
      },
      isNew: true,
    });
  } catch (error: any) {
    console.error('Generate problem error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate problem' });
  }
});

/**
 * GET /api/problems
 * Get problem list (only show user's own problems or public problems)
 */
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;

    const { page = '1', limit = '10', difficulty } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query condition: user's own OR public problems
    const where: any = {
      OR: [
        { creatorId: userId },    // User's own created
        { isPublic: true },       // Public problems
      ]
    };
    
    if (difficulty) {
      where.difficulty = parseInt(difficulty as string);
    }

    const [problems, total] = await Promise.all([
      prisma.problem.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          difficulty: true,
          algorithmTypes: true,
          createdAt: true,
          isPublic: true,
          creatorId: true,
          _count: {
            select: { submissions: true },
          },
        },
      }),
      prisma.problem.count({ where }),
    ]);

    res.json({
      problems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get problems error:', error);
    res.status(500).json({ error: 'Failed to get problem list' });
  }
});

/**
 * GET /api/problems/:id
 * Get problem details (requires permission check)
 */
router.get('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    console.log('🔍 Fetching problem:', problemId, 'for user:', userId);

    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: {
        submissions: {
          where: { userId },
          orderBy: { submittedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            score: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!problem) {
      console.log('❌ Problem not found:', problemId);
      return res.status(404).json({ error: 'Problem does not exist' });
    }

    console.log('📋 Problem found:', {
      id: problem.id,
      title: problem.title,
      isPublic: problem.isPublic,
      creatorId: problem.creatorId,
      requestUserId: userId,
    });

    // Permission check: can only access own problems or public problems
    if (!problem.isPublic && problem.creatorId !== userId) {
      console.log('🚫 Permission denied: problem is private and user is not creator');
      return res.status(404).json({ error: 'Problem does not exist' });
    }

    console.log('✅ Permission granted, returning problem');
    
    // 将 basicHints 映射为 hints 字段返回给前端
    const responseData = {
      ...problem,
      hints: problem.basicHints || []
    };
    
    res.json(responseData);
  } catch (error: any) {
    console.error('Get problem error:', error);
    res.status(500).json({ error: 'Failed to get problem' });
  }
});

/**
 * PATCH /api/problems/:id/visibility
 * Toggle problem's public/private status
 */
router.patch('/:id/visibility', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    // Find problem
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, creatorId: true, isPublic: true },
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem does not exist' });
    }

    // Check permission: only creator can modify
    if (problem.creatorId !== userId) {
      return res.status(403).json({ error: 'Can only modify own problems' });
    }

    // Toggle visibility
    const updatedProblem = await prisma.problem.update({
      where: { id: problemId },
      data: { isPublic: !problem.isPublic },
      select: { id: true, isPublic: true },
    });

    res.json({
      message: updatedProblem.isPublic ? 'Problem set to public' : 'Problem set to private',
      isPublic: updatedProblem.isPublic,
    });
  } catch (error: any) {
    console.error('Toggle visibility error:', error);
    res.status(500).json({ error: 'Failed to toggle visibility' });
  }
});

/**
 * DELETE /api/problems/:id
 * Delete problem (can only delete own private problems)
 */
router.delete('/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token not provided' });
    }

    const payload = verifyToken(token);
    const userId = payload.userId;
    const problemId = req.params.id;

    // Find problem
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      select: { id: true, creatorId: true, isPublic: true, title: true },
    });

    if (!problem) {
      return res.status(404).json({ error: 'Problem does not exist' });
    }

    // Check permission: only creator can delete
    if (problem.creatorId !== userId) {
      return res.status(403).json({ error: 'Can only delete own problems' });
    }

    // Can only delete private problems
    if (problem.isPublic) {
      return res.status(403).json({ error: 'Cannot delete public problem, please set to private first' });
    }

    // Delete problem
    await prisma.problem.delete({
      where: { id: problemId },
    });

    res.json({ message: 'Problem deleted', title: problem.title });
  } catch (error: any) {
    console.error('Delete problem error:', error);
    res.status(500).json({ error: 'Failed to delete problem' });
  }
});

export default router;
