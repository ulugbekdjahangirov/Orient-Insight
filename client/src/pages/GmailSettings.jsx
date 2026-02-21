import React, { useState, useEffect } from 'react';
import { gmailApi, telegramApi } from '../services/api';

export default function GmailSettings() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [whitelist, setWhitelist] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState(null);
  const [transportChatIds, setTransportChatIds] = useState({ sevil: '', xayrulla: '', nosir: '', hammasi: '' });
  const [savingTransport, setSavingTransport] = useState(false);
  const [mealChatIds, setMealChatIds] = useState({});
  const [newRestaurant, setNewRestaurant] = useState({ name: '', chatId: '' });
  const [savingMeal, setSavingMeal] = useState(false);

  useEffect(() => {
    loadStatus();
    loadSettings();
    checkAuthCallback();
    loadTransportSettings();
    loadMealSettings();
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

  const loadTransportSettings = async () => {
    try {
      const res = await telegramApi.getTransportSettings();
      setTransportChatIds(res.data);
    } catch (e) {
      console.error('Failed to load transport settings:', e);
    }
  };

  const loadMealSettings = async () => {
    try {
      const res = await telegramApi.getMealSettings();
      setMealChatIds(res.data.chatIds || {});
    } catch (e) {
      console.error('Failed to load meal settings:', e);
    }
  };

  const handleAddRestaurant = () => {
    const name = newRestaurant.name.trim();
    const chatId = newRestaurant.chatId.trim();
    if (!name) return;
    setMealChatIds(prev => ({ ...prev, [name]: chatId }));
    setNewRestaurant({ name: '', chatId: '' });
  };

  const handleRemoveRestaurant = (name) => {
    setMealChatIds(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSaveMeal = async () => {
    setSavingMeal(true);
    try {
      await telegramApi.saveMealSettings(mealChatIds);
      setMessage({ type: 'success', text: 'Restoran Telegram sozlamalari saqlandi' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Saqlashda xatolik' });
    } finally {
      setSavingMeal(false);
    }
  };

  const handleSaveTransport = async () => {
    setSavingTransport(true);
    try {
      await telegramApi.saveTransportSettings(transportChatIds);
      setMessage({ type: 'success', text: 'Transport Telegram sozlamalari saqlandi' });
    } catch (e) {
      setMessage({ type: 'error', text: 'Saqlashda xatolik' });
    } finally {
      setSavingTransport(false);
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

      {/* Transport Telegram Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-lg font-semibold mb-1">🚌 Transport Telegram sozlamalari</h2>
        <p className="text-sm text-gray-500 mb-4">
          Marshrut varaqasini Telegram orqali provayderga yuborish uchun har bir provayder uchun chat ID kiriting.
          Chat ID ni bilish uchun provayderdan bot ga xabar yozishini so'rang, keyin GmailSettings → Known chats dan ID ni oling.
        </p>
        <div className="space-y-3 mb-4">
          {[
            { key: 'xayrulla', label: 'Xayrulla',  placeholder: '-123456789' },
            { key: 'sevil',    label: 'Sevil aka',  placeholder: '-123456789' },
            { key: 'nosir',    label: 'Nosir aka',  placeholder: '-123456789' },
            { key: 'hammasi',  label: 'Hammasi',    placeholder: '-123456789 (barcha PDF tasdiqlash uchun)' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="w-28 text-sm font-medium text-gray-700 flex-shrink-0">{label}</label>
              <input
                type="text"
                value={transportChatIds[key] || ''}
                onChange={e => setTransportChatIds(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleSaveTransport}
          disabled={savingTransport}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {savingTransport ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
      </div>

      {/* Restoran Telegram Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-lg font-semibold mb-1">🍽 Restoran Telegram sozlamalari</h2>
        <p className="text-sm text-gray-500 mb-4">
          Har bir restoran uchun Telegram chat ID kiriting. Restoran nomi BookingDetail → Meals da ko'rsatilgan nom bilan bir xil bo'lishi kerak.
        </p>
        {/* Add new restaurant */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newRestaurant.name}
            onChange={e => setNewRestaurant(prev => ({ ...prev, name: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && handleAddRestaurant()}
            placeholder="Restoran nomi (masalan: Saida Opa)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={newRestaurant.chatId}
            onChange={e => setNewRestaurant(prev => ({ ...prev, chatId: e.target.value }))}
            onKeyPress={e => e.key === 'Enter' && handleAddRestaurant()}
            placeholder="-123456789"
            className="w-40 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAddRestaurant}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Qo'shish
          </button>
        </div>
        {/* Existing entries */}
        <div className="space-y-2 mb-4">
          {Object.keys(mealChatIds).length === 0 ? (
            <div className="text-gray-500 text-sm">Hali restoran qo'shilmagan</div>
          ) : (
            Object.entries(mealChatIds).map(([name, chatId]) => (
              <div key={name} className="flex items-center gap-3">
                <label className="w-40 text-sm font-medium text-gray-700 flex-shrink-0">{name}</label>
                <input
                  type="text"
                  value={chatId}
                  onChange={e => setMealChatIds(prev => ({ ...prev, [name]: e.target.value }))}
                  placeholder="-123456789"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleRemoveRestaurant(name)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  O'chirish
                </button>
              </div>
            ))
          )}
        </div>
        <button
          onClick={handleSaveMeal}
          disabled={savingMeal}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {savingMeal ? 'Saqlanmoqda...' : 'Saqlash'}
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
