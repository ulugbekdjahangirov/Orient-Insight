import { useState } from 'react';
import { FileText, Receipt, Building, Globe } from 'lucide-react';

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
  const [activeModule, setActiveModule] = useState('rechnung');

  const activeModuleData = modules.find(m => m.id === activeModule);
  const Icon = activeModuleData?.icon || FileText;

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
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-amber-100 to-orange-100">
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Nummer</th>
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Name</th>
                    <th className="border border-gray-300 px-6 py-4 text-left font-bold text-gray-900">Gruppe</th>
                    <th className="border border-gray-300 px-6 py-4 text-right font-bold text-gray-900">Summe</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sample data - replace with real data later */}
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">1</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">Beispiel Rechnung 1</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">ER</td>
                    <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">€ 1,250.00</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">2</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">Beispiel Rechnung 2</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">CO</td>
                    <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">€ 2,150.00</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">3</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">Beispiel Rechnung 3</td>
                    <td className="border border-gray-300 px-6 py-4 text-gray-900">KAS</td>
                    <td className="border border-gray-300 px-6 py-4 text-right text-gray-900 font-semibold">€ 3,450.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
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
