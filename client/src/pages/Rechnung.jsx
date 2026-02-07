import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Receipt, Building, Globe, Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
import { invoicesApi } from '../services/api';
import { toast } from 'react-hot-toast';

const modules = [
  { id: 'rechnung', name: 'Rechnung', color: 'amber', icon: FileText },
  { id: 'gutschrift', name: 'Gutschrift', color: 'emerald', icon: Receipt },
  { id: 'orient', name: 'Orient', color: 'blue', icon: Building },
  { id: 'infuturestorm', name: 'INFUTURESTORM', color: 'orange', icon: Globe },
  { id: 'er', name: 'ER', color: 'blue', icon: FileText },
  { id: 'co', name: 'CO', color: 'emerald', icon: FileText },
  { id: 'kas', name: 'KAS', color: 'orange', icon: FileText },
  { id: 'za', name: 'ZA', color: 'purple', icon: FileText },
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
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('rechnung');
  const [rechnungItems, setRechnungItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gutschriftItems, setGutschriftItems] = useState([]);
  const [orientItems, setOrientItems] = useState([]);
  const [infuturestormItems, setInfuturestormItems] = useState([]);

  const activeModuleData = modules.find(m => m.id === activeModule);
  const Icon = activeModuleData?.icon || FileText;

  // Load invoices from API when activeModule changes
  useEffect(() => {
    loadInvoices();
  }, [activeModule]);

  const loadInvoices = async () => {
    try {
      setLoading(true);

      // Determine filter params based on activeModule
      const params = {};
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

  // Add new item - Orient
  const handleAddOrientItem = () => {
    const newId = Math.max(...orientItems.map(i => i.id), 0) + 1;
    const newItem = {
      id: newId,
      nummer: newId.toString(),
      name: 'Neue Orient',
      gruppe: 'ER',
      firma: '',
      summe: 0.00
    };
    setOrientItems([...orientItems, newItem]);
  };

  // Delete item - Orient
  const handleDeleteOrientItem = (id) => {
    setOrientItems(orientItems.filter(item => item.id !== id));
  };

  // Update item - Orient
  const handleUpdateOrientItem = (id, field, value) => {
    setOrientItems(orientItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Add new item - INFUTURESTORM
  const handleAddInfuturestormItem = () => {
    const newId = Math.max(...infuturestormItems.map(i => i.id), 0) + 1;
    const newItem = {
      id: newId,
      nummer: newId.toString(),
      name: 'Neue INFUTURESTORM',
      gruppe: 'ER',
      firma: '',
      summe: 0.00
    };
    setInfuturestormItems([...infuturestormItems, newItem]);
  };

  // Delete item - INFUTURESTORM
  const handleDeleteInfuturestormItem = (id) => {
    setInfuturestormItems(infuturestormItems.filter(item => item.id !== id));
  };

  // Update item - INFUTURESTORM
  const handleUpdateInfuturestormItem = (id, field, value) => {
    setInfuturestormItems(infuturestormItems.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
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
                Rechnung - {activeModuleData?.name}
              </h1>
              <p className="text-gray-600 mt-1">
                Rechnungsverwaltung und Übersicht
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
                onClick={() => setActiveModule(module.id)}
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
                            {item.summe.toFixed(2)}
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
                            {rechnungItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0).toFixed(2)}
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
                          {(parseFloat(item.summe) || 0).toFixed(2)}
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
                        {gutschriftItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : activeModule === 'orient' ? (
            <>
              {/* Add Item button */}
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={handleAddOrientItem}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100">
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                      <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Summe</th>
                      <th className="border border-gray-300 px-6 py-4 text-center font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orientItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.nummer}
                            onChange={(e) => handleUpdateOrientItem(item.id, 'nummer', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateOrientItem(item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <select
                            value={item.gruppe}
                            onChange={(e) => handleUpdateOrientItem(item.id, 'gruppe', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          >
                            <option value="ER">ER</option>
                            <option value="CO">CO</option>
                            <option value="KAS">KAS</option>
                            <option value="ZA">ZA</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.firma}
                            onChange={(e) => handleUpdateOrientItem(item.id, 'firma', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                          <input
                            type="number"
                            value={item.summe}
                            onChange={(e) => handleUpdateOrientItem(item.id, 'summe', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1"
                            step="0.01"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {/* Edit action - cells are already editable */}}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrientItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold">
                      <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                        TOTAL
                      </td>
                      <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                        {orientItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : activeModule === 'infuturestorm' ? (
            <>
              {/* Add Item button */}
              <div className="p-6 border-b border-gray-200">
                <button
                  onClick={handleAddInfuturestormItem}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-orange-100 to-red-100">
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                      <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Firma</th>
                      <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Summe</th>
                      <th className="border border-gray-300 px-6 py-4 text-center font-bold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {infuturestormItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.nummer}
                            onChange={(e) => handleUpdateInfuturestormItem(item.id, 'nummer', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateInfuturestormItem(item.id, 'name', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <select
                            value={item.gruppe}
                            onChange={(e) => handleUpdateInfuturestormItem(item.id, 'gruppe', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          >
                            <option value="ER">ER</option>
                            <option value="CO">CO</option>
                            <option value="KAS">KAS</option>
                            <option value="ZA">ZA</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-gray-900">
                          <input
                            type="text"
                            value={item.firma}
                            onChange={(e) => handleUpdateInfuturestormItem(item.id, 'firma', e.target.value)}
                            className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">
                          <input
                            type="number"
                            value={item.summe}
                            onChange={(e) => handleUpdateInfuturestormItem(item.id, 'summe', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1"
                            step="0.01"
                          />
                        </td>
                        <td className="border border-gray-300 px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {/* Edit action - cells are already editable */}}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteInfuturestormItem(item.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="bg-gradient-to-r from-orange-100 to-red-100 font-bold">
                      <td className="border border-gray-300 px-6 py-4 text-gray-900" colSpan="4">
                        TOTAL
                      </td>
                      <td className="border border-gray-300 px-6 py-4 text-right text-gray-900">
                        {infuturestormItems.reduce((sum, item) => sum + (parseFloat(item.summe) || 0), 0).toFixed(2)}
                      </td>
                      <td className="border border-gray-300 px-6 py-4"></td>
                    </tr>
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
