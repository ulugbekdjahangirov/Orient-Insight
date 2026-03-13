import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Building, Globe, Plus, Edit, Trash2, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { invoicesApi } from '../services/api';
import { useYear } from '../context/YearContext';
import { toast } from 'react-hot-toast';

const modules = [
  { id: 'rechnung', name: 'Invoice', color: 'amber', icon: FileText },
  { id: 'gutschrift', name: 'Gutschrift', color: 'emerald', icon: Receipt },
  { id: 'orient', name: 'Orient', color: 'blue', icon: Building },
  { id: 'infuturestorm', name: 'INFUTURESTORM', color: 'orange', icon: Globe },
  { id: 'shamixon', name: 'Shamixon', color: 'purple', icon: Building },
];

const colorClasses = {
  amber: {
    bg: 'from-amber-500 to-orange-500',
    text: 'from-amber-600 to-orange-600',
    active: 'bg-gradient-to-r from-amber-500 to-orange-500',
    hover: 'hover:from-amber-600 hover:to-orange-600',
  },
  emerald: {
    bg: 'from-emerald-500 to-green-500',
    text: 'from-emerald-600 to-green-600',
    active: 'bg-gradient-to-r from-emerald-500 to-green-500',
    hover: 'hover:from-emerald-600 hover:to-green-600',
  },
  blue: {
    bg: 'from-blue-500 to-indigo-500',
    text: 'from-blue-600 to-indigo-600',
    active: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    hover: 'hover:from-blue-600 hover:to-indigo-600',
  },
  orange: {
    bg: 'from-orange-500 to-red-500',
    text: 'from-orange-600 to-red-600',
    active: 'bg-gradient-to-r from-orange-500 to-red-500',
    hover: 'hover:from-orange-600 hover:to-red-600',
  },
  purple: {
    bg: 'from-purple-500 to-pink-500',
    text: 'from-purple-600 to-pink-600',
    active: 'bg-gradient-to-r from-purple-500 to-pink-500',
    hover: 'hover:from-purple-600 hover:to-pink-600',
  },
};

