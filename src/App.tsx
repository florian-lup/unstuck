import { NavigationBar } from './components/navigation-bar'
import { TextChat } from './components/text-chat'
import { SettingsMenu } from './components/settings-menu'
import { ConversationHistory } from './components/conversation-history'
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
    showHistoryPanel,
    user,
    customKeybind,
    transparency,
    isLoadingMessage,

    // Actions
    handleSpeakClick,
    handleTextClick,
    handleHistoryClick,
    handleSettingsClick,
    handleGameSelect,
    handleSendMessage,
    handleTextChatClose,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    handleTransparencyChange,
    setShowSettingsMenu,
    setShowHistoryPanel,
    handleStartNewConversation,
    handleConversationSelect,
  } = useAppLogic()

  return (
    <>
      {isNavigationBarVisible && (
        <div className="relative">
          <NavigationBar
            onSpeakClick={handleSpeakClick}
            onTextClick={handleTextClick}
            onHistoryClick={handleHistoryClick}
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
              currentTransparency={transparency}
              onTransparencyChange={handleTransparencyChange}
            />
          )}
          {showHistoryPanel && (
            <ConversationHistory
              isOpen={showHistoryPanel}
              onClose={() => {
                setShowHistoryPanel(false)
              }}
              onConversationSelect={handleConversationSelect}
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
