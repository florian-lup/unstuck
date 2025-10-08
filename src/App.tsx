import { NavigationBar } from './components/navigation-bar'
import { GamingChat } from './components/gaming-chat'
import { SettingsMenu } from './components/settings-menu'
import { ConversationHistory } from './components/conversation-history'
import { AppInfo } from './components/app-info'
import { useAppLogic } from './hooks/use-app-logic'
import './index.css'
import './overlay.css'

function App() {
  const {
    // State
    selectedGame,
    isGamingChatVisible,
    messages,
    isNavigationBarVisible,
    showSettingsMenu,
    showHistoryPanel,
    showInfoPanel,
    user,
    customKeybind,
    chatKeybind,
    historyKeybind,
    settingsKeybind,
    newChatKeybind,
    transparency,
    isLoadingMessage,
    isSubscribed,
    subscriptionLoading,

    // Actions
    handleVoiceClick,
    handleTextClick,
    handleHistoryClick,
    handleSettingsClick,
    handleInfoClick,
    handleGameSelect,
    handleSendMessage,
    handleGamingChatClose,
    handleDropdownOpenChange,
    handleLogout,
    handleKeybindChange,
    handleChatKeybindChange,
    handleHistoryKeybindChange,
    handleSettingsKeybindChange,
    handleNewChatKeybindChange,
    handleTransparencyChange,
    handleUpgrade,
    handleCancel,
    setShowSettingsMenu,
    setShowHistoryPanel,
    setShowInfoPanel,
    handleStartNewConversation,
    handleConversationSelect,
  } = useAppLogic()

  return (
    <>
      {isNavigationBarVisible && (
        <div className="relative">
          <NavigationBar
            onSpeakClick={handleVoiceClick}
            onTextClick={handleTextClick}
            onHistoryClick={handleHistoryClick}
            onSettingsClick={handleSettingsClick}
            onInfoClick={handleInfoClick}
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
              currentChatKeybind={chatKeybind}
              onChatKeybindChange={handleChatKeybindChange}
              currentHistoryKeybind={historyKeybind}
              onHistoryKeybindChange={handleHistoryKeybindChange}
              currentSettingsKeybind={settingsKeybind}
              onSettingsKeybindChange={handleSettingsKeybindChange}
              currentNewChatKeybind={newChatKeybind}
              onNewChatKeybindChange={handleNewChatKeybindChange}
              currentTransparency={transparency}
              onTransparencyChange={handleTransparencyChange}
              isSubscribed={isSubscribed}
              subscriptionLoading={subscriptionLoading}
              onUpgrade={handleUpgrade}
              onCancel={handleCancel}
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
          {showInfoPanel && (
            <AppInfo
              isOpen={showInfoPanel}
              onClose={() => {
                setShowInfoPanel(false)
              }}
            />
          )}
        </div>
      )}
      {isNavigationBarVisible && isGamingChatVisible && (
        <GamingChat
          onClose={handleGamingChatClose}
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
