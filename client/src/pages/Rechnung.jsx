import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Receipt, Building, Globe, Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
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

      // Special handling for Shamixon module - load from localStorage
      if (activeModule === 'shamixon') {
        const savedItems = localStorage.getItem('shamixonItems');
        if (savedItems) {
          setShamixonItems(JSON.parse(savedItems));
        } else {
          setShamixonItems([]);
        }
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
      serviceFee: 0.00
    };
    const updatedItems = [...shamixonItems, newItem];
    setShamixonItems(updatedItems);
    localStorage.setItem('shamixonItems', JSON.stringify(updatedItems));
  };

  // Delete item - Shamixon
  const handleDeleteShamixonItem = (id) => {
    const updatedItems = shamixonItems.filter(item => item.id !== id);
    setShamixonItems(updatedItems);
    localStorage.setItem('shamixonItems', JSON.stringify(updatedItems));
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
    localStorage.setItem('shamixonItems', JSON.stringify(updatedItems));
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 bg-gradient-to-br ${colorClasses[activeModuleData?.color || 'amber'].bg} rounded-2xl shadow-lg`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className={`text-4xl font-bold bg-gradient-to-r ${colorClasses[activeModuleData?.color || 'amber'].text} bg-clip-text text-transparent`}>
                Invoice - {activeModuleData?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Invoice Management and Overview
              </p>
            </div>
          </div>
        </div>

        {/* Module tabs */}
        <div className="mb-6 flex flex-wrap gap-3">
          {modules.map((module) => {
            const ModuleIcon = module.icon;
            const isActive = activeModule === module.id;
            const colors = colorClasses[module.color];

            return (
              <button
                key={module.id}
                onClick={() => handleModuleChange(module.id)}
                className={`flex items-center gap-2.5 px-6 py-3 text-sm font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl ${
                  isActive
                    ? `${colors.active} ${colors.hover} text-white scale-105`
                    : 'bg-white text-gray-700 hover:bg-gray-50 hover:scale-105 border border-gray-200'
                }`}
              >
                <ModuleIcon className="w-5 h-5" />
                {module.name}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          {activeModule === 'rechnung' ? (
            <>
              {/* Table - Read-only view of bookings */}
              <div className="overflow-x-auto">
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
                        <th className="border border-gray-300 px-6 py-4 text-center font-bold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rechnungItems.map((item, index) => (
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
                            {formatNumber(item.summe)}
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
                          <td colSpan="6" className="border border-gray-300 px-6 py-8 text-center text-gray-500">
                            Ma'lumot topilmadi
                          </td>
                        </tr>
                      )}
                      {/* Total row */}
                      {rechnungItems.length > 0 && (
                        <tr className="bg-gradient-to-r from-amber-100 to-orange-100 font-bold">
                          <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                            TOTAL
                          </td>
                          <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                            {formatNumber(rechnungItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0))}
                          </td>
                          <td className="border border-gray-300 px-6 py-4"></td>
                        </tr>
                      )}
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

              {/* Table */}
              <div className="overflow-x-auto">
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
              {/* Table - Read-only view matching Invoice module */}
              <div className="overflow-x-auto">
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
              {/* Table - Read-only view matching Invoice module */}
              <div className="overflow-x-auto">
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

              {/* Table - Editable */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-100 to-pink-100">
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-16">№</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-32">Date</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-32">Payment</th>
                      <th className="border border-gray-300 px-3 py-4 text-left font-bold text-gray-900 w-28">Commission</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-28">Transfer fee</th>
                      <th className="border border-gray-300 px-3 py-4 text-right font-bold text-gray-900 w-32">Incoming payment</th>
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
                      const totalAmount = incomingPayment - serviceFee;

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
                      let totalIncomingPayment = 0;
                      let totalServiceFee = 0;
                      let grandTotal = 0;

                      shamixonItems.forEach(item => {
                        const paymentAmount = parseFloat(item.gruppe) || 0;
                        const commission = paymentAmount * 0.01;
                        const transferFee = 50;
                        const incomingPayment = paymentAmount - commission - transferFee;
                        const serviceFee = parseFloat(item.serviceFee) || 0;
                        const total = incomingPayment - serviceFee;

                        totalCommission += commission;
                        totalTransferFee += transferFee;
                        totalIncomingPayment += incomingPayment;
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
                          <td className="border border-gray-300 px-3 py-4 text-right text-gray-900">
                            {formatNumber(totalIncomingPayment)}
                          </td>
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
