'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Assessment {
  level: number
  learningGoal: string
  algorithmProficiency: Record<string, number>
  recommendedStartLevel: number
  summary: string
}

export default function WarmupPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Check if logged in and user role
  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      router.push('/auth/login')
      return
    }
    
  // Admin doesn't need warmup, directly redirect to admin panel
  const checkUserRole = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const user = response.data.data
      
      if (user.role === 'ADMIN') {
        // Admin directly redirect to admin panel, no warmup needed
        router.push('/admin')
        return
      }
      
      if (user.warmupCompleted) {
        // Regular user completed warmup, redirect to problem list
        router.push('/problems')
        return
      }
      
      // Regular user hasn't completed warmup, show initial greeting
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I am CodeTutor\'s learning assistant. Before starting algorithm learning, I\'d like to understand your situation. What is your learning goal? (For example: preparing for interviews, learning for interest, participating in competitions, etc.)'
        }
      ])
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      router.push('/auth/login')
    }
  }
    
    checkUserRole()
  }, [router])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setLoading(true)

    try {
      const token = sessionStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/api/warmup/chat`,
        {
          message: userMessage,
          conversationId: conversationId || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const { conversationId: newConversationId, message: assistantMessage, completed: isCompleted, assessment: assessmentData } = response.data

      if (!conversationId) {
        setConversationId(newConversationId)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }])
      setCompleted(isCompleted)

      // Save assessment results
      if (assessmentData) {
        setAssessment(assessmentData)
      }

      // If conversation is completed, delay redirect to problem page
      if (isCompleted) {
        setTimeout(() => {
          router.push('/problems')
        }, 5000) // Extend to 5 seconds for user to view assessment results
      }
    } catch (error: any) {
      console.error('Send message error:', error)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, an error occurred. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Warmup Conversation</CardTitle>
            <CardDescription>
              Let's talk about your learning goals and algorithm foundation to customize the most suitable learning path for you
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Chat messages area */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              {completed && assessment && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 my-4">
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 text-white rounded-full mb-3">
                      <span className="text-3xl">✅</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Assessment Completed!</h3>
                    <p className="text-gray-600">{assessment.summary}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">Current Level</div>
                      <div className="text-2xl font-bold text-blue-600">{assessment.level} / 10</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">Recommended Start Difficulty</div>
                      <div className="text-2xl font-bold text-green-600">{assessment.recommendedStartLevel} / 10</div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">Learning Goal</div>
                      <div className="text-lg font-semibold text-gray-800">
                        {assessment.learningGoal === 'interview' ? 'Interview Preparation' : 
                         assessment.learningGoal === 'competition' ? 'Competition Training' : 'Interest Learning'}
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="text-sm text-gray-500 mb-1">Algorithm Proficiency</div>
                      <div className="space-y-1 mt-2">
                        {Object.entries(assessment.algorithmProficiency).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{key}</span>
                            <div className="flex items-center">
                              <div className="w-20 h-2 bg-gray-200 rounded-full mr-2">
                                <div 
                                  className="h-2 bg-blue-500 rounded-full" 
                                  style={{ width: `${(value / 10) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-gray-700 font-medium">{value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center mt-4 text-sm text-gray-500">
                    Auto redirect to problem page in 5 seconds...
                  </div>
                </div>
              )}
              {completed && !assessment && (
                <div className="text-center py-4">
                  <div className="inline-block bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                    ✅ Assessment completed! Redirecting to problem page...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            {!completed && (
              <div className="border-t p-4">
                <div className="flex space-x-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your answer..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={loading || !inputValue.trim()}>
                    {loading ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
