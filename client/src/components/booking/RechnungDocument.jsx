import React, { useState, useEffect, useImperativeHandle } from 'react';
import { format } from 'date-fns';
import { Download, Printer, Plus, Trash2, Edit2, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api, { invoicesApi, pricesApi } from '../../services/api';

const RechnungDocument = React.forwardRef(function RechnungDocument({ booking, tourists, showThreeRows = false, invoice = null, invoiceType = 'Rechnung', previousInvoiceNumber = '', sequentialNumber = 0, previousInvoiceAmount = 0, onWorldInsightSend }, ref) {
  // Format number with space as thousands separator (1234 → 1 234)
  const formatNumber = (num) => {
    if (num === null || num === undefined || num === '') return '';
    const number = parseFloat(num);
    if (isNaN(number)) return num;

    // Remove decimals if they are .00
    const rounded = Number.isInteger(number) ? number : number.toFixed(2);
    const [integer, decimal] = rounded.toString().split('.');

    // Add space every 3 digits from right
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    // Return without decimals if they are .00
    if (decimal && decimal !== '00') {
      return `${formattedInteger}.${decimal}`;
    }
    return formattedInteger;
  };

  const [roomingListData, setRoomingListData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalPrices, setTotalPrices] = useState(null); // Total prices from database/localStorage
  const lockedInvoiceIdRef = React.useRef(null); // Track which invoice ID is locked
  const lockedItemsRef = React.useRef(null); // Store locked items

  // Load Total Prices from database (with localStorage fallback)
  useEffect(() => {

    if (!booking) {
      return;
    }

    const loadTotalPrices = async () => {
      const tourTypeCode = typeof booking?.tourType === 'string'
        ? booking?.tourType
        : booking?.tourType?.code;


      if (!tourTypeCode) {
        setTotalPrices({});
        return;
      }

      try {
        const response = await pricesApi.getTotalPrices(tourTypeCode);


        if (response.data && response.data.items && Object.keys(response.data.items).length > 0) {
          setTotalPrices(response.data.items);
        } else {
          // Fallback to localStorage
          const storageKey = `${tourTypeCode.toLowerCase()}-total-prices`;
          const savedPrices = JSON.parse(localStorage.getItem(storageKey) || '{}');

          if (Object.keys(savedPrices).length > 0) {
            setTotalPrices(savedPrices);
          } else {
            // Last fallback: calculate from individual categories
            try {
              const allResp = await api.get(`/prices/${tourTypeCode}`);
              const allPrices = allResp.data || {};
              const calculated = calculateTotalsFromCategories(allPrices);
              if (Object.keys(calculated).length > 0) {
                setTotalPrices(calculated);
              } else {
                setTotalPrices({});
              }
            } catch (calcErr) {
              console.error('❌ Error calculating from categories:', calcErr);
              setTotalPrices({});
            }
          }
        }
      } catch (error) {
        console.error('❌ Error loading Total Prices from database:', error);
        console.error('Error details:', error.response?.data || error.message);
        // Fallback to localStorage on error
        const storageKey = `${tourTypeCode.toLowerCase()}-total-prices`;
        const savedPrices = JSON.parse(localStorage.getItem(storageKey) || '{}');
        setTotalPrices(savedPrices);
      }
    };

    loadTotalPrices();
  }, [booking]);

  // Load rooming list data for the first accommodation (arrival hotel)
  useEffect(() => {
    const loadRoomingListData = async () => {
      if (!booking?.id) {
        setLoading(false);
        return;
      }

      try {

        // 1. Get all accommodations
        const accommodationsResponse = await api.get(`/bookings/${booking.id}/accommodations`);

        // API returns { accommodations: [...] }, not directly an array
        const accommodations = accommodationsResponse.data.accommodations || accommodationsResponse.data;

        if (!accommodations || !Array.isArray(accommodations) || accommodations.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Sort by checkInDate to find the first/arrival hotel
        const sortedAccommodations = accommodations.slice().sort((a, b) => {
          const dateA = new Date(a.checkInDate);
          const dateB = new Date(b.checkInDate);
          return dateA - dateB;
        });

        const firstAccommodation = sortedAccommodations[0];

        // 3. Get rooming list for the first accommodation
        const roomingListResponse = await api.get(
          `/bookings/${booking.id}/accommodations/${firstAccommodation.id}/rooming-list`
        );

        setRoomingListData(roomingListResponse.data);

      } catch (error) {
        console.error('❌ Error loading rooming list:', error);
        toast.error('Rooming list yuklanmadi');
      } finally {
        setLoading(false);
      }
    };

    loadRoomingListData();
  }, [booking?.id]);

  // Calculate total prices from individual category records (fallback when "total" not saved)
  const calculateTotalsFromCategories = (allPrices) => {
    const tiers = ['4', '5', '6-7', '8-9', '10-11', '12-13', '14-15', '16'];
    const paxCounts = { '4': 4, '5': 5, '6-7': 6, '8-9': 8, '10-11': 10, '12-13': 12, '14-15': 14, '16': 16 };

    // Commission is stored with paxTier "4" but contains rates for all tiers
    const commissionData = allPrices['commission_4'] || {};

    const result = {};
    tiers.forEach(tierId => {
      const pax = paxCounts[tierId];
      const hotels = allPrices[`hotels_${tierId}`] || [];
      const transport = allPrices[`transport_${tierId}`] || [];
      const railway = allPrices[`railway_${tierId}`] || [];
      const fly = allPrices[`fly_${tierId}`] || [];
      const meal = allPrices[`meal_${tierId}`] || [];
      const sightseeing = allPrices[`sightseeing_${tierId}`] || [];
      const guide = allPrices[`guide_${tierId}`] || [];
      const shou = allPrices[`shou_${tierId}`] || [];

      if (!Array.isArray(hotels) || hotels.length === 0) return; // skip if no data for this tier

      // Hotels: pricePerDay = room rate for 2 (shared), so /2 per person
      const hotelTotal = hotels.reduce((sum, h) => sum + (h.days * h.pricePerDay), 0) / 2;
      const totalEZZimmer = hotels.reduce((sum, h) => sum + (h.days * (h.ezZimmer || 0)), 0);
      const ezZuschlagValue = totalEZZimmer - hotelTotal;

      // Transport, Fly, Guide: total group cost, divide by PAX
      const transportTotal = Array.isArray(transport) ? transport.reduce((sum, t) => sum + (t.days * t.price), 0) / pax : 0;
      const flyTotal = Array.isArray(fly) ? fly.reduce((sum, f) => sum + (f.days * f.price), 0) / pax : 0;
      const guideTotal = Array.isArray(guide) ? guide.reduce((sum, g) => sum + (g.days * g.price), 0) / pax : 0;

      // Railway, Meal, Sightseeing, Shou: already per person
      const railwayTotal = Array.isArray(railway) ? railway.reduce((sum, r) => sum + (r.days * r.price), 0) : 0;
      const mealTotal = Array.isArray(meal) ? meal.reduce((sum, m) => sum + (m.days * m.price), 0) : 0;
      const sightTotal = Array.isArray(sightseeing) ? sightseeing.reduce((sum, s) => sum + (s.days * s.price), 0) : 0;
      const shouTotal = Array.isArray(shou) ? shou.reduce((sum, s) => sum + (s.days * s.price), 0) : 0;

      const basePrice = hotelTotal + transportTotal + railwayTotal + flyTotal + mealTotal + sightTotal + guideTotal + shouTotal;
      const commissionRate = typeof commissionData === 'object' ? (commissionData[tierId] || 0) : 0;
      const commissionAmount = Math.round(basePrice * commissionRate / 100);

      result[tierId] = {
        totalPrice: Math.round(basePrice + commissionAmount),
        ezZuschlag: Math.round(ezZuschlagValue)
      };
    });

    return result;
  };

  // Helper function to determine PAX tier (matching Price.jsx paxTiers)
  const getPaxTier = (touristCount) => {
    if (touristCount <= 4) return { id: '4', name: '4 PAX', count: 4 };
    if (touristCount === 5) return { id: '5', name: '5 PAX', count: 5 };
    if (touristCount >= 6 && touristCount <= 7) return { id: '6-7', name: '6-7 PAX', count: 6 };
    if (touristCount >= 8 && touristCount <= 9) return { id: '8-9', name: '8-9 PAX', count: 8 };
    if (touristCount >= 10 && touristCount <= 11) return { id: '10-11', name: '10-11 PAX', count: 10 };
    if (touristCount >= 12 && touristCount <= 13) return { id: '12-13', name: '12-13 PAX', count: 12 };
    if (touristCount >= 14 && touristCount <= 15) return { id: '14-15', name: '14-15 PAX', count: 14 };
    return { id: '16', name: '16 PAX', count: 16 };
  };

  // Get ER price from database (via totalPrices state)
  const calculateERPrice = () => {
    const touristCount = tourists?.length || booking?.pax || 0;
    const tier = getPaxTier(touristCount);


    // Use totalPrices state loaded from database (with localStorage fallback)
    const savedTotalPrices = totalPrices || {};


    // Get prices for this tier
    const tierPrices = savedTotalPrices[tier.id] || { totalPrice: 0, ezZuschlag: 0 };


    return {
      einzelpreis: tierPrices.totalPrice,
      ezZuschlag: tierPrices.ezZuschlag,
      anzahl: touristCount
    };
  };

  // Calculate price for any tour type (ZA, CO, KAS, etc.)
  const calculateTourPrice = (tourTypeCode) => {
    const touristCount = tourists?.length || booking?.pax || 0;
    const tier = getPaxTier(touristCount);


    // Use totalPrices state loaded from database (with localStorage fallback)
    const savedTotalPrices = totalPrices || {};


    // Get prices for this tier
    const tierPrices = savedTotalPrices[tier.id] || { totalPrice: 0, ezZuschlag: 0 };


    return {
      einzelpreis: tierPrices.totalPrice,
      ezZuschlag: tierPrices.ezZuschlag,
      anzahl: touristCount
    };
  };

  // Get count of EZ rooms from tourists
  const getEZCount = () => {
    if (!tourists || tourists.length === 0) return 5;
    return tourists.filter(t => {
      const room = (t.roomPreference || '').toUpperCase();
      return room === 'EZ' || room === 'SNGL' || room === 'SINGLE';
    }).length;
  };

  // Calculate birthdays during tour
  const calculateBirthdayCount = () => {

    if (!tourists || tourists.length === 0) {
      return 0;
    }

    if (!booking?.departureDate || !booking?.endDate) {
      return 0;
    }

    const tourStart = new Date(booking.departureDate);
    const tourEnd = new Date(booking.endDate);

    let birthdayCount = 0;

    tourists.forEach((tourist, index) => {

      // Method 1: Check if dateOfBirth exists and falls within tour
      const birthDateField = tourist.dateOfBirth || tourist.birthDate || tourist.birthday;

      if (birthDateField) {
        const birthDate = new Date(birthDateField);

        // Get the birthday in the tour year
        const tourYear = tourStart.getFullYear();
        const birthdayThisYear = new Date(tourYear, birthDate.getMonth(), birthDate.getDate());


        // Check if birthday falls within tour dates
        if (birthdayThisYear >= tourStart && birthdayThisYear <= tourEnd) {
          birthdayCount++;
        }
      }
      // Method 2: Check remarks field for "Birthday" or "Geburtstag" keyword
      else if (tourist.remarks) {
        const remarksLower = tourist.remarks.toLowerCase();
        if (remarksLower.includes('birthday') || remarksLower.includes('geburtstag')) {
          birthdayCount++;
        }
      }
    });

    return birthdayCount;
  };

  // Calculate early arrivals (Zusatznacht)
  const calculateEarlyArrivals = () => {

    // API returns { roomingList: [...] }, not directly an array
    const roomingList = roomingListData?.roomingList || roomingListData;

    if (!roomingList || !Array.isArray(roomingList) || roomingList.length === 0) {
      return { ezNights: 0, dzNights: 0 };
    }

    // Find the group's actual check-in date (most common check-in date among tourists in rooming list)
    const checkInDates = {};
    roomingList.forEach(entry => {
      const touristName = entry.tourist?.firstName || 'Unknown';

      if (entry.checkInDate) {
        const dateStr = entry.checkInDate.split('T')[0]; // Get date part only
        checkInDates[dateStr] = (checkInDates[dateStr] || 0) + 1;
      }
    });


    // Find the most common check-in date (this is the group's arrival date)
    let groupCheckInDate = null;
    let maxCount = 0;
    Object.entries(checkInDates).forEach(([date, count]) => {
      if (count > maxCount) {
        maxCount = count;
        groupCheckInDate = date;
      }
    });

    if (!groupCheckInDate) {
      return { ezNights: 0, dzNights: 0 };
    }


    const groupArrival = new Date(groupCheckInDate);
    let ezNights = 0; // Single room early nights
    let dzNights = 0; // Double room early nights

    roomingList.forEach(entry => {
      if (entry.checkInDate) {
        const touristArrival = new Date(entry.checkInDate);
        const daysDiff = Math.floor((groupArrival - touristArrival) / (1000 * 60 * 60 * 24));

        const touristName = entry.tourist?.firstName || 'Unknown';

        if (daysDiff > 0) {
          // Tourist arrived earlier than group
          // Get room preference from tourists array (since rooming list doesn't include it)
          const touristId = entry.id || entry.touristId;
          const fullTourist = tourists?.find(t => t.id === touristId);
          const roomPreference = fullTourist?.roomPreference || entry.tourist?.roomPreference || entry.roomPreference || '';
          const room = roomPreference.toUpperCase();
          const isEZ = room === 'EZ' || room === 'SNGL' || room === 'SINGLE';


          if (isEZ) {
            ezNights += daysDiff;
          } else {
            dzNights += daysDiff;
          }

        }
      }
    });

    return { ezNights, dzNights };
  };

  // Initialize invoice items with calculated prices for ER
  const initializeInvoiceItems = () => {
    // tourType can be either a string 'ER' or an object { code: 'ER', ... }
    const tourTypeCode = typeof booking?.tourType === 'string'
      ? booking?.tourType
      : booking?.tourType?.code;
    const isER = tourTypeCode === 'ER';

    if (isER) {
      const { einzelpreis, ezZuschlag, anzahl } = calculateERPrice();
      const ezCount = getEZCount();
      const { ezNights, dzNights } = calculateEarlyArrivals();
      const birthdayCount = calculateBirthdayCount();

      // Load Zusatzkosten prices from localStorage
      const zusatzkostenRaw = localStorage.getItem('er_zusatzkosten') || '[]';

      const zusatzkosten = JSON.parse(zusatzkostenRaw);

      // Log each item
      zusatzkosten.forEach((item, index) => {
      });

      // Find items - using exact match

      const zusatznachtEZ = zusatzkosten.find(item => {
        const match = item.name === 'Zusatznacht EZ';
        return match;
      });

      const zusatznachtDZ = zusatzkosten.find(item => item.name === 'Zusatznacht DZ');

      // Search for birthday gift - use flexible matching
      const geburtstagsgeschenk = zusatzkosten.find(item => {
        const nameLower = item.name.toLowerCase();
        // Match names containing "geburt" and "geschenk" (handles typos like missing 't')
        const match = nameLower.includes('gebur') && nameLower.includes('geschenk');
        return match;
      });

      const extraTransferTaschkent = zusatzkosten.find(item => item.name === 'Extra Transfer in Taschkent');


      const items = [
        {
          id: 1,
          description: 'Usbekistan Teil',
          einzelpreis: einzelpreis,
          anzahl: anzahl,
          currency: 'USD'
        }
      ];

      // Only add EZ Zuschlag if there are EZ rooms
      if (ezCount > 0) {
        items.push({
          id: 2,
          description: 'EZ Zuschlag',
          einzelpreis: ezZuschlag,
          anzahl: ezCount,
          currency: 'USD'
        });
      }

      let nextId = 3;

      // Add Zusatznacht EZ if there are early EZ arrivals
      if (ezNights > 0 && zusatznachtEZ) {
        items.push({
          id: nextId++,
          description: 'Zusatznacht EZ',
          einzelpreis: zusatznachtEZ.price || 60,
          anzahl: ezNights,
          currency: 'USD'
        });
      }

      // Add Zusatznacht DZ if there are early DZ arrivals
      if (dzNights > 0 && zusatznachtDZ) {
        items.push({
          id: nextId++,
          description: 'Zusatznacht DZ',
          einzelpreis: zusatznachtDZ.price || 80,
          anzahl: dzNights,
          currency: 'USD'
        });
      }

      // Add Geburtstagsgeschenk if there are birthdays during tour

      if (birthdayCount > 0 && geburtstagsgeschenk) {
        const birthdayItem = {
          id: nextId++,
          description: 'Geburtstagsgeschenk',
          einzelpreis: geburtstagsgeschenk.price || 10,
          anzahl: birthdayCount,
          currency: 'USD'
        };
        items.push(birthdayItem);
      } else {
      }

      // Add other Zusatzkosten items
      if (extraTransferTaschkent) {
        items.push({
          id: nextId++,
          description: 'Extra Transfer in Taschke',
          einzelpreis: extraTransferTaschkent.price || 25,
          anzahl: 1,
          currency: 'USD'
        });
      }

      return items;
    } else {
      // For non-ER tours (ZA, CO, KAS), use tour-specific pricing
      const { einzelpreis, ezZuschlag, anzahl } = calculateTourPrice(tourTypeCode);
      const ezCount = getEZCount();

      // Load Zusatzkosten prices from localStorage (tour-specific)
      const zusatzkostenKey = `${tourTypeCode.toLowerCase()}_zusatzkosten`;
      const zusatzkostenRaw = localStorage.getItem(zusatzkostenKey) || '[]';
      const zusatzkosten = JSON.parse(zusatzkostenRaw);

      const items = [
        {
          id: 1,
          description: 'Usbekistan Teil',
          einzelpreis: einzelpreis,
          anzahl: anzahl,
          currency: 'USD'
        }
      ];

      // Only add EZ Zuschlag if there are EZ rooms
      if (ezCount > 0) {
        items.push({
          id: 2,
          description: 'EZ Zuschlag',
          einzelpreis: ezZuschlag,
          anzahl: ezCount,
          currency: 'USD'
        });
      }

      // Note: For now, we only handle basic items for non-ER tours
      // Additional items can be added manually or we can extend this logic later
      return items;
    }
  };

  const [invoiceItems, setInvoiceItems] = useState([]);
  const [rechnungNr, setRechnungNr] = useState(invoice?.invoiceNumber || '11/25');
  const [bezahlteRechnungNr, setBezahlteRechnungNr] = useState(previousInvoiceNumber); // Bereits bezahlte Rechnung Nr.
  const [bezahlteRechnung, setBezahlteRechnung] = useState(previousInvoiceAmount); // Use prop value initially
  const [manualInvoiceNr, setManualInvoiceNr] = useState(previousInvoiceNumber); // Manual invoice number for Gutschrift

  // Update rechnungNr when invoice changes
  useEffect(() => {
    if (invoice?.invoiceNumber) {
      setRechnungNr(invoice.invoiceNumber);
    }
  }, [invoice]);

  // Auto-fill Bereits bezahlte Rechnung Nr from previous invoice (Neue Rechnung)
  useEffect(() => {
    if (invoiceType === 'Neue Rechnung' && previousInvoiceNumber && !bezahlteRechnungNr) {
      setBezahlteRechnungNr(previousInvoiceNumber);
    }
  }, [previousInvoiceNumber, invoiceType]);

  // Auto-fill manual invoice number from previous invoice (Gutschrift)
  useEffect(() => {
    if (invoiceType === 'Gutschrift' && previousInvoiceNumber && !manualInvoiceNr) {
      setManualInvoiceNr(previousInvoiceNumber);
    }
  }, [previousInvoiceNumber, invoiceType]);

  // Update bezahlteRechnung when previousInvoiceAmount prop changes
  useEffect(() => {
    // If previousInvoiceAmount prop is provided (from parent), use it directly
    if (previousInvoiceAmount > 0) {
      setBezahlteRechnung(previousInvoiceAmount);
    } else if (!bezahlteRechnungNr || bezahlteRechnungNr.trim() === '') {
      setBezahlteRechnung(0);
    }
  }, [previousInvoiceAmount, bezahlteRechnungNr]);

  // Update invoice items when booking, tourists, or rooming list changes
  // CRITICAL: If firma is selected, invoice is LOCKED - use saved items, don't recalculate
  useEffect(() => {
    if (booking && !loading) {
      const invoiceId = invoice?.id;
      const hasFirma = invoice?.firma ? true : false;

      // Try to load locked state from localStorage
      const lockKey = `invoice_lock_${invoiceId}`;
      const storedLock = localStorage.getItem(lockKey);
      let lockedData = null;

      if (storedLock) {
        try {
          lockedData = JSON.parse(storedLock);
        } catch (e) {
          console.error('Error parsing locked data:', e);
        }
      }


      // CRITICAL: If this invoice is locked in localStorage (firma selected), use locked items
      if (hasFirma && lockedData && lockedData.items && lockedData.items.length > 0) {
        // If lock was saved with 0 prices (race condition) and totalPrices now available, clear stale lock
        const mainItem = lockedData.items.find(item => item.description === 'Usbekistan Teil');
        if (mainItem && mainItem.einzelpreis === 0 && totalPrices !== null && Object.keys(totalPrices).length > 0) {
          localStorage.removeItem(lockKey);
          lockedData = null; // Fall through to recalculation
        } else {
          setInvoiceItems(lockedData.items);

          // Update refs
          lockedInvoiceIdRef.current = invoiceId;
          lockedItemsRef.current = lockedData.items;
          return; // Don't recalculate!
        }
      }

      // If firma is selected but not locked yet, LOCK IT NOW
      if (hasFirma && !lockedData) {
        // Wait for totalPrices to load first (prevents locking with 0 prices due to race condition)
        if (totalPrices === null) {
          return;
        }

        // Try to load from database first
        if (invoice?.items) {
          try {
            let savedItems;
            if (typeof invoice.items === 'string') {
              savedItems = JSON.parse(invoice.items);
            } else if (Array.isArray(invoice.items)) {
              savedItems = invoice.items;
            }

            if (Array.isArray(savedItems) && savedItems.length > 0) {
              // Use DB items only if they have valid (non-zero) prices
              const mainItem = savedItems.find(item => item.description === 'Usbekistan Teil');
              const hasValidPrice = !mainItem || mainItem.einzelpreis > 0;

              if (hasValidPrice) {
                setInvoiceItems(savedItems);

                // Save lock to localStorage
                localStorage.setItem(lockKey, JSON.stringify({ items: savedItems, firma: invoice.firma }));
                lockedInvoiceIdRef.current = invoiceId;
                lockedItemsRef.current = savedItems;
                return;
              }
            }
          } catch (error) {
            console.error('❌ Error parsing saved items:', error);
          }
        }

        // Calculate and lock current values
        const items = initializeInvoiceItems();
        setInvoiceItems(items);

        // Save lock to localStorage
        localStorage.setItem(lockKey, JSON.stringify({ items, firma: invoice.firma }));
        lockedInvoiceIdRef.current = invoiceId;
        lockedItemsRef.current = items;

        // Save to database immediately
        if (invoiceId) {
          invoicesApi.update(invoiceId, {
            items: JSON.stringify(items),
            totalAmount: items.reduce((sum, item) => sum + (item.einzelpreis * item.anzahl), 0)
          }).then(() => {
          }).catch(err => {
            console.error('❌ Error saving:', err);
          });
        }
        return;
      }

      // No firma - unlock and auto-calculate
      if (!hasFirma) {

        // Clear lock from localStorage
        localStorage.removeItem(lockKey);
        lockedInvoiceIdRef.current = null;
        lockedItemsRef.current = null;

        const items = initializeInvoiceItems();
        setInvoiceItems(items);
      }
    }
  }, [booking, tourists, roomingListData, loading, invoice?.id, invoice?.firma, invoice?.items, totalPrices]);

  // Calculate total
  const calculateTotal = () => {
    const items = Array.isArray(invoiceItems) ? invoiceItems : [];
    return items.reduce((sum, item) => {
      return sum + (item.einzelpreis * item.anzahl);
    }, 0);
  };

  // Calculate final amount
  // Neue Rechnung: Total - Already Paid
  // Gutschrift: Already Paid - Total (reversed, shows negative for credit)
  const calculateGesamtbetrag = () => {
    if (invoiceType === 'Gutschrift') {
      return bezahlteRechnung - calculateTotal();
    }
    return calculateTotal() - bezahlteRechnung;
  };

  // Update invoice totalAmount and items when items change
  useEffect(() => {
    if (invoice?.id && invoiceItems.length > 0) {
      // For Neue Rechnung (showThreeRows), save Gesamtbetrag (Total - Already Paid)
      // For regular Rechnung, save Total
      const amountToSave = showThreeRows ? calculateGesamtbetrag() : calculateTotal();

      // Debounce the update to avoid too many API calls
      const timer = setTimeout(async () => {
        try {
          // Save both totalAmount AND items (items as JSON string)
          await invoicesApi.update(invoice.id, {
            totalAmount: amountToSave,
            items: JSON.stringify(invoiceItems)
          });
        } catch (error) {
          console.error('Error updating invoice:', error);
        }
      }, 1000); // Wait 1 second after last change

      return () => clearTimeout(timer);
    }
  }, [invoiceItems, invoice?.id, bezahlteRechnung, showThreeRows]);

  // Get tour description
  const getTourDescription = () => {
    // For Gutschrift, show special message with invoice number
    if (invoiceType === 'Gutschrift') {
      // Use manual input if available, otherwise use invoice number, otherwise 'N/A'
      const invoiceNumber = manualInvoiceNr || invoice?.invoiceNumber || 'N/A';
      return `Hiermit ist eine Gutschrift zu unserer Rechnung Nr: ${invoiceNumber}`;
    }

    // For regular Rechnung and Neue Rechnung, show tour info
    if (booking?.departureDate && booking?.endDate) {
      const pax = tourists?.length || booking?.pax || 0;
      const startDate = format(new Date(booking.departureDate), 'dd.MM');
      const endDate = format(new Date(booking.endDate), 'dd.MM.yyyy');

      const tourTypeCode = typeof booking?.tourType === 'string'
        ? booking?.tourType
        : booking?.tourType?.code;

      let tourName;
      if (tourTypeCode === 'KAS') {
        tourName = 'Kasakistan, Kirgistan und Usbekistan';
      } else if (tourTypeCode === 'ZA') {
        tourName = 'Zentralasien';
      } else if (tourTypeCode === 'CO') {
        tourName = 'Usbekistan ComfortPlus';
      } else {
        tourName = 'Usbekistan mit Turkmenistan';
      }

      return `für die Erlebnisreisen ${tourName} (${pax} Personen) ${startDate}- ${endDate} (Usbekistan Teil)`;
    }
    return 'für die Erlebnisreisen Usbekistan';
  };

  useImperativeHandle(ref, () => ({
    generateOrientInsightBlob: () => generateOrientInsightPDF(true),
    generateInfuturestormBlob: () => generateInfuturestormPDF(true)
  }));

  // Generate Orient Insight PDF
  const generateOrientInsightPDF = (returnBlob = false) => {

    try {
      const doc = new jsPDF();
      let yPos = 15;

      // Load and add Orient Insight logo (smaller)
      const logoImg = new Image();
      logoImg.src = '/logo.png';

      // Add logo at top center (smaller size)
      try {
        doc.addImage(logoImg, 'PNG', 90, yPos, 30, 30);
        yPos += 33;
      } catch (e) {
        yPos += 8;
      }

      // Company addresses side by side (more compact)
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');

      // Left side - ORIENT INSIGHT GmbH
      doc.text('ORIENT INSIGHT GmbH', 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('Shota Rustavelli, 45', 15, yPos + 4);
      doc.text('140100 Samarkand', 15, yPos + 8);
      doc.text('Usbekistan', 15, yPos + 12);
      doc.text('Tel: +998933484208', 15, yPos + 16);
      doc.text('Tel: +998979282814', 15, yPos + 20);
      doc.text('E-Mail:orientinsightreisen@gmail.com', 15, yPos + 24);
      doc.text('Web: www.orient-insight.uz', 15, yPos + 28);

      // Right side - WORLD INSIGHT Erlebnisreisen GmbH
      doc.setFont('helvetica', 'bold');
      doc.text('WORLD INSIGHT Erlebnisreisen GmbH', 195, yPos, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text('Alter Deutzer Postweg 99', 195, yPos + 4, { align: 'right' });
      doc.text('51149 Köln', 195, yPos + 8, { align: 'right' });
      doc.text('Deutschland', 195, yPos + 12, { align: 'right' });
      doc.text('Tel: 02203 - 9255700', 195, yPos + 16, { align: 'right' });
      doc.text('Fax: 02203 - 9255777', 195, yPos + 20, { align: 'right' });
      doc.text('E-Mail: info@world-insight.de', 195, yPos + 24, { align: 'right' });
      doc.text('Web: www.world-insight.de', 195, yPos + 28, { align: 'right' });

      yPos += 35;

      // Title "Rechnung", "Neue Rechnung", or "Gutschrift"
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const pdfTitle = invoiceType === 'Gutschrift' ? 'Gutschrift' : (showThreeRows ? 'Neue Rechnung' : 'Rechnung');
      doc.text(pdfTitle, 105, yPos, { align: 'center' });
      yPos += 8;

      // Tour description
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const tourDesc = getTourDescription();
      doc.text(tourDesc, 105, yPos, { align: 'center', maxWidth: 180 });
      yPos += 10;

      // Rechnung Nr and Datum on same line
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      // Only show invoice number if firma is selected and sequential number exists
      const displayNumber = (invoice?.firma && sequentialNumber > 0) ? sequentialNumber : '';
      if (displayNumber) {
        doc.text(`Rechnung Nr: ${displayNumber}`, 15, yPos);
      }
      doc.text(`Datum:`, 155, yPos);
      doc.text(`${format(new Date(), 'dd.MM.yyyy')}`, 195, yPos, { align: 'right' });
      yPos += 10;

      // Invoice table (more compact)
      const tableData = (Array.isArray(invoiceItems) ? invoiceItems : []).map((item, index) => [
        (index + 1).toString(),
        item.description,
        item.einzelpreis.toString(),
        item.anzahl.toString(),
        (item.einzelpreis * item.anzahl).toString(),
        item.currency
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['№', 'Beschreibung', 'Einzelpreis', 'Anzahl', 'Gesamtpreis', 'Währung']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 75 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY;

      // Total rows - conditional based on showThreeRows (Neue Rechnung vs regular Rechnung)
      if (showThreeRows) {
        // For Neue Rechnung: show 3 rows (TOTAL, Already Paid, Final Amount)
        autoTable(doc, {
          startY: yPos,
          body: [
            ['', 'TOTAL:', '', '', calculateTotal().toString(), 'USD'],
            ['', `Bereits bezahlte Rechnung Nr. ${bezahlteRechnungNr || ''}`, '', '', bezahlteRechnung.toString(), 'USD'],
            ['', 'Gesamtbetrag:', '', '', calculateGesamtbetrag().toString(), 'USD']
          ],
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 2,
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 75 },
            2: { halign: 'right', cellWidth: 28 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 30 },
            5: { halign: 'center', cellWidth: 25 }
          }
        });
      } else {
        // For regular Rechnung: show single Gesamtbetrag row
        autoTable(doc, {
          startY: yPos,
          body: [['', 'Gesamtbetrag:', '', '', calculateTotal().toString(), 'USD']],
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 2,
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 75 },
            2: { halign: 'right', cellWidth: 28 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 30 },
            5: { halign: 'center', cellWidth: 25 }
          }
        });
      }

      yPos = doc.lastAutoTable.finalY + 10;

      // Bank details section (single line format with proper alignment)
      const leftCol = 15;
      const rightCol = 85;

      doc.setFontSize(8);

      doc.setFont('helvetica', 'bold');
      doc.text('Beneficiary:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('LLC "ORIENT INSIGHT", SHOTA RUSTAVELLI, 45  SAMARKAND CITY, UZBEKISTAN', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text("Beneficiary's Account:", leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('20208840905364923001 (USD)', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Beneficiary Bank:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('PJSCB "ORIENT FINANS" SAMARKAND BRANCH, SAMARKAND, UZBEKISTAN', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('S.W.I.F.T. CODE:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('ORFBUZ22', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text("Beneficiary's Bank correspondent:", leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('National Bank of Uzbekistan', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text("Correspondent's account:", leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('21002840200010071001 (USD)  /  21002978100010071001 (EUR)', rightCol, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('S.W.I.F.T. CODE:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('NBFAUZ2X', rightCol, yPos);
      yPos += 10;

      // Closing
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('mit freundlichen Grüßen', 15, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'bold');
      doc.text('ORIENT INSIGHT GmbH', 15, yPos);

      // Save or return blob
      const docType = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
      const filename = `${docType}_OrientInsight_${booking?.bookingNumber || 'invoice'}.pdf`;
      if (returnBlob) return doc.output('blob');
      doc.save(filename);
      toast.success('Orient Insight PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  // Generate INFUTURESTORM PDF
  const generateInfuturestormPDF = (returnBlob = false) => {

    try {
      const doc = new jsPDF();
      let yPos = 20;

      // Load and add INFUTURESTORM logo
      const logoImg = new Image();
      // Try PNG first, fallback to SVG
      logoImg.src = '/infuturestorm-logo.png';

      // Add logo at top center (if available)
      try {
        doc.addImage(logoImg, 'PNG', 85, yPos, 40, 40);
        yPos += 45;
      } catch (e) {
        // Try SVG if PNG fails
        try {
          logoImg.src = '/infuturestorm-logo.svg';
          doc.addImage(logoImg, 'SVG', 85, yPos, 40, 40);
          yPos += 45;
        } catch (e2) {
          yPos += 10;
        }
      }

      // Company addresses side by side
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');

      // Left side - INFUTURESTORM PTE. LTD.
      doc.text('INFUTURESTORM PTE. LTD.', 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text('6 EU TONG SEN STREET #11-10I', 15, yPos + 5);
      doc.text('059817 THE CENTRAL SINGAPORE', 15, yPos + 10);
      doc.text('SINGAPORE', 15, yPos + 15);
      doc.text('Telefon:  +998933484208', 15, yPos + 20);
      doc.text('Telefon:  +998979282814', 15, yPos + 25);
      doc.text('E-Mail:orientinsightreisen@gmail.com', 15, yPos + 30);
      doc.text('Web: www.orient-insight.uz', 15, yPos + 35);

      // Right side - WORLD INSIGHT Erlebnisreisen GmbH
      doc.setFont('helvetica', 'bold');
      doc.text('WORLD INSIGHT Erlebnisreisen GmbH', 195, yPos, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text('Alter Deutzer Postweg 99', 195, yPos + 5, { align: 'right' });
      doc.text('51149 Köln', 195, yPos + 10, { align: 'right' });
      doc.text('Deutschland', 195, yPos + 15, { align: 'right' });
      doc.text('Telefon:  02203 - 9255700', 195, yPos + 20, { align: 'right' });
      doc.text('Telefax: 02203 - 9255777', 195, yPos + 25, { align: 'right' });
      doc.text('E-Mail: info@world-insight.de', 195, yPos + 30, { align: 'right' });
      doc.text('Web: www.world-insight.de', 195, yPos + 35, { align: 'right' });

      yPos += 50;

      // Title "Rechnung", "Neue Rechnung", or "Gutschrift"
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const pdfTitle = invoiceType === 'Gutschrift' ? 'Gutschrift' : (showThreeRows ? 'Neue Rechnung' : 'Rechnung');
      doc.text(pdfTitle, 105, yPos, { align: 'center' });
      yPos += 10;

      // Tour description
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const tourDesc = getTourDescription();
      doc.text(tourDesc, 105, yPos, { align: 'center', maxWidth: 180 });
      yPos += 15;

      // Rechnung Nr and Datum on same line
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      // Only show invoice number if firma is selected and sequential number exists
      const displayNumber = (invoice?.firma && sequentialNumber > 0) ? sequentialNumber : '';
      if (displayNumber) {
        doc.text(`Rechnung Nr: ${displayNumber}`, 15, yPos);
      }
      doc.text(`Datum:`, 155, yPos);
      doc.text(`${format(new Date(), 'dd.MM.yyyy')}`, 195, yPos, { align: 'right' });
      yPos += 15;

      // Invoice table
      const tableData = (Array.isArray(invoiceItems) ? invoiceItems : []).map((item, index) => [
        (index + 1).toString(),
        item.description,
        item.einzelpreis.toString(),
        item.anzahl.toString(),
        (item.einzelpreis * item.anzahl).toString(),
        item.currency
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['№', 'Beschreibung', 'Einzelpreis', 'Anzahl', 'Gesamtpreis', 'Währung']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'left', cellWidth: 75 },
          2: { halign: 'right', cellWidth: 28 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
          5: { halign: 'center', cellWidth: 25 }
        }
      });

      yPos = doc.lastAutoTable.finalY;

      // Total rows - conditional based on showThreeRows (Neue Rechnung vs regular Rechnung)
      if (showThreeRows) {
        // For Neue Rechnung: show 3 rows (TOTAL, Already Paid, Final Amount)
        autoTable(doc, {
          startY: yPos,
          body: [
            ['', 'TOTAL:', '', '', calculateTotal().toString(), 'USD'],
            ['', `Bereits bezahlte Rechnung Nr. ${bezahlteRechnungNr || ''}`, '', '', bezahlteRechnung.toString(), 'USD'],
            ['', 'Gesamtbetrag:', '', '', calculateGesamtbetrag().toString(), 'USD']
          ],
          theme: 'grid',
          styles: {
            fontSize: 11,
            cellPadding: 3,
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold'
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 75 },
            2: { halign: 'right', cellWidth: 28 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 30 },
            5: { halign: 'center', cellWidth: 25 }
          }
        });
      } else {
        // For regular Rechnung: show single Gesamtbetrag row
        autoTable(doc, {
          startY: yPos,
          body: [['', 'Gesamtbetrag:', '', '', calculateTotal().toString(), 'USD']],
          theme: 'grid',
          styles: {
            fontSize: 11,
            cellPadding: 3,
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          bodyStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'left', cellWidth: 75 },
            2: { halign: 'right', cellWidth: 28 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 30 },
            5: { halign: 'center', cellWidth: 25 }
          }
        });
      }

      yPos = doc.lastAutoTable.finalY + 10;

      // Bank details section
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Company Name: INFUTURESTORM PTE. LTD.', 15, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('Bank details:', 15, yPos);
      yPos += 5;
      doc.text('OCBC (Oversea-Chinese Banking Corporation) Limited Singapore', 15, yPos);
      yPos += 5;
      doc.text('Bank address: OCBC Bank, 65 Chulia Street, OCBC Centre, Singapore 049513', 15, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'bold');
      doc.text('Business Accounts: 601365554201(USD)', 15, yPos);
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      doc.text('SWIFT BIC code: (for TT in USD) Intermediary Bank JP Morgan Chase Bank,', 15, yPos);
      yPos += 5;
      doc.text('New York, USA – CHASUS33', 15, yPos);
      yPos += 5;
      doc.text('BANK CODE: 7339', 15, yPos);
      yPos += 5;
      doc.text('BRANCH CODE: 601', 15, yPos);
      yPos += 5;
      doc.text('www.ocbc.com', 15, yPos);
      yPos += 15;

      // Closing
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('mit freundlichen Grüßen', 15, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'bold');
      doc.text('INFUTURESTORM PTE. LTD', 15, yPos);

      // Save or return blob
      const docType = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
      const filename = `${docType}_INFUTURESTORM_${booking?.bookingNumber || 'invoice'}.pdf`;
      if (returnBlob) return doc.output('blob');
      doc.save(filename);
      toast.success('INFUTURESTORM PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Add new item
  const addItem = () => {
    const items = Array.isArray(invoiceItems) ? invoiceItems : [];
    const newItem = {
      id: Math.max(...items.map(i => i.id), 0) + 1,
      description: 'New Item',
      einzelpreis: 0,
      anzahl: 1,
      currency: 'USD'
    };
    setInvoiceItems([...items, newItem]);
  };

  // Delete item
  const deleteItem = (id) => {
    const items = Array.isArray(invoiceItems) ? invoiceItems : [];
    setInvoiceItems(items.filter(item => item.id !== id));
  };

  // Update item
  const updateItem = (id, field, value) => {
    const items = Array.isArray(invoiceItems) ? invoiceItems : [];
    setInvoiceItems(items.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  return (
    <div className="bg-gradient-to-br from-gray-50 to-amber-50 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Action buttons */}
        <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:justify-end print:hidden">
          <button
            onClick={addItem}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
          <button
            onClick={() => generateOrientInsightPDF()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg font-semibold"
          >
            <Download className="w-5 h-5" />
            PDF (Orient Insight)
          </button>
          {onWorldInsightSend && (
            <button
              onClick={onWorldInsightSend}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl hover:from-emerald-700 hover:to-teal-800 transition-all shadow-lg font-semibold"
              title="Hotelliste + Rechnung als eine E-Mail an World Insight senden"
            >
              <Mail className="w-5 h-5" />
              An World Insight senden
            </button>
          )}
          <button
            onClick={() => generateInfuturestormPDF()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg font-semibold"
          >
            <Download className="w-5 h-5" />
            PDF (INFUTURESTORM)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all shadow-lg font-semibold"
          >
            <Printer className="w-5 h-5" />
            Печать
          </button>
        </div>

        {/* Document preview */}
        <div className="bg-white md:rounded-2xl shadow-md md:shadow-2xl overflow-hidden print:shadow-none print:rounded-none border-y md:border border-gray-100">
          <div className="p-4 md:p-16 print:p-12" style={{ fontFamily: 'Georgia, serif' }}>
            {/* Decorative header line */}
            <div className="w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-full mb-4 md:mb-8"></div>

            {/* Title */}
            <h1 className="text-2xl md:text-5xl font-bold text-center mb-4 md:mb-6 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
              {invoiceType === 'Gutschrift' ? 'Gutschrift' : (showThreeRows ? 'Neue Rechnung' : 'Rechnung')}
            </h1>

            {/* Tour description */}
            {invoiceType === 'Gutschrift' ? (
              <p className="text-center text-base text-gray-700 mb-8 leading-relaxed px-8">
                Hiermit ist eine Gutschrift zu unserer Rechnung Nr:{' '}
                <input
                  type="text"
                  value={manualInvoiceNr}
                  onChange={(e) => setManualInvoiceNr(e.target.value)}
                  placeholder="N/A"
                  className="inline-block w-24 px-2 py-1 border-b-2 border-gray-400 focus:border-blue-500 focus:outline-none text-center font-semibold bg-transparent print:border-none"
                />
              </p>
            ) : (
              <p className="text-center text-base text-gray-700 mb-8 leading-relaxed px-8">
                {getTourDescription()}
              </p>
            )}

            {/* Rechnung Nr and Datum with styled boxes */}
            <div className="flex justify-between mb-6 md:mb-12 text-base gap-3 md:gap-4">
              <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 md:p-4 border-2 border-amber-200 shadow-md">
                <div className="text-xs md:text-sm text-gray-600 mb-1">Rechnung Nr:</div>
                <div className="font-bold text-base md:text-xl text-gray-900">
                  {invoice?.firma && sequentialNumber > 0 ? sequentialNumber : ''}
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 md:p-4 border-2 border-blue-200 shadow-md text-right">
                <div className="text-xs md:text-sm text-gray-600 mb-1">Datum:</div>
                <div className="font-bold text-base md:text-xl text-gray-900">{format(new Date(), 'dd.MM.yyyy')}</div>
              </div>
            </div>

            {/* Invoice items — mobile: cards, desktop: table */}
            <div className="shadow-lg rounded-lg overflow-hidden">
              {/* MOBILE: card view */}
              <div className="md:hidden space-y-3 mb-3">
                {(Array.isArray(invoiceItems) ? invoiceItems : []).map((item, index) => (
                  <div key={item.id} className="border-2 border-amber-200 rounded-xl overflow-hidden bg-white">
                    {/* card header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-amber-100 border-b border-amber-200">
                      <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{formatNumber(item.einzelpreis * item.anzahl)}</span>
                        <span className="text-xs text-gray-600">{item.currency}</span>
                        <button onClick={() => deleteItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded print:hidden">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {/* description */}
                    <div className="px-3 py-2">
                      <input
                        id={`desc-${item.id}`}
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        className="w-full text-sm text-gray-900 bg-transparent border-b border-gray-200 focus:border-amber-400 focus:outline-none py-1"
                        placeholder="Beschreibung..."
                      />
                    </div>
                    {/* price × qty */}
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      <div>
                        <label className="text-xs text-gray-500">Einzelpreis</label>
                        <input
                          type="number"
                          value={item.einzelpreis}
                          onChange={(e) => updateItem(item.id, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="w-full text-sm font-semibold text-gray-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Anzahl</label>
                        <input
                          type="number"
                          value={item.anzahl}
                          onChange={(e) => updateItem(item.id, 'anzahl', parseInt(e.target.value) || 0)}
                          className="w-full text-sm font-semibold text-gray-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {/* Mobile summary rows */}
                {showThreeRows ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-100 rounded-xl border-2 border-blue-200">
                      <span className="font-bold text-gray-900">TOTAL</span>
                      <div className="flex items-center gap-2"><span className="font-bold text-lg text-gray-900">{formatNumber(calculateTotal())}</span><span className="text-xs text-gray-600">USD</span></div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border-2 border-gray-200">
                      <span className="text-sm text-gray-700">
                        Bereits bezahlt Nr.{' '}
                        <input type="text" value={bezahlteRechnungNr} onChange={(e) => setBezahlteRechnungNr(e.target.value)} className="w-12 border-b border-gray-300 focus:border-emerald-500 outline-none font-semibold bg-transparent text-center" placeholder="1" />
                      </span>
                      <div className="flex items-center gap-2">
                        <input type="number" value={bezahlteRechnung} onChange={(e) => setBezahlteRechnung(parseFloat(e.target.value) || 0)} className="w-24 text-right font-semibold bg-yellow-50 border border-yellow-200 rounded px-2 py-1 focus:outline-none" />
                        <span className="text-xs text-gray-600">USD</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-emerald-100 rounded-xl border-2 border-emerald-200">
                      <span className="font-bold text-gray-900">Gesamtbetrag:</span>
                      <div className="flex items-center gap-2"><span className="font-bold text-lg text-gray-900">{formatNumber(calculateGesamtbetrag())}</span><span className="text-xs text-gray-600">USD</span></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-100 rounded-xl border-2 border-emerald-200">
                    <span className="font-bold text-gray-900">Gesamtbetrag:</span>
                    <div className="flex items-center gap-2"><span className="font-bold text-lg text-gray-900">{formatNumber(calculateTotal())}</span><span className="text-xs text-gray-600">USD</span></div>
                  </div>
                )}
              </div>

              {/* DESKTOP: table */}
              <table className="hidden md:table w-full border-collapse">
                <thead>
                  <tr className="bg-amber-100">
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">№</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Beschreibung</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Einzelpreis</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Anzahl</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Gesamtpreis</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm">Währung</th>
                    <th className="border border-gray-300 px-4 py-3 text-center font-bold text-gray-900 text-sm print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(invoiceItems) ? invoiceItems : []).map((item, index) => (
                    <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors duration-150">
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-medium">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-3 text-gray-900">
                        <input
                          id={`desc-${item.id}`}
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-none focus:outline-none focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-gray-900 font-semibold">
                        <input
                          id={`price-${item.id}`}
                          type="number"
                          value={item.einzelpreis}
                          onChange={(e) => updateItem(item.id, 'einzelpreis', parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
                        <input
                          id={`quantity-${item.id}`}
                          type="number"
                          value={item.anzahl}
                          onChange={(e) => updateItem(item.id, 'anzahl', parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:outline-none text-center focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-base">
                        {formatNumber(item.einzelpreis * item.anzahl)}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">{item.currency}</td>
                      <td className="border border-gray-300 px-4 py-3 text-center print:hidden">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              const input = document.getElementById(`desc-${item.id}`);
                              if (input) input.focus();
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit description"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Summary rows - conditional based on showThreeRows prop */}
                  {showThreeRows ? (
                    <>
                      {/* TOTAL row */}
                      <tr className="bg-blue-100">
                        <td className="border border-gray-300 px-4 py-3 text-center"></td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-gray-900 text-base">
                          TOTAL
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-lg">
                          {formatNumber(calculateTotal())}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                          USD
                        </td>
                        <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
                      </tr>

                      {/* Already paid invoice row */}
                      <tr className="bg-white">
                        <td className="border border-gray-300 px-4 py-3 text-center"></td>
                        <td className="border border-gray-300 px-4 py-3 text-gray-900 text-sm">
                          Bereits bezahlte Rechnung Nr.{' '}
                          <input
                            id="bezahlte-rechnung-nr"
                            type="text"
                            value={bezahlteRechnungNr}
                            onChange={(e) => setBezahlteRechnungNr(e.target.value)}
                            className="w-16 border-b border-gray-300 focus:border-emerald-500 outline-none print:border-none font-semibold"
                            placeholder="1"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-semibold text-gray-900 bg-yellow-100">
                          <input
                            id="bezahlte-rechnung-amount"
                            type="number"
                            value={bezahlteRechnung}
                            onChange={(e) => setBezahlteRechnung(parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-none focus:outline-none text-right focus:bg-yellow-50 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                            title="Click to edit amount"
                          />
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">USD</td>
                        <td className="border border-gray-300 px-4 py-3 text-center print:hidden">
                          <button
                            onClick={() => {
                              const input = document.getElementById('bezahlte-rechnung-nr');
                              if (input) input.focus();
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit invoice number"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>

                      {/* Final amount row */}
                      <tr className="bg-emerald-100">
                        <td className="border border-gray-300 px-4 py-3 text-center"></td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-gray-900 text-base">
                          Gesamtbetrag:
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-lg">
                          {formatNumber(calculateGesamtbetrag())}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                          USD
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center print:hidden">
                          <button
                            onClick={() => {
                              const input = document.getElementById('bezahlte-rechnung-amount');
                              if (input) input.focus();
                            }}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="Edit amount"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    </>
                  ) : (
                    <>
                      {/* Single Gesamtbetrag row (old style) */}
                      <tr className="bg-emerald-100">
                        <td className="border border-gray-300 px-4 py-3 text-center"></td>
                        <td className="border border-gray-300 px-4 py-3 font-bold text-gray-900 text-base">
                          Gesamtbetrag:
                        </td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3"></td>
                        <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-lg">
                          {formatNumber(calculateTotal())}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                          USD
                        </td>
                        <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:rounded-none {
            border-radius: 0 !important;
          }
          .print\\:p-12 {
            padding: 3rem !important;
          }
          input {
            border: none !important;
            background: transparent !important;
          }
        }
      `}</style>
    </div>
  );
});

export default RechnungDocument;
