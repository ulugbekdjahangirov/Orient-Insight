{/* NEW AUSGABEN TAB - SIMPLE VERSION */}
{costsTab === 'ausgaben' && (
  <div className="mt-6">
    {/* Header */}
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-900">Ausgaben</h2>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-gray-600">Gruppe:</span>
            <span className="ml-2 font-bold text-gray-900">{booking?.bookingNumber || '-'}</span>
          </div>
          <div>
            <span className="text-gray-600">Personen:</span>
            <span className="ml-2 font-bold text-gray-900">{tourists.length}</span>
          </div>
        </div>
      </div>
    </div>

    {/* Main Table */}
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <th className="border-2 border-gray-900 px-4 py-3 text-left font-bold">Städte</th>
              <th className="border-2 border-gray-900 px-4 py-3 text-right font-bold">Preis</th>
              <th className="border-2 border-gray-900 px-4 py-3 text-center font-bold">PAX</th>
              <th className="border-2 border-gray-900 px-4 py-3 text-right font-bold">Dollar</th>
              <th className="border-2 border-gray-900 px-4 py-3 text-right font-bold">Som</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows = [];
              const pax = tourists.length;
              let totalUSD = 0;
              let totalUZS = 0;

              // TASHKENT SECTION
              rows.push(
                <tr key="tashkent-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    TASHKENT
                  </td>
                </tr>
              );

              // SAMARKAND SECTION
              rows.push(
                <tr key="samarkand-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    SAMARKAND
                  </td>
                </tr>
              );

              // ASRAF SECTION
              rows.push(
                <tr key="asraf-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    ASRAF
                  </td>
                </tr>
              );

              // NUROTA SECTION
              rows.push(
                <tr key="nurota-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    NUROTA
                  </td>
                </tr>
              );

              // BUKHARA SECTION
              rows.push(
                <tr key="bukhara-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    BUKHARA
                  </td>
                </tr>
              );

              // KHIVA SECTION
              rows.push(
                <tr key="khiva-header" className="bg-emerald-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    KHIVA
                  </td>
                </tr>
              );

              // TRANSPORT SECTION
              rows.push(
                <tr key="transport-header" className="bg-blue-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    TRANSPORT
                  </td>
                </tr>
              );

              // REISELEITER SECTION
              rows.push(
                <tr key="reiseleiter-header" className="bg-blue-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    REISELEITER
                  </td>
                </tr>
              );

              // RAILWAY & FLIGHTS SECTION
              rows.push(
                <tr key="railway-header" className="bg-blue-500">
                  <td colSpan="5" className="border-2 border-gray-900 px-4 py-2 font-bold text-center text-white text-lg">
                    RAILWAY & FLIGHTS
                  </td>
                </tr>
              );

              // TOTAL ROW
              rows.push(
                <tr key="total" className="bg-gradient-to-r from-blue-600 to-blue-700">
                  <td colSpan="3" className="border-2 border-gray-900 px-4 py-3 text-right text-white font-bold text-xl">
                    TOTAL
                  </td>
                  <td className="border-2 border-gray-900 px-4 py-3 text-right text-white font-bold text-xl">
                    {totalUSD > 0 ? `$${totalUSD.toLocaleString()}` : '-'}
                  </td>
                  <td className="border-2 border-gray-900 px-4 py-3 text-right text-white font-bold text-xl">
                    {totalUZS > 0 ? totalUZS.toLocaleString() : '-'}
                  </td>
                </tr>
              );

              return rows;
            })()}
          </tbody>
        </table>
      </div>
    </div>
  </div>
)}
