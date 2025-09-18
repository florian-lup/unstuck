import { NavigationBar } from './components/NavigationBar'
import './index.css'

function App() {
  const handleSpeakClick = () => {
    // Handle speak functionality here
  }

  const handleTextClick = () => {
    // Handle text functionality here
  }

  const handleSettingsClick = () => {
    // Handle settings functionality here
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-2 bg-transparent">
      <NavigationBar
        onSpeakClick={handleSpeakClick}
        onTextClick={handleTextClick}
        onSettingsClick={handleSettingsClick}
      />
    </div>
  )
}

export default App
