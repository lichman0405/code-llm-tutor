'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { CardSkeleton } from '@/components/ui/skeleton'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Problem {
  id: string
  title: string
  difficulty: number
  algorithmTypes: string[]
  createdAt: string
  isPublic: boolean
  creatorId: string | null
  _count: {
    submissions: number
  }
}

export default function ProblemsPage() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
    } else {
      fetchUserProfile()
      fetchProblems()
    }
  }, [router])

  const fetchUserProfile = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setCurrentUserId(response.data.data.id)
    } catch (err) {
      console.error('Failed to fetch user information:', err)
    }
  }

  const fetchProblems = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/problems`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setProblems(response.data.problems)
    } catch (err: any) {
      console.error('Fetch problems error:', err)
      setError('Failed to fetch problem list')
    } finally {
      setLoading(false)
    }
  }

  const generateNewProblem = async () => {
    setGenerating(true)
    setError('')

    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/api/problems/generate`,
        { forceNew: true }, // Force generate new problem, do not reuse problems from database
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const newProblem = response.data.problem
      console.log('Generated/Retrieved problem:', newProblem.id, newProblem.title, 'isNew:', response.data.isNew)

      // Navigate to newly generated problem
      router.push(`/problems/${newProblem.id}`)
    } catch (err: any) {
      console.error('Generate problem error:', err)
      setError(err.response?.data?.error || 'Failed to generate problem')
    } finally {
      setGenerating(false)
    }
  }

  const toggleVisibility = async (problemId: string, currentIsPublic: boolean, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering card click

    const action = currentIsPublic ? 'Set to private' : 'Set to public'
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this problem?`)) {
      return
    }

    try {
      const token = sessionStorage.getItem('token')
      await axios.patch(
        `${API_URL}/api/problems/${problemId}/visibility`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Refresh list
      fetchProblems()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to toggle visibility')
    }
  }

  const deleteProblem = async (problemId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (!confirm(`Are you sure you want to delete the problem "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = sessionStorage.getItem('token')
      await axios.delete(`${API_URL}/api/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      alert('Problem deleted')
      fetchProblems()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Delete failed')
    }
  }

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 3) return 'text-green-600 bg-green-100'
    if (difficulty <= 6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const getDifficultyText = (difficulty: number) => {
    if (difficulty <= 3) return 'Easy'
    if (difficulty <= 6) return 'Medium'
    return 'Hard'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="mb-8">
            <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Algorithm Problems</h1>
            <p className="text-gray-600 mt-2">Choose a problem to start practicing, or generate a new one</p>
          </div>
          <Button onClick={generateNewProblem} disabled={generating} size="lg">
            {generating ? 'Generating...' : '🎲 Generate New Problem'}
          </Button>
        </div>

        {error && (
          <Alert variant="error" title="Load Failed" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Problems List */}
        {problems.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <EmptyState
                icon="📚"
                title="No problems yet"
                description="Click the button below to generate your first algorithm problem and start your learning journey"
                action={{
                  label: generating ? 'Generating...' : '🎲 Generate First Problem',
                  onClick: generateNewProblem,
                }}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {problems.map((problem) => (
              <Card
                key={problem.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/problems/${problem.id}`)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{problem.title}</CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${getDifficultyColor(
                            problem.difficulty
                          )}`}
                        >
                          {getDifficultyText(problem.difficulty)} ({problem.difficulty}/10)
                        </span>
                        {problem.algorithmTypes.map((tag) => (
                          <span
                            key={tag}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right text-sm text-gray-500">
                        <div>{problem._count.submissions} submissions</div>
                        <div className="mt-1">
                          {new Date(problem.createdAt).toLocaleDateString('en-US')}
                        </div>
                      </div>
                      
                      {/* Visibility and action buttons - only show for creator */}
                      {problem.creatorId === currentUserId && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => toggleVisibility(problem.id, problem.isPublic, e)}
                          >
                            {problem.isPublic ? '🌍 Public' : '🔒 Private'}
                          </Button>
                          {!problem.isPublic && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => deleteProblem(problem.id, problem.title, e)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                      
                      {/* Show if it's a public problem (non-creator perspective) */}
                      {problem.creatorId !== currentUserId && problem.isPublic && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Public Problem
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
