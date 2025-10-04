import {
  X,
  Gamepad2,
  Type,
  BookOpen,
  ClipboardList,
  Scroll,
  Wrench,
  Bot,
  Mic,
} from 'lucide-react'
import { Button } from './ui/button'
import { InteractiveArea } from './interactive-area'

interface AppInfoProps {
  isOpen: boolean
  onClose: () => void
}

export function AppInfo({ isOpen, onClose }: AppInfoProps) {
  const handleClose = () => {
    // Ensure window stays on top when button is clicked
    window.electronAPI?.windowInteraction()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="w-full mx-auto mt-2">
      <InteractiveArea className="w-full">
        <div className="w-full bg-overlay-bg-primary border border-overlay-border-primary rounded-3xl p-4 mt-2 max-h-120 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-overlay-text-primary">
              How to Use Unstuck
            </h2>
            <Button
              onClick={handleClose}
              variant="gaming"
              size="icon"
              className="p-1 h-auto w-auto hover:border-overlay-accent-primary"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overlay-scrollbar pr-2">
            {/* Game Selection */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="w-4 h-4 text-overlay-accent-primary" />
                <h3 className="text-sm font-medium text-overlay-text-primary">
                  Select Game
                </h3>
              </div>
              <p className="text-xs text-overlay-text-secondary leading-relaxed ml-2">
                Choose your current game from the dropdown to get contextual
                help and information specific to that game.
              </p>
            </div>

            {/* Chat Feature */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-4 h-4 text-overlay-accent-primary" />
                <h3 className="text-sm font-medium text-overlay-text-primary">
                  Chat
                </h3>
              </div>
              <p className="text-xs text-overlay-text-secondary leading-relaxed ml-2">
                Your daily quick chat about everything gaming, optimised to
                provide concise and up to date information.
              </p>
            </div>

            {/* Voice Chat */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-overlay-accent-primary" />
                <h3 className="text-sm font-medium text-overlay-text-primary">
                  Voice Chat
                </h3>
              </div>
              <p className="text-xs text-overlay-text-secondary leading-relaxed ml-2">
                Use voice input to ask questions hands-free while gaming. Simply
                speak your query and get instant responses without interrupting
                your gameplay.
              </p>
            </div>

            {/* Agents */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-overlay-accent-primary" />
                <h3 className="text-sm font-medium text-overlay-text-primary">
                  Agents (Coming Soon)
                </h3>
              </div>
              <p className="text-xs text-overlay-text-secondary leading-relaxed ml-2 mb-3">
                To further enhance chat functionality, toggle an agent to get
                specialized responses tailored to your specific needs.
              </p>
              <div className="space-y-3 ml-2">
                {/* Guides */}
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 text-overlay-accent-primary mt-0.5" />
                  <div>
                    <h4 className="text-xs font-medium text-overlay-text-primary">
                      Guides
                    </h4>
                    <p className="text-xs text-overlay-text-secondary leading-relaxed">
                      Get help with game mechanics, tutorials, strategies, and
                      how-to information.
                    </p>
                  </div>
                </div>

                {/* Builds */}
                <div className="flex items-start gap-2">
                  <ClipboardList className="w-4 h-4 text-overlay-accent-primary mt-0.5" />
                  <div>
                    <h4 className="text-xs font-medium text-overlay-text-primary">
                      Builds
                    </h4>
                    <p className="text-xs text-overlay-text-secondary leading-relaxed">
                      Ask about character builds, item combinations, skill
                      rotations and talent trees.
                    </p>
                  </div>
                </div>

                {/* Lore */}
                <div className="flex items-start gap-2">
                  <Scroll className="w-4 h-4 text-overlay-accent-primary mt-0.5" />
                  <div>
                    <h4 className="text-xs font-medium text-overlay-text-primary">
                      Lore
                    </h4>
                    <p className="text-xs text-overlay-text-secondary leading-relaxed">
                      Discover game story, characters, world-building, and
                      background information.
                    </p>
                  </div>
                </div>

                {/* Fix */}
                <div className="flex items-start gap-2">
                  <Wrench className="w-4 h-4 text-overlay-accent-primary mt-0.5" />
                  <div>
                    <h4 className="text-xs font-medium text-overlay-text-primary">
                      Fix
                    </h4>
                    <p className="text-xs text-overlay-text-secondary leading-relaxed">
                      Get help troubleshooting technical issues and bugs in your
                      games.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prompt Tips */}
            <div className="border-t border-overlay-border-primary pt-4">
              <h3 className="text-sm font-semibold text-overlay-text-primary mb-3 text-center">
                Prompt Tips
              </h3>
              <div className="space-y-4">
                <div className="bg-overlay-bg-secondary/30 rounded-lg p-3 border border-overlay-border-primary/50">
                  <p className="text-sm font-semibold text-overlay-text-primary mb-2">
                    Be Specific and Contextual
                  </p>
                  <p className="text-xs text-overlay-text-secondary mb-3 leading-relaxed">
                    Our web search models require specificity to retrieve
                    relevant search results. Adding just 2-3 extra words of
                    context can dramatically improve performance.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-overlay-accent-error font-medium">
                      ❌ Avoid: &quot;Tell me about shaman builds&quot;
                    </p>
                    <p className="text-xs text-overlay-accent-success font-medium">
                      ✅ Instead: &quot;Best DPS build for stormbringer
                      elemental shaman M+&quot;
                    </p>
                  </div>
                </div>

                <div className="bg-overlay-bg-secondary/30 rounded-lg p-3 border border-overlay-border-primary/50">
                  <p className="text-sm font-semibold text-overlay-text-primary mb-2">
                    Provide Relevant Context
                  </p>
                  <p className="text-xs text-overlay-text-secondary mb-3 leading-relaxed">
                    Include critical context to guide the web search toward the
                    most relevant content, but keep prompts concise and focused.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-overlay-accent-error font-medium">
                      ❌ Avoid: &quot;How to get better at this game?&quot;
                    </p>
                    <p className="text-xs text-overlay-accent-success font-medium">
                      ✅ Instead: &quot;Advanced movement techniques for
                      improving aim in competitive matches&quot;
                    </p>
                  </div>
                </div>

                <div className="bg-overlay-bg-secondary/30 rounded-lg p-3 border border-overlay-border-primary/50">
                  <p className="text-sm font-semibold text-overlay-text-primary mb-2">
                    Avoid Overly Generic Questions
                  </p>
                  <p className="text-xs text-overlay-text-secondary mb-3 leading-relaxed">
                    Generic prompts lead to scattered web search results and
                    unfocused responses. Always narrow your scope.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-overlay-accent-error font-medium">
                      ❌ Avoid: &quot;What&apos;s new in gaming?&quot;
                    </p>
                    <p className="text-xs text-overlay-accent-success font-medium">
                      ✅ Instead: &quot;What are the three major balance changes
                      in the current patch?&quot;
                    </p>
                  </div>
                </div>

                <div className="bg-overlay-bg-secondary/30 rounded-lg p-3 border border-overlay-border-primary/50">
                  <p className="text-sm font-semibold text-overlay-text-primary mb-2">
                    Avoid Complex Multi-Part Requests
                  </p>
                  <p className="text-xs text-overlay-text-secondary mb-3 leading-relaxed">
                    Complex prompts with multiple unrelated questions can
                    confuse the search component. Focus on one topic per query.
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-overlay-accent-error font-medium">
                      ❌ Avoid: &quot;Explain Elden Ring lore, and also tell me
                      about Cyberpunk builds, and give me Minecraft tips.&quot;
                    </p>
                    <p className="text-xs text-overlay-accent-success font-medium">
                      ✅ Instead: &quot;Explain the connection between Marika
                      and Radagon in the main storyline&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </InteractiveArea>
    </div>
  )
}
