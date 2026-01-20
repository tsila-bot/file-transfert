'use client';

import { useState } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Tapez un message...',
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message, attachments.length > 0 ? attachments : undefined);
    setMessage('');
    setAttachments([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 space-y-2">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((file, idx) => (
            <div key={idx} className="bg-gray-100 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
              <span className="truncate max-w-xs">{file.name}</span>
              <button
                onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600">
          <Paperclip size={18} />
        </button>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 resize-none"
        />

        <button className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600">
          <Smile size={18} />
        </button>

        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 flex items-center justify-center"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
