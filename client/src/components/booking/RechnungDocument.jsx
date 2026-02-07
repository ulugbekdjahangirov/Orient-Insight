import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Download, Printer, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api, { invoicesApi } from '../../services/api';

const RechnungDocument = ({ booking, tourists, showThreeRows = false, invoice = null, invoiceType = 'Rechnung', previousInvoiceNumber = '', sequentialNumber = 0, previousInvoiceAmount = 0 }) => {
  const [roomingListData, setRoomingListData] = useState(null);
  const [loading, setLoading] = useState(true);
  const lockedInvoiceIdRef = React.useRef(null); // Track which invoice ID is locked
  const lockedItemsRef = React.useRef(null); // Store locked items

  // Load rooming list data for the first accommodation (arrival hotel)
  useEffect(() => {
    const loadRoomingListData = async () => {
      if (!booking?.id) {
        setLoading(false);
        return;
      }

      try {
        console.log('🔄 Loading accommodations for booking', booking.id);

        // 1. Get all accommodations
        const accommodationsResponse = await api.get(`/bookings/${booking.id}/accommodations`);
        console.log('📦 Raw API response:', accommodationsResponse);

        // API returns { accommodations: [...] }, not directly an array
        const accommodations = accommodationsResponse.data.accommodations || accommodationsResponse.data;
        console.log('🏨 Accommodations data:', accommodations);
        console.log('🔍 Is array?', Array.isArray(accommodations));
        console.log('🔍 Type:', typeof accommodations);

        if (!accommodations || !Array.isArray(accommodations) || accommodations.length === 0) {
          console.log('⚠️ No accommodations found or not an array');
          setLoading(false);
          return;
        }

        // 2. Sort by checkInDate to find the first/arrival hotel
        console.log('📊 Sorting accommodations...');
        const sortedAccommodations = accommodations.slice().sort((a, b) => {
          const dateA = new Date(a.checkInDate);
          const dateB = new Date(b.checkInDate);
          return dateA - dateB;
        });
        console.log('✅ Sorted accommodations:', sortedAccommodations);

        const firstAccommodation = sortedAccommodations[0];
        console.log('🏨 First accommodation (arrival hotel):', firstAccommodation);

        // 3. Get rooming list for the first accommodation
        const roomingListResponse = await api.get(
          `/bookings/${booking.id}/accommodations/${firstAccommodation.id}/rooming-list`
        );

        console.log('📋 Rooming list data:', roomingListResponse.data);
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

  // Get ER price from saved Total Prices in localStorage
  const calculateERPrice = () => {
    const touristCount = tourists?.length || booking?.pax || 0;
    const tier = getPaxTier(touristCount);

    console.log('🔵 Rechnung: Getting ER price for', touristCount, 'tourists, tier:', tier);

    // Load saved Total Prices from localStorage
    const savedTotalPrices = JSON.parse(localStorage.getItem('er-total-prices') || '{}');

    console.log('📦 Loaded Total Prices from localStorage:', savedTotalPrices);

    // Get prices for this tier
    const tierPrices = savedTotalPrices[tier.id] || { totalPrice: 0, ezZuschlag: 0 };

    console.log('💰 Prices for tier', tier.id, ':', tierPrices);

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
    console.log('🎂 calculateBirthdayCount called');
    console.log('📋 Booking dates:', booking?.departureDate, 'to', booking?.endDate);
    console.log('👥 Tourists count:', tourists?.length);

    if (!tourists || tourists.length === 0) {
      console.log('⚠️ No tourists');
      return 0;
    }

    if (!booking?.departureDate || !booking?.endDate) {
      console.log('⚠️ No booking dates');
      return 0;
    }

    const tourStart = new Date(booking.departureDate);
    const tourEnd = new Date(booking.endDate);

    let birthdayCount = 0;

    tourists.forEach((tourist, index) => {
      console.log(`👤 Tourist ${index + 1}:`, tourist);
      console.log(`  - firstName: ${tourist.firstName}`);
      console.log(`  - dateOfBirth: ${tourist.dateOfBirth}`);
      console.log(`  - remarks: ${tourist.remarks}`);

      // Method 1: Check if dateOfBirth exists and falls within tour
      const birthDateField = tourist.dateOfBirth || tourist.birthDate || tourist.birthday;

      if (birthDateField) {
        const birthDate = new Date(birthDateField);

        // Get the birthday in the tour year
        const tourYear = tourStart.getFullYear();
        const birthdayThisYear = new Date(tourYear, birthDate.getMonth(), birthDate.getDate());

        console.log(`🎂 ${tourist.firstName || 'Unknown'}: dateOfBirth=${birthDateField}, birthdayThisYear=${birthdayThisYear.toDateString()}`);

        // Check if birthday falls within tour dates
        if (birthdayThisYear >= tourStart && birthdayThisYear <= tourEnd) {
          birthdayCount++;
          console.log(`🎉 Birthday during tour (from dateOfBirth)! ${tourist.firstName}`);
        }
      }
      // Method 2: Check remarks field for "Birthday" or "Geburtstag" keyword
      else if (tourist.remarks) {
        const remarksLower = tourist.remarks.toLowerCase();
        if (remarksLower.includes('birthday') || remarksLower.includes('geburtstag')) {
          birthdayCount++;
          console.log(`🎉 Birthday during tour (from remarks: ${tourist.remarks})! ${tourist.firstName}`);
        }
      }
    });

    console.log(`🎂 Total birthdays during tour: ${birthdayCount}`);
    return birthdayCount;
  };

  // Calculate early arrivals (Zusatznacht)
  const calculateEarlyArrivals = () => {
    console.log('🔍 calculateEarlyArrivals called');
    console.log('📋 Rooming list data:', roomingListData);

    // API returns { roomingList: [...] }, not directly an array
    const roomingList = roomingListData?.roomingList || roomingListData;
    console.log('📋 Rooming list array:', roomingList);

    if (!roomingList || !Array.isArray(roomingList) || roomingList.length === 0) {
      console.log('⚠️ No rooming list data found or not an array');
      return { ezNights: 0, dzNights: 0 };
    }

    // Find the group's actual check-in date (most common check-in date among tourists in rooming list)
    const checkInDates = {};
    roomingList.forEach(entry => {
      const touristName = entry.tourist?.firstName || 'Unknown';
      console.log(`📋 Full entry for ${touristName}:`, entry);
      console.log(`  - checkInDate: ${entry.checkInDate}`);
      console.log(`  - checkOutDate: ${entry.checkOutDate}`);
      console.log(`  - tourist.roomPreference: ${entry.tourist?.roomPreference}`);
      console.log(`  - roomType: ${entry.roomType}`);
      console.log(`  - assignedRoomType: ${entry.assignedRoomType}`);

      if (entry.checkInDate) {
        const dateStr = entry.checkInDate.split('T')[0]; // Get date part only
        checkInDates[dateStr] = (checkInDates[dateStr] || 0) + 1;
      }
    });

    console.log('📅 Check-in dates found:', checkInDates);

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
      console.log('⚠️ No group check-in date found');
      return { ezNights: 0, dzNights: 0 };
    }

    console.log(`📅 Group check-in date: ${groupCheckInDate} (${maxCount} tourists)`);

    const groupArrival = new Date(groupCheckInDate);
    let ezNights = 0; // Single room early nights
    let dzNights = 0; // Double room early nights

    roomingList.forEach(entry => {
      if (entry.checkInDate) {
        const touristArrival = new Date(entry.checkInDate);
        const daysDiff = Math.floor((groupArrival - touristArrival) / (1000 * 60 * 60 * 24));

        const touristName = entry.tourist?.firstName || 'Unknown';
        console.log(`📆 ${touristName}: touristArrival=${touristArrival}, groupArrival=${groupArrival}, daysDiff=${daysDiff}`);

        if (daysDiff > 0) {
          // Tourist arrived earlier than group
          // Get room preference from tourists array (since rooming list doesn't include it)
          const touristId = entry.id || entry.touristId;
          const fullTourist = tourists?.find(t => t.id === touristId);
          const roomPreference = fullTourist?.roomPreference || entry.tourist?.roomPreference || entry.roomPreference || '';
          const room = roomPreference.toUpperCase();
          const isEZ = room === 'EZ' || room === 'SNGL' || room === 'SINGLE';

          console.log(`👤 Entry ID: ${entry.id}, Tourist ID: ${touristId}`);
          console.log(`👤 Found in tourists array:`, fullTourist);
          console.log(`🛏️ Room preference: ${roomPreference}, isEZ: ${isEZ}`);

          if (isEZ) {
            ezNights += daysDiff;
          } else {
            dzNights += daysDiff;
          }

          console.log(`🏨 Early arrival: ${touristName}, ${daysDiff} nights, room: ${room}, isEZ: ${isEZ}`);
        }
      }
    });

    console.log(`📊 Total early arrivals: EZ=${ezNights} nights, DZ=${dzNights} nights`);
    return { ezNights, dzNights };
  };

  // Initialize invoice items with calculated prices for ER
  const initializeInvoiceItems = () => {
    // tourType can be either a string 'ER' or an object { code: 'ER', ... }
    const tourTypeCode = typeof booking?.tourType === 'string'
      ? booking?.tourType
      : booking?.tourType?.code;
    const isER = tourTypeCode === 'ER';
    console.log('🟢 Rechnung: Initializing invoice items, tourType:', booking?.tourType, 'tourTypeCode:', tourTypeCode, 'isER:', isER);

    if (isER) {
      console.log('✅ Rechnung: This is an ER booking, calculating prices...');
      const { einzelpreis, ezZuschlag, anzahl } = calculateERPrice();
      const ezCount = getEZCount();
      const { ezNights, dzNights } = calculateEarlyArrivals();
      const birthdayCount = calculateBirthdayCount();

      // Load Zusatzkosten prices from localStorage
      const zusatzkostenRaw = localStorage.getItem('er_zusatzkosten') || '[]';
      console.log('📦 Raw er_zusatzkosten from localStorage:', zusatzkostenRaw);

      const zusatzkosten = JSON.parse(zusatzkostenRaw);
      console.log('📋 Parsed zusatzkosten array:', zusatzkosten);
      console.log('📋 Zusatzkosten items count:', zusatzkosten.length);

      // Log each item
      zusatzkosten.forEach((item, index) => {
        console.log(`  Item ${index + 1}: name="${item.name}", price=${item.price}, pax=${item.pax}`);
      });

      // Find items - using exact match
      console.log('🔍 Searching for specific items...');

      const zusatznachtEZ = zusatzkosten.find(item => {
        const match = item.name === 'Zusatznacht EZ';
        console.log(`  Checking "${item.name}" === "Zusatznacht EZ": ${match}`);
        return match;
      });

      const zusatznachtDZ = zusatzkosten.find(item => item.name === 'Zusatznacht DZ');

      // Search for birthday gift - use flexible matching
      const geburtstagsgeschenk = zusatzkosten.find(item => {
        const nameLower = item.name.toLowerCase();
        // Match names containing "geburt" and "geschenk" (handles typos like missing 't')
        const match = nameLower.includes('gebur') && nameLower.includes('geschenk');
        console.log(`  Checking "${item.name}" contains birthday gift: ${match}`);
        return match;
      });

      const extraTransferTaschkent = zusatzkosten.find(item => item.name === 'Extra Transfer in Taschkent');

      console.log('📋 Rechnung: Final values - Einzelpreis:', einzelpreis, 'EZ Zuschlag:', ezZuschlag, 'Anzahl:', anzahl, 'EZ Count:', ezCount);
      console.log('🏨 Early arrivals: EZ nights:', ezNights, 'DZ nights:', dzNights);
      console.log('🎂 Birthdays during tour:', birthdayCount);
      console.log('💰 Found items:', {
        zusatznachtEZ: zusatznachtEZ ? 'FOUND' : 'NOT FOUND',
        zusatznachtDZ: zusatznachtDZ ? 'FOUND' : 'NOT FOUND',
        geburtstagsgeschenk: geburtstagsgeschenk ? `FOUND (price: ${geburtstagsgeschenk.price})` : 'NOT FOUND',
        extraTransferTaschkent: extraTransferTaschkent ? 'FOUND' : 'NOT FOUND'
      });

      const items = [
        {
          id: 1,
          description: 'Usbekistan Teil',
          einzelpreis: einzelpreis,
          anzahl: anzahl,
          currency: 'USD'
        },
        {
          id: 2,
          description: 'EZ Zuschlag',
          einzelpreis: ezZuschlag,
          anzahl: ezCount,
          currency: 'USD'
        }
      ];

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
      console.log('🎁 Checking Geburtstagsgeschenk condition:');
      console.log('  - birthdayCount:', birthdayCount, '(> 0?', birthdayCount > 0, ')');
      console.log('  - geburtstagsgeschenk:', geburtstagsgeschenk);
      console.log('  - Both conditions met?', birthdayCount > 0 && geburtstagsgeschenk);

      if (birthdayCount > 0 && geburtstagsgeschenk) {
        const birthdayItem = {
          id: nextId++,
          description: 'Geburtstagsgeschenk',
          einzelpreis: geburtstagsgeschenk.price || 10,
          anzahl: birthdayCount,
          currency: 'USD'
        };
        console.log('✅ ADDING Geburtstagsgeschenk item:', birthdayItem);
        items.push(birthdayItem);
      } else {
        console.log('❌ NOT adding Geburtstagsgeschenk (condition not met)');
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

      console.log('📋 Final invoice items array:', items);
      console.log('📋 Total items count:', items.length);
      return items;
    } else {
      // Default for non-ER tours
      return [
        {
          id: 1,
          description: 'Usbekistan Teil',
          einzelpreis: 1125,
          anzahl: tourists?.length || 11,
          currency: 'USD'
        },
        {
          id: 2,
          description: 'EZ Zuschlag',
          einzelpreis: 240,
          anzahl: 5,
          currency: 'USD'
        },
        {
          id: 3,
          description: 'Zusatznacht fuer3 Naechte',
          einzelpreis: 50,
          anzahl: 3,
          currency: 'USD'
        },
        {
          id: 4,
          description: 'Extra Transfer in Taschkent',
          einzelpreis: 25,
          anzahl: 1,
          currency: 'USD'
        },
        {
          id: 5,
          description: 'Geburtstagsgeschenk',
          einzelpreis: 10,
          anzahl: 1,
          currency: 'USD'
        }
      ];
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
      console.log('✅ Using previousInvoiceAmount from prop:', previousInvoiceAmount);
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

      console.log('📊 Invoice useEffect:', {
        invoiceId,
        firma: invoice?.firma,
        touristsCount: tourists?.length,
        hasStoredLock: !!lockedData,
        storedLock: lockedData
      });

      // CRITICAL: If this invoice is locked in localStorage (firma selected), use locked items
      if (hasFirma && lockedData && lockedData.items && lockedData.items.length > 0) {
        console.log('🔒 INVOICE LOCKED (from localStorage) - using saved items, ignoring all changes');
        console.log('   Locked items:', lockedData.items);
        setInvoiceItems(lockedData.items);

        // Update refs
        lockedInvoiceIdRef.current = invoiceId;
        lockedItemsRef.current = lockedData.items;
        return; // Don't recalculate!
      }

      // If firma is selected but not locked yet, LOCK IT NOW
      if (hasFirma && !lockedData) {
        console.log('🔐 LOCKING INVOICE - firma selected, saving current values to localStorage');

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
              console.log('📥 Loaded items from database:', savedItems);
              setInvoiceItems(savedItems);

              // Save lock to localStorage
              localStorage.setItem(lockKey, JSON.stringify({ items: savedItems, firma: invoice.firma }));
              lockedInvoiceIdRef.current = invoiceId;
              lockedItemsRef.current = savedItems;
              return;
            }
          } catch (error) {
            console.error('❌ Error parsing saved items:', error);
          }
        }

        // Calculate and lock current values
        const items = initializeInvoiceItems();
        console.log('💾 Calculated items to lock:', items);
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
            console.log('✅ Invoice locked and saved to database + localStorage');
          }).catch(err => {
            console.error('❌ Error saving:', err);
          });
        }
        return;
      }

      // No firma - unlock and auto-calculate
      if (!hasFirma) {
        console.log('🔓 No firma - unlocking and auto-calculating');

        // Clear lock from localStorage
        localStorage.removeItem(lockKey);
        lockedInvoiceIdRef.current = null;
        lockedItemsRef.current = null;

        const items = initializeInvoiceItems();
        setInvoiceItems(items);
      }
    }
  }, [booking, tourists, roomingListData, loading, invoice?.id, invoice?.firma, invoice?.items]);

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
          console.log(`✅ Invoice updated: totalAmount=${amountToSave}, items saved (${invoiceItems.length} items)`);
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
      return `für die Erlebnisreisen Usbekistan mit Turkmenistan (${pax} Personen) ${startDate}- ${endDate} (Usbekistan Teil)`;
    }
    return 'für die Erlebnisreisen Usbekistan mit Turkmenistan';
  };

  // Generate Orient Insight PDF
  const generateOrientInsightPDF = () => {
    console.log('📄 Generating Orient Insight Rechnung PDF...');

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
        console.log('Logo could not be added:', e);
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

      // Title "Rechnung" or "Gutschrift"
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const pdfTitle = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
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
      const displayNumber = sequentialNumber > 0 ? sequentialNumber : (invoice?.invoiceNumber || booking?.bookingNumber || 'N/A');
      doc.text(`Rechnung Nr: ${displayNumber}`, 15, yPos);
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

      // Total row (Gesamtbetrag)
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

      // Save PDF
      const docType = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
      const filename = `${docType}_OrientInsight_${booking?.bookingNumber || 'invoice'}.pdf`;
      doc.save(filename);
      toast.success('Orient Insight PDF сақланди!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('PDF экспорт хатолиги');
    }
  };

  // Generate INFUTURESTORM PDF
  const generateInfuturestormPDF = () => {
    console.log('📄 Generating INFUTURESTORM Rechnung PDF...');

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
          console.log('INFUTURESTORM logo could not be added:', e2);
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

      // Title "Rechnung" or "Gutschrift"
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const pdfTitle = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
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
      const displayNumber = sequentialNumber > 0 ? sequentialNumber : (invoice?.invoiceNumber || booking?.bookingNumber || 'N/A');
      doc.text(`Rechnung Nr: ${displayNumber}`, 15, yPos);
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

      // Total row (Gesamtbetrag)
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

      // Save PDF
      const docType = invoiceType === 'Gutschrift' ? 'Gutschrift' : 'Rechnung';
      const filename = `${docType}_INFUTURESTORM_${booking?.bookingNumber || 'invoice'}.pdf`;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Action buttons */}
        <div className="flex gap-3 justify-end print:hidden">
          <button
            onClick={addItem}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Plus className="w-5 h-5" />
            Add Item
          </button>
          <button
            onClick={generateOrientInsightPDF}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Download className="w-5 h-5" />
            PDF (Orient Insight)
          </button>
          <button
            onClick={generateInfuturestormPDF}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Download className="w-5 h-5" />
            PDF (INFUTURESTORM)
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
          >
            <Printer className="w-5 h-5" />
            Печать
          </button>
        </div>

        {/* Document preview */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none border border-gray-100">
          <div className="p-16 print:p-12" style={{ minHeight: '297mm', fontFamily: 'Georgia, serif' }}>
            {/* Decorative header line */}
            <div className="w-full h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 rounded-full mb-8"></div>

            {/* Title */}
            <h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 bg-clip-text text-transparent">
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
            <div className="flex justify-between mb-12 text-base gap-4">
              <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200 shadow-md">
                <div className="text-sm text-gray-600 mb-1">Rechnung Nr:</div>
                <div className="font-bold text-xl text-gray-900">
                  {invoice?.firma && sequentialNumber > 0 ? sequentialNumber : ''}
                </div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200 shadow-md text-right">
                <div className="text-sm text-gray-600 mb-1">Datum:</div>
                <div className="font-bold text-xl text-gray-900">{format(new Date(), 'dd.MM.yyyy')}</div>
              </div>
            </div>

            {/* Invoice table with total row */}
            <div className="shadow-lg rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
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
                  {/* Item rows */}
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
                          title="Click to edit price"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center text-gray-900 font-semibold">
                        <input
                          id={`quantity-${item.id}`}
                          type="number"
                          value={item.anzahl}
                          onChange={(e) => updateItem(item.id, 'anzahl', parseInt(e.target.value) || 0)}
                          className="w-full bg-transparent border-none focus:outline-none text-center focus:bg-gray-100 rounded px-2 py-1 print:bg-transparent transition-all font-semibold"
                          title="Click to edit quantity"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right font-bold text-gray-900 text-base">
                        {item.einzelpreis * item.anzahl}
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
                          {calculateTotal()}
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
                          {bezahlteRechnung > 0 ? bezahlteRechnung.toFixed(2) : '0'}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">USD</td>
                        <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
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
                          {calculateGesamtbetrag()}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                          USD
                        </td>
                        <td className="border border-gray-300 px-4 py-3 print:hidden"></td>
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
                          {calculateTotal()}
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
};

export default RechnungDocument;
