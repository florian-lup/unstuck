import { NavigationBar } from './components/navigation-bar'
import { TextChat } from './components/text-chat'
import { useAppLogic } from './hooks/use-app-logic'
import './index.css'
import './App.css'

function App() {
  const {
    // State
    selectedGame,
    isTextChatVisible,
    messages,
    isNavigationBarVisible,
    
    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
  } = useAppLogic()

  return (
    <>
      {isNavigationBarVisible && (
        <NavigationBar
          onSpeakClick={handleSpeakClick}
          onTextClick={handleTextClick}
          onSettingsClick={handleSettingsClick}
          onGameSelect={handleGameSelect}
          selectedGame={selectedGame}
          onDropdownOpenChange={handleDropdownOpenChange}
        />
      )}
      {isNavigationBarVisible && isTextChatVisible && (
        <TextChat
          onClose={handleTextChatClose}
          onSendMessage={handleSendMessage}
          messages={messages}
        />
      )}
    </>
  )
}

export default App
