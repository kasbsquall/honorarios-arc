import { HashRouter, Routes, Route } from 'react-router-dom'
import { TopBar } from './components/Layout'
import { Home } from './pages/Home'
import { Setup } from './pages/Setup'
import { Issue } from './pages/Issue'
import { Pay } from './pages/Pay'
import { Dashboard } from './pages/Dashboard'
import { Proof } from './pages/Proof'

export default function App() {
  return (
    <HashRouter>
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/issue" element={<Issue />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pay/:freelancer/:ref" element={<Pay />} />
        <Route path="/proof" element={<Proof />} />
        <Route path="*" element={
          <main style={{ maxWidth: 640, margin: '0 auto', padding: '64px clamp(16px, 4vw, 48px)', textAlign: 'center' }}>
            <h1 style={{ fontWeight: 600, fontSize: 'var(--t-xl)' }}>Page not found</h1>
            <a href="#/" className="btn" style={{ marginTop: 24, display: 'inline-flex' }}>Back to home</a>
          </main>
        } />
      </Routes>
    </HashRouter>
  )
}
