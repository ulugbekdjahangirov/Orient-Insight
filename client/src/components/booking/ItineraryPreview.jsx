import { useState, useEffect, useRef } from 'react';
import { bookingsApi, touristsApi, hotelsApi } from '../../services/api';
import { routesApi, railwaysApi, flightsApi } from '../../services/api';
import toast from 'react-hot-toast';
import { MapPin, Printer, Loader2, Edit, Save, X, Download, Plus, Trash2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ItineraryPreview({ bookingId, booking }) {
  const [routes, setRoutes] = useState([]);
  const [railways, setRailways] = useState([]);
  const [flights, setFlights] = useState([]);
  const [tourists, setTourists] = useState([]);
  const [bookingRooms, setBookingRooms] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRoute, setEditingRoute] = useState(null);
  const [editingRailway, setEditingRailway] = useState(null);
  const [editingFlight, setEditingFlight] = useState(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerData, setHeaderData] = useState({
    nosirContact: 'Nosir aka (+998 91 151 11 10) Farg\'ona',
    sevilContact: 'Sevil aka (+998 90 445 10 92) Marshrutda',
    xayrullaContact: 'Xayrulla (+998 93 133 00 03) Toshkentda',
    country: 'Germaniya',
    guideName: 'Zokir Saidov',
    guidePhone: '+998 97 929 03 85'
  });
  const printRef = useRef(null);

  useEffect(() => {
    loadItineraryData();
    // Load header data from localStorage
    const savedHeader = localStorage.getItem(`itinerary-header-${bookingId}`);
    if (savedHeader) {
      setHeaderData(JSON.parse(savedHeader));
    }
  }, [bookingId]);

  // Generate array of dates between start and end date
  const generateDateRange = (startDate, endDate) => {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(new Date(date).toISOString().split('T')[0]);
    }

    return dates;
  };

  const loadItineraryData = async () => {
    try {
      setLoading(true);

      // Load routes (fresh from database)
      const routesRes = await bookingsApi.getRoutes(bookingId);
      let loadedRoutes = routesRes.data.routes || [];

      console.log('📥 [LOAD] Loaded routes from DATABASE:', loadedRoutes.map(r => ({
        id: r.id,
        date: r.date,
        routeName: r.routeName,
        hasItinerary: !!r.itinerary
      })));

      // Merge with localStorage backup (restore any custom itinerary data)
      try {
        const storageKey = `itinerary-data-${bookingId}`;
        const localData = JSON.parse(localStorage.getItem(storageKey) || '{}');

        if (Object.keys(localData).length > 0) {
          console.log('📥 [LOAD] Found localStorage backup, merging...');

          loadedRoutes = loadedRoutes.map(route => {
            const localBackup = localData[route.id];

            // If localStorage has data for this route AND it's newer/different
            if (localBackup && localBackup.routeName === route.routeName) {
              // Restore itinerary from localStorage if database is empty
              if (!route.itinerary && localBackup.itinerary) {
                console.log(`✅ [LOAD] Restored itinerary for route ${route.id} from localStorage`);
                return {
                  ...route,
                  itinerary: localBackup.itinerary
                };
              }
            }

            return route;
          });

          console.log('✅ [LOAD] localStorage merge complete');
        } else {
          console.log('📥 [LOAD] No localStorage backup found (this is normal for new bookings)');
        }
      } catch (storageError) {
        console.warn('⚠️  [LOAD] localStorage read failed (non-critical):', storageError);
        // Continue without localStorage data
      }

      // Load tourists to get actual date range from Final List
      const touristsRes = await touristsApi.getAll(bookingId);
      const touristsData = touristsRes.data.tourists || [];

      // Calculate actual date range from tourists' check-in/out dates (CRITICAL for ER groups)
      let actualStartDate = null;
      let actualEndDate = null;

      if (touristsData.length > 0) {
        const dates = touristsData
          .filter(t => t.checkInDate && t.checkOutDate)
          .map(t => ({
            checkIn: new Date(t.checkInDate),
            checkOut: new Date(t.checkOutDate)
          }));

        if (dates.length > 0) {
          actualStartDate = new Date(Math.min(...dates.map(d => d.checkIn.getTime())));
          actualEndDate = new Date(Math.max(...dates.map(d => d.checkOut.getTime())));
          console.log('✅ Using Final List dates:', actualStartDate.toISOString().split('T')[0], 'to', actualEndDate.toISOString().split('T')[0]);
        } else {
          console.log('⚠️  No tourists with check-in/out dates, using booking dates as fallback');
          actualStartDate = booking?.departureDate ? new Date(booking.departureDate) : null;
          actualEndDate = booking?.endDate ? new Date(booking.endDate) : null;
        }
      } else {
        console.log('⚠️  No tourists found, using booking dates');
        actualStartDate = booking?.departureDate ? new Date(booking.departureDate) : null;
        actualEndDate = booking?.endDate ? new Date(booking.endDate) : null;
      }

      // Auto-generate routes ONLY if completely empty (not if incomplete)
      // DO NOT reload if routes exist - this preserves user-edited "Sayohat dasturi" field
      const expectedDays = actualStartDate && actualEndDate
        ? Math.ceil((actualEndDate - actualStartDate) / (1000 * 60 * 60 * 24)) + 1
        : 0;

      const shouldReload = loadedRoutes.length === 0; // ONLY reload if completely empty

      if (actualStartDate && actualEndDate && shouldReload) {
        console.log(`Routes are ${loadedRoutes.length === 0 ? 'empty' : 'incomplete'}, loading from template...`);

        // Try to load from template first (for all tour types: ER, CO, KAS, ZA)
        let templateLoaded = false;
        if (booking?.tourType) {
          try {
            const templateRes = await routesApi.getTemplate(booking.tourType);
            const templates = templateRes.data.templates || [];

            if (templates.length > 0) {
              console.log(`Loading ${templates.length} routes from ${booking.tourType} template...`);

              // Delete existing routes if corrupt
              if (loadedRoutes.length > 0) {
                for (const route of loadedRoutes) {
                  await routesApi.delete(bookingId, route.id);
                }
              }

              // Calculate date range from ACTUAL tourist dates (Final List)
              const expectedDates = generateDateRange(
                actualStartDate.toISOString().split('T')[0],
                actualEndDate.toISOString().split('T')[0]
              );

              // Create routes from template (PRESERVE any existing custom itinerary data!)
              for (let i = 0; i < templates.length && i < expectedDates.length; i++) {
                const template = templates[i];

                // Check if there's a localStorage backup for this day number
                let customItinerary = '';
                try {
                  const storageKey = `itinerary-data-${bookingId}`;
                  const localData = JSON.parse(localStorage.getItem(storageKey) || '{}');

                  // Find matching route by routeName
                  const matchingBackup = Object.values(localData).find(
                    backup => backup.routeName === template.routeName
                  );

                  if (matchingBackup && matchingBackup.itinerary) {
                    customItinerary = matchingBackup.itinerary;
                    console.log(`🔄 [TEMPLATE] Preserved custom itinerary for day ${i + 1}: ${template.routeName}`);
                  }
                } catch (err) {
                  console.warn('⚠️  [TEMPLATE] Could not check localStorage backup');
                }

                const newRoute = {
                  dayNumber: i + 1,
                  date: expectedDates[i],
                  routeName: template.routeName || '',
                  city: template.city || '',
                  itinerary: customItinerary || template.itinerary || '', // CUSTOM DATA FIRST, then template
                  transportType: '',
                  provider: template.provider || ''
                };
                await routesApi.create(bookingId, newRoute);
              }

              templateLoaded = true;
              toast.success(`Шаблондан ${templates.length} та маршрут юкланди (Final List sanalariga asosan)`);
            }
          } catch (error) {
            console.log('No template found, will generate empty routes');
          }
        }

        // If no template, generate empty routes
        if (!templateLoaded) {
          console.log('Generating empty routes from booking dates...');
          const expectedDates = generateDateRange(booking.arrivalDate, booking.endDate);

          for (const date of expectedDates) {
            const newRoute = {
              dayNumber: 0,
              date: date,
              routeName: '',
              city: '',
              itinerary: '',
              transportType: '',
              provider: ''
            };
            await routesApi.create(bookingId, newRoute);
          }
        }

        // Reload routes after creating
        const updatedRoutesRes = await bookingsApi.getRoutes(bookingId);
        loadedRoutes = updatedRoutesRes.data.routes || [];
      }

      // Create a NEW array and sort it (important for React to detect state change)
      // Special sorting for Marshrut varaqasi table:
      // 1. First 3 Tashkent routes at the beginning (City Tour, Chimgan, Hotel-Vokzal)
      // 2. Middle routes (Samarkand, Bukhara, Khiva)
      // 3. Last 2 Tashkent routes at the end (Mahalliy Aeroport-Hotel, Hotel- Mahalliy Aeroport)

      const sortedRoutes = [...loadedRoutes].sort((a, b) => {
        const routeA = (a.routeName || '').toLowerCase();
        const routeB = (b.routeName || '').toLowerCase();

        // Simplified categorization based on routeName (not city field!)
        const getCategory = (routeName) => {
          console.log(`🔍 Checking route: "${routeName}"`);

          // Check if it's a Tashkent route (routeName contains "tashkent")
          if (!routeName.includes('tashkent')) {
            console.log(`  → middle (not Tashkent route)`);
            return 'middle';  // Non-Tashkent routes in middle
          }

          // First 3 Tashkent routes (by routeName pattern)
          if (routeName.includes('city tour')) {
            console.log(`  → first (city tour)`);
            return 'first';
          }
          if (routeName.includes('chimgan')) {
            console.log(`  → first (chimgan)`);
            return 'first';
          }
          if (routeName.includes('vokzal')) {
            console.log(`  → first (vokzal)`);
            return 'first';
          }

          // Last 2 Tashkent routes (airport pickup/dropoff)
          if (routeName.includes('aeroport') || routeName.includes('aeroporti')) {
            console.log(`  → last (aeroport)`);
            return 'last';
          }

          // Other Tashkent routes
          console.log(`  → middle (other Tashkent route)`);
          return 'middle';
        };

        const catA = getCategory(routeA);
        const catB = getCategory(routeB);

        // Category order: first < middle < last
        const catOrder = { first: 1, middle: 2, last: 3 };

        if (catOrder[catA] !== catOrder[catB]) {
          return catOrder[catA] - catOrder[catB];
        }

        // Within same category, sort by date
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const dateDiff = dateA - dateB;

        if (dateDiff !== 0) {
          return dateDiff;
        }

        // Same date: sort by ID
        return a.id - b.id;
      });

      console.log('📋 MARSHRUTNIY SORTED:', sortedRoutes.map((r, i) => `${i+1}. ${r.routeName} (city: ${r.city}, itinerary: ${r.itinerary ? 'set' : 'empty'})`));

      console.log('Routes AFTER sorting:', sortedRoutes.map(r => ({
        id: r.id,
        date: r.date?.split('T')[0],
        routeName: r.routeName || 'empty'
      })));

      // Force state update with new array reference
      setRoutes(sortedRoutes);

      // Load railways
      const railwaysRes = await bookingsApi.getRailways(bookingId);
      setRailways(railwaysRes.data.railways || []);

      // Load flights
      const flightsRes = await bookingsApi.getFlights(bookingId);
      const loadedFlights = flightsRes.data.flights || [];
      console.log('Loaded flights:', loadedFlights);
      setFlights(loadedFlights);

      // Tourists already loaded above for date calculation, just set state
      setTourists(touristsData || []);

      // Load hotels from Costs -> Accommodations
      const accommodationsRes = await bookingsApi.getAccommodations(bookingId);
      const accommodations = accommodationsRes.data.accommodations || [];

      // Convert accommodations to bookingRooms format
      const roomsFromAccommodations = accommodations.map(acc => ({
        id: acc.id,
        hotelId: acc.hotelId,
        hotel: acc.hotel,
        checkInDate: acc.checkInDate,
        checkOutDate: acc.checkOutDate
      }));
      setBookingRooms(roomsFromAccommodations);

      // Load hotels list for phone numbers
      const hotelsRes = await hotelsApi.getAll();
      setHotels(hotelsRes.data.hotels || []);
    } catch (error) {
      console.error('Error loading itinerary:', error);
      toast.error('Ошибка загрузки маршрута');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Translate route names from English to Uzbek for Marshrut varaqasi display
  // Note: Route names are now already in Uzbek, so this function just returns them as-is
  const translateRouteToUzbek = (routeName) => {
    if (!routeName) return '';

    // Route names are now stored in Uzbek in the database
    // Just return them as-is (no translation needed)
    return routeName;
  };

  // Transliteration function for Cyrillic to Latin
  const transliterate = (text) => {
    if (!text) return '';
    const map = {
      'А': 'A', 'а': 'a', 'Б': 'B', 'б': 'b', 'В': 'V', 'в': 'v',
      'Г': 'G', 'г': 'g', 'Д': 'D', 'д': 'd', 'Е': 'E', 'е': 'e',
      'Ё': 'Yo', 'ё': 'yo', 'Ж': 'Zh', 'ж': 'zh', 'З': 'Z', 'з': 'z',
      'И': 'I', 'и': 'i', 'Й': 'Y', 'й': 'y', 'К': 'K', 'к': 'k',
      'Л': 'L', 'л': 'l', 'М': 'M', 'м': 'm', 'Н': 'N', 'н': 'n',
      'О': 'O', 'о': 'o', 'П': 'P', 'п': 'p', 'Р': 'R', 'р': 'r',
      'С': 'S', 'с': 's', 'Т': 'T', 'т': 't', 'У': 'U', 'у': 'u',
      'Ф': 'F', 'ф': 'f', 'Х': 'X', 'х': 'x', 'Ц': 'Ts', 'ц': 'ts',
      'Ч': 'Ch', 'ч': 'ch', 'Ш': 'Sh', 'ш': 'sh', 'Щ': 'Shch', 'щ': 'shch',
      'Ъ': '', 'ъ': '', 'Ы': 'Y', 'ы': 'y', 'Ь': '', 'ь': '',
      'Э': 'E', 'э': 'e', 'Ю': 'Yu', 'ю': 'yu', 'Я': 'Ya', 'я': 'ya',
      'Ғ': 'G\'', 'ғ': 'g\'', 'Қ': 'Q', 'қ': 'q', 'Ў': 'O\'', 'ў': 'o\'',
      'Ҳ': 'H', 'ҳ': 'h'
    };
    return text.split('').map(char => map[char] || char).join('');
  };

  // Export to PDF function
  // provider: 'all', 'xayrulla', 'sevil'
  const exportToPDF = (provider = 'all') => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let yPos = 20;

      // Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      const title = provider === 'xayrulla'
        ? 'Marshrut varaqasi (Xayrulla)'
        : provider === 'sevil'
        ? 'Marshrut varaqasi (Sevil)'
        : 'Marshrut varaqasi';
      doc.text(title, 105, yPos, { align: 'center' });
      yPos += 7;

      // Header - Transport contacts + Group info
      const headerRows = [
        ['Transport turi', '', 'Gruppa', booking?.bookingNumber || ''],
        [transliterate(headerData.nosirContact), '', 'Davlat', transliterate(headerData.country)],
        [transliterate(headerData.sevilContact), '', 'Turistlar soni', tourists.length.toString()],
        [transliterate(headerData.xayrullaContact), '', `gid: ${transliterate(headerData.guideName)}`, headerData.guidePhone]
      ];

      autoTable(doc, {
        startY: yPos,
        body: headerRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.3 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 10 },
          2: { cellWidth: 45 },
          3: { cellWidth: 55 }
        },
        didParseCell: function(data) {
          // Xayrulla row (row index 3, which is index 2 in 0-based)
          if (data.row.index === 2 && data.column.index === 0) {
            data.cell.styles.fillColor = [254, 243, 199]; // yellow-100
          }
        }
      });
      yPos = doc.lastAutoTable.finalY + 5;

      // Main routes table
      if (routes.length > 0) {
        // Helper function to check if route is Tashkent (Xayrulla provider)
        const checkIsTashkent = (r) => {
          const routeNameLower = (r.routeName || '').toLowerCase();
          const cityLower = (r.city || '').toLowerCase();
          return routeNameLower.includes('tashkent') ||
                 routeNameLower.includes('toshkent') ||
                 cityLower.includes('tashkent') ||
                 cityLower.includes('toshkent');
        };

        // Filter routes based on provider
        let filteredRoutes = routes;
        if (provider === 'xayrulla') {
          filteredRoutes = routes.filter(r => checkIsTashkent(r));
        } else if (provider === 'sevil') {
          filteredRoutes = routes.filter(r => !checkIsTashkent(r));
        }

        // Store which rows should be yellow (Tashkent routes)
        const yellowRowIndices = [];

        const routeRows = filteredRoutes.map((r, idx) => {
          // Find matching flight for arrival time
          const routeDate = r.date?.split('T')[0];
          const matchingFlight = flights.find(f => f.date?.split('T')[0] === routeDate);

          // Check if route is in Tashkent
          const isTashkent = checkIsTashkent(r);

          if (isTashkent) {
            yellowRowIndices.push(idx);
          }

          // Translate route name to Uzbek, then transliterate
          const translatedRouteName = translateRouteToUzbek(r.routeName || '-');

          return [
            (idx + 1).toString(),
            formatDateDisplay(r.date),
            transliterate(translatedRouteName),
            r.personCount?.toString() || tourists.length.toString() || '-',
            transliterate(r.itinerary || '-')
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['№', 'Sana', "Yo'nalish", 'PAX', 'Sayohat dasturi']],
          body: routeRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 20 },
            2: { cellWidth: 35 },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 115 }
          },
          didParseCell: function(data) {
            // Apply yellow background to Tashkent routes
            if (data.section === 'body' && yellowRowIndices.includes(data.row.index)) {
              data.cell.styles.fillColor = [254, 243, 199]; // yellow-100
            }
          }
        });
        yPos = doc.lastAutoTable.finalY + 5;
      }

      // Poyezd bileti
      if (railways.length > 0) {
        doc.setFontSize(10);
        doc.text('Poyezd bileti', 105, yPos, { align: 'center' });
        yPos += 4;

        const railwayRows = railways.map(r => {
          // Build route string (use departure and arrival, not route field which has price)
          const routeStr = r.route || (r.departure && r.arrival ? `${r.departure}-${r.arrival}` : r.departure || '-');

          // Find hotel for arrival city - use r.arrival directly if available
          let arrCity = r.arrival || '';

          // If no arrival field, extract from route (but remove price if present)
          if (!arrCity && routeStr.includes('-')) {
            const parts = routeStr.split('-');
            // If last part looks like a number (price), use second-to-last part
            const lastPart = parts[parts.length - 1].trim();
            if (/^\d+/.test(lastPart) && parts.length > 2) {
              // Last part is a number, use second-to-last
              arrCity = parts[parts.length - 2].trim();
            } else {
              // Last part is city name
              arrCity = lastPart;
            }
          }

          const room = bookingRooms.find(br => {
            const cityName = br.hotel?.city?.name || '';
            return cityName.toLowerCase().includes(arrCity.toLowerCase()) ||
                   arrCity.toLowerCase().includes(cityName.toLowerCase());
          });

          const hotelInfo = hotels.find(h => h.id === room?.hotelId);

          return [
            formatDateDisplay(r.date),
            transliterate(routeStr),
            r.trainNumber || '-',
            r.departureTime && r.arrivalTime ? `${r.departureTime}-${r.arrivalTime}` : '-',
            transliterate(room?.hotel?.city?.name || '-'),
            room?.hotel?.name || '-',
            hotelInfo?.phone || room?.hotel?.phone || '-'
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Sana', "Yo'nalish", 'Poyezd', 'Vaqti', 'Shahar', 'Hotel', 'Telefon']],
          body: railwayRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 }
        });
        yPos = doc.lastAutoTable.finalY + 4;
      }

      // Ichki aviareys
      const domestic = flights.filter(f => f.type === 'DOMESTIC');
      if (domestic.length > 0) {
        doc.setFontSize(10);
        doc.text('Ichki aviareys', 105, yPos, { align: 'center' });
        yPos += 4;

        const flightRows = domestic.map(f => {
          // Build route string (use departure and arrival, not route field which has price)
          const routeStr = f.route || (f.departure && f.arrival ? `${f.departure}-${f.arrival}` : f.departure || '-');

          // Find hotel for arrival city - use f.arrival directly if available
          let arrCity = f.arrival || '';

          // If no arrival field, extract from route (but remove price if present)
          if (!arrCity && routeStr.includes('-')) {
            const parts = routeStr.split('-');
            // If last part looks like a number (price), use second-to-last part
            const lastPart = parts[parts.length - 1].trim();
            if (/^\d+/.test(lastPart) && parts.length > 2) {
              // Last part is a number, use second-to-last
              arrCity = parts[parts.length - 2].trim();
            } else {
              // Last part is city name
              arrCity = lastPart;
            }
          }

          const room = bookingRooms.find(br => {
            const cityName = br.hotel?.city?.name || '';
            return cityName.toLowerCase().includes(arrCity.toLowerCase()) ||
                   arrCity.toLowerCase().includes(cityName.toLowerCase());
          });
          const hotelInfo = hotels.find(h => h.id === room?.hotelId);

          return [
            formatDateDisplay(f.date),
            transliterate(routeStr),
            f.flightNumber || '-',
            f.departureTime && f.arrivalTime ? `${f.departureTime}-${f.arrivalTime}` : '-',
            transliterate(room?.hotel?.city?.name || '-'),
            room?.hotel?.name || '-',
            hotelInfo?.phone || room?.hotel?.phone || '-'
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Sana', "Yo'nalish", 'Reys', 'Vaqti', 'Shahar', 'Hotel', 'Telefon']],
          body: flightRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 }
        });
        yPos = doc.lastAutoTable.finalY + 4;
      }

      // Xalqaro aviareys
      const international = flights.filter(f => f.type === 'INTERNATIONAL');
      if (international.length > 0) {
        doc.setFontSize(10);
        doc.text('Xalqaro aviareys', 105, yPos, { align: 'center' });
        yPos += 4;

        const intRows = international.map(f => {
          // Build route string
          const routeStr = f.route || (f.departure && f.arrival ? `${f.departure}-${f.arrival}` : f.departure || '-');

          return [
            formatDateDisplay(f.date),
            transliterate(routeStr),
            f.flightNumber || '-',
            f.departureTime && f.arrivalTime ? `${f.departureTime}-${f.arrivalTime}` : '-'
          ];
        });

        autoTable(doc, {
          startY: yPos,
          head: [['Sana', "Yo'nalish", 'Reys', 'Vaqti']],
          body: intRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 }
        });
        yPos = doc.lastAutoTable.finalY + 4;
      }

      // Hotels
      if (bookingRooms.length > 0) {
        doc.setFontSize(10);
        doc.text('Hotels', 105, yPos, { align: 'center' });
        yPos += 4;

        // Get unique hotels
        const uniqueHotels = [];
        const seenHotelIds = new Set();

        bookingRooms.forEach(room => {
          if (room.hotel && room.hotelId && !seenHotelIds.has(room.hotelId)) {
            seenHotelIds.add(room.hotelId);
            const hotelDetails = hotels.find(h => h.id === room.hotelId);
            uniqueHotels.push({
              cityName: transliterate(room.hotel.city?.name || '-'),
              hotelName: room.hotel.name || '-',
              phone: hotelDetails?.phone || room.hotel.phone || '-'
            });
          }
        });

        const hotelRows = uniqueHotels.map(h => [h.cityName, h.hotelName, h.phone]);

        autoTable(doc, {
          startY: yPos,
          head: [['Shahar', 'Hotel', 'Telefon']],
          body: hotelRows,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 7 }
        });
      }

      // Save
      const providerSuffix = provider === 'xayrulla'
        ? ' (Xayrulla)'
        : provider === 'sevil'
        ? ' (Sevil)'
        : '';
      const filename = `${booking?.bookingNumber || 'ER'} Marshrut varaqasi${providerSuffix}.pdf`;
      doc.save(filename);
      toast.success('PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  const handleDownloadPDF = () => {
    // Use browser's print to PDF functionality
    window.print();
  };

  const restoreERTemplate = async () => {
    if (!confirm('ER shablonini default holatiga qaytarishni xohlaysizmi?\n\nBu barcha ER gruppalar uchun ishlatiladigan asosiy marshrutni tiklaydi.')) {
      return;
    }

    try {
      // Default ER template routes
      const defaultERTemplate = [
        { dayNumber: 1, dayOffset: 0, routeName: 'Istanbul -Tashkent', city: '', transportType: '', provider: '', sortOrder: 0 },
        { dayNumber: 2, dayOffset: 1, routeName: 'Tashkent - Chimgan - Tashkent', city: '', transportType: '', provider: '', sortOrder: 1 },
        { dayNumber: 3, dayOffset: 2, routeName: 'Hotel-Toshkent sevemiy vokzali', city: '', transportType: '', provider: '', sortOrder: 2 },
        { dayNumber: 4, dayOffset: 3, routeName: 'Samarqand vokzali', city: '', transportType: '', provider: '', sortOrder: 3 },
        { dayNumber: 5, dayOffset: 4, routeName: 'Samarqand', city: '', transportType: '', provider: '', sortOrder: 4 },
        { dayNumber: 6, dayOffset: 5, routeName: 'Samarqand', city: '', transportType: '', provider: '', sortOrder: 5 },
        { dayNumber: 7, dayOffset: 6, routeName: 'Samarkand - Asraf', city: '', transportType: '', provider: '', sortOrder: 6 },
        { dayNumber: 8, dayOffset: 7, routeName: 'Asraf - Buxoro', city: '', transportType: '', provider: '', sortOrder: 7 },
        { dayNumber: 9, dayOffset: 8, routeName: 'Buxoro', city: '', transportType: '', provider: '', sortOrder: 8 },
        { dayNumber: 10, dayOffset: 9, routeName: 'Buxoro', city: '', transportType: '', provider: '', sortOrder: 9 },
        { dayNumber: 11, dayOffset: 10, routeName: 'Buxoro-Xiva', city: '', transportType: '', provider: '', sortOrder: 10 },
        { dayNumber: 12, dayOffset: 11, routeName: 'Xiva', city: '', transportType: '', provider: '', sortOrder: 11 },
        { dayNumber: 13, dayOffset: 12, routeName: 'Xiva-Urgench', city: '', transportType: '', provider: '', sortOrder: 12 },
        { dayNumber: 14, dayOffset: 13, routeName: 'Xiva-Shovot', city: '', transportType: '', provider: '', sortOrder: 13 },
        { dayNumber: 15, dayOffset: 14, routeName: 'Tashkent mahalliy Aeroporti-Hotel', city: '', transportType: '', provider: '', sortOrder: 14 },
        { dayNumber: 16, dayOffset: 15, routeName: 'Hotel-Tashkent xalqoro aeroporti', city: '', transportType: '', provider: '', sortOrder: 15 }
      ];

      await routesApi.saveTemplate('ER', defaultERTemplate);
      toast.success('ER shabloni tiklanidi! Sahifani yangilang.');
    } catch (error) {
      console.error('Error restoring ER template:', error);
      toast.error('Xato: ' + (error.response?.data?.error || error.message));
    }
  };

  const reloadFromTemplate = async () => {
    if (!booking?.tourType) {
      toast.error('Tour type topilmadi');
      return;
    }

    if (!confirm('Hozirgi marshrutlarni o\'chirib, shablondan qayta yuklashni xohlaysizmi?\n\nBu hozirgi barcha marshrutlarni o\'chiradi!')) {
      return;
    }

    try {
      // Delete all existing routes for this booking
      for (const route of routes) {
        await routesApi.delete(bookingId, route.id);
      }

      // Reload data to load from template
      await loadItineraryData();
      toast.success('Marshrutlar shablondan qayta yuklandi');
    } catch (error) {
      console.error('Error reloading from template:', error);
      toast.error('Xato: ' + (error.response?.data?.error || error.message));
    }
  };

  const saveAsTemplate = async () => {
    if (!booking?.tourType) {
      toast.error('Тур тури топилмади');
      return;
    }

    if (!confirm(`Бу маршрутни ${booking.tourType} шаблони сифатида сақлашми?\n\nБарча янги ${booking.tourType} группалари учун ушбу маршрут автоматик юкланади.`)) {
      return;
    }

    try {
      // Prepare routes for template (remove booking-specific data)
      const templateRoutes = routes.map((route, index) => ({
        dayNumber: index + 1,
        dayOffset: index,
        routeName: route.routeName || '',
        city: route.city || '',
        itinerary: route.itinerary || '',
        transportType: route.transportType || '',
        provider: route.provider || '',
        sortOrder: index
      }));

      await routesApi.saveTemplate(booking.tourType, templateRoutes);
      toast.success(`Шаблон сақланди! Барча янги ${booking.tourType} группалари учун ушбу маршрут ишлатилади.`);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Хато: ' + (error.response?.data?.error || error.message));
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return format(new Date(date), 'yyyy-MM-dd');
  };

  const formatDateDisplay = (date) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy');
  };

  // Route editing
  const startEditRoute = (route) => {
    setEditingRoute({
      ...route,
      date: route.date ? formatDate(route.date) : ''
    });
  };

  const cancelEditRoute = () => {
    setEditingRoute(null);
  };

  const saveRoute = async () => {
    try {
      console.log('💾 [SAVE] Saving route:', editingRoute);
      console.log('💾 [SAVE] Route date before save:', editingRoute.date);

      // 1. Save to DATABASE (primary storage)
      const response = await routesApi.update(bookingId, editingRoute.id, editingRoute);
      console.log('✅ [SAVE] Database save response:', response.data);

      // 2. Save to LOCALSTORAGE (backup storage) - only itinerary field
      try {
        const storageKey = `itinerary-data-${bookingId}`;
        const existingData = JSON.parse(localStorage.getItem(storageKey) || '{}');

        // Update or add this route's itinerary
        existingData[editingRoute.id] = {
          routeId: editingRoute.id,
          routeName: editingRoute.routeName,
          itinerary: editingRoute.itinerary,
          lastUpdated: new Date().toISOString()
        };

        localStorage.setItem(storageKey, JSON.stringify(existingData));
        console.log('✅ [SAVE] localStorage backup saved');
      } catch (storageError) {
        console.warn('⚠️  [SAVE] localStorage save failed (non-critical):', storageError);
        // Don't fail the main save if localStorage fails
      }

      // 3. For ER tours: also update the template so "Sayohat dasturi" is saved for all future groups
      if (booking?.tourType === 'ER' && editingRoute.dayNumber) {
        try {
          // Load current template
          const templateRes = await routesApi.getTemplate('ER');
          const templates = templateRes.data.templates || [];

          // Find the template entry for this day number
          const templateIndex = templates.findIndex(t => t.dayNumber === editingRoute.dayNumber);

          if (templateIndex >= 0) {
            // Update the template entry (city and itinerary are separate!)
            templates[templateIndex] = {
              ...templates[templateIndex],
              routeName: editingRoute.routeName || templates[templateIndex].routeName,
              city: editingRoute.city || templates[templateIndex].city,
              itinerary: editingRoute.itinerary || templates[templateIndex].itinerary,
              provider: editingRoute.provider || templates[templateIndex].provider
            };

            // Save updated template
            await routesApi.saveTemplate('ER', templates);
            console.log('✅ [SAVE] Template updated for day', editingRoute.dayNumber);
          }
        } catch (templateError) {
          console.warn('Could not update template:', templateError);
          // Don't fail the main save if template update fails
        }
      }

      toast.success('Маршрут сақланди (Database + localStorage)');
      setEditingRoute(null);

      // Reload and re-sort
      console.log('Reloading routes...');
      await loadItineraryData();
      console.log('Routes reloaded and sorted');
    } catch (error) {
      console.error('🔴 [SAVE] Error saving route:', error);
      console.error('🔴 [SAVE] Error details:', error.response?.data);
      toast.error('Хато: ' + (error.response?.data?.message || error.message));
    }
  };

  const deleteRoute = async (routeId) => {
    if (!confirm('Маршрут ўчирилсинми?')) return;
    try {
      // 1. Delete from DATABASE
      await routesApi.delete(bookingId, routeId);

      // 2. Delete from LOCALSTORAGE backup (cleanup)
      try {
        const storageKey = `itinerary-data-${bookingId}`;
        const existingData = JSON.parse(localStorage.getItem(storageKey) || '{}');

        if (existingData[routeId]) {
          delete existingData[routeId];
          localStorage.setItem(storageKey, JSON.stringify(existingData));
          console.log('🗑️ [DELETE] Removed from localStorage backup');
        }
      } catch (storageError) {
        console.warn('⚠️  [DELETE] localStorage cleanup failed (non-critical)');
      }

      toast.success('Маршрут ўчирилди (Database + localStorage)');
      loadItineraryData();
    } catch (error) {
      console.error('🔴 [DELETE] Error deleting route:', error);
      toast.error('Ошибка удаления маршрута');
    }
  };

  const addRoute = async () => {
    try {
      // Find the last date in routes
      let nextDate = new Date();
      if (routes.length > 0) {
        const lastRoute = routes[routes.length - 1];
        const lastDate = new Date(lastRoute.date);
        nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (booking?.arrivalDate) {
        nextDate = new Date(booking.arrivalDate);
      }

      console.log('Creating route with date:', nextDate.toISOString().split('T')[0]);

      const newRoute = {
        dayNumber: 0,
        date: nextDate.toISOString().split('T')[0],
        routeName: '',
        city: '',
        itinerary: '',
        transportType: '',
        provider: ''
      };

      await routesApi.create(bookingId, newRoute);
      toast.success('Янги маршрут қўшилди');

      // Reload data
      const routesRes = await bookingsApi.getRoutes(bookingId);
      const loadedRoutes = routesRes.data.routes || [];

      const sortedRoutes = [...loadedRoutes].sort((a, b) => {
        const routeA = (a.routeName || '').toLowerCase();
        const routeB = (b.routeName || '').toLowerCase();

        // Same simplified logic based on routeName
        const getCategory = (routeName) => {
          if (!routeName.includes('tashkent')) return 'middle';
          if (routeName.includes('city tour')) return 'first';
          if (routeName.includes('chimgan')) return 'first';
          if (routeName.includes('vokzal')) return 'first';
          if (routeName.includes('aeroport') || routeName.includes('aeroporti')) return 'last';
          return 'middle';
        };

        const catA = getCategory(routeA);
        const catB = getCategory(routeB);
        const catOrder = { first: 1, middle: 2, last: 3 };

        if (catOrder[catA] !== catOrder[catB]) {
          return catOrder[catA] - catOrder[catB];
        }

        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        const dateDiff = dateA - dateB;

        if (dateDiff !== 0) {
          return dateDiff;
        }

        return a.id - b.id;
      });

      setRoutes(sortedRoutes);

      // Find the newly created route (last one with matching date)
      const newlyCreated = sortedRoutes.find(r =>
        r.date?.split('T')[0] === nextDate.toISOString().split('T')[0] &&
        !r.routeName && !r.city && !r.itinerary
      );

      // Auto-open edit mode for the newly created route
      if (newlyCreated) {
        setEditingRoute({
          ...newlyCreated,
          date: formatDate(newlyCreated.date)
        });
      }
    } catch (error) {
      console.error('Error adding route:', error);
      toast.error('Ошибка добавления маршрута: ' + (error.response?.data?.message || error.message));
    }
  };

  const autoFillDates = async () => {
    if (!booking?.arrivalDate || !booking?.endDate) {
      toast.error('Booking sanalar topilmadi');
      return;
    }

    const shouldClear = confirm('Эски маршрутларни ўчириб, янгисини яратишми?\n\nYes - Ҳаммасини ўчириб янгисини яратиш\nNo - Фақат етишмайотган саналарни қўшиш');

    try {
      // If user wants to clear, delete all existing routes
      if (shouldClear) {
        toast.info('Эски маршрутлар ўчирилмоқда...');

        // Delete all existing routes
        for (const route of routes) {
          await routesApi.delete(bookingId, route.id);
        }

        // Generate all dates from scratch
        const allDates = generateDateRange(booking.arrivalDate, booking.endDate);

        toast.info(`${allDates.length} та янги сана яратилмоқда...`);

        for (const date of allDates) {
          const newRoute = {
            dayNumber: 0,
            date: date,
            routeName: '',
            city: '',
            itinerary: '',
            transportType: '',
            provider: ''
          };
          await routesApi.create(bookingId, newRoute);
        }

        toast.success(`Ҳамма ўчирилди ва ${allDates.length} та янги сана яратилди`);
      } else {
        // Only add missing dates
        const expectedDates = generateDateRange(booking.arrivalDate, booking.endDate);
        const existingDates = new Set(routes.map(r => r.date?.split('T')[0]));
        const missingDates = expectedDates.filter(date => !existingDates.has(date));

        if (missingDates.length === 0) {
          toast.info('Барча саналар мавжуд');
          return;
        }

        for (const date of missingDates) {
          const newRoute = {
            dayNumber: 0,
            date: date,
            routeName: '',
            city: '',
            itinerary: '',
            transportType: '',
            provider: ''
          };
          await routesApi.create(bookingId, newRoute);
        }

        toast.success(`${missingDates.length} та сана қўшилди`);
      }

      loadItineraryData();
    } catch (error) {
      console.error('Error auto-filling dates:', error);
      toast.error('Ошибка автозаполнения');
    }
  };

  // Railway editing
  const startEditRailway = (railway) => {
    setEditingRailway({
      ...railway,
      date: railway.date ? formatDate(railway.date) : ''
    });
  };

  const cancelEditRailway = () => {
    setEditingRailway(null);
  };

  const saveRailway = async () => {
    try {
      await railwaysApi.update(bookingId, editingRailway.id, editingRailway);
      toast.success('Поезд обновлен');
      setEditingRailway(null);
      loadItineraryData();
    } catch (error) {
      console.error('Error saving railway:', error);
      toast.error('Ошибка сохранения поезда');
    }
  };

  // Flight editing
  const startEditFlight = (flight) => {
    setEditingFlight({
      ...flight,
      date: flight.date ? formatDate(flight.date) : ''
    });
  };

  const cancelEditFlight = () => {
    setEditingFlight(null);
  };

  const saveFlight = async () => {
    try {
      await flightsApi.update(bookingId, editingFlight.id, editingFlight);
      toast.success('Рейс обновлен');
      setEditingFlight(null);
      loadItineraryData();
    } catch (error) {
      console.error('Error saving flight:', error);
      toast.error('Ошибка сохранения рейса');
    }
  };

  // Header editing
  const startEditHeader = () => {
    setEditingHeader(true);
  };

  const cancelEditHeader = () => {
    setEditingHeader(false);
    // Reload from localStorage
    const savedHeader = localStorage.getItem(`itinerary-header-${bookingId}`);
    if (savedHeader) {
      setHeaderData(JSON.parse(savedHeader));
    } else {
      setHeaderData({
        nosirContact: 'Nosir aka (+998 91 151 11 10) Farg\'ona',
        sevilContact: 'Sevil aka (+998 90 445 10 92) Marshrutda',
        xayrullaContact: 'Xayrulla (+998 93 133 00 03) Toshkentda',
        country: 'Germaniya',
        guideName: 'Zokir Saidov',
        guidePhone: '+998 97 929 03 85'
      });
    }
  };

  const saveHeader = () => {
    try {
      localStorage.setItem(`itinerary-header-${bookingId}`, JSON.stringify(headerData));
      toast.success('Заголовок обновлен');
      setEditingHeader(false);
    } catch (error) {
      console.error('Error saving header:', error);
      toast.error('Ошибка сохранения заголовка');
    }
  };

  // Separate international and domestic flights
  const internationalFlights = flights.filter(f => f.type === 'INTERNATIONAL' || f.type === 'BUSINESS' || f.type === 'ECONOM');
  const domesticFlights = flights.filter(f => f.type === 'DOMESTIC');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Protection Notice */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 print:hidden">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Save className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-green-900 text-sm">Dual Storage Protection</h3>
            <p className="text-xs text-green-800 mt-1">
              Sayohat dasturi ma'lumotlari <span className="font-semibold">Database</span> va <span className="font-semibold">localStorage</span> ga saqlanadi.
              Ctrl+Shift+Delete qilsangiz ham, ma'lumotlar database dan tiklanadi. ✅
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 print:hidden">
        {/* PDF Download Buttons */}
        <button
          onClick={() => exportToPDF('all')}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FileDown className="w-4 h-4" />
          PDF (Hammasi)
        </button>
        <button
          onClick={() => exportToPDF('xayrulla')}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FileDown className="w-4 h-4" />
          PDF (Xayrulla)
        </button>
        <button
          onClick={() => exportToPDF('sevil')}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <FileDown className="w-4 h-4" />
          PDF (Sevil)
        </button>
      </div>

      {/* Itinerary Document */}
      <div id="itinerary-content" ref={printRef} className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden print:border-0">
        {/* Header Section */}
        <div className="border-b-2 border-gray-900 relative">
          {/* Edit button for header */}
          {!editingHeader && (
            <button
              onClick={startEditHeader}
              className="absolute top-2 right-2 p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded print:hidden z-10"
              title="Edit Header"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {editingHeader && (
            <div className="absolute top-2 right-2 flex gap-1 print:hidden z-10">
              <button
                onClick={saveHeader}
                className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded"
                title="Save"
              >
                <Save className="w-4 h-4" />
              </button>
              <button
                onClick={cancelEditHeader}
                className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <table className="w-full">
            <thead>
              <tr>
                <th colSpan="6" className="text-center py-3 text-xl font-bold border-b border-gray-900">
                  Marshrut varaqasi
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr>
                <td className="border border-gray-900 px-3 py-2 font-semibold bg-gray-50" rowSpan="3">
                  Transport
                </td>
                <td className="border border-gray-900 px-3 py-2" rowSpan="3"></td>
                <td className="border border-gray-900 px-3 py-2 bg-yellow-100">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.xayrullaContact}
                      onChange={(e) => setHeaderData({ ...headerData, xayrullaContact: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Xayrulla kontakt"
                    />
                  ) : (
                    headerData.xayrullaContact
                  )}
                </td>
                <td className="border border-gray-900 px-3 py-2"></td>
                <td className="border border-gray-900 px-3 py-2 font-semibold text-center">Gruppa</td>
                <td className="border border-gray-900 px-3 py-2 font-bold text-center">{booking?.bookingNumber || ''}</td>
              </tr>
              <tr>
                <td className="border border-gray-900 px-3 py-2">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.nosirContact}
                      onChange={(e) => setHeaderData({ ...headerData, nosirContact: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nosir kontakt"
                    />
                  ) : (
                    headerData.nosirContact
                  )}
                </td>
                <td className="border border-gray-900 px-3 py-2"></td>
                <td className="border border-gray-900 px-3 py-2 font-semibold text-center">Davlat</td>
                <td className="border border-gray-900 px-3 py-2 font-bold text-center">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.country}
                      onChange={(e) => setHeaderData({ ...headerData, country: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded text-center bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Davlat nomi"
                    />
                  ) : (
                    headerData.country
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-900 px-3 py-2">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.sevilContact}
                      onChange={(e) => setHeaderData({ ...headerData, sevilContact: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Sevil kontakt"
                    />
                  ) : (
                    headerData.sevilContact
                  )}
                </td>
                <td className="border border-gray-900 px-3 py-2"></td>
                <td className="border border-gray-900 px-3 py-2 font-semibold text-center">Turistlar soni</td>
                <td className="border border-gray-900 px-3 py-2 font-bold text-center">{tourists.length || 0}</td>
              </tr>
              <tr>
                <td className="border border-gray-900 px-3 py-2" colSpan="2"></td>
                <td className="border border-gray-900 px-3 py-2" colSpan="2"></td>
                <td className="border border-gray-900 px-3 py-2 font-semibold text-center">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.guideName}
                      onChange={(e) => setHeaderData({ ...headerData, guideName: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded text-center bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Gid ismi"
                    />
                  ) : (
                    `gid: ${headerData.guideName}`
                  )}
                </td>
                <td className="border border-gray-900 px-3 py-2 text-center">
                  {editingHeader ? (
                    <input
                      type="text"
                      value={headerData.guidePhone}
                      onChange={(e) => setHeaderData({ ...headerData, guidePhone: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-blue-500 rounded text-center bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="+998 XX XXX XX XX"
                    />
                  ) : (
                    headerData.guidePhone
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Main Itinerary Table */}
        <div className="mt-6">
          <div className="flex justify-end gap-2 mb-2 print:hidden">
            <button
              onClick={addRoute}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yangi qator
            </button>
          </div>
          {routes.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold w-12">№</th>
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold w-32">Sana</th>
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold w-56">Yo'nalish</th>
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold w-16">PAX</th>
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold">Sayohat dasturi</th>
                  <th className="border border-gray-900 px-3 py-2 text-center font-bold print:hidden w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route, idx) => {
                  const isEditing = editingRoute?.id === route.id;
                  const editData = isEditing ? editingRoute : route;

                  // Find matching flight for this route date
                  const routeDate = route.date?.split('T')[0];
                  const matchingFlight = flights.find(f => {
                    const flightDate = f.date?.split('T')[0];
                    return flightDate === routeDate;
                  });

                  // Check if route is in Tashkent
                  const routeNameLower = (route.routeName || '').toLowerCase();
                  const cityLower = (route.city || '').toLowerCase();
                  const isTashkent = routeNameLower.includes('tashkent') ||
                                     routeNameLower.includes('toshkent') ||
                                     cityLower.includes('tashkent') ||
                                     cityLower.includes('toshkent');

                  return (
                    <tr key={route.id} className={isTashkent ? 'bg-yellow-100' : ''}>
                      <td className="border border-gray-900 px-3 py-2 text-center">
                        {idx + 1}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.date || ''}
                            onChange={(e) => setEditingRoute({ ...editingRoute, date: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          formatDateDisplay(route.date)
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.routeName || ''}
                            onChange={(e) => setEditingRoute({ ...editingRoute, routeName: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          translateRouteToUzbek(route.routeName) || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center font-semibold">
                        {route.personCount || tourists.length || '-'}
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        {isEditing ? (
                          <textarea
                            value={editData.itinerary || ''}
                            onChange={(e) => setEditingRoute({ ...editingRoute, itinerary: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                            rows="3"
                            placeholder="Sayohat dasturi (masalan: Toshkentga tashrif. Aeroportda kutib olish...)"
                          />
                        ) : (
                          route.itinerary || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center print:hidden">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveRoute}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditRoute}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEditRoute(route)}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteRoute(route.id)}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Two Column Layout: Transports and Hotels */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {/* LEFT COLUMN: Transport Information */}
          <div className="space-y-6">
            {/* Train Tickets Section */}
            {railways.length > 0 && (
              <div>
                <div className="text-center font-bold text-lg py-2 bg-gray-900 text-white">
                  Poyezd bileti
                </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="border border-gray-900 px-3 py-2 font-bold">Sana</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Yo'nalish</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Poyezd</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Vaqti</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold print:hidden w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {railways.map((railway) => {
                  const isEditing = editingRailway?.id === railway.id;
                  const editData = isEditing ? editingRailway : railway;

                  return (
                    <tr key={railway.id} className="bg-yellow-100">
                      <td className="border border-gray-900 px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.date || ''}
                            onChange={(e) => setEditingRailway({ ...editingRailway, date: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          formatDateDisplay(railway.date)
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.departure || ''}
                            onChange={(e) => setEditingRailway({ ...editingRailway, departure: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          railway.departure || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.trainNumber || ''}
                            onChange={(e) => setEditingRailway({ ...editingRailway, trainNumber: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          railway.trainNumber || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center font-bold">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editData.departureTime || ''}
                              onChange={(e) => setEditingRailway({ ...editingRailway, departureTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="07:00"
                            />
                            <input
                              type="text"
                              value={editData.arrivalTime || ''}
                              onChange={(e) => setEditingRailway({ ...editingRailway, arrivalTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="09:00"
                            />
                          </div>
                        ) : (
                          railway.departureTime && railway.arrivalTime
                            ? `${railway.departureTime}-${railway.arrivalTime}`
                            : '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center print:hidden">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveRailway}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditRailway}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditRailway(railway)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
              )}

              {/* Domestic Flights Section */}
              {domesticFlights.length > 0 && (
                <div className="mt-6">
                  <div className="text-center font-bold text-lg py-2 bg-gray-900 text-white">
                    Ichki aviareys
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-yellow-100">
                        <th className="border border-gray-900 px-3 py-2 font-bold">Sana</th>
                        <th className="border border-gray-900 px-3 py-2 font-bold">Yo'nalish</th>
                        <th className="border border-gray-900 px-3 py-2 font-bold">Reys</th>
                        <th className="border border-gray-900 px-3 py-2 font-bold">Vaqti</th>
                        <th className="border border-gray-900 px-3 py-2 font-bold print:hidden w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domesticFlights.map((flight) => {
                        const isEditing = editingFlight?.id === flight.id;
                        const editData = isEditing ? editingFlight : flight;

                        return (
                    <tr key={flight.id} className="bg-yellow-100">
                      <td className="border border-gray-900 px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.date || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, date: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          formatDateDisplay(flight.date)
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.route || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, route: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          flight.route || flight.departure || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.flightNumber || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, flightNumber: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          flight.flightNumber || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center font-bold">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editData.departureTime || ''}
                              onChange={(e) => setEditingFlight({ ...editingFlight, departureTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="07:00"
                            />
                            <input
                              type="text"
                              value={editData.arrivalTime || ''}
                              onChange={(e) => setEditingFlight({ ...editingFlight, arrivalTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="09:00"
                            />
                          </div>
                        ) : (
                          flight.departureTime && flight.arrivalTime
                            ? `${flight.departureTime}-${flight.arrivalTime}`
                            : '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center print:hidden">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveFlight}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditFlight}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditFlight(flight)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
                </div>
              )}

              {/* International Flights Section */}
              {internationalFlights.length > 0 && (
                <div className="mt-6">
            <div className="text-center font-bold text-lg py-2 bg-gray-900 text-white">
              Xalqaro aviareyslar
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-yellow-100">
                  <th className="border border-gray-900 px-3 py-2 font-bold">Sana</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Yo'nalish</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Reys</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold">Vaqti</th>
                  <th className="border border-gray-900 px-3 py-2 font-bold print:hidden w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {internationalFlights.map((flight) => {
                  const isEditing = editingFlight?.id === flight.id;
                  const editData = isEditing ? editingFlight : flight;

                  return (
                    <tr key={flight.id} className="bg-yellow-100">
                      <td className="border border-gray-900 px-3 py-2 text-center whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editData.date || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, date: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          formatDateDisplay(flight.date)
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.route || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, route: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          flight.route || flight.departure || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editData.flightNumber || ''}
                            onChange={(e) => setEditingFlight({ ...editingFlight, flightNumber: e.target.value })}
                            className="w-full px-2 py-1 border rounded"
                          />
                        ) : (
                          flight.flightNumber || '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center font-bold">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={editData.departureTime || ''}
                              onChange={(e) => setEditingFlight({ ...editingFlight, departureTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="07:00"
                            />
                            <input
                              type="text"
                              value={editData.arrivalTime || ''}
                              onChange={(e) => setEditingFlight({ ...editingFlight, arrivalTime: e.target.value })}
                              className="w-1/2 px-2 py-1 border rounded"
                              placeholder="09:00"
                            />
                          </div>
                        ) : (
                          flight.departureTime && flight.arrivalTime
                            ? `${flight.departureTime}-${flight.arrivalTime}`
                            : '-'
                        )}
                      </td>
                      <td className="border border-gray-900 px-3 py-2 text-center print:hidden">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveFlight}
                              className="p-1.5 bg-green-100 hover:bg-green-200 text-green-600 rounded"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditFlight}
                              className="p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditFlight(flight)}
                            className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* END LEFT COLUMN */}

            {/* RIGHT COLUMN: Hotels Information */}
            <div>
              <div className="text-center font-bold text-lg py-2 bg-gray-900 text-white">
                Hotels
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="border border-gray-900 px-3 py-2 font-bold">Shahar</th>
                    <th className="border border-gray-900 px-3 py-2 font-bold">Hotel</th>
                    <th className="border border-gray-900 px-3 py-2 font-bold">Telefon</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Get unique hotels from bookingRooms
                    const uniqueHotels = [];
                    const seenHotelIds = new Set();

                    bookingRooms.forEach(room => {
                      if (room.hotel && room.hotelId && !seenHotelIds.has(room.hotelId)) {
                        seenHotelIds.add(room.hotelId);
                        const hotelDetails = hotels.find(h => h.id === room.hotelId);
                        uniqueHotels.push({
                          cityName: room.hotel.city?.name || '-',
                          hotelName: room.hotel.name || '-',
                          phone: hotelDetails?.phone || room.hotel.phone || '-'
                        });
                      }
                    });

                    if (uniqueHotels.length === 0) {
                      return (
                        <tr>
                          <td colSpan="3" className="border border-gray-900 px-3 py-6 text-center text-gray-500">
                            Rooms модулида отель қўшилмаган
                          </td>
                        </tr>
                      );
                    }

                    return uniqueHotels.map((hotel, idx) => (
                      <tr key={idx} className="bg-yellow-100">
                        <td className="border border-gray-900 px-3 py-2">{hotel.cityName}</td>
                        <td className="border border-gray-900 px-3 py-2 font-semibold">{hotel.hotelName}</td>
                        <td className="border border-gray-900 px-3 py-2 text-center">{hotel.phone}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
            {/* END RIGHT COLUMN */}
          </div>

        {/* Empty State */}
        {routes.length === 0 && railways.length === 0 && flights.length === 0 && bookingRooms.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium">Маршрут пусто</p>
            <p className="text-gray-500 text-sm mt-1">Добавьте маршруты, поезда и рейсы</p>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          /* Hide everything first */
          body * {
            visibility: hidden;
          }

          /* Show only itinerary content */
          #itinerary-content,
          #itinerary-content * {
            visibility: visible;
          }

          /* Position at page top */
          #itinerary-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }

          body {
            margin: 0;
            padding: 0;
          }

          /* Hide action buttons and edit controls */
          .print\\:hidden,
          th.print\\:hidden,
          td.print\\:hidden {
            display: none !important;
            visibility: hidden !important;
          }

          .print\\:border-0 {
            border: 0 !important;
          }

          table {
            font-size: 7px !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th, td {
            padding: 1px 2px !important;
            font-size: 7px !important;
            line-height: 1.2 !important;
          }

          .text-xl {
            font-size: 11px !important;
          }

          .text-lg {
            font-size: 9px !important;
          }

          .text-sm {
            font-size: 7px !important;
          }

          .py-2 {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }

          .py-3 {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }

          .px-3 {
            padding-left: 2px !important;
            padding-right: 2px !important;
          }

          .mt-6 {
            margin-top: 1mm !important;
          }

          .rounded-xl {
            border-radius: 0 !important;
          }

          .bg-gray-900 {
            background-color: #111827 !important;
            color: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .bg-yellow-100 {
            background-color: #fef3c7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .bg-gray-50 {
            background-color: #f9fafb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .bg-gray-100 {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .border-b-2 {
            border-bottom-width: 1px !important;
          }

          .space-y-6 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
