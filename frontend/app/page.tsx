export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          CodeTutor
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          LLM-powered Intelligent Algorithm Learning Platform
        </p>
        <div className="space-x-4">
          <a
            href="/auth/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </a>
          <a
            href="/auth/register"
            className="inline-block px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition"
          >
            Register
          </a>
        </div>
      </div>
    </div>
  )
}
