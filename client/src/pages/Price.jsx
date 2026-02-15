import { useState, useEffect, useRef } from 'react';
import { DollarSign, Plus, Edit, Trash2, Save, X, Hotel, Truck, ChevronUp, ChevronDown, Train, Plane, Utensils, Camera, User, Sparkles, Calculator, Download, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pricesApi } from '../services/api';

const tourTypes = [
  { id: 'er', name: 'ER', color: 'blue' },
  { id: 'co', name: 'CO', color: 'emerald' },
  { id: 'kas', name: 'KAS', color: 'orange' },
  { id: 'za', name: 'ZA', color: 'purple' },
  { id: 'preis2026', name: 'Preis 2026', color: 'teal' },
];

const erSubTabs = [
  { id: 'hotels', name: 'Hotels', icon: Hotel },
  { id: 'transport', name: 'Transport', icon: Truck },
  { id: 'railway', name: 'Railway', icon: Train },
  { id: 'fly', name: 'Fly', icon: Plane },
  { id: 'meal', name: 'Meal', icon: Utensils },
  { id: 'sightseing', name: 'Sightseing', icon: Camera },
  { id: 'guide', name: 'Guide', icon: User },
  { id: 'shou', name: 'Shou', icon: Sparkles },
  { id: 'zusatzkosten', name: 'Zusatzkosten', icon: DollarSign },
  { id: 'total', name: 'Total', icon: Calculator },
];

