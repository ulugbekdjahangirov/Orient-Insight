import React, { useState, useEffect } from 'react';
import { gmailApi } from '../services/api';

export default function GmailSettings() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadStatus();
    loadSettings();
    checkAuthCallback();
  }, []);

  const checkAuthCallback = () => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    const errorMsg = params.get('message');

    if (auth === 'success') {
      setMessage({ type: 'success', text: 'Gmail успешно подключен!' });
      setConnected(true);
      // Clean URL
      window.history.replaceState({}, '', '/gmail-settings');
    } else if (auth === 'error') {
      setMessage({ type: 'error', text: `Ошибка подключения: ${errorMsg || 'Неизвестная ошибка'}` });
      // Clean URL
      window.history.replaceState({}, '', '/gmail-settings');
    }
  };

  const loadStatus = async () => {
    try {
      const response = await gmailApi.getStatus();
      setConnected(response.data.connected);
    } catch (error) {
      console.error('Failed to load status:', error);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await gmailApi.getSettings();
      setWhitelist(response.data.whitelist || []);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleAuthorize = async () => {
    try {
      const response = await gmailApi.authorize();
      const authUrl = response.data.authUrl;
      // Redirect to Google OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Failed to authorize:', error);
      setMessage({ type: 'error', text: 'Ошибка авторизации' });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Отключить Gmail интеграцию?')) return;

    try {
      await gmailApi.disconnect();
      setConnected(false);
      setMessage({ type: 'success', text: 'Gmail отключен' });
    } catch (error) {
      console.error('Failed to disconnect:', error);
      setMessage({ type: 'error', text: 'Ошибка отключения' });
    }
  };

  const handlePollNow = async () => {
    setPolling(true);
    try {
      await gmailApi.pollNow();
      setMessage({ type: 'success', text: 'Проверка почты запущена...' });
    } catch (error) {
      console.error('Failed to poll:', error);
      setMessage({ type: 'error', text: 'Ошибка проверки почты' });
    } finally {
      setPolling(false);
    }
  };

  const handleAddEmail = () => {
    if (!newEmail.trim()) return;

    if (whitelist.includes(newEmail.trim())) {
      setMessage({ type: 'error', text: 'Email уже в списке' });
      return;
    }

    setWhitelist([...whitelist, newEmail.trim()]);
    setNewEmail('');
  };

  const handleRemoveEmail = (email) => {
    setWhitelist(whitelist.filter(e => e !== email));
  };

  const handleSaveSettings = async () => {
    try {
      await gmailApi.updateSettings({ whitelist });
      setMessage({ type: 'success', text: 'Настройки сохранены' });
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Ошибка сохранения настроек' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Настройки Gmail</h1>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Статус подключения</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-700">
              {connected ? 'Gmail подключен' : 'Gmail не подключен'}
            </span>
          </div>
          {connected ? (
            <div className="space-x-2">
              <button
                onClick={handlePollNow}
                disabled={polling}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {polling ? 'Проверка...' : 'Проверить сейчас'}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Отключить
              </button>
            </div>
          ) : (
            <button
              onClick={handleAuthorize}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Подключить Gmail
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-4">
          Интеграция автоматически импортирует данные из писем с вложениями Excel (Agenturdaten), PDF или скриншотами.
          Проверка почты происходит каждые 5 минут.
        </p>
      </div>

      {/* Email Whitelist */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Белый список отправителей</h2>
        <p className="text-sm text-gray-600 mb-4">
          Только письма от этих адресов будут обрабатываться. Можно добавить отдельные email'ы или домены (начинающиеся с @).
        </p>

        {/* Add Email */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
            placeholder="booking@example.com или @world-insight.de"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddEmail}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Добавить
          </button>
        </div>

        {/* Email List */}
        <div className="space-y-2 mb-4">
          {whitelist.length === 0 ? (
            <div className="text-gray-500 text-sm">Список пуст</div>
          ) : (
            whitelist.map((email, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-mono text-sm">{email}</span>
                <button
                  onClick={() => handleRemoveEmail(email)}
                  className="text-red-600 hover:text-red-800"
                >
                  Удалить
                </button>
              </div>
            ))
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Сохранить настройки
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Как это работает</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Система проверяет Gmail каждые 5 минут на наличие новых писем</li>
          <li>Обрабатываются только письма от адресов из белого списка</li>
          <li>Письма должны содержать вложение-скриншот с расписанием туров</li>
          <li>Claude AI автоматически распознает таблицу и создает/обновляет бронирования</li>
          <li>После обработки вы получите email-уведомление с результатами</li>
        </ul>
      </div>
    </div>
  );
}
