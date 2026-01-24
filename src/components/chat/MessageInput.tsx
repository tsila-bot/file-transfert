'use client';

import { useState } from 'react';
import { Send, Smile } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const EMOJIS = ['😀', '😂', '😍', '😘', '😜', '😎', '😴', '😡', '😢', '😱', '🔥', '💯', '👍', '👏', '🙏', '❤️', '💔', '✨', '🎉', '🎊'];

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Tapez un message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setMessage(message + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="border-t border-gray-200 p-4 space-y-2">
      {/* Input */}
      <div className="flex gap-2 relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 resize-none text-gray-900 placeholder-gray-400"
        />

        <button
          onClick={() => setShowEmojis(!showEmojis)}
          className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
        >
          <Smile size={18} />
        </button>

        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 flex items-center justify-center"
        >
          <Send size={18} />
        </button>

        {/* Emoji Picker */}
        {showEmojis && (
          <div className="absolute bottom-12 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3 grid grid-cols-5 gap-2 w-64 z-50">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiClick(emoji)}
                className="text-xl p-2 hover:bg-gray-100 rounded transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
