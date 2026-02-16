import { useIsMobile } from '../../hooks/useMediaQuery';

/**
 * ResponsiveTable Component
 * Automatically switches between desktop table view and mobile card view
 *
 * @param {Array} columns - Column definitions: [{ key, label, render?, className?, hideOnMobile? }]
 * @param {Array} data - Array of data objects
 * @param {boolean} mobileCardView - Enable card view on mobile (default: true)
 * @param {boolean} stickyHeader - Make header sticky (default: true)
 * @param {Function} renderMobileCard - Custom mobile card renderer (optional)
 * @param {string} keyExtractor - Key property for mapping (default: 'id')
 */
export default function ResponsiveTable({
  columns,
  data,
  mobileCardView = true,
  stickyHeader = true,
  renderMobileCard,
  keyExtractor = 'id',
  emptyMessage = 'No data available',
}) {
  const isMobile = useIsMobile();

  // Mobile card view
  if (isMobile && mobileCardView) {
    if (data.length === 0) {
      return (
        <div className="bg-white rounded-lg p-8 text-center text-gray-500">
          {emptyMessage}
        </div>
      );
    }

    // Use custom renderer if provided
    if (renderMobileCard) {
      return (
        <div className="space-y-3">
          {data.map((row, index) => (
            <div key={row[keyExtractor] || index}>
              {renderMobileCard(row, index)}
            </div>
          ))}
        </div>
      );
    }

    // Default card renderer
    return (
      <div className="space-y-3">
        {data.map((row, index) => (
          <div
            key={row[keyExtractor] || index}
            className="bg-white rounded-lg p-4 shadow border border-gray-200 space-y-3"
          >
            {columns
              .filter((col) => !col.hideOnMobile)
              .map((col) => (
                <div key={col.key} className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-600">
                    {col.label}:
                  </span>
                  <span className="text-sm text-gray-900 text-right ml-2">
                    {col.render ? col.render(row) : row[col.key]}
                  </span>
                </div>
              ))}
          </div>
        ))}
      </div>
    );
  }

  // Desktop table view with horizontal scroll
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`bg-gray-50 border-b border-gray-200 ${stickyHeader ? 'sticky top-0' : ''}`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.headerClassName || ''
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={row[keyExtractor] || index}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-6 py-4 whitespace-nowrap ${col.className || ''}`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
