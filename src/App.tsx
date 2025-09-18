import { NavigationBar } from './components/NavigationBar'
import { useKeyboardToggle } from './hooks/use-keyboard-toggle'
import './index.css'

function App() {
  const { isVisible: isNavigationBarVisible } = useKeyboardToggle({
    key: 'Backslash',
    modifiers: { shift: true }
  })

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
    <>
      {isNavigationBarVisible && (
        <NavigationBar
          onSpeakClick={handleSpeakClick}
          onTextClick={handleTextClick}
          onSettingsClick={handleSettingsClick}
        />
      )}
    </>
  )
}

export default App
