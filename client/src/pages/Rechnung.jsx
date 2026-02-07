import { FileText } from 'lucide-react';

export default function Rechnung() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Rechnung
              </h1>
              <p className="text-gray-600 mt-1">
                Rechnungsverwaltung und Übersicht
              </p>
            </div>
          </div>
        </div>

        {/* Content placeholder */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center py-16">
            <FileText className="w-24 h-24 mx-auto text-gray-300 mb-6" />
            <h2 className="text-2xl font-bold text-gray-700 mb-2">
              Rechnung Bereich
            </h2>
            <p className="text-gray-500">
              Dieser Bereich wird bald verfügbar sein
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
