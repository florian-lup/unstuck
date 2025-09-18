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
      <NavigationBar
        onSpeakClick={handleSpeakClick}
        onTextClick={handleTextClick}
        onSettingsClick={handleSettingsClick}
      />
  )
}

export default App
