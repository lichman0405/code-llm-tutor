'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert } from '@/components/ui/alert'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Problem {
  id: string
  title: string
  difficulty: number
  algorithmTypes: string[]
  generatedBy: string | null
  totalAttempts: number
  totalSolved: number
  averageScore: string
  createdAt: string
  isPublic: boolean
  creatorId: string | null
  creator: {
    username: string
  } | null
  _count: {
    submissions: number
  }
}

export default function AdminProblemsPage() {
  const router = useRouter()
  const [problems, setProblems] = useState<Problem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchProblems = async () => {
    try {
      setError('')
      const token = sessionStorage.getItem('token')
      if (!token) {
        router.push('/auth/login')
        return
      }

      const response = await axios.get(`${API_URL}/api/admin/problems`, {
        params: { page, limit: 20 },
        headers: { Authorization: `Bearer ${token}` },
      })

      setProblems(response.data.problems)
      setTotalPages(response.data.pagination.totalPages)
    } catch (err: any) {
      console.error('Fetch problems error:', err)
      if (err.response?.status === 403 || err.response?.status === 401) {
        router.push('/auth/login')
      } else {
        setError(err.response?.data?.error || 'Failed to load problem list')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProblems()
  }, [page])

  const deleteProblem = async (problemId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete the problem "${title}"? This action cannot be undone.`)) {
      return
    }

    try {
      const token = sessionStorage.getItem('token')
      await axios.delete(`${API_URL}/api/admin/problems/${problemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Refresh list
      fetchProblems()
    } catch (err: any) {
      console.error('Delete problem error:', err)
      alert('Failed to delete problem: ' + (err.response?.data?.error || err.message))
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Problem Management</h1>
          </div>
          <Button variant="outline" onClick={() => router.push('/admin')}>
            Back to Admin Dashboard
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>All Problems</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Algorithm Types</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Solved</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton variant="text" width="80%" /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={70} height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" width="60%" /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={50} height={20} /></TableCell>
                    <TableCell><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell><Skeleton variant="text" width={40} /></TableCell>
                    <TableCell><Skeleton variant="text" width="70%" /></TableCell>
                    <TableCell><Skeleton variant="rectangular" width={60} height={32} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Problem Management</h1>
          <p className="mt-2 text-slate-600">Total {problems.length} problems</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin')}>
          Back to Admin Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Problems</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="error" title="Load Failed" className="mb-4">
              {error}
            </Alert>
          )}

          {!error && problems.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No problems yet"
              description="No problems in the system yet"
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Algorithm Types</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Visibility</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Solved</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problems.map((problem) => (
                    <TableRow key={problem.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                        {problem.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant={problem.difficulty <= 3 ? 'secondary' : problem.difficulty <= 7 ? 'default' : 'destructive'}>
                          Level {problem.difficulty}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {problem.algorithmTypes.slice(0, 2).map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {problem.algorithmTypes.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{problem.algorithmTypes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={problem.generatedBy === 'LLM' ? 'default' : 'secondary'}>
                          {problem.generatedBy || 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-gray-600">
                          {problem.creator?.username || 'System'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={problem.isPublic ? 'default' : 'secondary'}>
                          {problem.isPublic ? '🌍 Public' : '🔒 Private'}
                        </Badge>
                      </TableCell>
                      <TableCell>{problem._count.submissions}</TableCell>
                      <TableCell>{problem.totalSolved}</TableCell>
                      <TableCell>{parseFloat(problem.averageScore).toFixed(1)}</TableCell>
                      <TableCell>
                        {new Date(problem.createdAt).toLocaleDateString('en-US')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => deleteProblem(problem.id, problem.title)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
