import { NavigationBar } from './components/navigation-bar'
import { TextChat } from './components/text-chat'
import { SettingsMenu } from './components/settings-menu'
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
    showSettingsMenu,
    user,
    isSecureStorage,
    
    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
    handleLogout,
    setShowSettingsMenu,
  } = useAppLogic()

  return (
    <>
      {isNavigationBarVisible && (
        <div className="relative">
          <NavigationBar
            onSpeakClick={handleSpeakClick}
            onTextClick={handleTextClick}
            onSettingsClick={handleSettingsClick}
            onGameSelect={handleGameSelect}
            selectedGame={selectedGame}
            onDropdownOpenChange={handleDropdownOpenChange}
          />
          {showSettingsMenu && (
            <SettingsMenu
              user={user}
              isSecureStorage={isSecureStorage}
              onLogout={handleLogout}
              onClose={() => setShowSettingsMenu(false)}
            />
          )}
        </div>
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
