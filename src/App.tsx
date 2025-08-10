import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/electron-vite.animate.svg'
import './index.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 h-full flex flex-col justify-center">
        <div className="flex justify-center gap-8 mb-8">
          <a 
            href="https://electron-vite.github.io" 
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <img src={viteLogo} className="h-16 w-16" alt="Vite logo" />
          </a>
          <a 
            href="https://react.dev" 
            target="_blank"
            rel="noreferrer"
            className="transition-opacity hover:opacity-80"
          >
            <img src={reactLogo} className="h-16 w-16 animate-spin" alt="React logo" />
          </a>
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-8">Vite + React</h1>
        
        <div className="flex flex-col items-center gap-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <button 
              onClick={() => {
                setCount((count) => count + 1)
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium transition-colors"
            >
              count is {count}
            </button>
            <p className="text-muted-foreground mt-4 text-center">
              Edit <code className="bg-muted px-2 py-1 rounded text-sm">src/App.tsx</code> and save to test HMR
            </p>
          </div>
          
          <p className="text-muted-foreground text-center">
            Click on the Vite and React logos to learn more
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
