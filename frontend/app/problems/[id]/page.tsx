'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Alert } from '@/components/ui/alert'
import { ResizablePanels, CollapsibleSection } from '@/components/ui/resizable-panels'
import Editor from '@monaco-editor/react'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Problem {
  id: string
  title: string
  description: string
  difficulty: number
  algorithmTypes: string[]
  testCases: Array<{ input: string; output: string }>
  hints?: string[]
  examples: Array<{ input: string; output: string; explanation?: string }>
  inputFormat?: string
  outputFormat?: string
  expectedComplexity?: string
}

interface TestResult {
  testCase: number
  passed: boolean
  status: string
  time: string
  memory: number | string
  output?: string
  error?: string
}

interface HintRecord {
  level: number
  content: string
  penalty: number
  language?: string
}

interface SubmissionHistoryItem {
  id: string
  status: string
  score: number | null
  language: string
  submittedAt: string
  executionTime: number | null
  passedCases?: number | null
  totalCases?: number | null
}

const getPenaltyPercentage = (level: number): number => {
  switch (level) {
    case 1:
      return 5
    case 2:
      return 15
    case 3:
      return 30
    case 4:
      return 50
    default:
      return 0
  }
}

export default function ProblemDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [problem, setProblem] = useState<Problem | null>(null)
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('python')
  const [availableLanguages, setAvailableLanguages] = useState<string[]>(['python'])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [submissionResult, setSubmissionResult] = useState<any>(null)
  const [hintMap, setHintMap] = useState<Record<string, HintRecord[]>>({})
  const [requestingHint, setRequestingHint] = useState(false)
  const [showResults, setShowResults] = useState(false) // Control bottom results panel display
  const [activeRightTab, setActiveRightTab] = useState<'editor' | 'history'>('editor')
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [loadingSubmissionId, setLoadingSubmissionId] = useState<string | null>(null)

  const defaultCode: Record<string, string> = {
    python: '# Write your code here\ndef solution():\n    pass\n\n# Call function\nsolution()\n',
    javascript: '// Write your code here\nfunction solution() {\n    \n}\n\n// Call function\nsolution();\n',
    cpp: '// Write your code here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
    java: '// Write your code here\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}\n',
    go: '// Write your code here\npackage main\n\nimport "fmt"\n\nfunc main() {\n    \n}\n',
    c: '// Write your code here\n#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n',
    rust: '// Write your code here\nfn main() {\n    \n}\n',
  }

  const languageNames: Record<string, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    cpp: 'C++',
    java: 'Java',
    go: 'Go',
    c: 'C',
    rust: 'Rust',
  }

  const normalizeLanguage = useCallback((lang?: string | null) => (lang && lang.trim() ? lang : 'python'), [])

  const getLanguageLabel = (lang: string) => {
    const normalized = normalizeLanguage(lang)
    return languageNames[normalized] || normalized.toUpperCase()
  }

  const currentHints = useMemo(() => hintMap[language] || [], [hintMap, language])

  const loadSubmissionDetail = useCallback(async (submissionId: string, tokenFromCaller?: string) => {
    const token = tokenFromCaller || sessionStorage.getItem('token')
    if (!token) {
      return null
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/submissions/${submissionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      const submission = response.data.submission
      if (!submission) {
        return null
      }

      if (submission.code) {
        setCode(submission.code)
      }

      if (submission.language) {
        const normalizedLang = normalizeLanguage(submission.language)
        setLanguage(normalizedLang)
        setHintMap((prev) => {
          if (prev[normalizedLang]) {
            return prev
          }
          return { ...prev, [normalizedLang]: [] }
        })
      }

      return submission
    } catch (error) {
      console.error('Failed to load submission detail:', error)
      return null
    }
  }, [normalizeLanguage])

  const loadSubmissionHistory = useCallback(async () => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
      return
    }

    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const response = await axios.get(
        `${API_URL}/api/submissions/problem/${params.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setSubmissionHistory(response.data.submissions || [])
      setHistoryLoaded(true)
    } catch (error: any) {
      console.error('Load submission history error:', error)
      setHistoryError(error.response?.data?.error || 'Failed to load submission history')
    } finally {
      setHistoryLoading(false)
    }
  }, [params.id, router])

  const fetchProblemAndUserProfile = useCallback(async () => {
    try {
      setLoading(true)

      const token = sessionStorage.getItem('token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const [problemResponse, userResponse, hintsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/problems/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/hints/problem/${params.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const problemData = problemResponse.data
      setProblem(problemData)

      const serverHints = hintsResponse.data.hints || []
      const groupedHints: Record<string, HintRecord[]> = {}
      serverHints.forEach((hint: any) => {
        const level = hint.level ?? hint.hintLevel
        const content = hint.content ?? hint.hintContent
        if (!level || !content) {
          return
        }

        const langKey = normalizeLanguage(hint.language)
        const penalty = hint.penalty ?? getPenaltyPercentage(level)
        if (!groupedHints[langKey]) {
          groupedHints[langKey] = []
        }
        groupedHints[langKey].push({
          level,
          content,
          penalty,
          language: langKey,
        })
      })

      Object.keys(groupedHints).forEach((key) => {
        groupedHints[key] = groupedHints[key].sort((a, b) => a.level - b.level)
      })

      const userData = userResponse.data.data || userResponse.data.user || userResponse.data
      const preferredLangsRaw: string[] = userData.preferredLanguages && userData.preferredLanguages.length > 0
        ? userData.preferredLanguages
        : ['python']
      const preferredLangs = preferredLangsRaw.map((lang: string) => normalizeLanguage(lang))
      const uniqueLangs = Array.from(new Set(preferredLangs))
      const defaultLang = uniqueLangs[0] || 'python'

      if (!groupedHints[defaultLang]) {
        groupedHints[defaultLang] = []
      }

      setHintMap(groupedHints)
      setAvailableLanguages(uniqueLangs)

      if (problemData.submissions && problemData.submissions.length > 0) {
        const lastSubmission = problemData.submissions[0]
        const submission = await loadSubmissionDetail(lastSubmission.id, token)
        if (submission?.language) {
          setSubmissionResult(null)
          setShowResults(false)
          setTestResults([])
          return
        }
      }

      setLanguage(defaultLang)
      setCode(defaultCode[defaultLang] || defaultCode.python)
      setSubmissionResult(null)
      setShowResults(false)
      setTestResults([])
    } catch (err: any) {
      console.error('Fetch error:', err)
      console.error('Error details:', err.response?.data)
    } finally {
      setLoading(false)
    }
  }, [params.id, normalizeLanguage, loadSubmissionDetail, router])

  useEffect(() => {
    fetchProblemAndUserProfile()
  }, [fetchProblemAndUserProfile])

  useEffect(() => {
    if (activeRightTab === 'history' && !historyLoaded && !historyLoading) {
      loadSubmissionHistory()
    }
  }, [activeRightTab, historyLoaded, historyLoading, loadSubmissionHistory])

  const handleSubmit = async () => {
    if (!code.trim()) {
      alert('Please enter code')
      return
    }

    setActiveRightTab('editor')
    setSubmitting(true)
    setTestResults([])
    setSubmissionResult(null)

    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/api/submissions/submit`,
        {
          problemId: params.id,
          code,
          language,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      setSubmissionResult(response.data.submission)
      setTestResults(response.data.testResults)
      setShowResults(true) // Show results panel
      setHistoryLoaded(false)
      if (activeRightTab === 'history') {
        loadSubmissionHistory()
      }

      // Show difficulty adjustment notification
      if (response.data.difficultyAdjustment?.changed) {
        const { newLevel, direction, reason } = response.data.difficultyAdjustment
        const message = direction === 'up'
          ? `🎉 Congratulations! Difficulty increased to Level ${newLevel}\nReason: ${reason}`
          : `📉 Difficulty decreased to Level ${newLevel}\nReason: ${reason}`
        
        setTimeout(() => {
          alert(message)
        }, 500) // Delay popup to avoid confusion with submission results
      }
    } catch (err: any) {
      console.error('Submit error:', err)
      alert(err.response?.data?.error || 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLanguageChange = (newLanguage: string) => {
    const normalized = normalizeLanguage(newLanguage)
    setLanguage(normalized)
    setHintMap((prev) => {
      if (prev[normalized]) {
        return prev
      }
      return { ...prev, [normalized]: [] }
    })
    setCode(defaultCode[normalized] || defaultCode.python)
    setSubmissionResult(null)
    setShowResults(false)
    setTestResults([])
    setActiveRightTab('editor')
  }

  const handleRightTabChange = (tab: 'editor' | 'history') => {
    setActiveRightTab(tab)
    if (tab === 'history') {
      setShowResults(false)
    }
  }

  const handleRequestHint = async (level: number, forceRegenerate = false) => {
    if (requestingHint) return

    setRequestingHint(true)

    try {
      const token = sessionStorage.getItem('token')
      const activeLanguage = normalizeLanguage(language)
      const response = await axios.post(
        `${API_URL}/api/hints/request`,
        {
          problemId: params.id,
          hintLevel: level,
          currentCode: code,
          language: activeLanguage,
          forceRegenerate,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const { hint, alreadyObtained } = response.data
      if (!hint) {
        return
      }

      const langKey = normalizeLanguage(hint.language || activeLanguage)
      const normalizedHint: HintRecord = {
        level: hint.level,
        content: hint.content,
        penalty: hint.penalty,
        language: langKey,
      }

      setHintMap((prev) => {
        const existingHints = prev[langKey] ? [...prev[langKey]] : []
        const existingIndex = existingHints.findIndex((item) => item.level === level)
        if (existingIndex >= 0) {
          existingHints[existingIndex] = normalizedHint
        } else {
          existingHints.push(normalizedHint)
        }
        existingHints.sort((a, b) => a.level - b.level)
        return { ...prev, [langKey]: existingHints }
      })

      if (forceRegenerate) {
        alert(`Hint regenerated for ${langKey} (deduct ${hint.penalty}% score)`)
      } else if (alreadyObtained) {
        console.log('Hint already obtained, showing cached version')
      } else {
        alert(`Hint Level ${level} (deduct ${hint.penalty}% score)`)
      }
    } catch (err: any) {
      console.error('Request hint error:', err)
      alert(err.response?.data?.error || 'Failed to get hint')
    } finally {
      setRequestingHint(false)
    }
  }

  const handleHistoryItemLoad = async (submissionId: string) => {
    setLoadingSubmissionId(submissionId)
    try {
      const submission = await loadSubmissionDetail(submissionId)
      if (submission) {
        setSubmissionResult(null)
        setShowResults(false)
        setTestResults([])
        setActiveRightTab('editor')
      }
    } catch (error) {
      console.error('Load submission from history failed:', error)
      alert('Failed to load submission details')
    } finally {
      setLoadingSubmissionId(null)
    }
  }

  if (loading) {
    return <LoadingSpinner size="lg" text="Loading problem..." fullScreen />
  }

  if (!problem) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="error" title="Problem not found" className="mb-4">
          The problem was not found, it may have been deleted or the ID is incorrect
        </Alert>
        <Button onClick={() => router.push('/problems')}>Return to problem list</Button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top toolbar - fixed height */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/problems')}
            className="text-gray-600 hover:text-gray-900 h-8"
          >
            ← Back
          </Button>
          <div className="h-5 w-px bg-gray-300" />
          <h1 className="text-base font-semibold text-gray-900 truncate max-w-md">{problem.title}</h1>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
            {problem.difficulty}/10
          </span>
          {problem.algorithmTypes.slice(0, 2).map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageNames[lang] || lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main content area - adaptive resizable panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanels
          defaultLeftWidth={40}
          minLeftWidth={25}
          maxLeftWidth={60}
          leftPanel={(
            <div className="h-full overflow-y-auto bg-gray-50 px-4 py-4 space-y-3">
              {/* Problem description */}
              <CollapsibleSection title="Problem Description" icon="📋" defaultOpen={true}>
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </CollapsibleSection>

              {/* Examples */}
              {problem.examples && problem.examples.length > 0 && (
                <CollapsibleSection title="Examples" icon="💡" defaultOpen={true}>
                  <div className="space-y-3">
                    {problem.examples.map((example, index) => (
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="text-xs font-medium text-gray-500 mb-2">Example {index + 1}</div>
                        <div className="space-y-2">
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Input:</div>
                            <pre className="text-xs p-2 bg-white rounded border border-gray-200 overflow-x-auto font-mono">
                              {example.input}
                            </pre>
                          </div>
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">Output:</div>
                            <pre className="text-xs p-2 bg-white rounded border border-gray-200 overflow-x-auto font-mono">
                              {example.output}
                            </pre>
                          </div>
                          {example.explanation && (
                            <div>
                              <div className="text-xs font-medium text-gray-600 mb-1">Explanation:</div>
                              <p className="text-xs text-gray-700">{example.explanation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* Basic hints */}
              {problem.hints && problem.hints.length > 0 && (
                <CollapsibleSection title="Basic Hints" icon="💭" defaultOpen={false}>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {problem.hints.slice(0, 2).map((hint, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="text-blue-500 flex-shrink-0">•</span>
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                </CollapsibleSection>
              )}

              {/* AI hints */}
              <CollapsibleSection title="AI Hints" icon="🤖" defaultOpen={false}>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((level) => {
                    const obtained = currentHints.find(h => h.level === level)
                    const canRequest = level === 1 || currentHints.some(h => h.level === level - 1)
                    const levelNames = ['Idea', 'Framework', 'Pseudocode', 'Code Snippet']
                    const penalties = [5, 15, 30, 50]
                    
                    return (
                      <div key={level} className="bg-gray-50 rounded-lg border border-gray-200">
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">
                                Level {level}
                              </span>
                              <span className="text-xs text-gray-500">
                                {levelNames[level - 1]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">
                                -{penalties[level - 1]}%
                              </span>
                              {!obtained ? (
                                <Button
                                  size="sm"
                                  variant={canRequest ? 'default' : 'outline'}
                                  onClick={() => handleRequestHint(level, false)}
                                  disabled={!canRequest || requestingHint}
                                  className="h-7 text-xs px-2"
                                >
                                  {requestingHint ? '...' : canRequest ? 'Get' : '🔒'}
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRequestHint(level, true)}
                                  disabled={requestingHint}
                                  className="h-7 text-xs px-2"
                                >
                                  {requestingHint ? '...' : 'Regenerate'}
                                </Button>
                              )}
                            </div>
                          </div>
                          {obtained && (
                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                              {(() => {
                                const content = obtained.content
                                const codeBlockMatch = content.match(/```(\w+)?\n([\s\S]*?)```/);
                                
                                if (codeBlockMatch) {
                                  const hintLang = codeBlockMatch[1] || language // Use currently selected language
                                  const code = codeBlockMatch[2].trim()
                                  const description = content.replace(/```(\w+)?\n[\s\S]*?```/, '').trim()
                                  
                                  return (
                                    <div className="space-y-2">
                                      {description && (
                                        <p className="text-xs text-gray-700 whitespace-pre-wrap">{description}</p>
                                      )}
                                      <div className="bg-gray-900 rounded overflow-hidden">
                                        <div className="px-2 py-1 bg-gray-800 text-gray-400 text-[10px] font-mono">
                                          {hintLang}
                                        </div>
                                        <pre className="p-2 overflow-x-auto">
                                          <code className="text-[11px] text-gray-100 font-mono leading-relaxed">
                                            {code}
                                          </code>
                                        </pre>
                                      </div>
                                    </div>
                                  )
                                }
                                
                                return <p className="text-xs text-gray-700 whitespace-pre-wrap">{content}</p>
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CollapsibleSection>
            </div>
          )}
          rightPanel={(
            <div className="h-full flex flex-col bg-white">
              {/* Top toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  {(['editor', 'history'] as const).map((tabKey) => {
                    const isActive = activeRightTab === tabKey
                    const label = tabKey === 'editor' ? 'Code Editor' : `Submission History${submissionHistory.length > 0 ? ` (${submissionHistory.length})` : ''}`
                    return (
                      <button
                        key={tabKey}
                        type="button"
                        onClick={() => handleRightTabChange(tabKey)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-transparent text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
                {activeRightTab === 'editor' ? (
                  <div className="flex items-center gap-3">
                    {submissionResult && (
                      <button
                        onClick={() => setShowResults(!showResults)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${showResults ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        <span>Test Results</span>
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          submissionResult.status === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {submissionResult.passedTests}/{submissionResult.totalTests}
                        </span>
                      </button>
                    )}
                    {submitting && (
                      <span className="text-xs text-gray-500">Evaluating...</span>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="h-8"
                      >
                        Run Code
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="h-8 bg-green-600 hover:bg-green-700"
                      >
                        {submitting ? 'Submitting...' : 'Submit'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHistoryLoaded(false)
                        loadSubmissionHistory()
                      }}
                      disabled={historyLoading}
                      className="h-8"
                    >
                      {historyLoading ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Editor + results area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {activeRightTab === 'editor' ? (
                  <>
                    <div className={`flex-1 ${showResults && submissionResult ? 'border-b border-gray-200' : ''}`}>
                      <Editor
                        height="100%"
                        language={language}
                        value={code}
                        onChange={(value) => setCode(value || '')}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          wordWrap: 'on',
                          formatOnPaste: true,
                          formatOnType: false,
                          autoIndent: 'advanced',
                          quickSuggestions: true,
                          suggestOnTriggerCharacters: true,
                          acceptSuggestionOnEnter: 'on',
                          bracketPairColorization: { enabled: true },
                          readOnly: false,
                          domReadOnly: false,
                          selectOnLineNumbers: true,
                          contextmenu: true,
                          mouseWheelZoom: true,
                          scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            useShadows: false,
                          },
                        }}
                      />
                    </div>

                    {showResults && submissionResult && (
                      <div className="max-h-[45%] min-h-[200px] bg-gray-50 border-t border-gray-200 overflow-y-auto">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">Test Results</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              submissionResult.status === 'accepted'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {submissionResult.passedTests}/{submissionResult.totalTests}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowResults(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Collapse
                          </button>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className={`p-4 rounded-lg ${
                            submissionResult.status === 'accepted'
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-red-50 border border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold">
                                {submissionResult.status === 'accepted' ? '✅ Passed' : '❌ Failed'}
                              </span>
                              <span className="text-2xl font-bold text-green-600">
                                {submissionResult.score} points
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Passed Tests: {submissionResult.passedTests} / {submissionResult.totalTests}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-sm mb-2 text-gray-700">Test Cases</h4>
                            <div className="space-y-2">
                              {testResults.map((result) => (
                                <div
                                  key={result.testCase}
                                  className={`p-3 rounded border text-sm ${
                                    result.passed
                                      ? 'bg-green-50 border-green-200'
                                      : 'bg-red-50 border-red-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">
                                      Case {result.testCase} {result.passed ? '✅' : '❌'}
                                    </span>
                                    <span className="text-xs text-gray-600">
                                      {result.time}s · {result.memory}KB
                                    </span>
                                  </div>
                                  {result.error && (
                                    <div className="mt-2 text-xs text-red-700">
                                      <strong>Error:</strong> {result.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 overflow-y-auto bg-gray-50">
                    {historyLoading && submissionHistory.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <LoadingSpinner size="md" text="Loading submission history..." />
                      </div>
                    ) : historyError ? (
                      <div className="p-6">
                        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                          {historyError}
                        </div>
                      </div>
                    ) : submissionHistory.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-gray-500">
                        <span>No submission records yet</span>
                        <span>Records will appear here after running or submitting code.</span>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {submissionHistory.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">
                                  {new Date(item.submittedAt).toLocaleString()}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  item.status === 'accepted'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {item.status === 'accepted' ? 'Passed' : 'Failed'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Language: {getLanguageLabel(item.language)} · Score: {item.score ?? 0} · Time: {item.executionTime ?? 0}ms
                              </div>
                              {item.passedCases != null && item.totalCases != null && (
                                <div className="text-xs text-gray-500">
                                  Passed Tests: {item.passedCases}/{item.totalCases}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleHistoryItemLoad(item.id)}
                                disabled={loadingSubmissionId === item.id}
                                className="h-8"
                              >
                                {loadingSubmissionId === item.id ? 'Loading...' : 'Load Code'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
