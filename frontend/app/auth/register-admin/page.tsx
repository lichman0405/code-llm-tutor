'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function RegisterAdminPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    // Check if it's development environment
    const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost'
    setIsDevMode(isDev)
    
    if (!isDev) {
      // Production environment redirects directly to regular registration page
      router.push('/auth/register')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate password
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)

    try {
      const response = await axios.post(`${API_URL}/api/auth/register-admin`, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      })

      console.log('Register admin response:', response.data)
      const { token, user } = response.data

      // Store token in sessionStorage
      sessionStorage.setItem('token', token)

      // Redirect to admin dashboard
      router.push('/admin')
    } catch (err: any) {
      console.error('Register admin error:', err)
      console.error('Error response:', err.response?.data)
      setError(err.response?.data?.error || 'Failed to create admin account, please try again')
    } finally {
      setLoading(false)
    }
  }

  if (!isDevMode) {
    return null // Not shown in production
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 px-4">
      <Card className="w-full max-w-md border-2 border-purple-200">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">🔐</span>
            <CardTitle className="text-2xl font-bold text-center text-purple-700">
              Create Admin Account
            </CardTitle>
          </div>
          <CardDescription className="text-center">
            Development Environment Only - Create account with admin privileges
          </CardDescription>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-xs text-yellow-800">
              ⚠️ This page is only available in development environment, it will be automatically hidden in production
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Admin username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
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
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Enter password again"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={loading}>
              {loading ? 'Creating...' : '🚀 Create Admin Account'}
            </Button>
          </form>
          <div className="mt-6 space-y-2">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Other Options</span>
              </div>
            </div>
            <div className="text-center text-sm space-y-2">
              <div>
                <Link href="/auth/register" className="text-blue-600 hover:underline">
                  Create Regular User Account
                </Link>
              </div>
              <div>
                Already have an account?{' '}
                <Link href="/auth/login" className="text-blue-600 hover:underline">
                  Login
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
