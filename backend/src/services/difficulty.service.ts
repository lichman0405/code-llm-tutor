import { prisma } from '../lib/prisma';

/**
 * 自适应难度调整服务
 * 根据用户最近表现动态调整题目难度
 */

interface DifficultyAdjustment {
  shouldAdjust: boolean;
  newLevel?: number;
  reason?: string;
  direction?: 'up' | 'down';
}

/**
 * 评估用户表现并调整难度
 * 
 * PRD规则:
 * - 提升: 连续3道≥80分 OR 最近5道平均≥85分
 * - 降低: 连续2道<50分 OR 最近5道平均<40分
 * 
 * @param userId 用户ID
 * @param currentScore 本次提交得分
 * @returns 难度调整结果
 */
export async function evaluateDifficultyAdjustment(
  userId: string,
  currentScore: number
): Promise<DifficultyAdjustment> {
  // 获取用户当前难度等级
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentLevel: true },
  });

  if (!user) {
    return { shouldAdjust: false };
  }

  const currentLevel = user.currentLevel;

  // 获取最近5次提交记录(包括本次)
  const recentSubmissions = await prisma.submission.findMany({
    where: {
      userId,
      status: { in: ['accepted', 'wrong_answer', 'runtime_error'] }, // 排除未完成的提交
    },
    orderBy: { submittedAt: 'desc' },
    take: 5,
    select: {
      score: true,
      submittedAt: true,
    },
  });

  // 如果提交记录不足,不调整
  if (recentSubmissions.length < 2) {
    return { shouldAdjust: false };
  }

  // 转换Decimal为number并过滤null
  const scores = recentSubmissions
    .map((s) => s.score)
    .filter((score): score is NonNullable<typeof score> => score !== null)
    .map((score) => Number(score));
  
  if (scores.length === 0) {
    return { shouldAdjust: false };
  }

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  // 检查是否需要提升难度
  if (shouldIncreaseDifficulty(scores, averageScore, currentLevel)) {
    const newLevel = Math.min(currentLevel + 1, 10); // 最高10级
    return {
      shouldAdjust: true,
      newLevel,
      direction: 'up',
      reason: getIncreaseReason(scores, averageScore),
    };
  }

  // 检查是否需要降低难度
  if (shouldDecreaseDifficulty(scores, averageScore, currentLevel)) {
    const newLevel = Math.max(currentLevel - 1, 1); // 最低1级
    return {
      shouldAdjust: true,
      newLevel,
      direction: 'down',
      reason: getDecreaseReason(scores, averageScore),
    };
  }

  return { shouldAdjust: false };
}

/**
 * 判断是否应该提升难度
 */
function shouldIncreaseDifficulty(
  scores: number[],
  averageScore: number,
  currentLevel: number
): boolean {
  // 已经是最高难度,不再提升
  if (currentLevel >= 10) {
    return false;
  }

  // 规则1: 连续3道题得分≥80分
  if (scores.length >= 3) {
    const lastThree = scores.slice(0, 3);
    if (lastThree.every((score) => score >= 80)) {
      return true;
    }
  }

  // 规则2: 最近5道题平均分≥85分
  if (scores.length >= 5 && averageScore >= 85) {
    return true;
  }

  return false;
}

/**
 * 判断是否应该降低难度
 */
function shouldDecreaseDifficulty(
  scores: number[],
  averageScore: number,
  currentLevel: number
): boolean {
  // 已经是最低难度,不再降低
  if (currentLevel <= 1) {
    return false;
  }

  // 规则1: 连续2道题得分<50分
  if (scores.length >= 2) {
    const lastTwo = scores.slice(0, 2);
    if (lastTwo.every((score) => score < 50)) {
      return true;
    }
  }

  // 规则2: 最近5道题平均分<40分
  if (scores.length >= 5 && averageScore < 40) {
    return true;
  }

  return false;
}

/**
 * 获取提升难度的原因描述
 */
function getIncreaseReason(scores: number[], averageScore: number): string {
  if (scores.length >= 3 && scores.slice(0, 3).every((s) => s >= 80)) {
    return '连续3道题得分≥80分';
  }
  if (scores.length >= 5 && averageScore >= 85) {
    return `最近5道题平均分${averageScore.toFixed(1)}分`;
  }
  return '表现优秀';
}

/**
 * 获取降低难度的原因描述
 */
function getDecreaseReason(scores: number[], averageScore: number): string {
  if (scores.length >= 2 && scores.slice(0, 2).every((s) => s < 50)) {
    return '连续2道题得分<50分';
  }
  if (scores.length >= 5 && averageScore < 40) {
    return `最近5道题平均分${averageScore.toFixed(1)}分`;
  }
  return '需要降低难度';
}

/**
 * 应用难度调整
 * 
 * @param userId 用户ID
 * @param newLevel 新难度等级
 * @returns 是否成功更新
 */
export async function applyDifficultyAdjustment(
  userId: string,
  newLevel: number
): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { currentLevel: newLevel },
    });
    return true;
  } catch (error) {
    console.error('Failed to update difficulty level:', error);
    return false;
  }
}