const defaultHotelPrices = [
  { id: 1, city: 'Tashkent', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 2, city: 'Samarkand', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 3, city: 'Asraf', days: 1, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 4, city: 'Buchara', days: 3, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
  { id: 5, city: 'Chiwa', days: 2, pricePerDay: 0, ezZimmer: 0, ezZuschlag: 0 },
];

const paxTiers = [
  { id: '4', name: '4 PAX', count: 4 },
  { id: '5', name: '5 PAX', count: 5 },
  { id: '6-7', name: '6-7 PAX', count: 6 },
  { id: '8-9', name: '8-9 PAX', count: 8 },
  { id: '10-11', name: '10-11 PAX', count: 10 },
  { id: '12-13', name: '12-13 PAX', count: 12 },
  { id: '14-15', name: '14-15 PAX', count: 14 },
  { id: '16', name: '16 PAX', count: 16 },
];

const defaultTransportRoutes = [
  { id: 1, name: 'Taschkent', days: 1, price: 220 },
  { id: 2, name: 'Taschkent-Chimgan-Taschkent', days: 1, price: 220 },
  { id: 3, name: 'Transfer zum Bahnhof', days: 1, price: 60 },
  { id: 4, name: 'Samarkand', days: 1, price: 220 },
  { id: 5, name: 'Samarkand', days: 1, price: 220 },
  { id: 6, name: 'Samarkand', days: 1, price: 220 },
  { id: 7, name: 'Samarkand-Asraf', days: 1, price: 220 },
  { id: 8, name: 'Asraf-Bukhara', days: 1, price: 220 },
  { id: 9, name: 'Bukhara', days: 1, price: 220 },
  { id: 10, name: 'Bukhara', days: 1, price: 220 },
  { id: 11, name: 'Bukhara-Khiva', days: 1, price: 220 },
  { id: 12, name: 'Khiva-Urgench', days: 1, price: 80 },
  { id: 13, name: 'Khiva-Shovot', days: 1, price: 100 },
  { id: 14, name: 'Aeroport-Hotel', days: 1, price: 60 },
  { id: 15, name: 'Hotel-Aeroport', days: 1, price: 60 },
];

const defaultRailwayRoutes = [
  { id: 1, name: 'Taschkent-Samarkand', days: 1, price: 0 },
  { id: 2, name: 'Samarkand-Taschkent', days: 1, price: 0 },
];

const defaultFlyRoutes = [
  { id: 1, name: 'Istanbul-Taschkent', days: 1, price: 0 },
  { id: 2, name: 'Taschkent-Istanbul', days: 1, price: 0 },
];

const defaultMealItems = [
  { id: 1, name: 'Breakfast', days: 1, price: 0 },
  { id: 2, name: 'Lunch', days: 1, price: 0 },
  { id: 3, name: 'Dinner', days: 1, price: 0 },
];

const defaultSightseingItems = [
  { id: 1, name: 'Museum Entry', days: 1, price: 0 },
  { id: 2, name: 'Guide Service', days: 1, price: 0 },
];

const defaultGuideItems = [
  { id: 1, name: 'Main Guide (per day)', days: 1, price: 0 },
  { id: 2, name: 'Local Guide (per day)', days: 1, price: 0 },
];

const defaultShouItems = [
  { id: 1, name: 'Show', days: 1, price: 0 },
];

export default function Price() {
  // Format number with space as thousands separator and no decimals
  const formatPrice = (price) => {
    return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const [selectedTourType, setSelectedTourType] = useState('er');
  const [selectedERSubTab, setSelectedERSubTab] = useState('hotels');
  const [selectedCOSubTab, setSelectedCOSubTab] = useState('hotels');
  const [selectedKASSubTab, setSelectedKASSubTab] = useState('hotels');
  const [selectedZASubTab, setSelectedZASubTab] = useState('hotels');
  const [selectedPreis2026SubTab, setSelectedPreis2026SubTab] = useState('hotels');
  const [selectedPaxTier, setSelectedPaxTier] = useState('4');
  const [prices, setPrices] = useState([]);
  const [hotelPrices, setHotelPrices] = useState(defaultHotelPrices);
  const [transportRoutes, setTransportRoutes] = useState(defaultTransportRoutes);
  const [railwayRoutes, setRailwayRoutes] = useState(defaultRailwayRoutes);
  const [flyRoutes, setFlyRoutes] = useState(defaultFlyRoutes);
  const [mealItems, setMealItems] = useState(defaultMealItems);
  const [sightseingItems, setSightseingItems] = useState(defaultSightseingItems);
  const [guideItems, setGuideItems] = useState(defaultGuideItems);
  const [shouItems, setShouItems] = useState(defaultShouItems);
  const [zusatzkostenItems, setZusatzkostenItems] = useState(() => {
    const saved = localStorage.getItem('er_zusatzkosten');
    console.log('🟢 Initializing ER Zusatzkosten state from localStorage:', saved);
    const parsed = saved ? JSON.parse(saved) : [];
    console.log('🟢 Initial ER Zusatzkosten state:', parsed);
    return parsed;
  });
  const [commissionValues, setCommissionValues] = useState({
    '4': 0,
    '5': 0,
    '6-7': 0,
    '8-9': 0,
    '10-11': 0,
    '12-13': 0,
    '14-15': 0,
    '16': 0,
  });

  // CO Module States
  const [coHotelPrices, setCoHotelPrices] = useState(defaultHotelPrices);
  const [coTransportRoutes, setCoTransportRoutes] = useState(defaultTransportRoutes);
  const [coRailwayRoutes, setCoRailwayRoutes] = useState(defaultRailwayRoutes);
  const [coFlyRoutes, setCoFlyRoutes] = useState(defaultFlyRoutes);
  const [coMealItems, setCoMealItems] = useState(defaultMealItems);
  const [coSightseingItems, setCoSightseingItems] = useState(defaultSightseingItems);
  const [coGuideItems, setCoGuideItems] = useState(defaultGuideItems);
  const [coShouItems, setCoShouItems] = useState(defaultShouItems);
  const [coZusatzkostenItems, setCoZusatzkostenItems] = useState(() => {
    const saved = localStorage.getItem('co_zusatzkosten');
    return saved ? JSON.parse(saved) : [];
  });
  const [coCommissionValues, setCoCommissionValues] = useState({
    '4': 0, '5': 0, '6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14-15': 0, '16': 0,
  });

  // KAS Module States
  const [kasHotelPrices, setKasHotelPrices] = useState(defaultHotelPrices);
  const [kasTransportRoutes, setKasTransportRoutes] = useState(defaultTransportRoutes);
  const [kasRailwayRoutes, setKasRailwayRoutes] = useState(defaultRailwayRoutes);
  const [kasFlyRoutes, setKasFlyRoutes] = useState(defaultFlyRoutes);
  const [kasMealItems, setKasMealItems] = useState(defaultMealItems);
  const [kasSightseingItems, setKasSightseingItems] = useState(defaultSightseingItems);
  const [kasGuideItems, setKasGuideItems] = useState(defaultGuideItems);
  const [kasShouItems, setKasShouItems] = useState(defaultShouItems);
  const [kasZusatzkostenItems, setKasZusatzkostenItems] = useState(() => {
    const saved = localStorage.getItem('kas_zusatzkosten');
    return saved ? JSON.parse(saved) : [];
  });
  const [kasCommissionValues, setKasCommissionValues] = useState({
    '4': 0, '5': 0, '6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14-15': 0, '16': 0,
  });

  // ZA Module States
  const [zaHotelPrices, setZaHotelPrices] = useState(defaultHotelPrices);
  const [zaTransportRoutes, setZaTransportRoutes] = useState(defaultTransportRoutes);
  const [zaRailwayRoutes, setZaRailwayRoutes] = useState(defaultRailwayRoutes);
  const [zaFlyRoutes, setZaFlyRoutes] = useState(defaultFlyRoutes);
  const [zaMealItems, setZaMealItems] = useState(defaultMealItems);
  const [zaSightseingItems, setZaSightseingItems] = useState(defaultSightseingItems);
  const [zaGuideItems, setZaGuideItems] = useState(defaultGuideItems);
  const [zaShouItems, setZaShouItems] = useState(defaultShouItems);
  const [zaZusatzkostenItems, setZaZusatzkostenItems] = useState(() => {
    const saved = localStorage.getItem('za_zusatzkosten');
    return saved ? JSON.parse(saved) : [];
  });
  const [zaCommissionValues, setZaCommissionValues] = useState({
    '4': 0, '5': 0, '6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14-15': 0, '16': 0,
  });

  // Preis 2026 Module States
  const [preis2026HotelPrices, setPreis2026HotelPrices] = useState(defaultHotelPrices);
  const [preis2026TransportRoutes, setPreis2026TransportRoutes] = useState(defaultTransportRoutes);
  const [preis2026RailwayRoutes, setPreis2026RailwayRoutes] = useState(defaultRailwayRoutes);
  const [preis2026FlyRoutes, setPreis2026FlyRoutes] = useState(defaultFlyRoutes);
  const [preis2026MealItems, setPreis2026MealItems] = useState(defaultMealItems);
  const [preis2026SightseingItems, setPreis2026SightseingItems] = useState(defaultSightseingItems);
  const [preis2026GuideItems, setPreis2026GuideItems] = useState(defaultGuideItems);
  const [preis2026ShouItems, setPreis2026ShouItems] = useState(defaultShouItems);
  const [preis2026CommissionValues, setPreis2026CommissionValues] = useState({
    '4': 0, '5': 0, '6-7': 0, '8-9': 0, '10-11': 0, '12-13': 0, '14-15': 0, '16': 0,
  });

  const [editingPrice, setEditingPrice] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(12500);

  // Ref to store calculated Total Prices from table rendering
  const calculatedTotalPrices = useRef({});

  useEffect(() => {
    loadPrices();
    if (selectedTourType === 'er') {
      loadHotelPrices();
      loadTransportRoutes();
      loadRailwayRoutes();
      loadFlyRoutes();
      loadMealItems();
      loadSightseingItems();
      loadGuideItems();
      loadShouItems();
      loadCommissionValues();
      // Zusatzkosten is loaded in state initialization, no need to load again
    } else if (selectedTourType === 'co') {
      loadCoHotelPrices();
      loadCoTransportRoutes();
      loadCoRailwayRoutes();
      loadCoFlyRoutes();
      loadCoMealItems();
      loadCoSightseingItems();
      loadCoGuideItems();
      loadCoShouItems();
      loadCoCommissionValues();
      // CO Zusatzkosten is loaded in state initialization
    } else if (selectedTourType === 'kas') {
      loadKasHotelPrices();
      loadKasTransportRoutes();
      loadKasRailwayRoutes();
      loadKasFlyRoutes();
      loadKasMealItems();
      loadKasSightseingItems();
      loadKasGuideItems();
      loadKasShouItems();
      loadKasCommissionValues();
      // KAS Zusatzkosten is loaded in state initialization
    } else if (selectedTourType === 'za') {
      loadZaHotelPrices();
      loadZaTransportRoutes();
      loadZaRailwayRoutes();
      loadZaFlyRoutes();
      loadZaMealItems();
      loadZaSightseingItems();
      loadZaGuideItems();
      loadZaShouItems();
      loadZaCommissionValues();
      // ZA Zusatzkosten is loaded in state initialization
    } else if (selectedTourType === 'preis2026') {
      // Load ALL modules' data for Preis 2026 summary
      // ER
      loadHotelPrices();
      loadTransportRoutes();
      loadRailwayRoutes();
      loadFlyRoutes();
      loadMealItems();
      loadSightseingItems();
      loadGuideItems();
      loadShouItems();
      loadCommissionValues();
      // ER Zusatzkosten loaded in state initialization
      // CO
      loadCoHotelPrices();
      loadCoTransportRoutes();
      loadCoRailwayRoutes();
      loadCoFlyRoutes();
      loadCoMealItems();
      loadCoSightseingItems();
      loadCoGuideItems();
      loadCoShouItems();
      loadCoCommissionValues();
      // CO Zusatzkosten loaded in state initialization
      // KAS
      loadKasHotelPrices();
      loadKasTransportRoutes();
      loadKasRailwayRoutes();
      loadKasFlyRoutes();
      loadKasMealItems();
      loadKasSightseingItems();
      loadKasGuideItems();
      loadKasShouItems();
      loadKasCommissionValues();
      // KAS Zusatzkosten loaded in state initialization
      // ZA
      loadZaHotelPrices();
      loadZaTransportRoutes();
      loadZaRailwayRoutes();
      loadZaFlyRoutes();
      loadZaMealItems();
      loadZaSightseingItems();
      loadZaGuideItems();
      loadZaShouItems();
      loadZaCommissionValues();
      // ZA Zusatzkosten loaded in state initialization
    }
  }, [selectedTourType]);

  useEffect(() => {
    if (selectedTourType === 'er' && selectedERSubTab === 'transport') {
      loadTransportRoutes();
    } else if (selectedTourType === 'co' && selectedCOSubTab === 'transport') {
      loadCoTransportRoutes();
    } else if (selectedTourType === 'kas' && selectedKASSubTab === 'transport') {
      loadKasTransportRoutes();
    } else if (selectedTourType === 'za' && selectedZASubTab === 'transport') {
      loadZaTransportRoutes();
    } else if (selectedTourType === 'preis2026' && selectedPreis2026SubTab === 'transport') {
      loadPreis2026TransportRoutes();
    }
  }, [selectedPaxTier, selectedTourType, selectedERSubTab, selectedCOSubTab, selectedKASSubTab, selectedZASubTab, selectedPreis2026SubTab]);

  const loadPrices = () => {
    // Load from localStorage
    const storageKey = `prices-${selectedTourType}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setPrices(JSON.parse(saved));
    } else {
      // Default prices
      setPrices([
        { id: 1, category: 'Hotel', subcategory: 'Single Room', price: '' },
        { id: 2, category: 'Hotel', subcategory: 'Double Room', price: '' },
        { id: 3, category: 'Transport', subcategory: 'Bus', price: '' },
        { id: 4, category: 'Meal', subcategory: 'Breakfast', price: '' },
        { id: 5, category: 'Meal', subcategory: 'Lunch', price: '' },
        { id: 6, category: 'Meal', subcategory: 'Dinner', price: '' },
      ]);
    }
  };

  const loadHotelPrices = async () => {
    await loadPriceConfig('ER', 'hotels', selectedPaxTier, 'er-hotel-prices', defaultHotelPrices, setHotelPrices);
  };

  const loadTransportRoutes = async () => {
    await loadPriceConfig('ER', 'transport', selectedPaxTier, `er-transport-${selectedPaxTier}`, defaultTransportRoutes, setTransportRoutes);
  };

  const savePrices = () => {
    const storageKey = `prices-${selectedTourType}`;
    localStorage.setItem(storageKey, JSON.stringify(prices));
    toast.success('Цены сохранены');
  };

  // CRITICAL FIX: Helper function to save to BOTH localStorage AND database
  const savePriceConfig = async (tourType, category, paxTier, items, localStorageKey) => {
    try {
      // 1. Save to localStorage (for immediate use & cache)
      localStorage.setItem(localStorageKey, JSON.stringify(items));

      // 2. Save to DATABASE (for persistence)
      await pricesApi.save({
        tourType: tourType.toUpperCase(),
        category,
        paxTier,
        items
      });

      console.log(`✅ Saved to localStorage (${localStorageKey}) AND database`);
      return true;
    } catch (error) {
      console.error('❌ Database save error:', error);
      toast.error('Сохранено в браузере, но не в базе данных!');
      return false;
    }
  };

  // CRITICAL FIX: Helper function to load from localStorage OR database
  const loadPriceConfig = async (tourType, category, paxTier, localStorageKey, defaultValue, setter) => {
    try {
      // 1. Try localStorage first (fastest)
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`✅ Loaded from localStorage (${localStorageKey})`);
        setter(parsed);
        return;
      }

      // 2. If localStorage empty, try database
      console.log(`⚠️ localStorage empty, loading from database (${tourType}/${category}/${paxTier})...`);
      const response = await pricesApi.get(tourType.toUpperCase(), category, paxTier);

      // Check if items exists and is not empty (array OR object)
      const hasItems = response.data && response.data.items && (
        (Array.isArray(response.data.items) && response.data.items.length > 0) ||
        (typeof response.data.items === 'object' && !Array.isArray(response.data.items) && Object.keys(response.data.items).length > 0)
      );

      if (hasItems) {
        console.log(`✅ Loaded from database, caching to localStorage (${localStorageKey})`);
        setter(response.data.items);
        // Cache to localStorage for next time
        localStorage.setItem(localStorageKey, JSON.stringify(response.data.items));
        return;
      }

      // 3. If both empty, use defaults
      console.log(`⚠️ No data in database, using defaults (${localStorageKey})`);
      setter(defaultValue);
    } catch (error) {
      console.error(`❌ Database load error (${localStorageKey}):`, error);
      // On error, use defaults
      setter(defaultValue);
    }
  };

  const saveHotelPrices = async () => {
    const storageKey = 'er-hotel-prices';
    const success = await savePriceConfig('ER', 'hotels', selectedPaxTier, hotelPrices, storageKey);
    if (success) {
      toast.success('Hotel цены сохранены в базу данных!');
    }
  };

  const saveTransportRoutes = async () => {
    const storageKey = `er-transport-${selectedPaxTier}`;
    const success = await savePriceConfig('ER', 'transport', selectedPaxTier, transportRoutes, storageKey);
    if (success) {
      toast.success('Transport маршрутлар сохранены в базу данных!');
    }
  };

  const copyTransportFrom4PaxToOthers = () => {
    if (confirm('4 PAX dagi narxlarni 5 PAX, 6-7 PAX, 8-9 PAX larga nusxalaysizmi?')) {
      // If currently on 4 PAX tier, save current state first
      if (selectedPaxTier === '4') {
        localStorage.setItem('er-transport-4', JSON.stringify(transportRoutes));
      }

      // Load 4 PAX transport routes
      const source4PaxKey = 'er-transport-4';
      const source4PaxData = localStorage.getItem(source4PaxKey);

      if (source4PaxData) {
        // Copy to 5 PAX, 6-7 PAX, 8-9 PAX
        localStorage.setItem('er-transport-5', source4PaxData);
        localStorage.setItem('er-transport-6-7', source4PaxData);
        localStorage.setItem('er-transport-8-9', source4PaxData);

        // If currently on one of these PAX tiers, reload the data
        if (['5', '6-7', '8-9'].includes(selectedPaxTier)) {
          loadTransportRoutes();
        }

        toast.success('4 PAX narxlari 5, 6-7, 8-9 PAX larga nusxalandi!');
      } else {
        toast.error('4 PAX narxlari topilmadi!');
      }
    }
  };

  const copyCoTransportFrom4PaxToOthers = () => {
    if (confirm('4 PAX dagi narxlarni 5 PAX, 6-7 PAX, 8-9 PAX larga nusxalaysizmi?')) {
      // If currently on 4 PAX tier, save current state first
      if (selectedPaxTier === '4') {
        localStorage.setItem('co-transport-4', JSON.stringify(coTransportRoutes));
      }

      const source4PaxKey = 'co-transport-4';
      const source4PaxData = localStorage.getItem(source4PaxKey);

      if (source4PaxData) {
        localStorage.setItem('co-transport-5', source4PaxData);
        localStorage.setItem('co-transport-6-7', source4PaxData);
        localStorage.setItem('co-transport-8-9', source4PaxData);

        if (['5', '6-7', '8-9'].includes(selectedPaxTier)) {
          loadCoTransportRoutes();
        }

        toast.success('CO: 4 PAX narxlari 5, 6-7, 8-9 PAX larga nusxalandi!');
      } else {
        toast.error('CO: 4 PAX narxlari topilmadi!');
      }
    }
  };

  const copyKasTransportFrom4PaxToOthers = () => {
    if (confirm('4 PAX dagi narxlarni 5 PAX, 6-7 PAX, 8-9 PAX larga nusxalaysizmi?')) {
      // If currently on 4 PAX tier, save current state first
      if (selectedPaxTier === '4') {
        localStorage.setItem('kas-transport-4', JSON.stringify(kasTransportRoutes));
      }

      const source4PaxKey = 'kas-transport-4';
      const source4PaxData = localStorage.getItem(source4PaxKey);

      if (source4PaxData) {
        localStorage.setItem('kas-transport-5', source4PaxData);
        localStorage.setItem('kas-transport-6-7', source4PaxData);
        localStorage.setItem('kas-transport-8-9', source4PaxData);

        if (['5', '6-7', '8-9'].includes(selectedPaxTier)) {
          loadKasTransportRoutes();
        }

        toast.success('KAS: 4 PAX narxlari 5, 6-7, 8-9 PAX larga nusxalandi!');
      } else {
        toast.error('KAS: 4 PAX narxlari topilmadi!');
      }
    }
  };

  const copyZaTransportFrom4PaxToOthers = () => {
    if (confirm('4 PAX dagi narxlarni 5 PAX, 6-7 PAX, 8-9 PAX larga nusxalaysizmi?')) {
      // If currently on 4 PAX tier, save current state first
      if (selectedPaxTier === '4') {
        localStorage.setItem('za-transport-4', JSON.stringify(zaTransportRoutes));
      }

      const source4PaxKey = 'za-transport-4';
      const source4PaxData = localStorage.getItem(source4PaxKey);

      if (source4PaxData) {
        localStorage.setItem('za-transport-5', source4PaxData);
        localStorage.setItem('za-transport-6-7', source4PaxData);
        localStorage.setItem('za-transport-8-9', source4PaxData);

        if (['5', '6-7', '8-9'].includes(selectedPaxTier)) {
          loadZaTransportRoutes();
        }

        toast.success('ZA: 4 PAX narxlari 5, 6-7, 8-9 PAX larga nusxalandi!');
      } else {
        toast.error('ZA: 4 PAX narxlari topilmadi!');
      }
    }
  };

  const copyTransportFrom10_11PaxToOthers = () => {
    if (confirm('10-11 PAX dagi narxlarni 12-13 PAX, 14-15 PAX, 16 PAX larga nusxalaysizmi?')) {
      // If currently on 10-11 PAX tier, save current state first
      if (selectedPaxTier === '10-11') {
        localStorage.setItem('er-transport-10-11', JSON.stringify(transportRoutes));
      }

      const source10_11PaxKey = 'er-transport-10-11';
      const source10_11PaxData = localStorage.getItem(source10_11PaxKey);

      if (source10_11PaxData) {
        localStorage.setItem('er-transport-12-13', source10_11PaxData);
        localStorage.setItem('er-transport-14-15', source10_11PaxData);
        localStorage.setItem('er-transport-16', source10_11PaxData);

        if (['12-13', '14-15', '16'].includes(selectedPaxTier)) {
          loadTransportRoutes();
        }

        toast.success('10-11 PAX narxlari 12-13, 14-15, 16 PAX larga nusxalandi!');
      } else {
        toast.error('10-11 PAX narxlari topilmadi!');
      }
    }
  };

  const copyCoTransportFrom10_11PaxToOthers = () => {
    if (confirm('10-11 PAX dagi narxlarni 12-13 PAX, 14-15 PAX, 16 PAX larga nusxalaysizmi?')) {
      // If currently on 10-11 PAX tier, save current state first
      if (selectedPaxTier === '10-11') {
        localStorage.setItem('co-transport-10-11', JSON.stringify(coTransportRoutes));
      }

      const source10_11PaxKey = 'co-transport-10-11';
      const source10_11PaxData = localStorage.getItem(source10_11PaxKey);

      if (source10_11PaxData) {
        localStorage.setItem('co-transport-12-13', source10_11PaxData);
        localStorage.setItem('co-transport-14-15', source10_11PaxData);
        localStorage.setItem('co-transport-16', source10_11PaxData);

        if (['12-13', '14-15', '16'].includes(selectedPaxTier)) {
          loadCoTransportRoutes();
        }

        toast.success('CO: 10-11 PAX narxlari 12-13, 14-15, 16 PAX larga nusxalandi!');
      } else {
        toast.error('CO: 10-11 PAX narxlari topilmadi!');
      }
    }
  };

  const copyKasTransportFrom10_11PaxToOthers = () => {
    if (confirm('10-11 PAX dagi narxlarni 12-13 PAX, 14-15 PAX, 16 PAX larga nusxalaysizmi?')) {
      // If currently on 10-11 PAX tier, save current state first
      if (selectedPaxTier === '10-11') {
        localStorage.setItem('kas-transport-10-11', JSON.stringify(kasTransportRoutes));
      }

      const source10_11PaxKey = 'kas-transport-10-11';
      const source10_11PaxData = localStorage.getItem(source10_11PaxKey);

      if (source10_11PaxData) {
        localStorage.setItem('kas-transport-12-13', source10_11PaxData);
        localStorage.setItem('kas-transport-14-15', source10_11PaxData);
        localStorage.setItem('kas-transport-16', source10_11PaxData);

        if (['12-13', '14-15', '16'].includes(selectedPaxTier)) {
          loadKasTransportRoutes();
        }

        toast.success('KAS: 10-11 PAX narxlari 12-13, 14-15, 16 PAX larga nusxalandi!');
      } else {
        toast.error('KAS: 10-11 PAX narxlari topilmadi!');
      }
    }
  };

  const copyZaTransportFrom10_11PaxToOthers = () => {
    if (confirm('10-11 PAX dagi narxlarni 12-13 PAX, 14-15 PAX, 16 PAX larga nusxalaysizmi?')) {
      // If currently on 10-11 PAX tier, save current state first
      if (selectedPaxTier === '10-11') {
        localStorage.setItem('za-transport-10-11', JSON.stringify(zaTransportRoutes));
      }

      const source10_11PaxKey = 'za-transport-10-11';
      const source10_11PaxData = localStorage.getItem(source10_11PaxKey);

      if (source10_11PaxData) {
        localStorage.setItem('za-transport-12-13', source10_11PaxData);
        localStorage.setItem('za-transport-14-15', source10_11PaxData);
        localStorage.setItem('za-transport-16', source10_11PaxData);

        if (['12-13', '14-15', '16'].includes(selectedPaxTier)) {
          loadZaTransportRoutes();
        }

        toast.success('ZA: 10-11 PAX narxlari 12-13, 14-15, 16 PAX larga nusxalandi!');
      } else {
        toast.error('ZA: 10-11 PAX narxlari topilmadi!');
      }
    }
  };

  const copyPreis2026TransportFrom4PaxToOthers = () => {
    if (confirm('4 PAX dagi narxlarni 5 PAX, 6-7 PAX, 8-9 PAX larga nusxalaysizmi?')) {
      // If currently on 4 PAX tier, save current state first
      if (selectedPaxTier === '4') {
        localStorage.setItem('preis2026-transport-4', JSON.stringify(preis2026TransportRoutes));
      }

      const source4PaxKey = 'preis2026-transport-4';
      const source4PaxData = localStorage.getItem(source4PaxKey);

      if (source4PaxData) {
        localStorage.setItem('preis2026-transport-5', source4PaxData);
        localStorage.setItem('preis2026-transport-6-7', source4PaxData);
        localStorage.setItem('preis2026-transport-8-9', source4PaxData);

        if (['5', '6-7', '8-9'].includes(selectedPaxTier)) {
          loadPreis2026TransportRoutes();
        }

        toast.success('Preis 2026: 4 PAX narxlari 5, 6-7, 8-9 PAX larga nusxalandi!');
      } else {
        toast.error('Preis 2026: 4 PAX narxlari topilmadi!');
      }
    }
  };

  const copyPreis2026TransportFrom10_11PaxToOthers = () => {
    if (confirm('10-11 PAX dagi narxlarni 12-13 PAX, 14-15 PAX, 16 PAX larga nusxalaysizmi?')) {
      // If currently on 10-11 PAX tier, save current state first
      if (selectedPaxTier === '10-11') {
        localStorage.setItem('preis2026-transport-10-11', JSON.stringify(preis2026TransportRoutes));
      }

      const source10_11PaxKey = 'preis2026-transport-10-11';
      const source10_11PaxData = localStorage.getItem(source10_11PaxKey);

      if (source10_11PaxData) {
        localStorage.setItem('preis2026-transport-12-13', source10_11PaxData);
        localStorage.setItem('preis2026-transport-14-15', source10_11PaxData);
        localStorage.setItem('preis2026-transport-16', source10_11PaxData);

        if (['12-13', '14-15', '16'].includes(selectedPaxTier)) {
          loadPreis2026TransportRoutes();
        }

        toast.success('Preis 2026: 10-11 PAX narxlari 12-13, 14-15, 16 PAX larga nusxalandi!');
      } else {
        toast.error('Preis 2026: 10-11 PAX narxlari topilmadi!');
      }
    }
  };

  const updateHotelPrice = (id, field, value) => {
    setHotelPrices(hotelPrices.map(h =>
      h.id === id ? {
        ...h,
        [field]: field === 'city' ? value : (parseFloat(value) || 0)
      } : h
    ));
  };

  const addHotelRow = () => {
    const newHotel = {
      id: Date.now(),
      city: 'New Hotel',
      days: 0,
      pricePerDay: 0,
      ezZimmer: 0
    };
    setHotelPrices([...hotelPrices, newHotel]);
  };

  const deleteHotelRow = (id) => {
    if (confirm('Bu mehmonxonani o\'chirmoqchimisiz?')) {
      setHotelPrices(hotelPrices.filter(h => h.id !== id));
    }
  };

  const updateTransportRoute = (id, field, value) => {
    setTransportRoutes(transportRoutes.map(r =>
      r.id === id ? {
        ...r,
        [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0)
      } : r
    ));
  };

  const addTransportRoute = () => {
    const newRoute = {
      id: Date.now(),
      name: 'New Route',
      days: 0,
      price: 0
    };
    setTransportRoutes([...transportRoutes, newRoute]);
  };

  const deleteTransportRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) {
      setTransportRoutes(transportRoutes.filter(r => r.id !== id));
    }
  };

  const moveRouteUp = (index) => {
    if (index === 0) return; // Already at top
    const newRoutes = [...transportRoutes];
    [newRoutes[index - 1], newRoutes[index]] = [newRoutes[index], newRoutes[index - 1]];
    setTransportRoutes(newRoutes);
  };

  const moveRouteDown = (index) => {
    if (index === transportRoutes.length - 1) return; // Already at bottom
    const newRoutes = [...transportRoutes];
    [newRoutes[index], newRoutes[index + 1]] = [newRoutes[index + 1], newRoutes[index]];
    setTransportRoutes(newRoutes);
  };

  // Railway functions
  const loadRailwayRoutes = async () => {
    await loadPriceConfig('ER', 'railway', selectedPaxTier, 'er-railway-routes', defaultRailwayRoutes, setRailwayRoutes);
  };

  const saveRailwayRoutes = async () => {
    const storageKey = 'er-railway-routes';
    const success = await savePriceConfig('ER', 'railway', selectedPaxTier, railwayRoutes, storageKey);
    if (success) {
      toast.success('Railway маршрутлар сохранены в базу данных!');
    }
  };

  const updateRailwayRoute = (id, field, value) => {
    setRailwayRoutes(railwayRoutes.map(r =>
      r.id === id ? {
        ...r,
        [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0)
      } : r
    ));
  };

  const addRailwayRoute = () => {
    const newRoute = {
      id: Date.now(),
      name: 'New Railway Route',
      days: 1,
      price: 0
    };
    setRailwayRoutes([...railwayRoutes, newRoute]);
  };

  const deleteRailwayRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) {
      setRailwayRoutes(railwayRoutes.filter(r => r.id !== id));
    }
  };

  const moveRailwayUp = (index) => {
    if (index === 0) return;
    const newRoutes = [...railwayRoutes];
    [newRoutes[index - 1], newRoutes[index]] = [newRoutes[index], newRoutes[index - 1]];
    setRailwayRoutes(newRoutes);
  };

  const moveRailwayDown = (index) => {
    if (index === railwayRoutes.length - 1) return;
    const newRoutes = [...railwayRoutes];
    [newRoutes[index], newRoutes[index + 1]] = [newRoutes[index + 1], newRoutes[index]];
    setRailwayRoutes(newRoutes);
  };

  // Fly functions
  const loadFlyRoutes = async () => {
    await loadPriceConfig('ER', 'fly', selectedPaxTier, 'er-fly-routes', defaultFlyRoutes, setFlyRoutes);
  };

  const saveFlyRoutes = async () => {
    const storageKey = 'er-fly-routes';
    const success = await savePriceConfig('ER', 'fly', selectedPaxTier, flyRoutes, storageKey);
    if (success) {
      toast.success('Fly маршрутлар сохранены в базу данных!');
    }
  };

  const updateFlyRoute = (id, field, value) => {
    setFlyRoutes(flyRoutes.map(r =>
      r.id === id ? {
        ...r,
        [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0)
      } : r
    ));
  };

  const addFlyRoute = () => {
    const newRoute = {
      id: Date.now(),
      name: 'New Flight Route',
      days: 1,
      price: 0
    };
    setFlyRoutes([...flyRoutes, newRoute]);
  };

  const deleteFlyRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) {
      setFlyRoutes(flyRoutes.filter(r => r.id !== id));
    }
  };

  const moveFlyUp = (index) => {
    if (index === 0) return;
    const newRoutes = [...flyRoutes];
    [newRoutes[index - 1], newRoutes[index]] = [newRoutes[index], newRoutes[index - 1]];
    setFlyRoutes(newRoutes);
  };

  const moveFlyDown = (index) => {
    if (index === flyRoutes.length - 1) return;
    const newRoutes = [...flyRoutes];
    [newRoutes[index], newRoutes[index + 1]] = [newRoutes[index + 1], newRoutes[index]];
    setFlyRoutes(newRoutes);
  };

  // Meal functions
  const loadMealItems = async () => {
    await loadPriceConfig('ER', 'meal', selectedPaxTier, 'er-meal-items', defaultMealItems, setMealItems);
  };
  const saveMealItems = async () => {
    const storageKey = 'er-meal-items';
    const success = await savePriceConfig('ER', 'meal', selectedPaxTier, mealItems, storageKey);
    if (success) {
      toast.success('Meal маълумотлар сохранены в базу данных!');
    }
  };
  const updateMealItem = (id, field, value) => {
    setMealItems(mealItems.map(m => m.id === id ? { ...m, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : m));
  };
  const addMealItem = () => {
    setMealItems([...mealItems, { id: Date.now(), name: 'New Meal Item', days: 1, price: 0 }]);
  };
  const deleteMealItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setMealItems(mealItems.filter(m => m.id !== id));
  };
  const moveMealUp = (index) => {
    if (index === 0) return;
    const newItems = [...mealItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setMealItems(newItems);
  };
  const moveMealDown = (index) => {
    if (index === mealItems.length - 1) return;
    const newItems = [...mealItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setMealItems(newItems);
  };

  // Sightseing functions
  const loadSightseingItems = async () => {
    await loadPriceConfig('ER', 'sightseeing', selectedPaxTier, 'er-sightseing-items', defaultSightseingItems, setSightseingItems);
  };
  const saveSightseingItems = async () => {
    const storageKey = 'er-sightseing-items';
    const success = await savePriceConfig('ER', 'sightseeing', selectedPaxTier, sightseingItems, storageKey);
    if (success) {
      toast.success('Sightseing маълумотлар сохранены в базу данных!');
    }
  };
  const updateSightseingItem = (id, field, value) => {
    setSightseingItems(sightseingItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addSightseingItem = () => {
    setSightseingItems([...sightseingItems, { id: Date.now(), name: 'New Sightseing Item', days: 1, price: 0 }]);
  };
  const deleteSightseingItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setSightseingItems(sightseingItems.filter(s => s.id !== id));
  };
  const moveSightseingUp = (index) => {
    if (index === 0) return;
    const newItems = [...sightseingItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setSightseingItems(newItems);
  };
  const moveSightseingDown = (index) => {
    if (index === sightseingItems.length - 1) return;
    const newItems = [...sightseingItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setSightseingItems(newItems);
  };

  // Guide functions
  const loadGuideItems = async () => {
    await loadPriceConfig('ER', 'guide', selectedPaxTier, 'er-guide-items', defaultGuideItems, setGuideItems);
  };
  const saveGuideItems = async () => {
    const storageKey = 'er-guide-items';
    const success = await savePriceConfig('ER', 'guide', selectedPaxTier, guideItems, storageKey);
    if (success) {
      toast.success('Guide маълумотлар сохранены в базу данных!');
    }
  };
  const updateGuideItem = (id, field, value) => {
    setGuideItems(guideItems.map(g => g.id === id ? { ...g, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : g));
  };
  const addGuideItem = () => {
    setGuideItems([...guideItems, { id: Date.now(), name: 'New Guide Item', days: 1, price: 0 }]);
  };
  const deleteGuideItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setGuideItems(guideItems.filter(g => g.id !== id));
  };
  const moveGuideUp = (index) => {
    if (index === 0) return;
    const newItems = [...guideItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setGuideItems(newItems);
  };
  const moveGuideDown = (index) => {
    if (index === guideItems.length - 1) return;
    const newItems = [...guideItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setGuideItems(newItems);
  };

  // Shou functions
  const loadShouItems = async () => {
    await loadPriceConfig('ER', 'shou', selectedPaxTier, 'er-shou-items', defaultShouItems, setShouItems);
  };
  const saveShouItems = async () => {
    const storageKey = 'er-shou-items';
    const success = await savePriceConfig('ER', 'shou', selectedPaxTier, shouItems, storageKey);
    if (success) {
      toast.success('Shou маълумотлар сохранены в базу данных!');
    }
  };
  const updateShouItem = (id, field, value) => {
    setShouItems(shouItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addShouItem = () => {
    setShouItems([...shouItems, { id: Date.now(), name: 'New Shou Item', days: 1, price: 0 }]);
  };
  const deleteShouItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setShouItems(shouItems.filter(s => s.id !== id));
  };

  // Commission functions
  const loadCommissionValues = async () => {
    await loadPriceConfig('ER', 'commission', selectedPaxTier, 'er-commission-values', {}, setCommissionValues);
  };
  const saveCommissionValues = async () => {
    const storageKey = 'er-commission-values';
    const success = await savePriceConfig('ER', 'commission', selectedPaxTier, commissionValues, storageKey);
    if (success) {
      toast.success('Commission маълумотлар сохранены в базу данных!');
    }
  };
  const updateCommissionValue = (tierId, value) => {
    setCommissionValues(prev => ({
      ...prev,
      [tierId]: value === '' ? 0 : parseFloat(value) || 0
    }));
  };
  const moveShouUp = (index) => {
    if (index === 0) return;
    const newItems = [...shouItems];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setShouItems(newItems);
  };
  const moveShouDown = (index) => {
    if (index === shouItems.length - 1) return;
    const newItems = [...shouItems];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setShouItems(newItems);
  };

  // Zusatzkosten load functions
  const loadZusatzkostenItems = async () => {
    await loadPriceConfig('ER', 'zusatzkosten', selectedPaxTier, 'er_zusatzkosten', [], setZusatzkostenItems);
  };

  const loadCoZusatzkostenItems = async () => {
    await loadPriceConfig('CO', 'zusatzkosten', selectedPaxTier, 'co_zusatzkosten', [], setCoZusatzkostenItems);
  };

  const loadKasZusatzkostenItems = async () => {
    await loadPriceConfig('KAS', 'zusatzkosten', selectedPaxTier, 'kas_zusatzkosten', [], setKasZusatzkostenItems);
  };

  const loadZaZusatzkostenItems = async () => {
    await loadPriceConfig('ZA', 'zusatzkosten', selectedPaxTier, 'za_zusatzkosten', [], setZaZusatzkostenItems);
  };

  // Zusatzkosten save functions
  const saveZusatzkosten = async () => {
    const storageKey = 'er_zusatzkosten';
    const success = await savePriceConfig('ER', 'zusatzkosten', selectedPaxTier, zusatzkostenItems, storageKey);
    if (success) {
      toast.success(`ER Zusatzkosten сохранены в базу данных! (${zusatzkostenItems.length} items)`);
    }
  };

  const saveCoZusatzkosten = async () => {
    const storageKey = 'co_zusatzkosten';
    const success = await savePriceConfig('CO', 'zusatzkosten', selectedPaxTier, coZusatzkostenItems, storageKey);
    if (success) {
      toast.success('CO Zusatzkosten сохранены в базу данных!');
    }
  };

  const saveKasZusatzkosten = async () => {
    const storageKey = 'kas_zusatzkosten';
    const success = await savePriceConfig('KAS', 'zusatzkosten', selectedPaxTier, kasZusatzkostenItems, storageKey);
    if (success) {
      toast.success('KAS Zusatzkosten сохранены в базу данных!');
    }
  };

  const saveZaZusatzkosten = async () => {
    const storageKey = 'za_zusatzkosten';
    const success = await savePriceConfig('ZA', 'zusatzkosten', selectedPaxTier, zaZusatzkostenItems, storageKey);
    if (success) {
      toast.success('ZA Zusatzkosten сохранены в базу данных!');
    }
  };

  // ==================== CO MODULE FUNCTIONS ====================
  const loadCoHotelPrices = async () => {
    await loadPriceConfig('CO', 'hotels', selectedPaxTier, 'co-hotel-prices', defaultHotelPrices, setCoHotelPrices);
  };
  const saveCoHotelPrices = async () => {
    const storageKey = 'co-hotel-prices';
    const success = await savePriceConfig('CO', 'hotels', selectedPaxTier, coHotelPrices, storageKey);
    if (success) {
      toast.success('CO Hotel цены сохранены в базу данных!');
    }
  };
  const updateCoHotelPrice = (id, field, value) => {
    setCoHotelPrices(coHotelPrices.map(h => h.id === id ? { ...h, [field]: field === 'city' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : h));
  };

  const addCoHotelRow = () => {
    setCoHotelPrices([...coHotelPrices, { id: Date.now(), city: 'New Hotel', days: 0, pricePerDay: 0, ezZimmer: 0 }]);
  };

  const deleteCoHotelRow = (id) => {
    if (confirm('Bu mehmonxonani o\'chirmoqchimisiz?')) setCoHotelPrices(coHotelPrices.filter(h => h.id !== id));
  };

  const loadCoTransportRoutes = async () => {
    await loadPriceConfig('CO', 'transport', selectedPaxTier, `co-transport-${selectedPaxTier}`, [], setCoTransportRoutes);
  };
  const saveCoTransportRoutes = async () => {
    const storageKey = `co-transport-${selectedPaxTier}`;
    const success = await savePriceConfig('CO', 'transport', selectedPaxTier, coTransportRoutes, storageKey);
    if (success) {
      toast.success('CO Transport сохранены в базу данных!');
    }
  };
  const updateCoTransportRoute = (id, field, value) => {
    setCoTransportRoutes(coTransportRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addCoTransportRoute = () => {
    setCoTransportRoutes([...coTransportRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteCoTransportRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setCoTransportRoutes(coTransportRoutes.filter(r => r.id !== id));
  };

  const loadCoRailwayRoutes = async () => {
    await loadPriceConfig('CO', 'railway', selectedPaxTier, 'co-railway-routes', defaultRailwayRoutes, setCoRailwayRoutes);
  };
  const saveCoRailwayRoutes = async () => {
    const storageKey = 'co-railway-routes';
    const success = await savePriceConfig('CO', 'railway', selectedPaxTier, coRailwayRoutes, storageKey);
    if (success) {
      toast.success('CO Railway сохранены в базу данных!');
    }
  };
  const updateCoRailwayRoute = (id, field, value) => {
    setCoRailwayRoutes(coRailwayRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addCoRailwayRoute = () => {
    setCoRailwayRoutes([...coRailwayRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteCoRailwayRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setCoRailwayRoutes(coRailwayRoutes.filter(r => r.id !== id));
  };

  const loadCoFlyRoutes = async () => {
    await loadPriceConfig('CO', 'fly', selectedPaxTier, 'co-fly-routes', defaultFlyRoutes, setCoFlyRoutes);
  };
  const saveCoFlyRoutes = async () => {
    const storageKey = 'co-fly-routes';
    const success = await savePriceConfig('CO', 'fly', selectedPaxTier, coFlyRoutes, storageKey);
    if (success) {
      toast.success('CO Fly сохранены в базу данных!');
    }
  };
  const updateCoFlyRoute = (id, field, value) => {
    setCoFlyRoutes(coFlyRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addCoFlyRoute = () => {
    setCoFlyRoutes([...coFlyRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteCoFlyRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setCoFlyRoutes(coFlyRoutes.filter(r => r.id !== id));
  };

  const loadCoMealItems = async () => {
    await loadPriceConfig('CO', 'meal', selectedPaxTier, 'co-meal-items', defaultMealItems, setCoMealItems);
  };
  const saveCoMealItems = async () => {
    const storageKey = 'co-meal-items';
    const success = await savePriceConfig('CO', 'meal', selectedPaxTier, coMealItems, storageKey);
    if (success) {
      toast.success('CO Meal сохранены в базу данных!');
    }
  };
  const updateCoMealItem = (id, field, value) => {
    setCoMealItems(coMealItems.map(m => m.id === id ? { ...m, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : m));
  };
  const addCoMealItem = () => {
    setCoMealItems([...coMealItems, { id: Date.now(), name: 'New Meal', days: 1, price: 0 }]);
  };
  const deleteCoMealItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setCoMealItems(coMealItems.filter(m => m.id !== id));
  };

  const loadCoSightseingItems = async () => {
    await loadPriceConfig('CO', 'sightseeing', selectedPaxTier, 'co-sightseing-items', defaultSightseingItems, setCoSightseingItems);
  };
  const saveCoSightseingItems = async () => {
    const storageKey = 'co-sightseing-items';
    const success = await savePriceConfig('CO', 'sightseeing', selectedPaxTier, coSightseingItems, storageKey);
    if (success) {
      toast.success('CO Sightseing сохранены в базу данных!');
    }
  };
  const updateCoSightseingItem = (id, field, value) => {
    setCoSightseingItems(coSightseingItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addCoSightseingItem = () => {
    setCoSightseingItems([...coSightseingItems, { id: Date.now(), name: 'New Sightseing', days: 1, price: 0 }]);
  };
  const deleteCoSightseingItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setCoSightseingItems(coSightseingItems.filter(s => s.id !== id));
  };

  const loadCoGuideItems = async () => {
    await loadPriceConfig('CO', 'guide', selectedPaxTier, 'co-guide-items', defaultGuideItems, setCoGuideItems);
  };
  const saveCoGuideItems = async () => {
    const storageKey = 'co-guide-items';
    const success = await savePriceConfig('CO', 'guide', selectedPaxTier, coGuideItems, storageKey);
    if (success) {
      toast.success('CO Guide сохранены в базу данных!');
    }
  };
  const updateCoGuideItem = (id, field, value) => {
    setCoGuideItems(coGuideItems.map(g => g.id === id ? { ...g, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : g));
  };
  const addCoGuideItem = () => {
    setCoGuideItems([...coGuideItems, { id: Date.now(), name: 'New Guide', days: 1, price: 0 }]);
  };
  const deleteCoGuideItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setCoGuideItems(coGuideItems.filter(g => g.id !== id));
  };

  const loadCoShouItems = async () => {
    await loadPriceConfig('CO', 'shou', selectedPaxTier, 'co-shou-items', defaultShouItems, setCoShouItems);
  };
  const saveCoShouItems = async () => {
    const storageKey = 'co-shou-items';
    const success = await savePriceConfig('CO', 'shou', selectedPaxTier, coShouItems, storageKey);
    if (success) {
      toast.success('CO Shou сохранены в базу данных!');
    }
  };
  const updateCoShouItem = (id, field, value) => {
    setCoShouItems(coShouItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addCoShouItem = () => {
    setCoShouItems([...coShouItems, { id: Date.now(), name: 'New Shou', days: 1, price: 0 }]);
  };
  const deleteCoShouItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setCoShouItems(coShouItems.filter(s => s.id !== id));
  };

  const loadCoCommissionValues = async () => {
    await loadPriceConfig('CO', 'commission', selectedPaxTier, 'co-commission-values', {}, setCoCommissionValues);
  };
  const saveCoCommissionValues = async () => {
    const storageKey = 'co-commission-values';
    const success = await savePriceConfig('CO', 'commission', selectedPaxTier, coCommissionValues, storageKey);
    if (success) {
      toast.success('CO Commission сохранены в базу данных!');
    }
  };
  const updateCoCommissionValue = (tierId, value) => {
    setCoCommissionValues(prev => ({ ...prev, [tierId]: value === '' ? 0 : parseFloat(value) || 0 }));
  };

  // ==================== KAS MODULE FUNCTIONS ====================
  const loadKasHotelPrices = async () => {
    await loadPriceConfig('KAS', 'hotels', selectedPaxTier, 'kas-hotel-prices', defaultHotelPrices, setKasHotelPrices);
  };
  const saveKasHotelPrices = async () => {
    const storageKey = 'kas-hotel-prices';
    const success = await savePriceConfig('KAS', 'hotels', selectedPaxTier, kasHotelPrices, storageKey);
    if (success) {
      toast.success('KAS Hotel цены сохранены в базу данных!');
    }
  };
  const updateKasHotelPrice = (id, field, value) => {
    setKasHotelPrices(kasHotelPrices.map(h => h.id === id ? { ...h, [field]: field === 'city' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : h));
  };

  const addKasHotelRow = () => {
    setKasHotelPrices([...kasHotelPrices, { id: Date.now(), city: 'New Hotel', days: 0, pricePerDay: 0, ezZimmer: 0 }]);
  };

  const deleteKasHotelRow = (id) => {
    if (confirm('Bu mehmonxonani o\'chirmoqchimisiz?')) setKasHotelPrices(kasHotelPrices.filter(h => h.id !== id));
  };

  const loadKasTransportRoutes = async () => {
    await loadPriceConfig('KAS', 'transport', selectedPaxTier, `kas-transport-${selectedPaxTier}`, [], setKasTransportRoutes);
  };
  const saveKasTransportRoutes = async () => {
    const storageKey = `kas-transport-${selectedPaxTier}`;
    const success = await savePriceConfig('KAS', 'transport', selectedPaxTier, kasTransportRoutes, storageKey);
    if (success) {
      toast.success('KAS Transport сохранены в базу данных!');
    }
  };
  const updateKasTransportRoute = (id, field, value) => {
    setKasTransportRoutes(kasTransportRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addKasTransportRoute = () => {
    setKasTransportRoutes([...kasTransportRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteKasTransportRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setKasTransportRoutes(kasTransportRoutes.filter(r => r.id !== id));
  };

  const loadKasRailwayRoutes = async () => {
    await loadPriceConfig('KAS', 'railway', selectedPaxTier, 'kas-railway-routes', defaultRailwayRoutes, setKasRailwayRoutes);
  };
  const saveKasRailwayRoutes = async () => {
    const storageKey = 'kas-railway-routes';
    const success = await savePriceConfig('KAS', 'railway', selectedPaxTier, kasRailwayRoutes, storageKey);
    if (success) {
      toast.success('KAS Railway сохранены в базу данных!');
    }
  };
  const updateKasRailwayRoute = (id, field, value) => {
    setKasRailwayRoutes(kasRailwayRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addKasRailwayRoute = () => {
    setKasRailwayRoutes([...kasRailwayRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteKasRailwayRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setKasRailwayRoutes(kasRailwayRoutes.filter(r => r.id !== id));
  };

  const loadKasFlyRoutes = async () => {
    await loadPriceConfig('KAS', 'fly', selectedPaxTier, 'kas-fly-routes', defaultFlyRoutes, setKasFlyRoutes);
  };
  const saveKasFlyRoutes = async () => {
    const storageKey = 'kas-fly-routes';
    const success = await savePriceConfig('KAS', 'fly', selectedPaxTier, kasFlyRoutes, storageKey);
    if (success) {
      toast.success('KAS Fly сохранены в базу данных!');
    }
  };
  const updateKasFlyRoute = (id, field, value) => {
    setKasFlyRoutes(kasFlyRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addKasFlyRoute = () => {
    setKasFlyRoutes([...kasFlyRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteKasFlyRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setKasFlyRoutes(kasFlyRoutes.filter(r => r.id !== id));
  };

  const loadKasMealItems = async () => {
    await loadPriceConfig('KAS', 'meal', selectedPaxTier, 'kas-meal-items', defaultMealItems, setKasMealItems);
  };
  const saveKasMealItems = async () => {
    const storageKey = 'kas-meal-items';
    const success = await savePriceConfig('KAS', 'meal', selectedPaxTier, kasMealItems, storageKey);
    if (success) {
      toast.success('KAS Meal сохранены в базу данных!');
    }
  };
  const updateKasMealItem = (id, field, value) => {
    setKasMealItems(kasMealItems.map(m => m.id === id ? { ...m, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : m));
  };
  const addKasMealItem = () => {
    setKasMealItems([...kasMealItems, { id: Date.now(), name: 'New Meal', days: 1, price: 0 }]);
  };
  const deleteKasMealItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setKasMealItems(kasMealItems.filter(m => m.id !== id));
  };

  const loadKasSightseingItems = async () => {
    await loadPriceConfig('KAS', 'sightseeing', selectedPaxTier, 'kas-sightseing-items', defaultSightseingItems, setKasSightseingItems);
  };
  const saveKasSightseingItems = async () => {
    const storageKey = 'kas-sightseing-items';
    const success = await savePriceConfig('KAS', 'sightseeing', selectedPaxTier, kasSightseingItems, storageKey);
    if (success) {
      toast.success('KAS Sightseing сохранены в базу данных!');
    }
  };
  const updateKasSightseingItem = (id, field, value) => {
    setKasSightseingItems(kasSightseingItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addKasSightseingItem = () => {
    setKasSightseingItems([...kasSightseingItems, { id: Date.now(), name: 'New Sightseing', days: 1, price: 0 }]);
  };
  const deleteKasSightseingItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setKasSightseingItems(kasSightseingItems.filter(s => s.id !== id));
  };

  const loadKasGuideItems = async () => {
    await loadPriceConfig('KAS', 'guide', selectedPaxTier, 'kas-guide-items', defaultGuideItems, setKasGuideItems);
  };
  const saveKasGuideItems = async () => {
    const storageKey = 'kas-guide-items';
    const success = await savePriceConfig('KAS', 'guide', selectedPaxTier, kasGuideItems, storageKey);
    if (success) {
      toast.success('KAS Guide сохранены в базу данных!');
    }
  };
  const updateKasGuideItem = (id, field, value) => {
    setKasGuideItems(kasGuideItems.map(g => g.id === id ? { ...g, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : g));
  };
  const addKasGuideItem = () => {
    setKasGuideItems([...kasGuideItems, { id: Date.now(), name: 'New Guide', days: 1, price: 0 }]);
  };
  const deleteKasGuideItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setKasGuideItems(kasGuideItems.filter(g => g.id !== id));
  };

  const loadKasShouItems = async () => {
    await loadPriceConfig('KAS', 'shou', selectedPaxTier, 'kas-shou-items', defaultShouItems, setKasShouItems);
  };
  const saveKasShouItems = async () => {
    const storageKey = 'kas-shou-items';
    const success = await savePriceConfig('KAS', 'shou', selectedPaxTier, kasShouItems, storageKey);
    if (success) {
      toast.success('KAS Shou сохранены в базу данных!');
    }
  };
  const updateKasShouItem = (id, field, value) => {
    setKasShouItems(kasShouItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addKasShouItem = () => {
    setKasShouItems([...kasShouItems, { id: Date.now(), name: 'New Shou', days: 1, price: 0 }]);
  };
  const deleteKasShouItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setKasShouItems(kasShouItems.filter(s => s.id !== id));
  };

  const loadKasCommissionValues = async () => {
    await loadPriceConfig('KAS', 'commission', selectedPaxTier, 'kas-commission-values', {}, setKasCommissionValues);
  };
  const saveKasCommissionValues = async () => {
    const storageKey = 'kas-commission-values';
    const success = await savePriceConfig('KAS', 'commission', selectedPaxTier, kasCommissionValues, storageKey);
    if (success) {
      toast.success('KAS Commission сохранены в базу данных!');
    }
  };
  const updateKasCommissionValue = (tierId, value) => {
    setKasCommissionValues(prev => ({ ...prev, [tierId]: value === '' ? 0 : parseFloat(value) || 0 }));
  };

  // ==================== ZA MODULE FUNCTIONS ====================
  const loadZaHotelPrices = async () => {
    await loadPriceConfig('ZA', 'hotels', selectedPaxTier, 'za-hotel-prices', defaultHotelPrices, setZaHotelPrices);
  };
  const saveZaHotelPrices = async () => {
    const storageKey = 'za-hotel-prices';
    const success = await savePriceConfig('ZA', 'hotels', selectedPaxTier, zaHotelPrices, storageKey);
    if (success) {
      toast.success('ZA Hotel цены сохранены в базу данных!');
    }
  };
  const updateZaHotelPrice = (id, field, value) => {
    setZaHotelPrices(zaHotelPrices.map(h => h.id === id ? { ...h, [field]: field === 'city' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : h));
  };

  const addZaHotelRow = () => {
    setZaHotelPrices([...zaHotelPrices, { id: Date.now(), city: 'New Hotel', days: 0, pricePerDay: 0, ezZimmer: 0 }]);
  };

  const deleteZaHotelRow = (id) => {
    if (confirm('Bu mehmonxonani o\'chirmoqchimisiz?')) setZaHotelPrices(zaHotelPrices.filter(h => h.id !== id));
  };

  const loadZaTransportRoutes = async () => {
    await loadPriceConfig('ZA', 'transport', selectedPaxTier, `za-transport-${selectedPaxTier}`, [], setZaTransportRoutes);
  };
  const saveZaTransportRoutes = async () => {
    const storageKey = `za-transport-${selectedPaxTier}`;
    const success = await savePriceConfig('ZA', 'transport', selectedPaxTier, zaTransportRoutes, storageKey);
    if (success) {
      toast.success('ZA Transport сохранены в базу данных!');
    }
  };
  const updateZaTransportRoute = (id, field, value) => {
    setZaTransportRoutes(zaTransportRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addZaTransportRoute = () => {
    setZaTransportRoutes([...zaTransportRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteZaTransportRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setZaTransportRoutes(zaTransportRoutes.filter(r => r.id !== id));
  };

  const loadZaRailwayRoutes = async () => {
    await loadPriceConfig('ZA', 'railway', selectedPaxTier, 'za-railway-routes', defaultRailwayRoutes, setZaRailwayRoutes);
  };
  const saveZaRailwayRoutes = async () => {
    const storageKey = 'za-railway-routes';
    const success = await savePriceConfig('ZA', 'railway', selectedPaxTier, zaRailwayRoutes, storageKey);
    if (success) {
      toast.success('ZA Railway сохранены в базу данных!');
    }
  };
  const updateZaRailwayRoute = (id, field, value) => {
    setZaRailwayRoutes(zaRailwayRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addZaRailwayRoute = () => {
    setZaRailwayRoutes([...zaRailwayRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteZaRailwayRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setZaRailwayRoutes(zaRailwayRoutes.filter(r => r.id !== id));
  };

  const loadZaFlyRoutes = async () => {
    await loadPriceConfig('ZA', 'fly', selectedPaxTier, 'za-fly-routes', defaultFlyRoutes, setZaFlyRoutes);
  };
  const saveZaFlyRoutes = async () => {
    const storageKey = 'za-fly-routes';
    const success = await savePriceConfig('ZA', 'fly', selectedPaxTier, zaFlyRoutes, storageKey);
    if (success) {
      toast.success('ZA Fly сохранены в базу данных!');
    }
  };
  const updateZaFlyRoute = (id, field, value) => {
    setZaFlyRoutes(zaFlyRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addZaFlyRoute = () => {
    setZaFlyRoutes([...zaFlyRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deleteZaFlyRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setZaFlyRoutes(zaFlyRoutes.filter(r => r.id !== id));
  };

  const loadZaMealItems = async () => {
    await loadPriceConfig('ZA', 'meal', selectedPaxTier, 'za-meal-items', defaultMealItems, setZaMealItems);
  };
  const saveZaMealItems = async () => {
    const storageKey = 'za-meal-items';
    const success = await savePriceConfig('ZA', 'meal', selectedPaxTier, zaMealItems, storageKey);
    if (success) {
      toast.success('ZA Meal сохранены в базу данных!');
    }
  };
  const updateZaMealItem = (id, field, value) => {
    setZaMealItems(zaMealItems.map(m => m.id === id ? { ...m, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : m));
  };
  const addZaMealItem = () => {
    setZaMealItems([...zaMealItems, { id: Date.now(), name: 'New Meal', days: 1, price: 0 }]);
  };
  const deleteZaMealItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setZaMealItems(zaMealItems.filter(m => m.id !== id));
  };

  const loadZaSightseingItems = async () => {
    await loadPriceConfig('ZA', 'sightseeing', selectedPaxTier, 'za-sightseing-items', defaultSightseingItems, setZaSightseingItems);
  };
  const saveZaSightseingItems = async () => {
    const storageKey = 'za-sightseing-items';
    const success = await savePriceConfig('ZA', 'sightseeing', selectedPaxTier, zaSightseingItems, storageKey);
    if (success) {
      toast.success('ZA Sightseing сохранены в базу данных!');
    }
  };
  const updateZaSightseingItem = (id, field, value) => {
    setZaSightseingItems(zaSightseingItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addZaSightseingItem = () => {
    setZaSightseingItems([...zaSightseingItems, { id: Date.now(), name: 'New Sightseing', days: 1, price: 0 }]);
  };
  const deleteZaSightseingItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setZaSightseingItems(zaSightseingItems.filter(s => s.id !== id));
  };

  const loadZaGuideItems = async () => {
    await loadPriceConfig('ZA', 'guide', selectedPaxTier, 'za-guide-items', defaultGuideItems, setZaGuideItems);
  };
  const saveZaGuideItems = async () => {
    const storageKey = 'za-guide-items';
    const success = await savePriceConfig('ZA', 'guide', selectedPaxTier, zaGuideItems, storageKey);
    if (success) {
      toast.success('ZA Guide сохранены в базу данных!');
    }
  };
  const updateZaGuideItem = (id, field, value) => {
    setZaGuideItems(zaGuideItems.map(g => g.id === id ? { ...g, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : g));
  };
  const addZaGuideItem = () => {
    setZaGuideItems([...zaGuideItems, { id: Date.now(), name: 'New Guide', days: 1, price: 0 }]);
  };
  const deleteZaGuideItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setZaGuideItems(zaGuideItems.filter(g => g.id !== id));
  };

  const loadZaShouItems = async () => {
    await loadPriceConfig('ZA', 'shou', selectedPaxTier, 'za-shou-items', defaultShouItems, setZaShouItems);
  };
  const saveZaShouItems = async () => {
    const storageKey = 'za-shou-items';
    const success = await savePriceConfig('ZA', 'shou', selectedPaxTier, zaShouItems, storageKey);
    if (success) {
      toast.success('ZA Shou сохранены в базу данных!');
    }
  };
  const updateZaShouItem = (id, field, value) => {
    setZaShouItems(zaShouItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addZaShouItem = () => {
    setZaShouItems([...zaShouItems, { id: Date.now(), name: 'New Shou', days: 1, price: 0 }]);
  };
  const deleteZaShouItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setZaShouItems(zaShouItems.filter(s => s.id !== id));
  };

  const loadZaCommissionValues = async () => {
    await loadPriceConfig('ZA', 'commission', selectedPaxTier, 'za-commission-values', {}, setZaCommissionValues);
  };
  const saveZaCommissionValues = async () => {
    const storageKey = 'za-commission-values';
    const success = await savePriceConfig('ZA', 'commission', selectedPaxTier, zaCommissionValues, storageKey);
    if (success) {
      toast.success('ZA Commission сохранены в базу данных!');
    }
  };
  const updateZaCommissionValue = (tierId, value) => {
    setZaCommissionValues(prev => ({ ...prev, [tierId]: value === '' ? 0 : parseFloat(value) || 0 }));
  };

  const addPrice = () => {
    const newPrice = {
      id: Date.now(),
      category: '',
      subcategory: '',
      price: ''
    };
    setPrices([...prices, newPrice]);
    setEditingPrice(newPrice.id);
  };

  const updatePrice = (id, field, value) => {
    setPrices(prices.map(p =>
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const deletePrice = (id) => {
    if (confirm('Удалить цену?')) {
      setPrices(prices.filter(p => p.id !== id));
      const storageKey = `prices-${selectedTourType}`;
      const updated = prices.filter(p => p.id !== id);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      toast.success('Цена удалена');
    }
  };

  // CRITICAL FIX: Always ensure selectedTour has a value (fallback to first tour type)
  const selectedTour = tourTypes.find(t => t.id === selectedTourType) || tourTypes[0];

  // Calculate totals for Hotels
  const calculateHotelTotals = () => {
    let totalDays = 0;
    let totalPerTraveler = 0;
    let totalEZZimmer = 0;
    let totalEZZuschlag = 0;
    hotelPrices.forEach(hotel => {
      totalDays += hotel.days;
      const total = hotel.days * hotel.pricePerDay;
      totalPerTraveler += total;
      totalEZZimmer += hotel.ezZimmer * hotel.days;
      const ezZuschlag = (hotel.ezZimmer - hotel.pricePerDay) * hotel.days;
      totalEZZuschlag += ezZuschlag;
    });
    return { totalDays, totalPerTraveler, totalEZZimmer, totalEZZuschlag };
  };

  // Calculate totals for Transport
  const calculateTransportTotals = () => {
    let totalDays = 0;
    let grandTotal = 0;
    transportRoutes.forEach(route => {
      totalDays += route.days;
      const routeTotal = route.days * route.price;
      grandTotal += routeTotal;
    });
    const paxCount = paxTiers.find(p => p.id === selectedPaxTier)?.count || 1;
    const pricePerPerson = grandTotal / paxCount;
    return { totalDays, grandTotal, pricePerPerson };
  };

  // Calculate totals for CO Hotels
  const calculateCoHotelTotals = () => {
    let totalDays = 0;
    let totalPerTraveler = 0;
    let totalEZZimmer = 0;
    let totalEZZuschlag = 0;
    coHotelPrices.forEach(hotel => {
      totalDays += hotel.days;
      const total = hotel.days * hotel.pricePerDay;
      totalPerTraveler += total;
      totalEZZimmer += hotel.ezZimmer * hotel.days;
      const ezZuschlag = (hotel.ezZimmer - hotel.pricePerDay) * hotel.days;
      totalEZZuschlag += ezZuschlag;
    });
    return { totalDays, totalPerTraveler, totalEZZimmer, totalEZZuschlag };
  };

  // Calculate totals for CO Transport
  const calculateCoTransportTotals = () => {
    let totalDays = 0;
    let grandTotal = 0;
    coTransportRoutes.forEach(route => {
      totalDays += route.days;
      const routeTotal = route.days * route.price;
      grandTotal += routeTotal;
    });
    const paxCount = paxTiers.find(p => p.id === selectedPaxTier)?.count || 1;
    const pricePerPerson = grandTotal / paxCount;
    return { totalDays, grandTotal, pricePerPerson };
  };

  // Calculate totals for KAS Hotels
  const calculateKasHotelTotals = () => {
    let totalDays = 0;
    let totalPerTraveler = 0;
    let totalEZZimmer = 0;
    let totalEZZuschlag = 0;
    kasHotelPrices.forEach(hotel => {
      totalDays += hotel.days;
      const total = hotel.days * hotel.pricePerDay;
      totalPerTraveler += total;
      totalEZZimmer += hotel.ezZimmer * hotel.days;
      const ezZuschlag = (hotel.ezZimmer - hotel.pricePerDay) * hotel.days;
      totalEZZuschlag += ezZuschlag;
    });
    return { totalDays, totalPerTraveler, totalEZZimmer, totalEZZuschlag };
  };

  // Calculate totals for KAS Transport
  const calculateKasTransportTotals = () => {
    let totalDays = 0;
    let grandTotal = 0;
    kasTransportRoutes.forEach(route => {
      totalDays += route.days;
      const routeTotal = route.days * route.price;
      grandTotal += routeTotal;
    });
    const paxCount = paxTiers.find(p => p.id === selectedPaxTier)?.count || 1;
    const pricePerPerson = grandTotal / paxCount;
    return { totalDays, grandTotal, pricePerPerson };
  };

  // Calculate totals for ZA Hotels
  const calculateZaHotelTotals = () => {
    let totalDays = 0;
    let totalPerTraveler = 0;
    let totalEZZimmer = 0;
    let totalEZZuschlag = 0;
    zaHotelPrices.forEach(hotel => {
      totalDays += hotel.days;
      const total = hotel.days * hotel.pricePerDay;
      totalPerTraveler += total;
      totalEZZimmer += hotel.ezZimmer * hotel.days;
      const ezZuschlag = (hotel.ezZimmer - hotel.pricePerDay) * hotel.days;
      totalEZZuschlag += ezZuschlag;
    });
    return { totalDays, totalPerTraveler, totalEZZimmer, totalEZZuschlag };
  };

  // Calculate totals for ZA Transport
  const calculateZaTransportTotals = () => {
    let totalDays = 0;
    let grandTotal = 0;
    zaTransportRoutes.forEach(route => {
      totalDays += route.days;
      const routeTotal = route.days * route.price;
      grandTotal += routeTotal;
    });
    const paxCount = paxTiers.find(p => p.id === selectedPaxTier)?.count || 1;
    const pricePerPerson = grandTotal / paxCount;
    return { totalDays, grandTotal, pricePerPerson };
  };

  // Preis 2026 Module Functions
  const loadPreis2026HotelPrices = async () => {
    await loadPriceConfig('PREIS2026', 'hotels', selectedPaxTier, 'preis2026-hotel-prices', defaultHotelPrices, setPreis2026HotelPrices);
  };
  const savePreis2026HotelPrices = async () => {
    const storageKey = 'preis2026-hotel-prices';
    const success = await savePriceConfig('PREIS2026', 'hotels', selectedPaxTier, preis2026HotelPrices, storageKey);
    if (success) {
      toast.success('Preis 2026 Hotel цены сохранены в базу данных!');
    }
  };
  const updatePreis2026HotelPrice = (id, field, value) => {
    setPreis2026HotelPrices(preis2026HotelPrices.map(h => h.id === id ? { ...h, [field]: field === 'city' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : h));
  };
  const addPreis2026HotelRow = () => {
    setPreis2026HotelPrices([...preis2026HotelPrices, { id: Date.now(), city: 'New Hotel', days: 0, pricePerDay: 0, ezZimmer: 0 }]);
  };
  const deletePreis2026HotelRow = (id) => {
    if (confirm('Bu mehmonxonani o\'chirmoqchimisiz?')) setPreis2026HotelPrices(preis2026HotelPrices.filter(h => h.id !== id));
  };

  const loadPreis2026TransportRoutes = async () => {
    await loadPriceConfig('PREIS2026', 'transport', selectedPaxTier, `preis2026-transport-${selectedPaxTier}`, [], setPreis2026TransportRoutes);
  };
  const savePreis2026TransportRoutes = async () => {
    const storageKey = `preis2026-transport-${selectedPaxTier}`;
    const success = await savePriceConfig('PREIS2026', 'transport', selectedPaxTier, preis2026TransportRoutes, storageKey);
    if (success) {
      toast.success('Preis 2026 Transport сохранены в базу данных!');
    }
  };
  const updatePreis2026TransportRoute = (id, field, value) => {
    setPreis2026TransportRoutes(preis2026TransportRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addPreis2026TransportRoute = () => {
    setPreis2026TransportRoutes([...preis2026TransportRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deletePreis2026TransportRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setPreis2026TransportRoutes(preis2026TransportRoutes.filter(r => r.id !== id));
  };

  const loadPreis2026RailwayRoutes = async () => {
    await loadPriceConfig('PREIS2026', 'railway', selectedPaxTier, 'preis2026-railway-routes', defaultRailwayRoutes, setPreis2026RailwayRoutes);
  };
  const savePreis2026RailwayRoutes = async () => {
    const storageKey = 'preis2026-railway-routes';
    const success = await savePriceConfig('PREIS2026', 'railway', selectedPaxTier, preis2026RailwayRoutes, storageKey);
    if (success) {
      toast.success('Preis 2026 Railway сохранены в базу данных!');
    }
  };
  const updatePreis2026RailwayRoute = (id, field, value) => {
    setPreis2026RailwayRoutes(preis2026RailwayRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addPreis2026RailwayRoute = () => {
    setPreis2026RailwayRoutes([...preis2026RailwayRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deletePreis2026RailwayRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setPreis2026RailwayRoutes(preis2026RailwayRoutes.filter(r => r.id !== id));
  };

  const loadPreis2026FlyRoutes = async () => {
    await loadPriceConfig('PREIS2026', 'fly', selectedPaxTier, 'preis2026-fly-routes', defaultFlyRoutes, setPreis2026FlyRoutes);
  };
  const savePreis2026FlyRoutes = async () => {
    const storageKey = 'preis2026-fly-routes';
    const success = await savePriceConfig('PREIS2026', 'fly', selectedPaxTier, preis2026FlyRoutes, storageKey);
    if (success) {
      toast.success('Preis 2026 Fly сохранены в базу данных!');
    }
  };
  const updatePreis2026FlyRoute = (id, field, value) => {
    setPreis2026FlyRoutes(preis2026FlyRoutes.map(r => r.id === id ? { ...r, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : r));
  };
  const addPreis2026FlyRoute = () => {
    setPreis2026FlyRoutes([...preis2026FlyRoutes, { id: Date.now(), name: 'New Route', days: 1, price: 0 }]);
  };
  const deletePreis2026FlyRoute = (id) => {
    if (confirm('Bu marshrutni o\'chirmoqchimisiz?')) setPreis2026FlyRoutes(preis2026FlyRoutes.filter(r => r.id !== id));
  };

  const loadPreis2026MealItems = async () => {
    await loadPriceConfig('PREIS2026', 'meal', selectedPaxTier, 'preis2026-meal-items', defaultMealItems, setPreis2026MealItems);
  };
  const savePreis2026MealItems = async () => {
    const storageKey = 'preis2026-meal-items';
    const success = await savePriceConfig('PREIS2026', 'meal', selectedPaxTier, preis2026MealItems, storageKey);
    if (success) {
      toast.success('Preis 2026 Meal сохранены в базу данных!');
    }
  };
  const updatePreis2026MealItem = (id, field, value) => {
    setPreis2026MealItems(preis2026MealItems.map(m => m.id === id ? { ...m, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : m));
  };
  const addPreis2026MealItem = () => {
    setPreis2026MealItems([...preis2026MealItems, { id: Date.now(), name: 'New Meal', days: 1, price: 0 }]);
  };
  const deletePreis2026MealItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setPreis2026MealItems(preis2026MealItems.filter(m => m.id !== id));
  };

  const loadPreis2026SightseingItems = async () => {
    await loadPriceConfig('PREIS2026', 'sightseeing', selectedPaxTier, 'preis2026-sightseing-items', defaultSightseingItems, setPreis2026SightseingItems);
  };
  const savePreis2026SightseingItems = async () => {
    const storageKey = 'preis2026-sightseing-items';
    const success = await savePriceConfig('PREIS2026', 'sightseeing', selectedPaxTier, preis2026SightseingItems, storageKey);
    if (success) {
      toast.success('Preis 2026 Sightseing сохранены в базу данных!');
    }
  };
  const updatePreis2026SightseingItem = (id, field, value) => {
    setPreis2026SightseingItems(preis2026SightseingItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addPreis2026SightseingItem = () => {
    setPreis2026SightseingItems([...preis2026SightseingItems, { id: Date.now(), name: 'New Sightseing', days: 1, price: 0 }]);
  };
  const deletePreis2026SightseingItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setPreis2026SightseingItems(preis2026SightseingItems.filter(s => s.id !== id));
  };

  const loadPreis2026GuideItems = async () => {
    await loadPriceConfig('PREIS2026', 'guide', selectedPaxTier, 'preis2026-guide-items', defaultGuideItems, setPreis2026GuideItems);
  };
  const savePreis2026GuideItems = async () => {
    const storageKey = 'preis2026-guide-items';
    const success = await savePriceConfig('PREIS2026', 'guide', selectedPaxTier, preis2026GuideItems, storageKey);
    if (success) {
      toast.success('Preis 2026 Guide сохранены в базу данных!');
    }
  };
  const updatePreis2026GuideItem = (id, field, value) => {
    setPreis2026GuideItems(preis2026GuideItems.map(g => g.id === id ? { ...g, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : g));
  };
  const addPreis2026GuideItem = () => {
    setPreis2026GuideItems([...preis2026GuideItems, { id: Date.now(), name: 'New Guide', days: 1, price: 0 }]);
  };
  const deletePreis2026GuideItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setPreis2026GuideItems(preis2026GuideItems.filter(g => g.id !== id));
  };

  const loadPreis2026ShouItems = async () => {
    await loadPriceConfig('PREIS2026', 'shou', selectedPaxTier, 'preis2026-shou-items', defaultShouItems, setPreis2026ShouItems);
  };
  const savePreis2026ShouItems = async () => {
    const storageKey = 'preis2026-shou-items';
    const success = await savePriceConfig('PREIS2026', 'shou', selectedPaxTier, preis2026ShouItems, storageKey);
    if (success) {
      toast.success('Preis 2026 Shou сохранены в базу данных!');
    }
  };
  const updatePreis2026ShouItem = (id, field, value) => {
    setPreis2026ShouItems(preis2026ShouItems.map(s => s.id === id ? { ...s, [field]: field === 'name' ? value : (value === '' ? 0 : parseFloat(value) || 0) } : s));
  };
  const addPreis2026ShouItem = () => {
    setPreis2026ShouItems([...preis2026ShouItems, { id: Date.now(), name: 'New Shou', days: 1, price: 0 }]);
  };
  const deletePreis2026ShouItem = (id) => {
    if (confirm('Bu elementni o\'chirmoqchimisiz?')) setPreis2026ShouItems(preis2026ShouItems.filter(s => s.id !== id));
  };

  const loadPreis2026CommissionValues = async () => {
    await loadPriceConfig('PREIS2026', 'commission', selectedPaxTier, 'preis2026-commission-values', {}, setPreis2026CommissionValues);
  };
  const savePreis2026CommissionValues = async () => {
    const storageKey = 'preis2026-commission-values';
    const success = await savePriceConfig('PREIS2026', 'commission', selectedPaxTier, preis2026CommissionValues, storageKey);
    if (success) {
      toast.success('Preis 2026 Commission сохранены в базу данных!');
    }
  };
  const updatePreis2026CommissionValue = (tierId, value) => {
    setPreis2026CommissionValues(prev => ({ ...prev, [tierId]: value === '' ? 0 : parseFloat(value) || 0 }));
  };

  // Calculate totals for Preis 2026 Hotels
  const calculatePreis2026HotelTotals = () => {
    let totalDays = 0;
    let totalPerTraveler = 0;
    let totalEZZimmer = 0;
    let totalEZZuschlag = 0;
    preis2026HotelPrices.forEach(hotel => {
      totalDays += hotel.days;
      const total = hotel.days * hotel.pricePerDay;
      totalPerTraveler += total;
      totalEZZimmer += hotel.ezZimmer * hotel.days;
      const ezZuschlag = (hotel.ezZimmer - hotel.pricePerDay) * hotel.days;
      totalEZZuschlag += ezZuschlag;
    });
    return { totalDays, totalPerTraveler, totalEZZimmer, totalEZZuschlag };
  };

  // Calculate totals for Preis 2026 Transport
  const calculatePreis2026TransportTotals = () => {
    let totalDays = 0;
    let grandTotal = 0;
    preis2026TransportRoutes.forEach(route => {
      totalDays += route.days;
      const routeTotal = route.days * route.price;
      grandTotal += routeTotal;
    });
    const paxCount = paxTiers.find(p => p.id === selectedPaxTier)?.count || 1;
    const pricePerPerson = grandTotal / paxCount;
    return { totalDays, grandTotal, pricePerPerson };
  };

  const handleSave = () => {
    if (selectedTourType === 'er') {
      if (selectedERSubTab === 'hotels') {
        saveHotelPrices();
      } else if (selectedERSubTab === 'transport') {
        saveTransportRoutes();
      } else if (selectedERSubTab === 'railway') {
        saveRailwayRoutes();
      } else if (selectedERSubTab === 'fly') {
        saveFlyRoutes();
      } else if (selectedERSubTab === 'meal') {
        saveMealItems();
      } else if (selectedERSubTab === 'sightseing') {
        saveSightseingItems();
      } else if (selectedERSubTab === 'guide') {
        saveGuideItems();
      } else if (selectedERSubTab === 'shou') {
        saveShouItems();
      } else if (selectedERSubTab === 'zusatzkosten') {
        saveZusatzkosten();
      } else if (selectedERSubTab === 'total') {
        saveTotalPrices();
      }
    } else if (selectedTourType === 'co') {
      if (selectedCOSubTab === 'hotels') {
        saveCoHotelPrices();
      } else if (selectedCOSubTab === 'transport') {
        saveCoTransportRoutes();
      } else if (selectedCOSubTab === 'railway') {
        saveCoRailwayRoutes();
      } else if (selectedCOSubTab === 'fly') {
        saveCoFlyRoutes();
      } else if (selectedCOSubTab === 'meal') {
        saveCoMealItems();
      } else if (selectedCOSubTab === 'sightseing') {
        saveCoSightseingItems();
      } else if (selectedCOSubTab === 'guide') {
        saveCoGuideItems();
      } else if (selectedCOSubTab === 'shou') {
        saveCoShouItems();
      } else if (selectedCOSubTab === 'zusatzkosten') {
        saveCoZusatzkosten();
      } else if (selectedCOSubTab === 'total') {
        saveTotalPrices();
      }
    } else if (selectedTourType === 'kas') {
      if (selectedKASSubTab === 'hotels') {
        saveKasHotelPrices();
      } else if (selectedKASSubTab === 'transport') {
        saveKasTransportRoutes();
      } else if (selectedKASSubTab === 'railway') {
        saveKasRailwayRoutes();
      } else if (selectedKASSubTab === 'fly') {
        saveKasFlyRoutes();
      } else if (selectedKASSubTab === 'meal') {
        saveKasMealItems();
      } else if (selectedKASSubTab === 'sightseing') {
        saveKasSightseingItems();
      } else if (selectedKASSubTab === 'guide') {
        saveKasGuideItems();
      } else if (selectedKASSubTab === 'shou') {
        saveKasShouItems();
      } else if (selectedKASSubTab === 'zusatzkosten') {
        saveKasZusatzkosten();
      } else if (selectedKASSubTab === 'total') {
        saveTotalPrices();
      }
    } else if (selectedTourType === 'za') {
      if (selectedZASubTab === 'hotels') {
        saveZaHotelPrices();
      } else if (selectedZASubTab === 'transport') {
        saveZaTransportRoutes();
      } else if (selectedZASubTab === 'railway') {
        saveZaRailwayRoutes();
      } else if (selectedZASubTab === 'fly') {
        saveZaFlyRoutes();
      } else if (selectedZASubTab === 'meal') {
        saveZaMealItems();
      } else if (selectedZASubTab === 'sightseing') {
        saveZaSightseingItems();
      } else if (selectedZASubTab === 'guide') {
        saveZaGuideItems();
      } else if (selectedZASubTab === 'shou') {
        saveZaShouItems();
      } else if (selectedZASubTab === 'zusatzkosten') {
        saveZaZusatzkosten();
      } else if (selectedZASubTab === 'total') {
        saveTotalPrices();
      }
    } else if (selectedTourType === 'preis2026') {
      if (selectedPreis2026SubTab === 'hotels') {
        savePreis2026HotelPrices();
      } else if (selectedPreis2026SubTab === 'transport') {
        savePreis2026TransportRoutes();
      } else if (selectedPreis2026SubTab === 'railway') {
        savePreis2026RailwayRoutes();
      } else if (selectedPreis2026SubTab === 'fly') {
        savePreis2026FlyRoutes();
      } else if (selectedPreis2026SubTab === 'meal') {
        savePreis2026MealItems();
      } else if (selectedPreis2026SubTab === 'sightseing') {
        savePreis2026SightseingItems();
      } else if (selectedPreis2026SubTab === 'guide') {
        savePreis2026GuideItems();
      } else if (selectedPreis2026SubTab === 'shou') {
        savePreis2026ShouItems();
      }
    }
  };

  // Export Preis 2026 to PDF
  const exportPreis2026ToPDF = () => {
    try {
      console.log('🔄 PDF export started...');
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
      console.log('✅ jsPDF instance created');

      let yPosition = 8;
      const pageWidth = doc.internal.pageSize.getWidth();

      // Load and add Orient Insight logo (centered, bigger)
      const logoImg = new Image();
      logoImg.src = '/logo.png';

      // Add logo at top center (bigger size: 35x35)
      try {
        const logoSize = 35;
        doc.addImage(logoImg, 'PNG', (pageWidth - logoSize) / 2, yPosition, logoSize, logoSize);
        yPosition += logoSize + 3;
      } catch (e) {
        console.log('Logo could not be added:', e);
        yPosition += 8;
      }

      // Company information (centered, below logo)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ORIENT INSIGHT GmbH', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Shota Rustavelli, 45, 140100 Samarkand, Usbekistan', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4;
      doc.text('Tel: +998933484208 / +998979282814', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 4;
      doc.text('E-Mail: orientinsightreisen@gmail.com | Web: www.orient-insight.uz', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 12;

      // Title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Preis 2026 - Preisliste', pageWidth / 2, yPosition, { align: 'center' });

      yPosition += 8;

      // CO (Comfort Plus) Table
      const coHotelTotal = calculateCoHotelTotals().totalPerTraveler / 2;
      const coRailwayTotal = coRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const coFlyTotal = coFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const coMealTotal = coMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
      const coSightseingTotal = coSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const coGuideTotal = coGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
      const coShouTotal = coShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const coEzZuschlag = calculateCoHotelTotals().totalEZZimmer - (calculateCoHotelTotals().totalPerTraveler / 2);

      const coPrices = paxTiers.map(tier => {
        const transportPPP = calculateCoTransportTotals().grandTotal / tier.count;
        const price = coHotelTotal + transportPPP + coRailwayTotal + (coFlyTotal / tier.count) +
                      coMealTotal + coSightseingTotal + (coGuideTotal / tier.count) + coShouTotal;
        const commissionPercent = coCommissionValues[tier.id] || 0;
        const commissionAmount = (price * commissionPercent) / 100;
        return Math.round(price + commissionAmount);
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Preis fur die Comfort Plus', ...paxTiers.map(t => t.name), 'EZ Zuschlag']],
        body: [['Preis pro Person', ...coPrices, `$ ${Math.round(coEzZuschlag)}`]],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        margin: { left: 10, right: 10 },
      });

      yPosition = doc.lastAutoTable.finalY + 5;

      // ER (Erlebnisreisen) Table
      const hotelTotal = calculateHotelTotals().totalPerTraveler / 2;
      const railwayTotal = railwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const flyTotal = flyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const mealTotal = mealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
      const sightseingTotal = sightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const guideTotal = guideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
      const shouTotal = shouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const ezZuschlag = calculateHotelTotals().totalEZZimmer - (calculateHotelTotals().totalPerTraveler / 2);

      const erPrices = paxTiers.map(tier => {
        const transportPPP = calculateTransportTotals().grandTotal / tier.count;
        const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                      mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
        const commissionPercent = commissionValues[tier.id] || 0;
        const commissionAmount = (price * commissionPercent) / 100;
        return Math.round(price + commissionAmount);
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Preis fur die Erlebnissreisen', ...paxTiers.map(t => t.name), 'EZ Zuschlag']],
        body: [['Preis pro Person', ...erPrices, `$ ${Math.round(ezZuschlag)}`]],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        margin: { left: 10, right: 10 },
      });

      yPosition = doc.lastAutoTable.finalY + 5;

      // ZA (Zentralasienreisen) Table
      const zaHotelTotal = calculateZaHotelTotals().totalPerTraveler / 2;
      const zaRailwayTotal = zaRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const zaFlyTotal = zaFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const zaMealTotal = zaMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
      const zaSightseingTotal = zaSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const zaGuideTotal = zaGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
      const zaShouTotal = zaShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const zaEzZuschlag = calculateZaHotelTotals().totalEZZimmer - (calculateZaHotelTotals().totalPerTraveler / 2);

      const zaPrices = paxTiers.map(tier => {
        const transportPPP = calculateZaTransportTotals().grandTotal / tier.count;
        const price = zaHotelTotal + transportPPP + zaRailwayTotal + (zaFlyTotal / tier.count) +
                      zaMealTotal + zaSightseingTotal + (zaGuideTotal / tier.count) + zaShouTotal;
        const commissionPercent = zaCommissionValues[tier.id] || 0;
        const commissionAmount = (price * commissionPercent) / 100;
        return Math.round(price + commissionAmount);
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Preis fur die Zentralasienreisen', ...paxTiers.map(t => t.name), 'EZ Zuschlag']],
        body: [['Preis pro Person', ...zaPrices, `$ ${Math.round(zaEzZuschlag)}`]],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        margin: { left: 10, right: 10 },
      });

      yPosition = doc.lastAutoTable.finalY + 5;

      // KAS (Kasakistan Kirgistan und Usbekistan) Table
      const kasHotelTotal = calculateKasHotelTotals().totalPerTraveler / 2;
      const kasRailwayTotal = kasRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const kasFlyTotal = kasFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
      const kasMealTotal = kasMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
      const kasSightseingTotal = kasSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const kasGuideTotal = kasGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
      const kasShouTotal = kasShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
      const kasEzZuschlag = calculateKasHotelTotals().totalEZZimmer - (calculateKasHotelTotals().totalPerTraveler / 2);

      const kasPrices = paxTiers.map(tier => {
        const transportPPP = calculateKasTransportTotals().grandTotal / tier.count;
        const price = kasHotelTotal + transportPPP + kasRailwayTotal + (kasFlyTotal / tier.count) +
                      kasMealTotal + kasSightseingTotal + (kasGuideTotal / tier.count) + kasShouTotal;
        const commissionPercent = kasCommissionValues[tier.id] || 0;
        const commissionAmount = (price * commissionPercent) / 100;
        return Math.round(price + commissionAmount);
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Preis fur Kasakistan Kirgistan und Usbekistan', ...paxTiers.map(t => t.name), 'EZ Zuschlag']],
        body: [['Preis pro Person', ...kasPrices, `$ ${Math.round(kasEzZuschlag)}`]],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        bodyStyles: { fontSize: 9, fontStyle: 'bold', halign: 'center', cellPadding: 2 },
        margin: { left: 10, right: 10 },
      });

      // Save PDF
      console.log('💾 Saving PDF...');
      doc.save('Preis_2026.pdf');
      console.log('✅ PDF saved successfully!');
      toast.success('PDF muvaffaqiyatli yuklandi!');
    } catch (error) {
      console.error('❌ PDF export error:', error);
      toast.error('PDF yaratishda xatolik: ' + error.message);
    }
  };

  // Save Total Prices to localStorage for Rechnung
  const saveTotalPrices = () => {
    console.log('💾 Saving Total Prices from table to localStorage...');

    // CRITICAL FIX: Check if selectedTour exists
    const selectedTour = tourTypes.find(t => t.id === selectedTourType);
    if (!selectedTour) {
      toast.error('Tour type topilmadi!');
      console.error('❌ selectedTour is undefined. selectedTourType:', selectedTourType);
      return;
    }

    // Just save the prices that were calculated during table rendering
    const pricesToSave = calculatedTotalPrices.current;

    if (Object.keys(pricesToSave).length === 0) {
      toast.error('Avval Total tabni oching va ko\'ring!');
      console.error('❌ No prices calculated yet. Please view the Total tab first.');
      return;
    }

    // Save to localStorage with tour-specific key
    const storageKey = `${selectedTour.id.toLowerCase()}-total-prices`;

    try {
      localStorage.setItem(storageKey, JSON.stringify(pricesToSave));

      console.log(`✅ Total Prices saved to localStorage (${storageKey})!`);
      Object.keys(pricesToSave).forEach(tierId => {
        const tierData = pricesToSave[tierId];
        console.log(`   ${tierId}: Total=${tierData.totalPrice}$, EZ=${tierData.ezZuschlag}$`);
      });

      toast.success(`${selectedTour.name} narxlar saqlandi! Endi Rechnung to'g'ri ko'rinadi.`);
    } catch (error) {
      console.error('❌ localStorage save error:', error);
      toast.error('Saqlashda xatolik: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 bg-gradient-to-br from-${selectedTour.color}-500 to-${selectedTour.color}-600 rounded-xl flex items-center justify-center shadow-lg`}>
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">Price Management</h1>
            <p className="text-gray-600">Управление ценами для туров</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl"
          >
            <Save className="w-5 h-5" />
            Сохранить
          </button>
          {selectedTourType === 'er' && selectedERSubTab === 'transport' && (
            <button
              onClick={addTransportRoute}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'railway' && (
            <button
              onClick={addRailwayRoute}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'fly' && (
            <button
              onClick={addFlyRoute}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'meal' && (
            <button
              onClick={addMealItem}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Element қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'sightseing' && (
            <button
              onClick={addSightseingItem}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Element қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'guide' && (
            <button
              onClick={addGuideItem}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Element қўшиш
            </button>
          )}
          {selectedTourType === 'er' && selectedERSubTab === 'shou' && (
            <button
              onClick={addShouItem}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus className="w-5 h-5" />
              Element қўшиш
            </button>
          )}
          {/* CO Module Add Buttons */}
          {selectedTourType === 'co' && selectedCOSubTab === 'transport' && (
            <button onClick={addCoTransportRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'railway' && (
            <button onClick={addCoRailwayRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'fly' && (
            <button onClick={addCoFlyRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'meal' && (
            <button onClick={addCoMealItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'sightseing' && (
            <button onClick={addCoSightseingItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'guide' && (
            <button onClick={addCoGuideItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'co' && selectedCOSubTab === 'shou' && (
            <button onClick={addCoShouItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {/* KAS Module Add Buttons */}
          {selectedTourType === 'kas' && selectedKASSubTab === 'transport' && (
            <button onClick={addKasTransportRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'railway' && (
            <button onClick={addKasRailwayRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'fly' && (
            <button onClick={addKasFlyRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'meal' && (
            <button onClick={addKasMealItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'sightseing' && (
            <button onClick={addKasSightseingItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'guide' && (
            <button onClick={addKasGuideItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'kas' && selectedKASSubTab === 'shou' && (
            <button onClick={addKasShouItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl hover:from-orange-700 hover:to-amber-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {/* ZA Module Add Buttons */}
          {selectedTourType === 'za' && selectedZASubTab === 'transport' && (
            <button onClick={addZaTransportRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'railway' && (
            <button onClick={addZaRailwayRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'fly' && (
            <button onClick={addZaFlyRoute} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Marshрут қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'meal' && (
            <button onClick={addZaMealItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'sightseing' && (
            <button onClick={addZaSightseingItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'guide' && (
            <button onClick={addZaGuideItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
          {selectedTourType === 'za' && selectedZASubTab === 'shou' && (
            <button onClick={addZaShouItem} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl hover:from-purple-700 hover:to-violet-700 transition-all duration-300 shadow-lg hover:shadow-xl">
              <Plus className="w-5 h-5" />Element қўшиш
            </button>
          )}
        </div>
      </div>

      {/* Tour Type Tabs */}
      <div className="flex gap-3">
        {tourTypes.map((tour) => (
          <button
            key={tour.id}
            onClick={() => setSelectedTourType(tour.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
              selectedTourType === tour.id
                ? `bg-gradient-to-r from-${tour.color}-600 to-${tour.color}-700 text-white shadow-lg`
                : 'bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            {tour.name}
          </button>
        ))}
      </div>

      {/* ER Sub-Tabs */}
      {selectedTourType === 'er' && (
        <div className="flex gap-3">
          {erSubTabs.map((subTab) => {
            const Icon = subTab.icon;
            return (
              <button
                key={subTab.id}
                onClick={() => setSelectedERSubTab(subTab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 ${
                  selectedERSubTab === subTab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {subTab.name}
              </button>
            );
          })}
        </div>
      )}

      {/* CO Sub-Tabs */}
      {selectedTourType === 'co' && (
        <div className="flex gap-3">
          {erSubTabs.map((subTab) => {
            const Icon = subTab.icon;
            return (
              <button
                key={subTab.id}
                onClick={() => setSelectedCOSubTab(subTab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 ${
                  selectedCOSubTab === subTab.id
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {subTab.name}
              </button>
            );
          })}
        </div>
      )}

      {/* KAS Sub-Tabs */}
      {selectedTourType === 'kas' && (
        <div className="flex gap-3">
          {erSubTabs.map((subTab) => {
            const Icon = subTab.icon;
            return (
              <button
                key={subTab.id}
                onClick={() => setSelectedKASSubTab(subTab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 ${
                  selectedKASSubTab === subTab.id
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {subTab.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ZA Sub-Tabs */}
      {selectedTourType === 'za' && (
        <div className="flex gap-3">
          {erSubTabs.map((subTab) => {
            const Icon = subTab.icon;
            return (
              <button
                key={subTab.id}
                onClick={() => setSelectedZASubTab(subTab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 ${
                  selectedZASubTab === subTab.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {subTab.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Content - Hotels Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'hotels' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">Hotels</h3>
            <button
              onClick={addHotelRow}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Hotels</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Tage</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">DBL</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zimmer</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zuschlag</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hotelPrices.map((hotel) => {
                return (
                  <tr key={hotel.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={hotel.city}
                        onChange={(e) => updateHotelPrice(hotel.id, 'city', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-semibold"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.days === 0 ? '' : hotel.days}
                        onChange={(e) => updateHotelPrice(hotel.id, 'days', e.target.value)}
                        className="w-20 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.pricePerDay === 0 ? '' : hotel.pricePerDay}
                        onChange={(e) => updateHotelPrice(hotel.id, 'pricePerDay', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.ezZimmer === 0 ? '' : hotel.ezZimmer}
                        onChange={(e) => updateHotelPrice(hotel.id, 'ezZimmer', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => deleteHotelRow(hotel.id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Summary Row - Total */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-6 py-4 text-gray-900 text-lg">Total</td>
                <td className="px-6 py-4 text-center text-gray-900 text-lg">
                  {calculateHotelTotals().totalDays}
                </td>
                <td className="px-6 py-4 text-center text-blue-700 text-lg">
                  {calculateHotelTotals().totalPerTraveler.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
              {/* Summary Row - Total pro person */}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                <td className="px-6 py-4 text-gray-900 text-lg">Total pro person</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center text-green-700 text-lg">
                  {(calculateHotelTotals().totalPerTraveler / 2).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-purple-700 text-lg">
                  {calculateHotelTotals().totalEZZimmer.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-orange-700 text-lg">
                  {(calculateHotelTotals().totalEZZimmer - (calculateHotelTotals().totalPerTraveler / 2)).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Content - Transport Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'transport' && (
        <>
          {/* PAX Tier Sub-Tabs */}
          <div className="flex gap-2 flex-wrap items-center">
            {paxTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedPaxTier(tier.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                  selectedPaxTier === tier.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier.name}
              </button>
            ))}
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyTransportFrom4PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              title="4 PAX narxlarini 5, 6-7, 8-9 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 4 PAX
            </button>
            <button
              onClick={copyTransportFrom10_11PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md"
              title="10-11 PAX narxlarini 12-13, 14-15, 16 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 10-11 PAX
            </button>
          </div>

          {/* Transport Routes Table */}
          <div key={selectedPaxTier} className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
              <h3 className="text-xl font-bold text-white text-center">
                Transport Erlebnisreisen - Usbekistan 15 Tage
              </h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                  <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Route</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Preise</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transportRoutes.map((route, index) => {
                  const routeTotal = route.days * route.price;
                  return (
                    <tr key={route.id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-3 py-2 text-center">
                        <span className="font-semibold text-gray-600">{index + 1}</span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={route.name}
                          onChange={(e) => updateTransportRoute(route.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          value={route.days === 0 ? '' : route.days}
                          onChange={(e) => updateTransportRoute(route.id, 'days', e.target.value)}
                          className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="number"
                          value={route.price === 0 ? '' : route.price}
                          onChange={(e) => updateTransportRoute(route.id, 'price', e.target.value)}
                          className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`font-bold ${routeTotal > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {routeTotal}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => moveRouteUp(index)}
                            disabled={index === 0}
                            className={`p-1.5 rounded-lg transition-colors ${
                              index === 0
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                            }`}
                            title="Yuqoriga"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveRouteDown(index)}
                            disabled={index === transportRoutes.length - 1}
                            className={`p-1.5 rounded-lg transition-colors ${
                              index === transportRoutes.length - 1
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                            }`}
                            title="Pastga"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTransportRoute(route.id)}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                            title="O'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-gray-900">
                    {calculateTransportTotals().totalDays}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-blue-700 text-lg">
                    {calculateTransportTotals().grandTotal}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
                {/* Anzahl der Reisende Row */}
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Anzahl der Reisende</td>
                  <td className="px-4 py-3 text-center text-gray-900">
                    {paxTiers.find(p => p.id === selectedPaxTier)?.count || 0}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-green-700 text-lg">
                    {calculateTransportTotals().pricePerPerson.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Content - Railway Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'railway' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Railway Routes</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Route</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {railwayRoutes.map((route, index) => {
                return (
                  <tr key={route.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-3 py-2 text-center">
                      <span className="font-semibold text-gray-600">{index + 1}</span>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={route.name}
                        onChange={(e) => updateRailwayRoute(route.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        value={route.days === 0 ? '' : route.days}
                        onChange={(e) => updateRailwayRoute(route.id, 'days', e.target.value)}
                        className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        value={route.price === 0 ? '' : route.price}
                        onChange={(e) => updateRailwayRoute(route.id, 'price', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => moveRailwayUp(index)}
                          disabled={index === 0}
                          className={`p-1.5 rounded-lg transition-colors ${
                            index === 0
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                          }`}
                          title="Yuqoriga"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveRailwayDown(index)}
                          disabled={index === railwayRoutes.length - 1}
                          className={`p-1.5 rounded-lg transition-colors ${
                            index === railwayRoutes.length - 1
                              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                          }`}
                          title="Pastga"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteRailwayRoute(route.id)}
                          className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {railwayRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {railwayRoutes.reduce((sum, r) => {
                    const days = parseFloat(r.days) || 1;
                    const price = parseFloat(r.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          {railwayRoutes.length === 0 && (
            <div className="text-center py-12">
              <Train className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Marshrutlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi marshrut qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* Content - Fly Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'fly' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Flight Routes</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Route</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {flyRoutes.map((route, index) => (
                <tr key={route.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-gray-600">{index + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={route.name}
                      onChange={(e) => updateFlyRoute(route.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={route.days === 0 ? '' : route.days}
                      onChange={(e) => updateFlyRoute(route.id, 'days', e.target.value)}
                      className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={route.price === 0 ? '' : route.price}
                      onChange={(e) => updateFlyRoute(route.id, 'price', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => moveFlyUp(index)}
                        disabled={index === 0}
                        className={`p-1.5 rounded-lg transition-colors ${
                          index === 0
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                        }`}
                        title="Yuqoriga"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveFlyDown(index)}
                        disabled={index === flyRoutes.length - 1}
                        className={`p-1.5 rounded-lg transition-colors ${
                          index === flyRoutes.length - 1
                            ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                        }`}
                        title="Pastga"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteFlyRoute(route.id)}
                        className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {flyRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {flyRoutes.reduce((sum, r) => {
                    const days = parseFloat(r.days) || 1;
                    const price = parseFloat(r.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
              {/* PAX Breakdown */}
              <tr className="bg-gray-50">
                <td colSpan="5" className="px-4 py-4">
                  <div className="text-center mb-2 font-bold text-gray-700">Odam boshiga narx (Price per person)</div>
                  <div className="grid grid-cols-8 gap-2">
                    {paxTiers.map(tier => {
                      const totalPrice = flyRoutes.reduce((sum, r) => {
                        const days = parseFloat(r.days) || 1;
                        const price = parseFloat(r.price) || 0;
                        return sum + (days * price);
                      }, 0);
                      const pricePerPerson = totalPrice / tier.count;
                      return (
                        <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                          <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                          <div className="text-lg font-bold text-green-600">{pricePerPerson.toFixed(2)} $</div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {flyRoutes.length === 0 && (
            <div className="text-center py-12">
              <Plane className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Marshrutlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi marshrut qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* Content - Meal Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'meal' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Meal Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mealItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-gray-600">{index + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateMealItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.days === 0 ? '' : item.days}
                      onChange={(e) => updateMealItem(item.id, 'days', e.target.value)}
                      className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateMealItem(item.id, 'price', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => moveMealUp(index)} disabled={index === 0} className={`p-1.5 rounded-lg transition-colors ${index === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Yuqoriga">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveMealDown(index)} disabled={index === mealItems.length - 1} className={`p-1.5 rounded-lg transition-colors ${index === mealItems.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Pastga">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteMealItem(item.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {mealItems.reduce((sum, m) => sum + (parseFloat(m.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {mealItems.reduce((sum, m) => {
                    const days = parseFloat(m.days) || 1;
                    const price = parseFloat(m.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          {mealItems.length === 0 && (
            <div className="text-center py-12">
              <Utensils className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Elementlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi element qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* Content - Sightseing Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'sightseing' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Sightseing Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sightseingItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-gray-600">{index + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateSightseingItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.days === 0 ? '' : item.days}
                      onChange={(e) => updateSightseingItem(item.id, 'days', e.target.value)}
                      className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateSightseingItem(item.id, 'price', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => moveSightseingUp(index)} disabled={index === 0} className={`p-1.5 rounded-lg transition-colors ${index === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Yuqoriga">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveSightseingDown(index)} disabled={index === sightseingItems.length - 1} className={`p-1.5 rounded-lg transition-colors ${index === sightseingItems.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Pastga">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteSightseingItem(item.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {sightseingItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {sightseingItems.reduce((sum, s) => {
                    const days = parseFloat(s.days) || 1;
                    const price = parseFloat(s.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          {sightseingItems.length === 0 && (
            <div className="text-center py-12">
              <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Elementlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi element qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* Content - Total Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'zusatzkosten' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-pink-100 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Zusatzkosten (Additional Costs) - ER</h3>
            <button
              onClick={() => {
                const newItem = {
                  id: Date.now(),
                  name: 'New Cost',
                  price: 0,
                  pax: 1,
                  currency: 'USD'
                };
                setZusatzkostenItems([...zusatzkostenItems, newItem]);
              }}
              className="bg-white text-pink-600 px-4 py-2 rounded-lg font-semibold hover:bg-pink-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-pink-100 to-rose-100">
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">№</th>
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">Name</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">PAX</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Price</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Total</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Currency</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zusatzkostenItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="border border-pink-300 px-4 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No additional costs added yet</p>
                      <p className="text-sm mt-2">Click "Add Cost" to add a new item</p>
                    </td>
                  </tr>
                ) : (
                  zusatzkostenItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-pink-50 transition-colors">
                      <td className="border border-pink-300 px-4 py-3 text-center font-semibold">{index + 1}</td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const updated = zusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, name: e.target.value } : i
                            );
                            setZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="number"
                          value={item.pax || 1}
                          onChange={(e) => {
                            const updated = zusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, pax: parseInt(e.target.value) || 1 } : i
                            );
                            setZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-center font-semibold"
                          min="1"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const updated = zusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i
                            );
                            setZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-right font-semibold"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-right font-bold text-lg text-gray-900">
                        {((item.price || 0) * (item.pax || 1)).toFixed(2)}
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <select
                          value={item.currency}
                          onChange={(e) => {
                            const updated = zusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, currency: e.target.value } : i
                            );
                            setZusatzkostenItems(updated);
                          }}
                          className="px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 font-semibold"
                        >
                          <option value="USD">USD</option>
                          <option value="UZS">UZS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setZusatzkostenItems(zusatzkostenItems.filter(i => i.id !== item.id));
                            toast.success('Item deleted');
                          }}
                          className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {zusatzkostenItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                    <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">
                      Total USD:
                    </td>
                    <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">
                      {zusatzkostenItems
                        .filter(i => i.currency === 'USD')
                        .reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0)
                        .toFixed(2)}
                    </td>
                    <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">USD</td>
                    <td className="border border-pink-300"></td>
                  </tr>
                  {zusatzkostenItems.some(i => i.currency === 'UZS') && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">
                        Total UZS:
                      </td>
                      <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">
                        {zusatzkostenItems
                          .filter(i => i.currency === 'UZS')
                          .reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0)
                          .toLocaleString()}
                      </td>
                      <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">UZS</td>
                      <td className="border border-pink-300"></td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
          <div className="p-4 bg-pink-50 border-t border-pink-200">
            <button
              onClick={saveZusatzkosten}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:from-pink-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Zusatzkosten
            </button>
          </div>
        </div>
      )}

      {selectedTourType === 'er' && selectedERSubTab === 'total' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Total Price Summary - All Categories</h3>
          </div>
          <div className="overflow-x-auto">{(() => {
              const hotelTotal = calculateHotelTotals().totalPerTraveler / 2;
              const transportTotals = paxTiers.map(tier => calculateTransportTotals().grandTotal / tier.count);
              const railwayTotal = railwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const flyTotal = flyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const mealTotal = mealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
              const sightseingTotal = sightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
              const guideTotal = guideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
              const shouTotal = shouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
              const ezZuschlag = calculateHotelTotals().totalEZZuschlag;

              // Clear previous calculations
              calculatedTotalPrices.current = {};

              return (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 to-indigo-500">
                  <th className="border border-purple-600 px-4 py-3 text-left font-bold text-white">Category</th>
                  {paxTiers.map(tier => (
                    <th key={tier.id} className="border border-purple-600 px-4 py-3 text-center font-bold text-white">{tier.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Hotels */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Hotels</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(hotelTotal)}
                    </td>
                  ))}
                </tr>
                {/* Transport */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Transport</td>
                  {transportTotals.map((total, idx) => (
                    <td key={idx} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(total)}
                    </td>
                  ))}
                </tr>
                {/* Railway */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Railway</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(railwayTotal)}
                    </td>
                  ))}
                </tr>
                {/* Fly */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Fly</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(flyTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                {/* Meal */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Meal</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(mealTotal)}
                    </td>
                  ))}
                </tr>
                {/* Sightseing */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Sightseing</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(sightseingTotal)}
                    </td>
                  ))}
                </tr>
                {/* Guide */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Guide</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(guideTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                {/* Shou */}
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Shou</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-blue-600 font-bold">
                      {formatPrice(shouTotal)}
                    </td>
                  ))}
                </tr>
                {/* Price (Subtotal) */}
                <tr className="bg-gray-100 border-t-2 border-gray-400">
                  <td className="border border-gray-400 px-4 py-3 font-bold text-base text-gray-900">Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-4 py-3 text-center font-bold text-lg text-gray-900">
                        {formatPrice(price)} $
                      </td>
                    );
                  })}
                </tr>
                {/* Commission */}
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 px-4 py-3 font-semibold text-base text-gray-700">commission (%)</td>
                  {paxTiers.map(tier => {
                    const commission = commissionValues[tier.id] || 0;
                    const transportPPP = calculateTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionAmount = (price * commission) / 100;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-2 py-2 text-center">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={commission === 0 ? '' : commission}
                          onChange={(e) => updateCommissionValue(tier.id, e.target.value)}
                          onBlur={saveCommissionValues}
                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-base"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {commissionAmount > 0 && `+${formatPrice(commissionAmount)} $`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* Total Price (Final) */}
                <tr className="bg-gradient-to-r from-green-400 to-emerald-400 border-t-4 border-green-600">
                  <td className="border border-green-600 px-4 py-4 font-black text-lg text-gray-900">Total Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionPercent = commissionValues[tier.id] || 0;
                    const commissionAmount = (price * commissionPercent) / 100;
                    const totalPrice = price + commissionAmount;

                    // Store calculated values for saving later
                    calculatedTotalPrices.current[tier.id] = {
                      totalPrice: Math.round(totalPrice),
                      ezZuschlag: Math.round(ezZuschlag)
                    };

                    return (
                      <td key={tier.id} className="border border-green-600 px-4 py-4 text-center font-black text-xl text-gray-900">
                        {formatPrice(totalPrice)} $
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
              );
            })()}

            {/* EZ Zuschlag Info */}
            <div className="px-6 py-4 bg-orange-50 border-t-2 border-orange-200">
              <div className="flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700 mr-3">EZ Zuschlag:</span>
                <span className="text-2xl font-black text-orange-600">{formatPrice(calculateHotelTotals().totalEZZuschlag)} $</span>
              </div>
            </div>

            {/* Save Total Prices Button */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-200">
              <div className="flex items-center justify-center">
                <button
                  onClick={saveTotalPrices}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Narxlarni saqlash (Rechnung uchun)
                </button>
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">
                Bu tugmani bosing, keyin Documents → Rechnung da to'g'ri narxlar ko'rinadi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content - Shou Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'shou' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Shou Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shouItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-gray-600">{index + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateShouItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.days === 0 ? '' : item.days}
                      onChange={(e) => updateShouItem(item.id, 'days', e.target.value)}
                      className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateShouItem(item.id, 'price', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => moveShouUp(index)} disabled={index === 0} className={`p-1.5 rounded-lg transition-colors ${index === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Yuqoriga">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveShouDown(index)} disabled={index === shouItems.length - 1} className={`p-1.5 rounded-lg transition-colors ${index === shouItems.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Pastga">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteShouItem(item.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {shouItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {shouItems.reduce((sum, s) => {
                    const days = parseFloat(s.days) || 1;
                    const price = parseFloat(s.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          {shouItems.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Elementlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi element qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* Content - Guide Tab for ER */}
      {selectedTourType === 'er' && selectedERSubTab === 'guide' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Guide Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guideItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <span className="font-semibold text-gray-600">{index + 1}</span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateGuideItem(item.id, 'name', e.target.value)}
                      className="w-full px-2 py-1 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-medium"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.days === 0 ? '' : item.days}
                      onChange={(e) => updateGuideItem(item.id, 'days', e.target.value)}
                      className="w-16 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.price === 0 ? '' : item.price}
                      onChange={(e) => updateGuideItem(item.id, 'price', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => moveGuideUp(index)} disabled={index === 0} className={`p-1.5 rounded-lg transition-colors ${index === 0 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Yuqoriga">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveGuideDown(index)} disabled={index === guideItems.length - 1} className={`p-1.5 rounded-lg transition-colors ${index === guideItems.length - 1 ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'}`} title="Pastga">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteGuideItem(item.id)} className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors" title="O'chirish">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">
                  {guideItems.reduce((sum, g) => sum + (parseFloat(g.days) || 1), 0)}
                </td>
                <td className="px-4 py-3 text-center text-blue-600 text-xl font-bold">
                  {guideItems.reduce((sum, g) => {
                    const days = parseFloat(g.days) || 1;
                    const price = parseFloat(g.price) || 0;
                    return sum + (days * price);
                  }, 0).toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
              {/* PAX Breakdown */}
              <tr className="bg-gray-50">
                <td colSpan="5" className="px-4 py-4">
                  <div className="text-center mb-2 font-bold text-gray-700">Odam boshiga narx (Price per person)</div>
                  <div className="grid grid-cols-8 gap-2">
                    {paxTiers.map(tier => {
                      const totalPrice = guideItems.reduce((sum, g) => {
                        const days = parseFloat(g.days) || 1;
                        const price = parseFloat(g.price) || 0;
                        return sum + (days * price);
                      }, 0);
                      const pricePerPerson = totalPrice / tier.count;
                      return (
                        <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                          <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                          <div className="text-lg font-bold text-green-600">{pricePerPerson.toFixed(2)} $</div>
                        </div>
                      );
                    })}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          {guideItems.length === 0 && (
            <div className="text-center py-12">
              <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 font-medium">Elementlar yo'q</p>
              <p className="text-gray-500 text-sm mt-1">Yangi element qo'shing</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== CO MODULE TABS ==================== */}

      {/* CO - Hotels Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'hotels' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">Hotels</h3>
            <button
              onClick={addCoHotelRow}
              className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Hotels</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Tage</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">DBL</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zimmer</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zuschlag</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coHotelPrices.map((hotel) => (
                <tr key={hotel.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-6 py-3">
                    <input
                      type="text"
                      value={hotel.city}
                      onChange={(e) => updateCoHotelPrice(hotel.id, 'city', e.target.value)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none font-semibold"
                    />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <input
                      type="number"
                      value={hotel.days === 0 ? '' : hotel.days}
                      onChange={(e) => updateCoHotelPrice(hotel.id, 'days', e.target.value)}
                      className="w-20 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <input
                      type="number"
                      value={hotel.pricePerDay === 0 ? '' : hotel.pricePerDay}
                      onChange={(e) => updateCoHotelPrice(hotel.id, 'pricePerDay', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <input
                      type="number"
                      value={hotel.ezZimmer === 0 ? '' : hotel.ezZimmer}
                      onChange={(e) => updateCoHotelPrice(hotel.id, 'ezZimmer', e.target.value)}
                      className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className="text-gray-400">-</span>
                  </td>
                  <td className="px-6 py-3 text-center">
                    <button
                      onClick={() => deleteCoHotelRow(hotel.id)}
                      className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {/* CO Hotels - Total Row */}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-6 py-4 text-gray-900 text-lg">Total</td>
                <td className="px-6 py-4 text-center text-gray-900 text-lg">
                  {coHotelPrices.reduce((sum, h) => sum + (h.days || 0), 0)}
                </td>
                <td className="px-6 py-4 text-center text-green-700 text-lg">
                  {coHotelPrices.reduce((sum, h) => sum + (h.days * h.pricePerDay || 0), 0).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
              <tr className="bg-gradient-to-r from-emerald-50 to-green-100 font-bold">
                <td className="px-6 py-4 text-gray-900 text-lg">Total pro person</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center text-green-700 text-lg">
                  {(coHotelPrices.reduce((sum, h) => sum + (h.days * h.pricePerDay || 0), 0) / 2).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-purple-700 text-lg">
                  {coHotelPrices.reduce((sum, h) => sum + (h.ezZimmer * h.days || 0), 0).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-orange-700 text-lg">
                  {(coHotelPrices.reduce((sum, h) => sum + (h.ezZimmer * h.days || 0), 0) - (coHotelPrices.reduce((sum, h) => sum + (h.days * h.pricePerDay || 0), 0) / 2)).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CO - Transport Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'transport' && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            {paxTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedPaxTier(tier.id)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                  selectedPaxTier === tier.id
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier.name}
              </button>
            ))}
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyCoTransportFrom4PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              title="4 PAX narxlarini 5, 6-7, 8-9 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 4 PAX
            </button>
            <button
              onClick={copyCoTransportFrom10_11PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md"
              title="10-11 PAX narxlarini 12-13, 14-15, 16 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 10-11 PAX
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
              <h3 className="text-xl font-bold text-white text-center">Transport Routes - {paxTiers.find(t => t.id === selectedPaxTier)?.name}</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                  <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Name</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coTransportRoutes.map((route, index) => (
                  <tr key={route.id} className="hover:bg-green-50 transition-colors">
                    <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <input type="text" value={route.name} onChange={(e) => updateCoTransportRoute(route.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="number" value={route.days} onChange={(e) => updateCoTransportRoute(route.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input type="number" value={route.price} onChange={(e) => updateCoTransportRoute(route.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => deleteCoTransportRoute(route.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-gray-900 text-lg">{coTransportRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}</td>
                  <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coTransportRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0).toFixed(2)} $</td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
                {/* Anzahl der Reisende Row */}
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Anzahl der Reisende</td>
                  <td className="px-4 py-3 text-center text-gray-900">
                    {paxTiers.find(p => p.id === selectedPaxTier)?.count || 0}
                  </td>
                  <td className="px-4 py-3 text-center text-green-700 text-lg">
                    {calculateCoTransportTotals().pricePerPerson.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CO - Railway Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'railway' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Railway Routes</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Name</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coRailwayRoutes.map((route, index) => (
                <tr key={route.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={route.name} onChange={(e) => updateCoRailwayRoute(route.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={route.days} onChange={(e) => updateCoRailwayRoute(route.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={route.price} onChange={(e) => updateCoRailwayRoute(route.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoRailwayRoute(route.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coRailwayRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CO - Fly Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'fly' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Fly Routes</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Name</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coFlyRoutes.map((route, index) => (
                <tr key={route.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={route.name} onChange={(e) => updateCoFlyRoute(route.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={route.days} onChange={(e) => updateCoFlyRoute(route.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={route.price} onChange={(e) => updateCoFlyRoute(route.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoFlyRoute(route.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coFlyRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-green-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const flyTotal = coFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const pricePerPerson = flyTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-green-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CO - Meal Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'meal' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Meal Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coMealItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateCoMealItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateCoMealItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateCoMealItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoMealItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coMealItems.reduce((sum, m) => sum + (parseFloat(m.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CO - Sightseing Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'sightseing' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Sightseing Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coSightseingItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateCoSightseingItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateCoSightseingItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateCoSightseingItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoSightseingItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coSightseingItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CO - Guide Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'guide' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Guide Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coGuideItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateCoGuideItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateCoGuideItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateCoGuideItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoGuideItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coGuideItems.reduce((sum, g) => sum + (parseFloat(g.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-green-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const guideTotal = coGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const pricePerPerson = guideTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-green-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* CO - Shou Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'shou' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Shou Items</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 border-b-2 border-green-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coShouItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-green-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateCoShouItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateCoShouItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateCoShouItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteCoShouItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold border-t-2 border-green-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{coShouItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-green-600 text-xl font-bold">{coShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* CO - Total Tab */}
      {selectedTourType === 'co' && selectedCOSubTab === 'zusatzkosten' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-pink-100 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Zusatzkosten (Additional Costs) - CO</h3>
            <button
              onClick={() => {
                const newItem = {
                  id: Date.now(),
                  name: 'New Cost',
                  price: 0,
                  pax: 1,
                  currency: 'USD'
                };
                setCoZusatzkostenItems([...coZusatzkostenItems, newItem]);
              }}
              className="bg-white text-pink-600 px-4 py-2 rounded-lg font-semibold hover:bg-pink-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-pink-100 to-rose-100">
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">№</th>
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">Name</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">PAX</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Price</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Total</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Currency</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coZusatzkostenItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="border border-pink-300 px-4 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No additional costs added yet</p>
                      <p className="text-sm mt-2">Click "Add Cost" to add a new item</p>
                    </td>
                  </tr>
                ) : (
                  coZusatzkostenItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-pink-50 transition-colors">
                      <td className="border border-pink-300 px-4 py-3 text-center font-semibold">{index + 1}</td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => {
                            const updated = coZusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, name: e.target.value } : i
                            );
                            setCoZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="number"
                          value={item.pax || 1}
                          onChange={(e) => {
                            const updated = coZusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, pax: parseInt(e.target.value) || 1 } : i
                            );
                            setCoZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-center font-semibold"
                          min="1"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => {
                            const updated = coZusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i
                            );
                            setCoZusatzkostenItems(updated);
                          }}
                          className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-right font-semibold"
                        />
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-right font-bold text-lg text-gray-900">
                        {((item.price || 0) * (item.pax || 1)).toFixed(2)}
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <select
                          value={item.currency}
                          onChange={(e) => {
                            const updated = coZusatzkostenItems.map(i =>
                              i.id === item.id ? { ...i, currency: e.target.value } : i
                            );
                            setCoZusatzkostenItems(updated);
                          }}
                          className="px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 font-semibold"
                        >
                          <option value="USD">USD</option>
                          <option value="UZS">UZS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setCoZusatzkostenItems(coZusatzkostenItems.filter(i => i.id !== item.id));
                            toast.success('Item deleted');
                          }}
                          className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {coZusatzkostenItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                    <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">
                      Total USD:
                    </td>
                    <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">
                      {coZusatzkostenItems
                        .filter(i => i.currency === 'USD')
                        .reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0)
                        .toFixed(2)}
                    </td>
                    <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">USD</td>
                    <td className="border border-pink-300"></td>
                  </tr>
                  {coZusatzkostenItems.some(i => i.currency === 'UZS') && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">
                        Total UZS:
                      </td>
                      <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">
                        {coZusatzkostenItems
                          .filter(i => i.currency === 'UZS')
                          .reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0)
                          .toLocaleString()}
                      </td>
                      <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">UZS</td>
                      <td className="border border-pink-300"></td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
          <div className="p-4 bg-pink-50 border-t border-pink-200">
            <button
              onClick={saveCoZusatzkosten}
              className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:from-pink-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Zusatzkosten
            </button>
          </div>
        </div>
      )}

      {selectedTourType === 'co' && selectedCOSubTab === 'total' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Total Price Summary - All Categories</h3>
          </div>
          <div className="overflow-x-auto">{(() => {
              // Clear previous calculations
              calculatedTotalPrices.current = {};

              const hotelTotal = calculateCoHotelTotals().totalPerTraveler / 2;
              const transportTotals = paxTiers.map(tier => calculateCoTransportTotals().grandTotal / tier.count);
              const railwayTotal = coRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const flyTotal = coFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const mealTotal = coMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
              const sightseingTotal = coSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
              const guideTotal = coGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
              const shouTotal = coShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);

              return (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-green-500 to-emerald-500">
                  <th className="border border-green-600 px-4 py-3 text-left font-bold text-white">Category</th>
                  {paxTiers.map(tier => (
                    <th key={tier.id} className="border border-green-600 px-4 py-3 text-center font-bold text-white">{tier.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Hotels */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Hotels</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(hotelTotal)}
                    </td>
                  ))}
                </tr>
                {/* Transport */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Transport</td>
                  {transportTotals.map((total, idx) => (
                    <td key={idx} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(total)}
                    </td>
                  ))}
                </tr>
                {/* Railway */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Railway</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(railwayTotal)}
                    </td>
                  ))}
                </tr>
                {/* Fly */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Fly</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(flyTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                {/* Meal */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Meal</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(mealTotal)}
                    </td>
                  ))}
                </tr>
                {/* Sightseing */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Sightseing</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(sightseingTotal)}
                    </td>
                  ))}
                </tr>
                {/* Guide */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Guide</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(guideTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                {/* Shou */}
                <tr className="bg-green-50 hover:bg-green-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Shou</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-green-600 font-bold">
                      {formatPrice(shouTotal)}
                    </td>
                  ))}
                </tr>
                {/* Price (Subtotal) */}
                <tr className="bg-gray-100 border-t-2 border-gray-400">
                  <td className="border border-gray-400 px-4 py-3 font-bold text-base text-gray-900">Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateCoTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-4 py-3 text-center font-bold text-lg text-gray-900">
                        {formatPrice(price)} $
                      </td>
                    );
                  })}
                </tr>
                {/* Commission */}
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 px-4 py-3 font-semibold text-base text-gray-700">commission (%)</td>
                  {paxTiers.map(tier => {
                    const commission = coCommissionValues[tier.id] || 0;
                    const transportPPP = calculateCoTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionAmount = (price * commission) / 100;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-2 py-2 text-center">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={commission === 0 ? '' : commission}
                          onChange={(e) => updateCoCommissionValue(tier.id, e.target.value)}
                          onBlur={saveCoCommissionValues}
                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-base"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {commissionAmount > 0 && `+${formatPrice(commissionAmount)} $`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* Total Price (Final) */}
                <tr className="bg-gradient-to-r from-green-400 to-emerald-400 border-t-4 border-green-600">
                  <td className="border border-green-600 px-4 py-4 font-black text-lg text-gray-900">Total Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateCoTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionPercent = coCommissionValues[tier.id] || 0;
                    const commissionAmount = (price * commissionPercent) / 100;
                    const totalPrice = price + commissionAmount;

                    // Calculate EZ Zuschlag dynamically
                    const ezZuschlag = Math.round(calculateCoHotelTotals().totalEZZimmer - (calculateCoHotelTotals().totalPerTraveler / 2));

                    // Store calculated values for saving later
                    calculatedTotalPrices.current[tier.id] = {
                      totalPrice: Math.round(totalPrice),
                      ezZuschlag: ezZuschlag
                    };

                    return (
                      <td key={tier.id} className="border border-green-600 px-4 py-4 text-center font-black text-xl text-gray-900">
                        {formatPrice(totalPrice)} $
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
              );
            })()}

            {/* EZ Zuschlag Info */}
            <div className="px-6 py-4 bg-orange-50 border-t-2 border-orange-200">
              <div className="flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700 mr-3">EZ Zuschlag:</span>
                <span className="text-2xl font-black text-orange-600">{formatPrice(calculateCoHotelTotals().totalEZZimmer - (calculateCoHotelTotals().totalPerTraveler / 2))} $</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KAS - Hotels Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'hotels' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">Hotels</h3>
            <button
              onClick={addKasHotelRow}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Hotels</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Tage</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">DBL</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zimmer</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zuschlag</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasHotelPrices.map((hotel) => {
                return (
                  <tr key={hotel.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={hotel.city}
                        onChange={(e) => updateKasHotelPrice(hotel.id, 'city', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none font-semibold"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.days === 0 ? '' : hotel.days}
                        onChange={(e) => updateKasHotelPrice(hotel.id, 'days', e.target.value)}
                        className="w-20 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.pricePerDay === 0 ? '' : hotel.pricePerDay}
                        onChange={(e) => updateKasHotelPrice(hotel.id, 'pricePerDay', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.ezZimmer === 0 ? '' : hotel.ezZimmer}
                        onChange={(e) => updateKasHotelPrice(hotel.id, 'ezZimmer', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => deleteKasHotelRow(hotel.id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-6 py-4 text-gray-900 text-lg">Total</td>
                <td className="px-6 py-4 text-center text-gray-900 text-lg">
                  {calculateKasHotelTotals().totalDays}
                </td>
                <td className="px-6 py-4 text-center text-orange-700 text-lg">
                  {calculateKasHotelTotals().totalPerTraveler.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                <td className="px-6 py-4 text-gray-900 text-lg">Total pro person</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center text-green-700 text-lg">
                  {(calculateKasHotelTotals().totalPerTraveler / 2).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-purple-700 text-lg">
                  {calculateKasHotelTotals().totalEZZimmer.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-orange-700 text-lg">
                  {(calculateKasHotelTotals().totalEZZimmer - (calculateKasHotelTotals().totalPerTraveler / 2)).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* KAS - Transport Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'transport' && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            {paxTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedPaxTier(tier.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                  selectedPaxTier === tier.id
                    ? 'bg-orange-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier.name}
              </button>
            ))}
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyKasTransportFrom4PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              title="4 PAX narxlarini 5, 6-7, 8-9 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 4 PAX
            </button>
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyKasTransportFrom10_11PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md"
              title="10-11 PAX narxlarini 12-13, 14-15, 16 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 10-11 PAX
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white text-center flex-1">Transport Routes - KAS</h3>
              <button
                onClick={addKasTransportRoute}
                className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                  <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Route</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Preise</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kasTransportRoutes.map((route, index) => {
                  const routeTotal = route.days * route.price;
                  return (
                    <tr key={route.id} className="hover:bg-orange-50 transition-colors">
                      <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input type="text" value={route.name} onChange={(e) => updateKasTransportRoute(route.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" value={route.days === 0 ? '' : route.days} onChange={(e) => updateKasTransportRoute(route.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="0" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" value={route.price === 0 ? '' : route.price} onChange={(e) => updateKasTransportRoute(route.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" placeholder="0" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${routeTotal > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{routeTotal}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => deleteKasTransportRoute(route.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-gray-900 text-lg">{calculateKasTransportTotals().totalDays}</td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{calculateKasTransportTotals().grandTotal.toFixed(2)} $</td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
                {/* Anzahl der Reisende Row */}
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Anzahl der Reisende</td>
                  <td className="px-4 py-3 text-center text-gray-900">
                    {paxTiers.find(p => p.id === selectedPaxTier)?.count || 0}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-green-700 text-lg">
                    {calculateKasTransportTotals().pricePerPerson.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* KAS - Railway Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'railway' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Railway Items</h3>
            <button
              onClick={addKasRailwayRoute}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasRailwayRoutes.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasRailwayRoute(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasRailwayRoute(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasRailwayRoute(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasRailwayRoute(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasRailwayRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* KAS - Fly Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'fly' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Fly Items</h3>
            <button
              onClick={addKasFlyRoute}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasFlyRoutes.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasFlyRoute(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasFlyRoute(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasFlyRoute(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasFlyRoute(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasFlyRoutes.reduce((sum, f) => sum + (parseFloat(f.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasFlyRoutes.reduce((sum, f) => sum + ((parseFloat(f.days) || 1) * (parseFloat(f.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-orange-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const flyTotal = kasFlyRoutes.reduce((sum, f) => sum + ((parseFloat(f.days) || 1) * (parseFloat(f.price) || 0)), 0);
                const pricePerPerson = flyTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-orange-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KAS - Meal Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'meal' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Meal Items</h3>
            <button
              onClick={addKasMealItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasMealItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasMealItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasMealItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasMealItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasMealItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasMealItems.reduce((sum, m) => sum + (parseFloat(m.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* KAS - Sightseing Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'sightseing' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Sightseing Items</h3>
            <button
              onClick={addKasSightseingItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasSightseingItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasSightseingItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasSightseingItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasSightseingItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasSightseingItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasSightseingItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* KAS - Guide Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'guide' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Guide Items</h3>
            <button
              onClick={addKasGuideItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasGuideItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasGuideItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasGuideItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasGuideItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasGuideItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasGuideItems.reduce((sum, g) => sum + (parseFloat(g.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-orange-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const guideTotal = kasGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const pricePerPerson = guideTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-orange-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KAS - Shou Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'shou' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Shou Items</h3>
            <button
              onClick={addKasShouItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kasShouItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateKasShouItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateKasShouItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateKasShouItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteKasShouItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-orange-50 to-orange-100 font-bold border-t-2 border-orange-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{kasShouItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-orange-600 text-xl font-bold">{kasShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* KAS - Total Tab */}
      {selectedTourType === 'kas' && selectedKASSubTab === 'zusatzkosten' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-pink-100 overflow-hidden">
          <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Zusatzkosten (Additional Costs) - KAS</h3>
            <button
              onClick={() => {
                const newItem = { id: Date.now(), name: 'New Cost', price: 0, pax: 1, currency: 'USD' };
                setKasZusatzkostenItems([...kasZusatzkostenItems, newItem]);
              }}
              className="bg-white text-pink-600 px-4 py-2 rounded-lg font-semibold hover:bg-pink-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-pink-100 to-rose-100">
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">№</th>
                  <th className="border border-pink-300 px-4 py-3 text-left font-bold text-gray-800">Name</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">PAX</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Price</th>
                  <th className="border border-pink-300 px-4 py-3 text-right font-bold text-gray-800">Total</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Currency</th>
                  <th className="border border-pink-300 px-4 py-3 text-center font-bold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {kasZusatzkostenItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="border border-pink-300 px-4 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No additional costs added yet</p>
                    </td>
                  </tr>
                ) : (
                  kasZusatzkostenItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-pink-50 transition-colors">
                      <td className="border border-pink-300 px-4 py-3 text-center font-semibold">{index + 1}</td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input type="text" value={item.name} onChange={(e) => setKasZusatzkostenItems(kasZusatzkostenItems.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))} className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300" />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input type="number" value={item.pax || 1} onChange={(e) => setKasZusatzkostenItems(kasZusatzkostenItems.map(i => i.id === item.id ? { ...i, pax: parseInt(e.target.value) || 1 } : i))} className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-center font-semibold" min="1" />
                      </td>
                      <td className="border border-pink-300 px-4 py-3">
                        <input type="number" value={item.price} onChange={(e) => setKasZusatzkostenItems(kasZusatzkostenItems.map(i => i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i))} className="w-full px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 text-right font-semibold" />
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-right font-bold text-lg text-gray-900">{((item.price || 0) * (item.pax || 1)).toFixed(2)}</td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <select value={item.currency} onChange={(e) => setKasZusatzkostenItems(kasZusatzkostenItems.map(i => i.id === item.id ? { ...i, currency: e.target.value } : i))} className="px-2 py-1 border border-pink-200 rounded focus:outline-none focus:ring-2 focus:ring-pink-300 font-semibold">
                          <option value="USD">USD</option>
                          <option value="UZS">UZS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </td>
                      <td className="border border-pink-300 px-4 py-3 text-center">
                        <button onClick={() => { setKasZusatzkostenItems(kasZusatzkostenItems.filter(i => i.id !== item.id)); toast.success('Item deleted'); }} className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {kasZusatzkostenItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                    <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">Total USD:</td>
                    <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">{kasZusatzkostenItems.filter(i => i.currency === 'USD').reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0).toFixed(2)}</td>
                    <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">USD</td>
                    <td className="border border-pink-300"></td>
                  </tr>
                  {kasZusatzkostenItems.some(i => i.currency === 'UZS') && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <td colSpan="4" className="border border-pink-300 px-4 py-4 font-bold text-gray-900 text-lg">Total UZS:</td>
                      <td className="border border-pink-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">{kasZusatzkostenItems.filter(i => i.currency === 'UZS').reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0).toLocaleString()}</td>
                      <td className="border border-pink-300 px-4 py-4 text-center font-bold text-lg">UZS</td>
                      <td className="border border-pink-300"></td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
          <div className="p-4 bg-pink-50 border-t border-pink-200">
            <button onClick={saveKasZusatzkosten} className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:from-pink-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              Save Zusatzkosten
            </button>
          </div>
        </div>
      )}

      {selectedTourType === 'kas' && selectedKASSubTab === 'total' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Total Price Summary - All Categories</h3>
          </div>
          <div className="overflow-x-auto">{(() => {
              // Clear previous calculations
              calculatedTotalPrices.current = {};

              const hotelTotal = calculateKasHotelTotals().totalPerTraveler / 2;
              const transportTotals = paxTiers.map(tier => calculateKasTransportTotals().grandTotal / tier.count);
              const railwayTotal = kasRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const flyTotal = kasFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const mealTotal = kasMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
              const sightseingTotal = kasSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
              const guideTotal = kasGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
              const shouTotal = kasShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);

              return (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 to-orange-600">
                  <th className="border border-orange-600 px-4 py-3 text-left font-bold text-white">Category</th>
                  {paxTiers.map(tier => (
                    <th key={tier.id} className="border border-orange-600 px-4 py-3 text-center font-bold text-white">{tier.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Hotels</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(hotelTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Transport</td>
                  {transportTotals.map((total, idx) => (
                    <td key={idx} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(total)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Railway</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(railwayTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Fly</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(flyTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Meal</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(mealTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Sightseing</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(sightseingTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Guide</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(guideTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-orange-50 hover:bg-orange-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Shou</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-orange-600 font-bold">
                      {formatPrice(shouTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-100 border-t-2 border-gray-400">
                  <td className="border border-gray-400 px-4 py-3 font-bold text-base text-gray-900">Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateKasTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-4 py-3 text-center font-bold text-lg text-gray-900">
                        {formatPrice(price)} $
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 px-4 py-3 font-semibold text-base text-gray-700">commission (%)</td>
                  {paxTiers.map(tier => {
                    const commission = kasCommissionValues[tier.id] || 0;
                    const transportPPP = calculateKasTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionAmount = (price * commission) / 100;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-2 py-2 text-center">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={commission === 0 ? '' : commission}
                          onChange={(e) => updateKasCommissionValue(tier.id, e.target.value)}
                          onBlur={saveKasCommissionValues}
                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold text-base"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {commissionAmount > 0 && `+${formatPrice(commissionAmount)} $`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gradient-to-r from-green-400 to-emerald-400 border-t-4 border-green-600">
                  <td className="border border-green-600 px-4 py-4 font-black text-lg text-gray-900">Total Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateKasTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionPercent = kasCommissionValues[tier.id] || 0;
                    const commissionAmount = (price * commissionPercent) / 100;
                    const totalPrice = price + commissionAmount;

                    // Store calculated values for saving later
                    calculatedTotalPrices.current[tier.id] = {
                      totalPrice: Math.round(totalPrice),
                      ezZuschlag: 140  // KAS EZ Zuschlag is 140$ (from screenshot)
                    };

                    return (
                      <td key={tier.id} className="border border-green-600 px-4 py-4 text-center font-black text-xl text-gray-900">
                        {formatPrice(totalPrice)} $
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
              );
            })()}
            <div className="px-6 py-4 bg-orange-50 border-t-2 border-orange-200">
              <div className="flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700 mr-3">EZ Zuschlag:</span>
                <span className="text-2xl font-black text-orange-600">{formatPrice(calculateKasHotelTotals().totalEZZimmer - (calculateKasHotelTotals().totalPerTraveler / 2))} $</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ZA - Hotels Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'hotels' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">Hotels</h3>
            <button
              onClick={addZaHotelRow}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Hotels</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Tage</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">DBL</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zimmer</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">EZ Zuschlag</th>
                <th className="px-6 py-4 text-center text-sm font-bold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaHotelPrices.map((hotel) => {
                return (
                  <tr key={hotel.id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={hotel.city}
                        onChange={(e) => updateZaHotelPrice(hotel.id, 'city', e.target.value)}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none font-semibold"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.days === 0 ? '' : hotel.days}
                        onChange={(e) => updateZaHotelPrice(hotel.id, 'days', e.target.value)}
                        className="w-20 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.pricePerDay === 0 ? '' : hotel.pricePerDay}
                        onChange={(e) => updateZaHotelPrice(hotel.id, 'pricePerDay', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <input
                        type="number"
                        value={hotel.ezZimmer === 0 ? '' : hotel.ezZimmer}
                        onChange={(e) => updateZaHotelPrice(hotel.id, 'ezZimmer', e.target.value)}
                        className="w-24 px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className="text-gray-400">-</span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => deleteZaHotelRow(hotel.id)}
                        className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-6 py-4 text-gray-900 text-lg">Total</td>
                <td className="px-6 py-4 text-center text-gray-900 text-lg">
                  {calculateZaHotelTotals().totalDays}
                </td>
                <td className="px-6 py-4 text-center text-purple-700 text-lg">
                  {calculateZaHotelTotals().totalPerTraveler.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
              <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                <td className="px-6 py-4 text-gray-900 text-lg">Total pro person</td>
                <td className="px-6 py-4 text-center">-</td>
                <td className="px-6 py-4 text-center text-green-700 text-lg">
                  {(calculateZaHotelTotals().totalPerTraveler / 2).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-purple-700 text-lg">
                  {calculateZaHotelTotals().totalEZZimmer.toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center text-orange-700 text-lg">
                  {(calculateZaHotelTotals().totalEZZimmer - (calculateZaHotelTotals().totalPerTraveler / 2)).toFixed(2)} $
                </td>
                <td className="px-6 py-4 text-center">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ZA - Transport Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'transport' && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            {paxTiers.map((tier) => (
              <button
                key={tier.id}
                onClick={() => setSelectedPaxTier(tier.id)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                  selectedPaxTier === tier.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tier.name}
              </button>
            ))}
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyZaTransportFrom4PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold text-sm hover:from-purple-700 hover:to-indigo-700 transition-all duration-300 shadow-md"
              title="4 PAX narxlarini 5, 6-7, 8-9 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 4 PAX
            </button>
            <div className="h-8 w-px bg-gray-300 mx-2"></div>
            <button
              onClick={copyZaTransportFrom10_11PaxToOthers}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-md"
              title="10-11 PAX narxlarini 12-13, 14-15, 16 PAX larga nusxalash"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy 10-11 PAX
            </button>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white text-center flex-1">Transport Routes - ZA</h3>
              <button
                onClick={addZaTransportRoute}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                  <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                  <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Route</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Preise</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Total</th>
                  <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {zaTransportRoutes.map((route, index) => {
                  const routeTotal = route.days * route.price;
                  return (
                    <tr key={route.id} className="hover:bg-purple-50 transition-colors">
                      <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input type="text" value={route.name} onChange={(e) => updateZaTransportRoute(route.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" value={route.days === 0 ? '' : route.days} onChange={(e) => updateZaTransportRoute(route.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" placeholder="0" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" value={route.price === 0 ? '' : route.price} onChange={(e) => updateZaTransportRoute(route.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" placeholder="0" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold ${routeTotal > 0 ? 'text-purple-600' : 'text-gray-400'}`}>{routeTotal}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => deleteZaTransportRoute(route.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-center text-gray-900 text-lg">{calculateZaTransportTotals().totalDays}</td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{calculateZaTransportTotals().grandTotal.toFixed(2)} $</td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
                {/* Anzahl der Reisende Row */}
                <tr className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                  <td className="px-3 py-3 text-center"></td>
                  <td className="px-4 py-3 text-gray-900">Anzahl der Reisende</td>
                  <td className="px-4 py-3 text-center text-gray-900">
                    {paxTiers.find(p => p.id === selectedPaxTier)?.count || 0}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                  <td className="px-4 py-3 text-center text-green-700 text-lg">
                    {calculateZaTransportTotals().pricePerPerson.toFixed(0)}
                  </td>
                  <td className="px-4 py-3 text-center"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ZA - Railway Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'railway' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Railway Items</h3>
            <button
              onClick={addZaRailwayRoute}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaRailwayRoutes.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaRailwayRoute(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaRailwayRoute(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaRailwayRoute(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaRailwayRoute(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaRailwayRoutes.reduce((sum, r) => sum + (parseFloat(r.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ZA - Fly Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'fly' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Fly Items</h3>
            <button
              onClick={addZaFlyRoute}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaFlyRoutes.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaFlyRoute(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaFlyRoute(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaFlyRoute(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaFlyRoute(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaFlyRoutes.reduce((sum, f) => sum + (parseFloat(f.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaFlyRoutes.reduce((sum, f) => sum + ((parseFloat(f.days) || 1) * (parseFloat(f.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-purple-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const flyTotal = zaFlyRoutes.reduce((sum, f) => sum + ((parseFloat(f.days) || 1) * (parseFloat(f.price) || 0)), 0);
                const pricePerPerson = flyTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-purple-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ZA - Meal Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'meal' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Meal Items</h3>
            <button
              onClick={addZaMealItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaMealItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaMealItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaMealItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaMealItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaMealItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaMealItems.reduce((sum, m) => sum + (parseFloat(m.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ZA - Sightseing Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'sightseing' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Sightseing Items</h3>
            <button
              onClick={addZaSightseingItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaSightseingItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaSightseingItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaSightseingItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaSightseingItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaSightseingItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaSightseingItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ZA - Guide Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'guide' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Guide Items</h3>
            <button
              onClick={addZaGuideItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaGuideItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaGuideItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaGuideItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaGuideItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaGuideItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaGuideItems.reduce((sum, g) => sum + (parseFloat(g.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
          <div className="px-6 py-4 bg-purple-50">
            <h4 className="font-bold text-gray-800 mb-3">PAX Breakdown</h4>
            <div className="grid grid-cols-4 gap-3">
              {paxTiers.map(tier => {
                const guideTotal = zaGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const pricePerPerson = guideTotal / tier.count;
                return (
                  <div key={tier.id} className="bg-white rounded-lg p-3 border-2 border-gray-200 shadow-sm">
                    <div className="text-sm font-semibold text-gray-600 mb-1">{tier.name}</div>
                    <div className="text-lg font-bold text-purple-600">{formatPrice(pricePerPerson)} $</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ZA - Shou Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'shou' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white text-center flex-1">Shou Items</h3>
            <button
              onClick={addZaShouItem}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 border-b-2 border-purple-200">
                <th className="px-3 py-3 text-center text-sm font-bold text-gray-900 w-16">№</th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900">Item</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Tage</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-32">Price ($)</th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zaShouItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                  <td className="px-3 py-3 text-center text-gray-700 font-medium">{index + 1}</td>
                  <td className="px-4 py-3">
                    <input type="text" value={item.name} onChange={(e) => updateZaShouItem(item.id, 'name', e.target.value)} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.days} onChange={(e) => updateZaShouItem(item.id, 'days', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input type="number" value={item.price} onChange={(e) => updateZaShouItem(item.id, 'price', e.target.value)} className="w-full px-2 py-1 text-center border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteZaShouItem(item.id)} className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="bg-gradient-to-r from-purple-50 to-purple-100 font-bold border-t-2 border-purple-300">
                <td className="px-3 py-3 text-center"></td>
                <td className="px-4 py-3 text-gray-900">Total</td>
                <td className="px-4 py-3 text-center text-gray-900 text-lg">{zaShouItems.reduce((sum, s) => sum + (parseFloat(s.days) || 1), 0)}</td>
                <td className="px-4 py-3 text-center text-purple-600 text-xl font-bold">{zaShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0).toFixed(2)} $</td>
                <td className="px-4 py-3 text-center"></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ZA - Total Tab */}
      {selectedTourType === 'za' && selectedZASubTab === 'zusatzkosten' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-purple-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-3 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Zusatzkosten (Additional Costs) - ZA</h3>
            <button
              onClick={() => {
                const newItem = { id: Date.now(), name: 'New Cost', price: 0, pax: 1, currency: 'USD' };
                setZaZusatzkostenItems([...zaZusatzkostenItems, newItem]);
              }}
              className="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-50 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Cost
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-100 to-violet-100">
                  <th className="border border-purple-300 px-4 py-3 text-left font-bold text-gray-800">№</th>
                  <th className="border border-purple-300 px-4 py-3 text-left font-bold text-gray-800">Name</th>
                  <th className="border border-purple-300 px-4 py-3 text-center font-bold text-gray-800">PAX</th>
                  <th className="border border-purple-300 px-4 py-3 text-right font-bold text-gray-800">Price</th>
                  <th className="border border-purple-300 px-4 py-3 text-right font-bold text-gray-800">Total</th>
                  <th className="border border-purple-300 px-4 py-3 text-center font-bold text-gray-800">Currency</th>
                  <th className="border border-purple-300 px-4 py-3 text-center font-bold text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {zaZusatzkostenItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="border border-purple-300 px-4 py-12 text-center text-gray-500">
                      <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No additional costs added yet</p>
                    </td>
                  </tr>
                ) : (
                  zaZusatzkostenItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-purple-50 transition-colors">
                      <td className="border border-purple-300 px-4 py-3 text-center font-semibold">{index + 1}</td>
                      <td className="border border-purple-300 px-4 py-3">
                        <input type="text" value={item.name} onChange={(e) => setZaZusatzkostenItems(zaZusatzkostenItems.map(i => i.id === item.id ? { ...i, name: e.target.value } : i))} className="w-full px-2 py-1 border border-purple-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-300" />
                      </td>
                      <td className="border border-purple-300 px-4 py-3">
                        <input type="number" value={item.pax || 1} onChange={(e) => setZaZusatzkostenItems(zaZusatzkostenItems.map(i => i.id === item.id ? { ...i, pax: parseInt(e.target.value) || 1 } : i))} className="w-full px-2 py-1 border border-purple-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-300 text-center font-semibold" min="1" />
                      </td>
                      <td className="border border-purple-300 px-4 py-3">
                        <input type="number" value={item.price} onChange={(e) => setZaZusatzkostenItems(zaZusatzkostenItems.map(i => i.id === item.id ? { ...i, price: parseFloat(e.target.value) || 0 } : i))} className="w-full px-2 py-1 border border-purple-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-300 text-right font-semibold" />
                      </td>
                      <td className="border border-purple-300 px-4 py-3 text-right font-bold text-lg text-gray-900">{((item.price || 0) * (item.pax || 1)).toFixed(2)}</td>
                      <td className="border border-purple-300 px-4 py-3 text-center">
                        <select value={item.currency} onChange={(e) => setZaZusatzkostenItems(zaZusatzkostenItems.map(i => i.id === item.id ? { ...i, currency: e.target.value } : i))} className="px-2 py-1 border border-purple-200 rounded focus:outline-none focus:ring-2 focus:ring-purple-300 font-semibold">
                          <option value="USD">USD</option>
                          <option value="UZS">UZS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </td>
                      <td className="border border-purple-300 px-4 py-3 text-center">
                        <button onClick={() => { setZaZusatzkostenItems(zaZusatzkostenItems.filter(i => i.id !== item.id)); toast.success('Item deleted'); }} className="text-red-600 hover:text-white hover:bg-red-600 p-2 rounded-lg transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {zaZusatzkostenItems.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                    <td colSpan="4" className="border border-purple-300 px-4 py-4 font-bold text-gray-900 text-lg">Total USD:</td>
                    <td className="border border-purple-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">{zaZusatzkostenItems.filter(i => i.currency === 'USD').reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0).toFixed(2)}</td>
                    <td className="border border-purple-300 px-4 py-4 text-center font-bold text-lg">USD</td>
                    <td className="border border-purple-300"></td>
                  </tr>
                  {zaZusatzkostenItems.some(i => i.currency === 'UZS') && (
                    <tr className="bg-gradient-to-r from-emerald-100 to-green-100">
                      <td colSpan="4" className="border border-purple-300 px-4 py-4 font-bold text-gray-900 text-lg">Total UZS:</td>
                      <td className="border border-purple-300 px-4 py-4 text-right font-bold text-emerald-700 text-xl">{zaZusatzkostenItems.filter(i => i.currency === 'UZS').reduce((sum, i) => sum + ((i.price || 0) * (i.pax || 1)), 0).toLocaleString()}</td>
                      <td className="border border-purple-300 px-4 py-4 text-center font-bold text-lg">UZS</td>
                      <td className="border border-purple-300"></td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
          <div className="p-4 bg-purple-50 border-t border-purple-200">
            <button onClick={saveZaZusatzkosten} className="w-full bg-gradient-to-r from-purple-600 to-violet-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-violet-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              Save Zusatzkosten
            </button>
          </div>
        </div>
      )}

      {selectedTourType === 'za' && selectedZASubTab === 'total' && (
        <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-3">
            <h3 className="text-xl font-bold text-white text-center">Total Price Summary - All Categories</h3>
          </div>
          <div className="overflow-x-auto">{(() => {
              // Clear previous calculations
              calculatedTotalPrices.current = {};

              const hotelTotal = calculateZaHotelTotals().totalPerTraveler / 2;
              const transportTotals = paxTiers.map(tier => calculateZaTransportTotals().grandTotal / tier.count);
              const railwayTotal = zaRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const flyTotal = zaFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
              const mealTotal = zaMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
              const sightseingTotal = zaSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
              const guideTotal = zaGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
              const shouTotal = zaShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);

              return (
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 to-purple-600">
                  <th className="border border-purple-600 px-4 py-3 text-left font-bold text-white">Category</th>
                  {paxTiers.map(tier => (
                    <th key={tier.id} className="border border-purple-600 px-4 py-3 text-center font-bold text-white">{tier.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Hotels</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(hotelTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Transport</td>
                  {transportTotals.map((total, idx) => (
                    <td key={idx} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(total)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Railway</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(railwayTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Fly</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(flyTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Meal</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(mealTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Sightseing</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(sightseingTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Guide</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(guideTotal / tier.count)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-purple-50 hover:bg-purple-100 transition-colors">
                  <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">Shou</td>
                  {paxTiers.map(tier => (
                    <td key={tier.id} className="border border-gray-300 px-4 py-3 text-center text-purple-600 font-bold">
                      {formatPrice(shouTotal)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-100 border-t-2 border-gray-400">
                  <td className="border border-gray-400 px-4 py-3 font-bold text-base text-gray-900">Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateZaTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-4 py-3 text-center font-bold text-lg text-gray-900">
                        {formatPrice(price)} $
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-400 px-4 py-3 font-semibold text-base text-gray-700">commission (%)</td>
                  {paxTiers.map(tier => {
                    const commission = zaCommissionValues[tier.id] || 0;
                    const transportPPP = calculateZaTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionAmount = (price * commission) / 100;
                    return (
                      <td key={tier.id} className="border border-gray-400 px-2 py-2 text-center">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="0"
                          value={commission === 0 ? '' : commission}
                          onChange={(e) => updateZaCommissionValue(tier.id, e.target.value)}
                          onBlur={saveZaCommissionValues}
                          className="w-full px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-base"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {commissionAmount > 0 && `+${formatPrice(commissionAmount)} $`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-gradient-to-r from-green-400 to-emerald-400 border-t-4 border-green-600">
                  <td className="border border-green-600 px-4 py-4 font-black text-lg text-gray-900">Total Price</td>
                  {paxTiers.map(tier => {
                    const transportPPP = calculateZaTransportTotals().grandTotal / tier.count;
                    const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                  mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                    const commissionPercent = zaCommissionValues[tier.id] || 0;
                    const commissionAmount = (price * commissionPercent) / 100;
                    const totalPrice = price + commissionAmount;

                    // Store calculated values for saving later
                    calculatedTotalPrices.current[tier.id] = {
                      totalPrice: Math.round(totalPrice),
                      ezZuschlag: 125  // ZA EZ Zuschlag is 125$ (from screenshot)
                    };

                    return (
                      <td key={tier.id} className="border border-green-600 px-4 py-4 text-center font-black text-xl text-gray-900">
                        {formatPrice(totalPrice)} $
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
              );
            })()}
            <div className="px-6 py-4 bg-orange-50 border-t-2 border-orange-200">
              <div className="flex items-center justify-center">
                <span className="text-lg font-bold text-gray-700 mr-3">EZ Zuschlag:</span>
                <span className="text-2xl font-black text-orange-600">{formatPrice(calculateZaHotelTotals().totalEZZimmer - (calculateZaHotelTotals().totalPerTraveler / 2))} $</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preis 2026 - Summary of All Modules */}
      {selectedTourType === 'preis2026' && (
        <div className="space-y-6">
          {/* PDF Export Button */}
          <div className="flex justify-end">
            <button
              onClick={exportPreis2026ToPDF}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 font-bold"
            >
              <Download size={20} />
              <span>PDF yuklash</span>
            </button>
          </div>

          {/* CO (Comfort Plus) Summary */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden hover:shadow-3xl transition-shadow duration-300">
            <div className="bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 px-8 py-5">
              <h3 className="text-3xl font-bold text-white text-center drop-shadow-lg">Preis für die Comfort Plus</h3>
            </div>
            <div className="overflow-x-auto">
              {(() => {
                const hotelTotal = calculateCoHotelTotals().totalPerTraveler / 2;
                const railwayTotal = coRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const flyTotal = coFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const mealTotal = coMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
                const sightseingTotal = coSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const guideTotal = coGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const shouTotal = coShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const ezZuschlag = calculateCoHotelTotals().totalEZZimmer - (calculateCoHotelTotals().totalPerTraveler / 2);

                return (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-emerald-300 via-green-300 to-teal-300">
                        {paxTiers.map(tier => (
                          <th key={tier.id} className="border border-emerald-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">
                            {tier.name}
                          </th>
                        ))}
                        <th className="border border-emerald-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">EZ Zuschlag</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 transition-colors duration-200">
                        {paxTiers.map(tier => {
                          const transportPPP = calculateCoTransportTotals().grandTotal / tier.count;
                          const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                        mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                          const commissionPercent = coCommissionValues[tier.id] || 0;
                          const commissionAmount = (price * commissionPercent) / 100;
                          const totalPrice = price + commissionAmount;

                          return (
                            <td key={tier.id} className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-emerald-700 shadow-sm">
                              {Math.round(totalPrice)}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-orange-600 shadow-sm">
                          $ {Math.round(ezZuschlag)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* ER (Erlebnissreisen) Summary */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden hover:shadow-3xl transition-shadow duration-300">
            <div className="bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 px-8 py-5">
              <h3 className="text-3xl font-bold text-white text-center drop-shadow-lg">Preis für die Erlebnissreisen</h3>
            </div>
            <div className="overflow-x-auto">
              {(() => {
                const hotelTotal = calculateHotelTotals().totalPerTraveler / 2;
                const railwayTotal = railwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const flyTotal = flyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const mealTotal = mealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
                const sightseingTotal = sightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const guideTotal = guideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const shouTotal = shouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const ezZuschlag = calculateHotelTotals().totalEZZimmer - (calculateHotelTotals().totalPerTraveler / 2);

                return (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-sky-300 via-blue-300 to-indigo-300">
                        {paxTiers.map(tier => (
                          <th key={tier.id} className="border border-sky-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">
                            {tier.name}
                          </th>
                        ))}
                        <th className="border border-sky-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">EZ Zuschlag</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 transition-colors duration-200">
                        {paxTiers.map(tier => {
                          const transportPPP = calculateTransportTotals().grandTotal / tier.count;
                          const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                        mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                          const commissionPercent = commissionValues[tier.id] || 0;
                          const commissionAmount = (price * commissionPercent) / 100;
                          const totalPrice = price + commissionAmount;

                          return (
                            <td key={tier.id} className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-blue-700 shadow-sm">
                              {Math.round(totalPrice)}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-orange-600 shadow-sm">
                          {Math.round(ezZuschlag)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* ZA (Zentralasienreisen) Summary */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden hover:shadow-3xl transition-shadow duration-300">
            <div className="bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 px-8 py-5">
              <h3 className="text-3xl font-bold text-white text-center drop-shadow-lg">Preis für die Zentralasienreisen</h3>
            </div>
            <div className="overflow-x-auto">
              {(() => {
                const hotelTotal = calculateZaHotelTotals().totalPerTraveler / 2;
                const railwayTotal = zaRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const flyTotal = zaFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const mealTotal = zaMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
                const sightseingTotal = zaSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const guideTotal = zaGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const shouTotal = zaShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const ezZuschlag = calculateZaHotelTotals().totalEZZimmer - (calculateZaHotelTotals().totalPerTraveler / 2);

                return (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-purple-300 via-violet-300 to-fuchsia-300">
                        {paxTiers.map(tier => (
                          <th key={tier.id} className="border border-purple-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">
                            {tier.name}
                          </th>
                        ))}
                        <th className="border border-purple-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">EZ Zuschlag</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 transition-colors duration-200">
                        {paxTiers.map(tier => {
                          const transportPPP = calculateZaTransportTotals().grandTotal / tier.count;
                          const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                        mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                          const commissionPercent = zaCommissionValues[tier.id] || 0;
                          const commissionAmount = (price * commissionPercent) / 100;
                          const totalPrice = price + commissionAmount;

                          return (
                            <td key={tier.id} className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-purple-700 shadow-sm">
                              {Math.round(totalPrice)}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-purple-700 shadow-sm">
                          $ {Math.round(ezZuschlag)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          {/* KAS (Kasakistan Kirgistan und Usbekistan) Summary */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden hover:shadow-3xl transition-shadow duration-300">
            <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 px-8 py-5">
              <h3 className="text-3xl font-bold text-white text-center drop-shadow-lg">Preis für Kasakistan Kirgistan und Usbekistan Erlebnissreisen</h3>
            </div>
            <div className="overflow-x-auto">
              {(() => {
                const hotelTotal = calculateKasHotelTotals().totalPerTraveler / 2;
                const railwayTotal = kasRailwayRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const flyTotal = kasFlyRoutes.reduce((sum, r) => sum + ((parseFloat(r.days) || 1) * (parseFloat(r.price) || 0)), 0);
                const mealTotal = kasMealItems.reduce((sum, m) => sum + ((parseFloat(m.days) || 1) * (parseFloat(m.price) || 0)), 0);
                const sightseingTotal = kasSightseingItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const guideTotal = kasGuideItems.reduce((sum, g) => sum + ((parseFloat(g.days) || 1) * (parseFloat(g.price) || 0)), 0);
                const shouTotal = kasShouItems.reduce((sum, s) => sum + ((parseFloat(s.days) || 1) * (parseFloat(s.price) || 0)), 0);
                const ezZuschlag = calculateKasHotelTotals().totalEZZimmer - (calculateKasHotelTotals().totalPerTraveler / 2);

                return (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-300">
                        {paxTiers.map(tier => (
                          <th key={tier.id} className="border border-orange-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">
                            {tier.name}
                          </th>
                        ))}
                        <th className="border border-orange-400 px-6 py-4 text-center font-bold text-gray-800 text-base shadow-sm">EZ Zuschlag</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 transition-colors duration-200">
                        {paxTiers.map(tier => {
                          const transportPPP = calculateKasTransportTotals().grandTotal / tier.count;
                          const price = hotelTotal + transportPPP + railwayTotal + (flyTotal / tier.count) +
                                        mealTotal + sightseingTotal + (guideTotal / tier.count) + shouTotal;
                          const commissionPercent = kasCommissionValues[tier.id] || 0;
                          const commissionAmount = (price * commissionPercent) / 100;
                          const totalPrice = price + commissionAmount;

                          return (
                            <td key={tier.id} className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-orange-700 shadow-sm">
                              {Math.round(totalPrice)}
                            </td>
                          );
                        })}
                        <td className="border border-gray-300 px-6 py-5 text-center font-extrabold text-3xl text-orange-700 shadow-sm">
                          {Math.round(ezZuschlag)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
