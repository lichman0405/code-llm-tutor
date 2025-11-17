'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface UserProfile {
  id: string
  username: string
  email: string
  role: string
  currentLevel: number
  learningGoal: string | null
  warmupCompleted: boolean
  algorithmProficiency: Record<string, number>
  preferredLanguages: string[]
  totalProblemsSolved: number
  totalSubmissions: number
  averageScore: string
  createdAt: string
}

interface LLMConfig {
  id: string
  provider: 'openai' | 'anthropic' | 'custom'
  apiKeyMasked: string | null
  model: string | null
  baseUrl: string | null
  customHeaders: Record<string, string> | null
  totalRequests: number
  totalTokens: number
}

interface CurrentLLMConfig {
  provider: string
  model: string
  baseURL: string
  isUserConfig: boolean
  description: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profile')
  
  // User information state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [learningGoal, setLearningGoal] = useState<string>('')
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>([])
  
  // LLM configuration state
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null)
  const [currentLLMConfig, setCurrentLLMConfig] = useState<CurrentLLMConfig | null>(null)
  const [provider, setProvider] = useState<'openai' | 'anthropic' | 'custom'>('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  
  // Change password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
      return
    }
    
    fetchProfile()
    fetchLLMConfig()
    fetchCurrentLLMConfig()
  }, [])

  const fetchProfile = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const data = response.data.data
      setProfile(data)
      setLearningGoal(data.learningGoal || 'interest')
      setPreferredLanguages(data.preferredLanguages || [])
    } catch (error: any) {
      console.error('Failed to fetch user information:', error)
      // Authentication failed, clean up and redirect
      if (error.response?.status === 401 || error.response?.status === 403) {
        sessionStorage.removeItem('token')
        router.push('/auth/login')
        return
      }
      setMessage({ type: 'error', text: 'Failed to fetch user information' })
    } finally {
      setLoading(false)
    }
  }

  const fetchLLMConfig = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/user/llm-config`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const data = response.data.data
      if (data) {
        setLlmConfig(data)
        setProvider(data.provider)
        setModel(data.model || '')
        setBaseUrl(data.baseUrl || '')
      }
    } catch (error: any) {
      console.error('Failed to fetch LLM configuration:', error)
    }
  }

  const fetchCurrentLLMConfig = async () => {
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/user/llm-config/current`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      setCurrentLLMConfig(response.data.data)
    } catch (error: any) {
      console.error('Failed to fetch current LLM configuration:', error)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const token = sessionStorage.getItem('token')
      await axios.put(
        `${API_URL}/api/user/profile`,
        {
          learningGoal,
          preferredLanguages,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      
      setMessage({ type: 'success', text: 'Saved successfully!' })
      fetchProfile()
    } catch (error: any) {
      console.error('Save failed:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLLMConfig = async () => {
    setSaving(true)
    setMessage(null)
    
    try {
      const token = sessionStorage.getItem('token')
      const data: any = {
        provider,
        model: model || undefined,
        baseUrl: baseUrl || undefined,
      }
      
      // Only send if API Key is entered
      if (apiKey.trim()) {
        data.apiKey = apiKey
      }
      
      await axios.post(
        `${API_URL}/api/user/llm-config`,
        data,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      
      setMessage({ type: 'success', text: 'LLM configuration saved successfully!' })
      setApiKey('') // Clear input field
      fetchLLMConfig()
      fetchCurrentLLMConfig() // Refresh currently used configuration
    } catch (error: any) {
      console.error('Failed to save LLM configuration:', error)
      setMessage({ type: 'error', text: error.response?.data?.error || 'Save failed' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setMessage(null)
    
    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/api/user/llm-config/test`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      
      setMessage({ type: 'success', text: response.data.message || 'Connection test successful!' })
    } catch (error: any) {
      console.error('Connection test failed:', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.details || error.response?.data?.error || 'Connection test failed',
      })
    } finally {
      setTesting(false)
    }
  }

  const toggleLanguage = (lang: string) => {
    if (preferredLanguages.includes(lang)) {
      setPreferredLanguages(preferredLanguages.filter(l => l !== lang))
    } else {
      setPreferredLanguages([...preferredLanguages, lang])
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-6">User Center</h1>

      {message && (
        <Alert className={`mb-4 ${message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
          <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Personal Information</TabsTrigger>
          <TabsTrigger value="password">Change Password</TabsTrigger>
          <TabsTrigger value="llm">LLM Configuration</TabsTrigger>
        </TabsList>

        {/* Personal Information Tab */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information (Read-only) */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Account basic information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Username</Label>
                  <div className="mt-1 text-sm font-medium">{profile?.username}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="mt-1 text-sm font-medium">{profile?.email}</div>
                </div>
                <div>
                  <Label>Role</Label>
                  <div className="mt-1">
                    <Badge variant={profile?.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {profile?.role === 'ADMIN' ? 'Administrator' : 'Regular User'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Registration Time</Label>
                  <div className="mt-1 text-sm text-gray-600">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US') : '-'}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Statistics (Read-only) */}
            <Card>
              <CardHeader>
                <CardTitle>Learning Statistics</CardTitle>
                <CardDescription>Overview of your learning data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Current Level</Label>
                  <div className="mt-1 text-2xl font-bold text-indigo-600">
                    Level {profile?.currentLevel || 1}
                  </div>
                </div>
                <div>
                  <Label>Total Problems Solved</Label>
                  <div className="mt-1 text-lg font-semibold">{profile?.totalProblemsSolved || 0} problems</div>
                </div>
                <div>
                  <Label>Total Submissions</Label>
                  <div className="mt-1 text-lg font-semibold">{profile?.totalSubmissions || 0} times</div>
                </div>
                <div>
                  <Label>Average Score</Label>
                  <div className="mt-1 text-lg font-semibold">{profile?.averageScore || '0.00'} points</div>
                </div>
              </CardContent>
            </Card>

            {/* Learning Settings (Editable) */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Learning Settings</CardTitle>
                <CardDescription>Customize your learning preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Learning Goal</Label>
                  <div className="mt-2 flex gap-3">
                    {[
                      { value: 'interview', label: 'Interview Preparation', icon: '💼' },
                      { value: 'interest', label: 'Interest Learning', icon: '🎯' },
                      { value: 'competition', label: 'Competition Training', icon: '🏆' },
                    ].map((goal) => (
                      <button
                        key={goal.value}
                        onClick={() => setLearningGoal(goal.value)}
                        className={`flex-1 flex flex-col items-center justify-center p-4 rounded-lg border-2 transition ${
                          learningGoal === goal.value
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        <span className="text-3xl mb-2">{goal.icon}</span>
                        <span className="text-sm font-medium">{goal.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Preferred Programming Languages</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['Python', 'JavaScript', 'Go', 'Java', 'C++', 'Rust'].map((lang) => (
                      <button
                        key={lang}
                        onClick={() => toggleLanguage(lang.toLowerCase())}
                        className={`px-4 py-2 rounded-md border transition ${
                          preferredLanguages.includes(lang.toLowerCase())
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 hover:border-indigo-300'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </CardContent>
            </Card>

            {/* Algorithm Proficiency (Read-only) */}
            {profile?.algorithmProficiency && Object.keys(profile.algorithmProficiency).length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Algorithm Proficiency</CardTitle>
                  <CardDescription>Proficiency level in various algorithms (automatically updated through problem solving)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(profile.algorithmProficiency).map(([type, proficiency]) => (
                      <div key={type} className="flex items-center gap-3">
                        <div className="w-32 text-sm font-medium text-gray-700">{type}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full flex items-center justify-end px-2 text-xs text-white font-medium"
                            style={{ width: `${(proficiency / 10) * 100}%` }}
                          >
                            {proficiency}/10
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Change Password Tab */}
        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Change your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setPasswordError('')
                setPasswordSuccess('')

                // Validation
                if (passwordForm.newPassword.length < 6) {
                  setPasswordError('New password must be at least 6 characters')
                  return
                }

                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  setPasswordError('The two new passwords do not match')
                  return
                }

                try {
                  setSaving(true)
                  const token = sessionStorage.getItem('token')
                  
                  await axios.post(
                    `${API_URL}/api/auth/reset-password`,
                    {
                      currentPassword: passwordForm.currentPassword,
                      newPassword: passwordForm.newPassword,
                    },
                    {
                      headers: { Authorization: `Bearer ${token}` },
                    }
                  )

                  setPasswordSuccess('Password changed successfully!')
                  setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  })

                  // Clear success message after 3 seconds
                  setTimeout(() => setPasswordSuccess(''), 3000)
                } catch (error: any) {
                  console.error('Password change failed:', error)
                  setPasswordError(error.response?.data?.error || 'Password change failed, please try again')
                } finally {
                  setSaving(false)
                }
              }} className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    required
                    placeholder="At least 6 characters"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    required
                    placeholder="Enter new password again"
                  />
                </div>

                {passwordError && (
                  <Alert variant="error">
                    <AlertDescription>{passwordError}</AlertDescription>
                  </Alert>
                )}

                {passwordSuccess && (
                  <Alert variant="success">
                    <AlertDescription>{passwordSuccess}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={saving}>
                  {saving ? 'Changing...' : 'Change Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Configuration Tab */}
        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>Large Language Model Configuration</CardTitle>
              <CardDescription>
                Configure your LLM API for generating problems, hints, and other features. If not configured, system defaults will be used.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current configuration display */}
              {currentLLMConfig && (
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border-2 border-indigo-200">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🤖</div>
                    <div className="flex-1">
                      <div className="font-semibold text-indigo-900 mb-1">Currently Used LLM</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Provider:</span>
                          <Badge variant={currentLLMConfig.isUserConfig ? 'default' : 'secondary'}>
                            {currentLLMConfig.provider}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            ({currentLLMConfig.description})
                          </span>
                        </div>
                        <div className="text-gray-700">
                          <span className="text-gray-600">Model:</span> {currentLLMConfig.model}
                        </div>
                        {currentLLMConfig.isUserConfig ? (
                          <div className="text-green-700 font-medium text-xs mt-2">
                            ✅ Using your personal configuration
                          </div>
                        ) : (
                          <div className="text-blue-700 text-xs mt-2">
                            ℹ️ Using system default configuration. Personal API configuration will automatically switch.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm text-gray-700 mb-3">Configure Personal LLM</h3>
              </div>

              <div>
                <Label>Provider Type</Label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {[
                    { value: 'openai', label: 'OpenAI', desc: 'GPT-4, GPT-3.5' },
                    { value: 'anthropic', label: 'Anthropic', desc: 'Claude 3' },
                    { value: 'custom', label: 'Custom', desc: 'OpenRouter, etc.' },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setProvider(p.value as any)}
                      className={`p-4 rounded-lg border-2 transition text-left ${
                        provider === p.value
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="font-semibold text-sm">{p.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {(provider === 'custom' || provider === 'openai') && (
                <div>
                  <Label>Base URL</Label>
                  <Input
                    type="text"
                    placeholder={provider === 'openai' ? 'https://api.openai.com (optional)' : 'https://openrouter.ai/api'}
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {provider === 'openai' && 'Leave blank to use default OpenAI address'}
                    {provider === 'custom' && 'Fill in API address compatible with OpenAI format'}
                  </p>
                </div>
              )}

              <div>
                <Label>Model Name</Label>
                <Input
                  type="text"
                  placeholder={
                    provider === 'openai'
                      ? 'gpt-4, gpt-3.5-turbo'
                      : provider === 'anthropic'
                      ? 'claude-3-opus-20240229'
                      : 'openai/gpt-4, anthropic/claude-3'
                  }
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder={llmConfig?.apiKeyMasked ? `Current: ${llmConfig.apiKeyMasked}` : 'Enter your API Key'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  API Key will be encrypted and stored. Leave blank to keep existing configuration unchanged.
                </p>
              </div>

              {llmConfig && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>✅ Current Configuration: <strong>{llmConfig.provider}</strong></div>
                    <div>📊 Total Requests: {llmConfig.totalRequests}</div>
                    <div>🎯 Total Tokens: {llmConfig.totalTokens}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleSaveLLMConfig} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
                <Button
                  onClick={handleTestConnection}
                  disabled={testing || !llmConfig}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
