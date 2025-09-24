import { NavigationBar } from './components/navigation-bar'
import { TextChat } from './components/text-chat'
import { SettingsMenu } from './components/settings-menu'
import { useAppLogic } from './hooks/use-app-logic'
import './index.css'
import './overlay.css'

function App() {
  const {
    // State
    selectedGame,
    isTextChatVisible,
    messages,
    isNavigationBarVisible,
    showSettingsMenu,
    user,
    customKeybind,

    // Actions
    handleSpeakClick,
    handleTextClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    setShowSettingsMenu,
    isLoadingMessage,
    handleStartNewConversation,
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
              isOpen={showSettingsMenu}
              onLogout={handleLogout}
              onClose={() => {
                setShowSettingsMenu(false)
              }}
              currentKeybind={customKeybind}
              onKeybindChange={handleKeybindChange}
            />
          )}
        </div>
      )}
      {isNavigationBarVisible && isTextChatVisible && (
        <TextChat
          onClose={handleTextChatClose}
          onSendMessage={handleSendMessage}
          onStartNewConversation={handleStartNewConversation}
          messages={messages}
          isLoading={isLoadingMessage}
        />
      )}
    </>
  )
}

export default App
