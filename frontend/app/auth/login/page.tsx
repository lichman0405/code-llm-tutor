'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function LoginPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClearCache = () => {
    localStorage.clear()
    sessionStorage.clear()
    alert('Cache cleared!')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        usernameOrEmail: formData.email,
        password: formData.password,
      })

      const { token, user, requirePasswordReset } = response.data

      // Only store token in sessionStorage, user info fetched from API in real-time
      sessionStorage.setItem('token', token)

      // Check if password reset is required
      if (requirePasswordReset) {
        router.push('/auth/reset-password')
        return
      }

      // Determine redirect based on user role and warmup status
      if (user.role === 'ADMIN') {
        // Admin goes directly to admin dashboard
        router.push('/admin')
      } else if (user.warmupCompleted) {
        // Regular user who completed warmup goes to problem list
        router.push('/problems')
      } else {
        // Regular user who hasn't completed warmup goes to warmup page
        router.push('/warmup')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.response?.data?.error || 'Login failed, please check your email and password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Login to CodeTutor</CardTitle>
          <CardDescription className="text-center">
            Enter your email and password to log in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Don't have an account?{' '}
            <Link href="/auth/register" className="text-blue-600 hover:underline">
              Register
            </Link>
          </div>
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={handleClearCache}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear Cache
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