export default function Rechnung() {
  const { selectedYear } = useYear();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get active module from URL or default to 'rechnung'
  const activeModule = searchParams.get('module') || 'rechnung';

  // Function to change module and update URL
  const handleModuleChange = (module) => {
    setSearchParams({ module });
  };
  const [rechnungItems, setRechnungItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gutschriftItems, setGutschriftItems] = useState([]);
  const [orientItems, setOrientItems] = useState([]);
  const [infuturestormItems, setInfuturestormItems] = useState([]);
  const [shamixonItems, setShamixonItems] = useState([]);

  const activeModuleData = modules.find(m => m.id === activeModule);
  const Icon = activeModuleData?.icon || FileText;

  // Format number with space as thousands separator
  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '';
    const number = parseFloat(num);
    if (isNaN(number)) return num;
    const rounded = Number.isInteger(number) ? number : number.toFixed(2);
    const [integer, decimal] = rounded.toString().split('.');
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    if (decimal && decimal !== '00') {
      return `${formattedInteger}.${decimal}`;
    }
    return formattedInteger;
  };

  // Load invoices from API when activeModule or year changes
  useEffect(() => {
    loadInvoices();
  }, [activeModule, selectedYear]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      // Special handling for Shamixon module - load from backend
      if (activeModule === 'shamixon') {
        const res = await invoicesApi.getShamixon();
        let items = res.data.items || [];
        // One-time migration: if backend is empty but localStorage has data, migrate it
        if (items.length === 0) {
          const legacy = localStorage.getItem('shamixonItems');
          if (legacy) {
            try {
              items = JSON.parse(legacy);
              await invoicesApi.saveShamixon(items);
              localStorage.removeItem('shamixonItems');
            } catch {}
          }
        }
        setShamixonItems(items);
        setLoading(false);
        return;
      }

      // Determine filter params based on activeModule
      const params = { year: selectedYear };
      if (activeModule === 'orient') {
        params.firma = 'Orient Insight';
      } else if (activeModule === 'infuturestorm') {
        params.firma = 'INFUTURESTORM';
      } else if (activeModule === 'gutschrift') {
        params.invoiceType = 'Gutschrift';
      }
      // For 'rechnung' module: load all invoices, then filter client-side

      const response = await invoicesApi.getAll(params);
      let invoices = response.data.invoices || [];

      // Client-side filtering for Rechnung module
      if (activeModule === 'rechnung') {
        // Show only "Rechnung" and "Neue Rechnung" types (not Gutschrift)
        // AND only invoices with firma selected
        invoices = invoices.filter(inv =>
          (inv.invoiceType === 'Rechnung' || inv.invoiceType === 'Neue Rechnung') &&
          inv.firma // Only show if firma is selected
        );
      } else {
        // For other modules, also filter out invoices without firma
        invoices = invoices.filter(inv => inv.firma);
      }

      // Transform invoices to items
      const items = invoices
        .map((invoice) => ({
          id: invoice.id,
          bookingId: invoice.bookingId,
          nummer: invoice.invoiceNumber, // Sequential number from DB
          name: invoice.invoiceType, // "Rechnung", "Neue Rechnung", "Gutschrift"
          gruppe: invoice.booking?.bookingNumber || '', // Booking code: ER-07, CO-01, etc.
          firma: invoice.firma || '',
          summe: invoice.totalAmount || 0
        }))
        .sort((a, b) => parseInt(a.nummer) - parseInt(b.nummer)); // Sort by invoice number ascending

      // Set items to the appropriate state based on activeModule
      if (activeModule === 'gutschrift') {
        setGutschriftItems(items);
      } else if (activeModule === 'orient') {
        setOrientItems(items);
      } else if (activeModule === 'infuturestorm') {
        setInfuturestormItems(items);
      } else {
        // Default: rechnung module
        setRechnungItems(items);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  // Toggle paid status for an invoice
  const handleTogglePaid = async (item) => {
    const newPaid = !item.isPaid;
    setRechnungItems(prev => prev.map(i => i.id === item.id ? { ...i, isPaid: newPaid } : i));
    try {
      await invoicesApi.update(item.id, { isPaid: newPaid });
    } catch {
      // revert on error
      setRechnungItems(prev => prev.map(i => i.id === item.id ? { ...i, isPaid: !newPaid } : i));
      toast.error('Xatolik yuz berdi');
    }
  };

  // Add new item - Rechnung
  const handleAddItem = () => {
    const newId = Math.max(...rechnungItems.map(i => i.id), 0) + 1;
    const newItem = {
      id: newId,
      nummer: newId.toString(),
      name: 'Neue Rechnung',
      gruppe: 'ER',
      firma: '',
      summe: 0.00
    };
    setRechnungItems([...rechnungItems, newItem]);
  };

  // Delete item - Rechnung
  const handleDeleteItem = (id) => {
    setRechnungItems(rechnungItems.filter(item => item.id !== id));
  };

  // Update item - Rechnung
  const handleUpdateItem = (id, field, value) => {
    setRechnungItems(rechnungItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Add new item - Gutschrift
  const handleAddGutschriftItem = () => {
    const newId = Math.max(...gutschriftItems.map(i => i.id), 0) + 1;
    const newItem = {
      id: newId,
      nummer: newId.toString(),
      name: 'Neue Gutschrift',
      gruppe: 'ER',
      firma: '',
      summe: 0.00
    };
    setGutschriftItems([...gutschriftItems, newItem]);
  };

  // Delete item - Gutschrift
  const handleDeleteGutschriftItem = (id) => {
    setGutschriftItems(gutschriftItems.filter(item => item.id !== id));
  };

  // Update item - Gutschrift
  const handleUpdateGutschriftItem = (id, field, value) => {
    setGutschriftItems(gutschriftItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Add new item - Shamixon
  const handleAddShamixonItem = () => {
    const newId = Math.max(...shamixonItems.map(i => i.id), 0) + 1;
    const newItem = {
      id: newId,
      nummer: newId.toString(),
      name: '',
      gruppe: '',
      firma: '',
      summe: 0.00,
      transferFee: 0.00,
      incomingPayment: 0.00,
      receivedAmount: 0.00,
      serviceFee: 0.00
    };
    const updatedItems = [...shamixonItems, newItem];
    setShamixonItems(updatedItems);
    invoicesApi.saveShamixon(updatedItems).catch(() => toast.error('Saqlashda xatolik'));
  };

  // Delete item - Shamixon
  const handleDeleteShamixonItem = (id) => {
    const updatedItems = shamixonItems.filter(item => item.id !== id);
    setShamixonItems(updatedItems);
    invoicesApi.saveShamixon(updatedItems).catch(() => toast.error('Saqlashda xatolik'));
  };

  // Update item - Shamixon
  const handleUpdateShamixonItem = (id, field, value) => {
    const updatedItems = shamixonItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setShamixonItems(updatedItems);
    invoicesApi.saveShamixon(updatedItems).catch(() => toast.error('Saqlashda xatolik'));
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-3 sm:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center gap-3 mb-3 sm:mb-4">
            <div className={`p-2 sm:p-3 bg-gradient-to-br ${colorClasses[activeModuleData?.color || 'amber'].bg} rounded-xl sm:rounded-2xl shadow-lg`}>
              <Icon className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-xl sm:text-4xl font-bold bg-gradient-to-r ${colorClasses[activeModuleData?.color || 'amber'].text} bg-clip-text text-transparent`}>
                Invoice - {activeModuleData?.name} <span className="text-xl sm:text-3xl">{selectedYear}</span>
              </h1>
              <p className="text-gray-500 text-xs sm:text-base mt-0.5 sm:mt-1">
                Invoice Management and Overview
              </p>
            </div>
          </div>
        </div>

        {/* Module tabs — mobile: 3-col grid, desktop: flex wrap */}
        <div className="mb-4 sm:mb-6 grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-3">
          {modules.map((module) => {
            const ModuleIcon = module.icon;
            const isActive = activeModule === module.id;
            const colors = colorClasses[module.color];

            return (
              <button
                key={module.id}
                onClick={() => handleModuleChange(module.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 px-2 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-xl transition-all duration-300 shadow sm:shadow-lg hover:shadow-xl ${
                  isActive
                    ? `${colors.active} ${colors.hover} text-white`
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <ModuleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-center leading-tight">{module.name}</span>
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          {activeModule === 'rechnung' ? (
            <>
              {/* Mobile cards */}
              {loading ? (
                <div className="sm:hidden flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
                </div>
              ) : (
                <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                  {rechnungItems.map((item, index) => (
                    <div key={item.id} className="rounded-xl overflow-hidden border border-amber-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(245,158,11,0.08)' }}>
                      <div className="h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-amber-200">{index + 1}</span>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 text-sm truncate">{item.gruppe}</div>
                              <div className="text-[10px] text-gray-500">{item.name}{item.firma ? ` · ${item.firma}` : ''}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="bg-amber-50 rounded-lg px-2 py-1 border border-amber-100 text-right">
                              <div className="text-[10px] text-amber-600 font-medium">Summe</div>
                              <div className="font-bold text-gray-900 text-sm">{formatNumber(item.summe)}</div>
                            </div>
                            <button onClick={() => { const docTab = item.name === 'Rechnung' ? 'rechnung' : item.name === 'Neue Rechnung' ? 'neue-rechnung' : 'gutschrift'; navigate(`/bookings/${item.bookingId}?tab=documents&docTab=${docTab}`); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><ExternalLink className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {rechnungItems.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Ma'lumot topilmadi</div>}
                  {rechnungItems.length > 0 && (
                    <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                      <span className="text-gray-600 uppercase text-[10px] tracking-widest self-center">TOTAL</span>
                      <span className="text-gray-900 text-base">{formatNumber(rechnungItems.reduce((s, i) => s + (parseFloat(i.summe) || 0), 0))}</span>
                    </div>
                  )}
                </div>
              )}
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-amber-100 to-orange-100">
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Summe</th>
                        <th className="border border-gray-300 px-4 py-4 text-center font-bold text-gray-900">Bezahlt</th>
                        <th className="border border-gray-300 px-6 py-4 text-center font-bold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rechnungItems.map((item, index) => (
                        <tr key={item.id} className={`transition-colors ${item.isPaid ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}>
                          <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                            {index + 1}
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-gray-900">
                            {item.name}
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                            {item.gruppe}
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-gray-900">
                            {item.firma || '-'}
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                            {formatNumber(item.summe)}
                          </td>
                          <td className="border border-gray-300 px-4 py-4 text-center">
                            <button
                              onClick={() => handleTogglePaid(item)}
                              title={item.isPaid ? 'Bekor qilish' : 'Tolandi deb belgilash'}
                              className="inline-flex items-center justify-center transition-colors"
                            >
                              {item.isPaid
                                ? <CheckCircle2 className="w-6 h-6 text-green-500" />
                                : <Circle className="w-6 h-6 text-gray-300 hover:text-green-400" />}
                            </button>
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                const docTab = item.name === 'Rechnung' ? 'rechnung' : item.name === 'Neue Rechnung' ? 'neue-rechnung' : 'gutschrift';
                                navigate(`/bookings/${item.bookingId}?tab=documents&docTab=${docTab}`);
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="View Booking"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {rechnungItems.length === 0 && (
                        <tr>
                          <td colSpan="7" className="border border-gray-300 px-6 py-8 text-center text-gray-500">
                            Ma'lumot topilmadi
                          </td>
                        </tr>
                      )}
                      {/* Total row */}
                      {rechnungItems.length > 0 && (() => {
                        const paidItems = rechnungItems.filter(i => i.isPaid);
                        const paidSum = paidItems.reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                        const totalSum = rechnungItems.reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                        const remaining = totalSum - paidSum;
                        return (
                          <>
                            <tr className="bg-gradient-to-r from-amber-100 to-orange-100 font-bold">
                              <td className="border border-gray-300 px-6 py-3 text-gray-900" colSpan="4">TOTAL</td>
                              <td className="border border-gray-300 px-6 py-3 text-right text-gray-900">{formatNumber(totalSum)}</td>
                              <td className="border border-gray-300 px-4 py-3 text-center text-xs text-gray-500">{paidItems.length}/{rechnungItems.length}</td>
                              <td className="border border-gray-300 px-6 py-3"></td>
                            </tr>
                            <tr className="bg-green-50 font-semibold">
                              <td className="border border-gray-300 px-6 py-3 text-green-700" colSpan="4">
                                <span className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  Bezahlt ({paidItems.length})
                                </span>
                              </td>
                              <td className="border border-gray-300 px-6 py-3 text-right text-green-700">{formatNumber(paidSum)}</td>
                              <td className="border border-gray-300 px-4 py-3"></td>
                              <td className="border border-gray-300 px-6 py-3"></td>
                            </tr>
                            {remaining > 0 && (
                              <tr className="bg-orange-50 font-semibold">
                                <td className="border border-gray-300 px-6 py-3 text-orange-700" colSpan="4">
                                  <span className="flex items-center gap-2">
                                    <Circle className="w-4 h-4 text-orange-400" />
                                    Ausstehend ({rechnungItems.length - paidItems.length})
                                  </span>
                                </td>
                                <td className="border border-gray-300 px-6 py-3 text-right text-orange-700">{formatNumber(remaining)}</td>
                                <td className="border border-gray-300 px-4 py-3"></td>
                                <td className="border border-gray-300 px-6 py-3"></td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : activeModule === 'gutschrift' ? (

            <>
              {/* Add Item button */}
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={handleAddGutschriftItem}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>

              {/* Mobile cards — Gutschrift */}
              <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                {gutschriftItems.map((item, index) => (
                  <div key={item.id} className="rounded-xl overflow-hidden border border-emerald-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(16,185,129,0.08)' }}>
                    <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-green-500" />
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-emerald-200">{index + 1}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm truncate">{item.gruppe}</div>
                            <div className="text-[10px] text-gray-500">{item.name}{item.firma ? ` · ${item.firma}` : ''}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="bg-emerald-50 rounded-lg px-2 py-1 border border-emerald-100 text-right">
                            <div className="text-[10px] text-emerald-600 font-medium">Summe</div>
                            <div className="font-bold text-gray-900 text-sm">{formatNumber(item.summe)}</div>
                          </div>
                          <button onClick={() => navigate(`/bookings/${item.bookingId}?tab=documents&docTab=gutschrift`)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"><ExternalLink className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {gutschriftItems.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Ma'lumot topilmadi</div>}
                <div className="rounded-xl px-3 py-2.5 flex justify-between font-bold bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100">
                  <span className="text-gray-600 uppercase text-[10px] tracking-widest self-center">TOTAL</span>
                  <span className="text-gray-900 text-base">{formatNumber(gutschriftItems.reduce((s, i) => s + (parseFloat(i.summe) || 0), 0))}</span>
                </div>
              </div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                      <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Summe</th>
                      <th className="border border-gray-300 px-6 py-4 text-center font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gutschriftItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          {item.name}
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                          {item.gruppe}
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                          {item.firma}
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-bold">
                          {formatNumber(item.summe)}
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              navigate(`/bookings/${item.bookingId}?tab=documents&docTab=gutschrift`);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="View Booking"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100 font-bold">
                      <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                        TOTAL
                      </td>
                      <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                        {formatNumber(gutschriftItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0))}
                      </td>
                      <td className="border border-gray-300 px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : activeModule === 'orient' ? (
            <>
              {/* Mobile cards — Orient */}
              {loading ? (
                <div className="sm:hidden flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                  {orientItems.map((item, index) => {
                    const rAmt = (item.name === 'Rechnung' || item.name === 'Neue Rechnung') ? (parseFloat(item.summe) || 0) : 0;
                    const gAmt = item.name === 'Gutschrift' ? (parseFloat(item.summe) || 0) : 0;
                    const tot = rAmt - gAmt;
                    return (
                      <div key={item.id} className="rounded-xl overflow-hidden border border-blue-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(59,130,246,0.08)' }}>
                        <div className="h-0.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-blue-200">{index + 1}</span>
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 text-sm truncate">{item.gruppe}</div>
                                <div className="text-[10px] text-gray-500">{item.name}{item.firma ? ` · ${item.firma}` : ''}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="text-right">
                                <div className="font-bold text-gray-900 text-sm">{formatNumber(tot)}</div>
                                {rAmt > 0 && <div className="text-[10px] text-blue-500 font-medium">R: {formatNumber(rAmt)}</div>}
                                {gAmt > 0 && <div className="text-[10px] text-red-400 font-medium">G: -{formatNumber(gAmt)}</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {orientItems.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Ma'lumot topilmadi</div>}
                  {orientItems.length > 0 && (() => {
                    const tR = orientItems.filter(i => i.name === 'Rechnung' || i.name === 'Neue Rechnung').reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                    const tG = orientItems.filter(i => i.name === 'Gutschrift').reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                    return (
                      <div className="rounded-xl px-3 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                        <div className="flex justify-between font-bold text-gray-900 mb-1">
                          <span className="uppercase text-[10px] tracking-widest text-gray-600 self-center">TOTAL</span>
                          <span className="text-base">{formatNumber(tR - tG)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>Rechnung: {formatNumber(tR)}</span>
                          <span>Gutschrift: -{formatNumber(tG)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Rechnung</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Gutschrift</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orientItems.map((item, index) => {
                        const rechnungAmount = (item.name === 'Rechnung' || item.name === 'Neue Rechnung') ? (parseFloat(item.summe) || 0) : 0;
                        const gutschriftAmount = item.name === 'Gutschrift' ? (parseFloat(item.summe) || 0) : 0;
                        const totalAmount = rechnungAmount - gutschriftAmount;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                              {index + 1}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900">
                              {item.name}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                              {item.gruppe}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900">
                              {item.firma || '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                              {rechnungAmount > 0 ? formatNumber(rechnungAmount) : '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                              {gutschriftAmount > 0 ? formatNumber(gutschriftAmount) : '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-bold">
                              {formatNumber(totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                      {orientItems.length === 0 && (
                        <tr>
                          <td colSpan="7" className="border border-gray-300 px-6 py-8 text-center text-gray-500">
                            Ma'lumot topilmadi
                          </td>
                        </tr>
                      )}
                      {/* Total row */}
                      {orientItems.length > 0 && (() => {
                        const totalRechnung = orientItems.filter(item => item.name === 'Rechnung' || item.name === 'Neue Rechnung').reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0);
                        const totalGutschrift = orientItems.filter(item => item.name === 'Gutschrift').reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0);
                        const grandTotal = totalRechnung - totalGutschrift;

                        return (
                          <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold">
                            <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                              TOTAL
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(totalRechnung)}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(totalGutschrift)}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(grandTotal)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : activeModule === 'infuturestorm' ? (
            <>
              {/* Mobile cards — INFUTURESTORM */}
              {loading ? (
                <div className="sm:hidden flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
                </div>
              ) : (
                <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                  {infuturestormItems.map((item, index) => {
                    const rAmt = (item.name === 'Rechnung' || item.name === 'Neue Rechnung') ? (parseFloat(item.summe) || 0) : 0;
                    const gAmt = item.name === 'Gutschrift' ? (parseFloat(item.summe) || 0) : 0;
                    const tot = rAmt - gAmt;
                    return (
                      <div key={item.id} className="rounded-xl overflow-hidden border border-orange-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(249,115,22,0.08)' }}>
                        <div className="h-0.5 bg-gradient-to-r from-orange-400 to-red-500" />
                        <div className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-orange-200">{index + 1}</span>
                              <div className="min-w-0">
                                <div className="font-bold text-gray-900 text-sm truncate">{item.gruppe}</div>
                                <div className="text-[10px] text-gray-500">{item.name}{item.firma ? ` · ${item.firma}` : ''}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="text-right">
                                <div className="font-bold text-gray-900 text-sm">{formatNumber(tot)}</div>
                                {rAmt > 0 && <div className="text-[10px] text-orange-500 font-medium">R: {formatNumber(rAmt)}</div>}
                                {gAmt > 0 && <div className="text-[10px] text-red-400 font-medium">G: -{formatNumber(gAmt)}</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {infuturestormItems.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Ma'lumot topilmadi</div>}
                  {infuturestormItems.length > 0 && (() => {
                    const tR = infuturestormItems.filter(i => i.name === 'Rechnung' || i.name === 'Neue Rechnung').reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                    const tG = infuturestormItems.filter(i => i.name === 'Gutschrift').reduce((s, i) => s + (parseFloat(i.summe) || 0), 0);
                    return (
                      <div className="rounded-xl px-3 py-2.5 bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100">
                        <div className="flex justify-between font-bold text-gray-900 mb-1">
                          <span className="uppercase text-[10px] tracking-widest text-gray-600 self-center">TOTAL</span>
                          <span className="text-base">{formatNumber(tR - tG)}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>Rechnung: {formatNumber(tR)}</span>
                          <span>Gutschrift: -{formatNumber(tG)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-orange-100 to-red-100">
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                        <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Rechnung</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Gutschrift</th>
                        <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {infuturestormItems.map((item, index) => {
                        const rechnungAmount = (item.name === 'Rechnung' || item.name === 'Neue Rechnung') ? (parseFloat(item.summe) || 0) : 0;
                        const gutschriftAmount = item.name === 'Gutschrift' ? (parseFloat(item.summe) || 0) : 0;
                        const totalAmount = rechnungAmount - gutschriftAmount;

                        return (
                          <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                              {index + 1}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900">
                              {item.name}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900 font-semibold">
                              {item.gruppe}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-gray-900">
                              {item.firma || '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                              {rechnungAmount > 0 ? formatNumber(rechnungAmount) : '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                              {gutschriftAmount > 0 ? formatNumber(gutschriftAmount) : '-'}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-bold">
                              {formatNumber(totalAmount)}
                            </td>
                          </tr>
                        );
                      })}
                      {infuturestormItems.length === 0 && (
                        <tr>
                          <td colSpan="7" className="border border-gray-300 px-6 py-8 text-center text-gray-500">
                            Ma'lumot topilmadi
                          </td>
                        </tr>
                      )}
                      {/* Total row */}
                      {infuturestormItems.length > 0 && (() => {
                        const totalRechnung = infuturestormItems.filter(item => item.name === 'Rechnung' || item.name === 'Neue Rechnung').reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0);
                        const totalGutschrift = infuturestormItems.filter(item => item.name === 'Gutschrift').reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0);
                        const grandTotal = totalRechnung - totalGutschrift;

                        return (
                          <tr className="bg-gradient-to-r from-orange-100 to-red-100 font-bold">
                            <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                              TOTAL
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(totalRechnung)}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(totalGutschrift)}
                            </td>
                            <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                              {formatNumber(grandTotal)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : activeModule === 'shamixon' ? (
            <>
              {/* Add Item button */}
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={handleAddShamixonItem}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>

              {/* Mobile cards — Shamixon (editable) */}
              <div className="sm:hidden px-3 py-2 flex flex-col gap-2">
                {shamixonItems.map((item, index) => {
                  const payAmt = parseFloat(item.gruppe) || 0;
                  const commission = payAmt * 0.01;
                  const transferFee = 50;
                  const incomingPayment = payAmt - commission - transferFee;
                  const serviceFee = parseFloat(item.serviceFee) || 0;
                  const receivedAmt = parseFloat(item.receivedAmount) || 0;
                  const totalAmount = receivedAmt - serviceFee;
                  return (
                    <div key={item.id} className="rounded-xl overflow-hidden border border-purple-100 bg-white" style={{ boxShadow: '0 1px 4px rgba(168,85,247,0.08)' }}>
                      <div className="h-0.5 bg-gradient-to-r from-purple-400 to-pink-500" />
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-bold flex items-center justify-center shrink-0 border border-purple-200">{index + 1}</span>
                            <span className="font-bold text-gray-900 text-sm">{item.name || '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="bg-purple-50 rounded-lg px-2 py-1 border border-purple-100 text-right">
                              <div className="text-[10px] text-purple-600 font-medium">Total</div>
                              <div className="font-bold text-gray-900 text-sm">{formatNumber(totalAmount)}</div>
                            </div>
                            <button onClick={() => handleDeleteShamixonItem(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Date</div>
                            <input type="date" value={item.name || ''} onChange={e => handleUpdateShamixonItem(item.id, 'name', e.target.value)} className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-none" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Income date</div>
                            <input type="date" value={item.firma || ''} onChange={e => handleUpdateShamixonItem(item.id, 'firma', e.target.value)} className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-none" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Payment</div>
                            <input type="text" value={item.gruppe ? formatNumber(parseFloat(item.gruppe)) : ''} onChange={e => { const v = e.target.value.replace(/\s/g, ''); if (v === '' || !isNaN(v)) handleUpdateShamixonItem(item.id, 'gruppe', v); }} className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-none" placeholder="0" />
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Service fee</div>
                            <input type="number" value={item.serviceFee || ''} onChange={e => handleUpdateShamixonItem(item.id, 'serviceFee', parseFloat(e.target.value) || 0)} className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-none" step="0.01" />
                          </div>
                          <div className="bg-purple-50 rounded-lg p-1.5 border border-purple-100">
                            <div className="text-[10px] text-purple-500 font-medium mb-0.5">Commission (1%)</div>
                            <div className="text-xs font-bold text-gray-900">{formatNumber(commission)}</div>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-1.5 border border-purple-100">
                            <div className="text-[10px] text-purple-500 font-medium mb-0.5">Transfer fee</div>
                            <div className="text-xs font-bold text-gray-900">{formatNumber(transferFee)}</div>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-1.5 border border-indigo-100">
                            <div className="text-[10px] text-indigo-500 font-medium mb-0.5">Incoming payment</div>
                            <div className="text-xs font-bold text-gray-900">{formatNumber(incomingPayment)}</div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-1.5 border border-gray-100">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Received</div>
                            <input type="text" value={item.receivedAmount ? formatNumber(parseFloat(item.receivedAmount)) : ''} onChange={e => { const v = e.target.value.replace(/\s/g, ''); if (v === '' || !isNaN(v)) handleUpdateShamixonItem(item.id, 'receivedAmount', v); }} className="w-full bg-transparent text-xs font-semibold text-gray-900 outline-none" placeholder="0" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {shamixonItems.length === 0 && <div className="py-8 text-center text-gray-400 text-sm">Ma'lumot topilmadi</div>}
                {shamixonItems.length > 0 && (() => {
                  let tComm = 0, tFee = 0, tRem = 0, tSvc = 0, tTotal = 0;
                  shamixonItems.forEach(i => { const p = parseFloat(i.gruppe)||0; const c = p*0.01; const f = 50; const inc = p-c-f; const s = parseFloat(i.serviceFee)||0; const r = parseFloat(i.receivedAmount)||0; tComm+=c; tFee+=f; tRem+=(inc-r); tSvc+=s; tTotal+=r-s; });
                  return (
                    <div className="rounded-xl px-3 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
                      <div className="flex justify-between font-bold text-gray-900 mb-1.5">
                        <span className="uppercase text-[10px] tracking-widest text-gray-600 self-center">TOTAL</span>
                        <span className="text-base">{formatNumber(tTotal)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 text-[10px] text-gray-500">
                        <span>Commission: {formatNumber(tComm)}</span>
                        <span>Transfer: {formatNumber(tFee)}</span>
                        <span>Qoldiq: {formatNumber(tRem)}</span>
                        <span>Service: {formatNumber(tSvc)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              {/* Desktop table - Editable */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-100 to-pink-100">
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-16">№</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-32">Date</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-32">Payment</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-28">Commission</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-28">Transfer fee</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-32">Incoming payment</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-32">Received</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-32">Income date</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-24">Service fee</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-28">Total</th>
                      <th className="border border-gray-300 px-3 py-4 text-center font-bold text-gray-900 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shamixonItems.map((item, index) => {
                      const paymentAmount = parseFloat(item.gruppe) || 0;
                      const commission = paymentAmount * 0.01;
                      const transferFee = 50;
                      const incomingPayment = paymentAmount - commission - transferFee;
                      const serviceFee = parseFloat(item.serviceFee) || 0;
                      const receivedAmt = parseFloat(item.receivedAmount) || 0;
                      const totalAmount = receivedAmt - serviceFee;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="border border-gray-300 px-3 py-4 text-gray-900 font-semibold">
                            {index + 1}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-gray-900">
                            <input
                              type="date"
                              value={item.name || ''}
                              onChange={(e) => handleUpdateShamixonItem(item.id, 'name', e.target.value)}
                              className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-gray-900">
                            <input
                              type="text"
                              value={item.gruppe ? formatNumber(parseFloat(item.gruppe)) : ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\s/g, '');
                                if (value === '' || !isNaN(value)) {
                                  handleUpdateShamixonItem(item.id, 'gruppe', value);
                                }
                              }}
                              className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                              placeholder="Enter payment amount"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 font-semibold bg-gray-50">
                            {formatNumber(commission)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 font-semibold bg-gray-50">
                            {formatNumber(transferFee)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 font-semibold bg-gray-50">
                            {formatNumber(incomingPayment)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            <input
                              type="text"
                              value={item.receivedAmount ? formatNumber(parseFloat(item.receivedAmount)) : ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\s/g, '');
                                if (value === '' || !isNaN(value)) {
                                  handleUpdateShamixonItem(item.id, 'receivedAmount', value);
                                }
                              }}
                              className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1"
                              placeholder="0"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-gray-900">
                            <input
                              type="date"
                              value={item.firma || ''}
                              onChange={(e) => handleUpdateShamixonItem(item.id, 'firma', e.target.value)}
                              className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 font-semibold">
                            <input
                              type="number"
                              value={item.serviceFee || ''}
                              onChange={(e) => handleUpdateShamixonItem(item.id, 'serviceFee', parseFloat(e.target.value) || 0)}
                              className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1"
                              step="0.01"
                            />
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 font-bold">
                            {formatNumber(totalAmount)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {/* Cells are already editable */}}
                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteShamixonItem(item.id)}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    {shamixonItems.length > 0 && (() => {
                      let totalCommission = 0;
                      let totalTransferFee = 0;
                      let totalRemaining = 0;
                      let totalServiceFee = 0;
                      let grandTotal = 0;

                      shamixonItems.forEach(item => {
                        const paymentAmount = parseFloat(item.gruppe) || 0;
                        const commission = paymentAmount * 0.01;
                        const transferFee = 50;
                        const incomingPayment = paymentAmount - commission - transferFee;
                        const serviceFee = parseFloat(item.serviceFee) || 0;
                        const receivedAmt = parseFloat(item.receivedAmount) || 0;
                        const total = receivedAmt - serviceFee;

                        totalCommission += commission;
                        totalTransferFee += transferFee;
                        totalRemaining += (incomingPayment - receivedAmt);
                        totalServiceFee += serviceFee;
                        grandTotal += total;
                      });

                      return (
                        <tr className="bg-gradient-to-r from-purple-100 to-pink-100 font-bold">
                          <td className="border border-gray-300 px-3 py-4 text-gray-900" colSpan="3">
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            {formatNumber(totalCommission)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            {formatNumber(totalTransferFee)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900 text-orange-700">
                            {formatNumber(totalRemaining)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-gray-900"></td>
                          <td className="border border-gray-300 px-3 py-4 text-gray-900"></td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            {formatNumber(totalServiceFee)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            {formatNumber(grandTotal)}
                          </td>
                          <td className="border border-gray-300 px-3 py-4"></td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-8">
              <div className="text-center py-16">
                <Icon className="w-24 h-24 mx-auto text-gray-300 mb-6" />
                <h2 className="text-2xl font-bold text-gray-700 mb-2">
                  {activeModuleData?.name} Modul
                </h2>
                <p className="text-gray-500">
                  Dieser Bereich wird bald verfügbar sein
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
