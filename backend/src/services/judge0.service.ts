import axios from 'axios';

const JUDGE0_URL = process.env.JUDGE0_URL || 'http://192.168.100.207:2358';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  status: {
    id: number;
    description: string;
  };
  time: string;
  memory: number;
  compile_output?: string;
}

/**
 * Judge0 代码执行服务
 */
class Judge0Service {
  /**
   * 提交代码执行
   */
  async submitCode(
    sourceCode: string,
    languageId: number,
    stdin?: string
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`,
        {
          source_code: sourceCode,
          language_id: languageId,
          stdin: stdin || '',
        }
      );

      return response.data.token;
    } catch (error: any) {
      console.error('Judge0 submission error:', error.response?.data || error.message);
      throw new Error('代码提交失败');
    }
  }

  /**
   * 获取执行结果
   */
  async getResult(token: string): Promise<ExecutionResult> {
    try {
      const response = await axios.get(
        `${JUDGE0_URL}/submissions/${token}?base64_encoded=false`
      );

      return response.data;
    } catch (error: any) {
      console.error('Judge0 get result error:', error.response?.data || error.message);
      throw new Error('获取执行结果失败');
    }
  }

  /**
   * 提交并等待结果
   */
  async executeCode(
    sourceCode: string,
    languageId: number,
    stdin?: string
  ): Promise<ExecutionResult> {
    const token = await this.submitCode(sourceCode, languageId, stdin);

    // 轮询获取结果
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待 500ms

      const result = await this.getResult(token);

      // 状态 1: In Queue, 2: Processing
      if (result.status.id > 2) {
        return result;
      }

      attempts++;
    }

    throw new Error('代码执行超时');
  }

  /**
   * 批量执行测试用例
   */
  async runTestCases(
    sourceCode: string,
    languageId: number,
    testCases: Array<{ input: string; output: string }>
  ): Promise<Array<{ passed: boolean; result: ExecutionResult }>> {
    const results = [];

    for (const testCase of testCases) {
      try {
        const result = await this.executeCode(sourceCode, languageId, testCase.input);

        const passed = result.stdout?.trim() === testCase.output.trim();

        results.push({ passed, result });
      } catch (error) {
        results.push({
          passed: false,
          result: {
            stdout: '',
            stderr: 'Execution failed',
            status: { id: 13, description: 'Internal Error' },
            time: '0',
            memory: 0,
          },
        });
      }
    }

    return results;
  }

  /**
   * 获取支持的语言 ID
   * Python: 71, JavaScript (Node.js): 63, C++: 54, Java: 62, C: 50
   */
  getLanguageId(language: string): number {
    const languageMap: Record<string, number> = {
      python: 71,
      javascript: 63,
      cpp: 54,
      java: 62,
      c: 50,
      go: 60,
      rust: 73,
    };

    return languageMap[language.toLowerCase()] || 71; // 默认 Python
  }
}

export const judge0Service = new Judge0Service();
