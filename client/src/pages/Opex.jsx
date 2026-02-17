import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Plus, Edit, Trash2, Search, Bus, Eye, Coffee, Drama, Navigation, Users, Car, Train, Plane, MapPin, Save } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { transportApi, opexApi } from '../services/api';

const categories = [
  { id: 'transport', name: 'Transport', icon: Bus, color: 'blue', hasSubTabs: true },
  { id: 'sightseeing', name: 'Sightseeing', icon: Eye, color: 'purple', hasSubTabs: true },
  { id: 'meal', name: 'Meal', icon: Coffee, color: 'orange', hasSubTabs: true },
  { id: 'shows', name: 'Shows', icon: Drama, color: 'indigo', hasSubTabs: true },
];

const transportSubTabs = [
  { id: 'sevil-er', name: 'Sevil ER', icon: Car, color: 'blue' },
  { id: 'sevil-co', name: 'Sevil CO', icon: Car, color: 'emerald' },
  { id: 'sevil-kas', name: 'Sevil KAS', icon: Car, color: 'orange' },
  { id: 'sevil-za', name: 'Sevil ZA', icon: Car, color: 'purple' },
  { id: 'xayrulla', name: 'Xayrulla', icon: Car, color: 'cyan' },
  { id: 'nosir', name: 'Nosir', icon: Car, color: 'teal' },
  { id: 'train', name: 'Train', icon: Train, color: 'violet' },
  { id: 'plane', name: 'Plane', icon: Plane, color: 'sky' },
  { id: 'metro', name: 'Metro', icon: Navigation, color: 'emerald' },
];

const sightseeingSubTabs = [
  { id: 'er', name: 'ER', icon: MapPin, color: 'blue' },
  { id: 'co', name: 'CO', icon: MapPin, color: 'emerald' },
  { id: 'kas', name: 'KAS', icon: MapPin, color: 'orange' },
  { id: 'za', name: 'ZA', icon: MapPin, color: 'purple' },
];

const mealSubTabs = [
  { id: 'er', name: 'ER', icon: Coffee, color: 'blue' },
  { id: 'co', name: 'CO', icon: Coffee, color: 'emerald' },
  { id: 'kas', name: 'KAS', icon: Coffee, color: 'orange' },
  { id: 'za', name: 'ZA', icon: Coffee, color: 'purple' },
];

const showsSubTabs = [
  { id: 'er', name: 'ER', icon: Drama, color: 'blue' },
  { id: 'co', name: 'CO', icon: Drama, color: 'emerald' },
  { id: 'kas', name: 'KAS', icon: Drama, color: 'orange' },
  { id: 'za', name: 'ZA', icon: Drama, color: 'purple' },
];

// Default vehicle data for initial seeding
const defaultSevilVehicles = [
  { id: 1, name: 'Starex', seats: '7', person: '1-4', pickupDropoff: '', tagRate: 30, urgenchRate: 80, shovotRate2: '' },
  { id: 2, name: 'Joylong', seats: '30', person: '5-8', pickupDropoff: '', tagRate: 50, urgenchRate: 110, shovotRate2: 60 },
  { id: 3, name: 'Yutong 33', seats: '45', person: '9-20', pickupDropoff: '', tagRate: 50, urgenchRate: 160, shovotRate2: 120 },
];

const defaultXayrullaVehicles = [
  { id: 1, name: 'Starex', seats: '7', person: '1-4', vstrecha: '', chimgan: 100, tag: '', oybek: '', chernyayevka: '', cityTour: 80 },
  { id: 2, name: 'Joylong', seats: '30', person: '5-8', vstrecha: '', chimgan: 120, tag: 90, oybek: 100, chernyayevka: 110, cityTour: 100 },
  { id: 3, name: 'Sprinter', seats: '20', person: '9-16', vstrecha: '', chimgan: 150, tag: 100, oybek: 120, chernyayevka: 130, cityTour: 120 },
  { id: 4, name: 'Yutong 33', seats: '45', person: '17-30', vstrecha: '', chimgan: 220, tag: 130, oybek: 150, chernyayevka: 160, cityTour: 150 },
];

const defaultNosirVehicles = [
  { id: 1, name: 'PKW', seats: '4', person: '1-2', margilan: '', qoqon: 20, dostlik: 60, toshkent: 170, extra: 60 },
  { id: 2, name: 'Starex', seats: '7', person: '3-4', margilan: 30, qoqon: 100, dostlik: 100, toshkent: 120, extra: '' },
  { id: 3, name: 'Joylong', seats: '30', person: '5-8', margilan: 80, qoqon: 180, dostlik: 180, toshkent: 200, extra: '' },
  { id: 4, name: 'Yutong 33', seats: '45', person: '9-20', margilan: 100, qoqon: 220, dostlik: 220, toshkent: '', extra: '' },
];

const defaultMetroVehicles = [
  { id: 1, name: 'Tashkent Metro Line 1', economPrice: '1 400' },
  { id: 2, name: 'Tashkent Metro Line 2', economPrice: '1 400' },
  { id: 3, name: 'Tashkent Metro Line 3', economPrice: '1 400' },
];

const defaultTrainVehicles = [
  { id: 1, name: 'Afrosiyob764Ф (CKPCT) Tashkent Central → Karshi', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', vipPrice: '600 000', departure: '6:33', arrival: '8:46' },
  { id: 2, name: 'Afrosiyob766Ф (CKPCT) Tashkent Central → Bukhara', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', vipPrice: '600 000', departure: '7:30', arrival: '9:49' },
  { id: 3, name: 'Afrosiyob768Ф (CKPCT) Tashkent Central → Samarkand', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', vipPrice: '600 000', departure: '8:00', arrival: '10:25' },
];

const defaultPlaneVehicles = [
  { id: 1, name: 'Uzbekistan Airways HY-101', route: 'Tashkent - Samarkand', economPrice: '450 000', businessPrice: '850 000', vipPrice: '1 200 000', departure: '7:00', arrival: '8:15' },
  { id: 2, name: 'Uzbekistan Airways HY-102', route: 'Tashkent - Bukhara', economPrice: '480 000', businessPrice: '900 000', vipPrice: '1 200 000', departure: '9:30', arrival: '10:50' },
];

export default function Opex() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get state from URL or use defaults
  const activeCategory = searchParams.get('category') || 'transport';
  const activeTransportTab = searchParams.get('transport') || 'sevil-er';
  const activeSightseeingTab = searchParams.get('sightseeing') || 'er';
  const activeMealTab = searchParams.get('meal') || 'er';
  const activeShowsTab = searchParams.get('shows') || 'er';

  // Function to update URL params
  const updateParams = (updates) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      newParams.set(key, value);
    });
    setSearchParams(newParams);
  };
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Vehicle data from API
  const [sevilVehicles, setSevilVehicles] = useState([]); // Legacy - kept for backward compatibility
  const [sevilErVehicles, setSevilErVehicles] = useState([]);
  const [sevilCoVehicles, setSevilCoVehicles] = useState([]);
  const [sevilKasVehicles, setSevilKasVehicles] = useState([]);
  const [sevilZaVehicles, setSevilZaVehicles] = useState([]);
  const [xayrullaVehicles, setXayrullaVehicles] = useState([]);
  const [nosirVehicles, setNosirVehicles] = useState([]);
  const [metroVehicles, setMetroVehicles] = useState([]);
  const [trainVehicles, setTrainVehicles] = useState([]);
  const [planeVehicles, setPlaneVehicles] = useState([]);

  // Prevent saving on initial mount - only save after data is loaded from database
  const dataLoadedRef = useRef(false);

  // Sightseeing data for each tour type
  const [erSightseeing, setErSightseeing] = useState(() => {
    const saved = localStorage.getItem('erSightseeing');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ER sightseeing from localStorage:', e);
      }
    }
    return [
      // Tashkent
      { id: 1, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
      { id: 2, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '' },
      // Samarkand
      { id: 3, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
      { id: 4, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
      { id: 5, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
      { id: 6, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
      { id: 7, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
      { id: 8, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
      { id: 9, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
      // Nurota
      { id: 10, name: 'Spring', city: 'Nurota', price: '20 000' },
      // Buxoro
      { id: 11, name: 'Samanid Mausoleum', city: 'Bukhara', price: '' },
      { id: 12, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
      { id: 13, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
      { id: 14, name: 'Kalon Mosque', city: 'Bukhara', price: '' },
      { id: 15, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
      // Khiva
      { id: 16, name: 'Itchan Kala', city: 'Khiva', price: '250 000' },
      { id: 17, name: 'Pahlavon Mahmud', city: 'Khiva', price: '30 000' },
    ];
  });
  const [coSightseeing, setCoSightseeing] = useState(() => {
    const saved = localStorage.getItem('coSightseeing');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading CO sightseeing from localStorage:', e);
      }
    }
    return [
      // Qoqon
      { id: 1, name: 'Khudayar Khan Palace', city: 'Kokand', price: '30 000' },
      { id: 2, name: 'Jami Mosque', city: 'Kokand', price: '30 000' },
      // Tashkent
      { id: 3, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
      { id: 4, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '20 000' },
      // Samarkand
      { id: 5, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
      { id: 6, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
      { id: 7, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
      { id: 8, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
      { id: 9, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
      { id: 10, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
      { id: 11, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
      // Buxoro
      { id: 12, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
      { id: 13, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
      { id: 14, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
      { id: 15, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
      { id: 16, name: 'Naqshband mausoleum', city: 'Bukhara', price: '30000' },
      { id: 17, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
      // Khiva
      { id: 18, name: 'Itchan Kala', city: 'Khiva', price: '250 000' },
      { id: 19, name: 'Pahlavon Mahmud', city: 'Khiva', price: '30 000' },
      { id: 20, name: 'Koshay Bobo', city: 'Khiva', price: '150 000' },
    ];
  });
  const [kasSightseeing, setKasSightseeing] = useState(() => {
    const saved = localStorage.getItem('kasSightseeing');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading KAS sightseeing from localStorage:', e);
      }
    }
    return [
      // Qoqon
      { id: 1, name: 'Khudayar Khan Palace', city: 'Kokand', price: '30 000' },
      { id: 2, name: 'Jami Mosque', city: 'Kokand', price: '30 000' },
      // Tashkent
      { id: 3, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
      { id: 4, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '20 000' },
      // Samarkand
      { id: 5, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
      { id: 6, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
      { id: 7, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
      { id: 8, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
      { id: 9, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
      { id: 10, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
      { id: 11, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
      // Buxoro
      { id: 12, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
      { id: 13, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
      { id: 14, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
      { id: 15, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
      { id: 16, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
    ];
  });
  const [zaSightseeing, setZaSightseeing] = useState(() => {
    const saved = localStorage.getItem('zaSightseeing');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ZA sightseeing from localStorage:', e);
      }
    }
    return [
      // Buxoro
      { id: 1, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
      { id: 2, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
      { id: 3, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
      { id: 4, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
      { id: 5, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
      // Samarkand
      { id: 6, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
      { id: 7, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
      { id: 8, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
      { id: 9, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
      { id: 10, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
      { id: 11, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
      { id: 12, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
    ];
  });

  // Meal data for each tour type
  const [erMeal, setErMeal] = useState(() => {
    const saved = localStorage.getItem('erMeal');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ER meal from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
      { id: 2, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
      { id: 3, name: 'Lyabi Hauz Restaurant', city: 'Bukhara', price: '130 000' },
      { id: 4, name: 'Terrassa Restaurant', city: 'Khiva', price: '110 000' },
    ];
  });

  const [coMeal, setCoMeal] = useState(() => {
    const saved = localStorage.getItem('coMeal');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading CO meal from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Silk Road Restaurant', city: 'Kokand', price: '100 000' },
      { id: 2, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
      { id: 3, name: 'Registan Plaza', city: 'Samarkand', price: '140 000' },
      { id: 4, name: 'Old Bukhara', city: 'Bukhara', price: '135 000' },
      { id: 5, name: 'Orient Star', city: 'Khiva', price: '115 000' },
    ];
  });

  const [kasMeal, setKasMeal] = useState(() => {
    const saved = localStorage.getItem('kasMeal');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading KAS meal from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Akhunbabaev Restaurant', city: 'Kokand', price: '95 000' },
      { id: 2, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
      { id: 3, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
      { id: 4, name: 'Lyabi Hauz Restaurant', city: 'Bukhara', price: '130 000' },
    ];
  });

  const [zaMeal, setZaMeal] = useState(() => {
    const saved = localStorage.getItem('zaMeal');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ZA meal from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Old Bukhara', city: 'Bukhara', price: '135 000' },
      { id: 2, name: 'Registan Plaza', city: 'Samarkand', price: '140 000' },
      { id: 3, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
    ];
  });

  // Shows data for each tour type
  const [erShows, setErShows] = useState(() => {
    const saved = localStorage.getItem('erShows');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ER shows from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
      { id: 2, name: 'Silk Road Spices Show', city: 'Bukhara', price: '70 000' },
      { id: 3, name: 'El Merosi Show', city: 'Khiva', price: '75 000' },
    ];
  });

  const [coShows, setCoShows] = useState(() => {
    const saved = localStorage.getItem('coShows');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading CO shows from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
      { id: 2, name: 'El Merosi Show', city: 'Khiva', price: '75 000' },
      { id: 3, name: 'National Dance Show', city: 'Samarkand', price: '85 000' },
    ];
  });

  const [kasShows, setKasShows] = useState(() => {
    const saved = localStorage.getItem('kasShows');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading KAS shows from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
      { id: 2, name: 'Silk Road Spices Show', city: 'Bukhara', price: '70 000' },
    ];
  });

  const [zaShows, setZaShows] = useState(() => {
    const saved = localStorage.getItem('zaShows');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading ZA shows from localStorage:', e);
      }
    }
    return [
      { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
      { id: 2, name: 'National Dance Show', city: 'Samarkand', price: '85 000' },
    ];
  });

  // Default values for sightseeing, meal, and shows
  const defaultErSightseeing = [
    // Tashkent
    { id: 1, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
    { id: 2, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '' },
    // Samarkand
    { id: 3, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
    { id: 4, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
    { id: 5, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
    { id: 6, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
    { id: 7, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
    { id: 8, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
    { id: 9, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
    // Nurota
    { id: 10, name: 'Spring', city: 'Nurota', price: '20 000' },
    // Buxoro
    { id: 11, name: 'Samanid Mausoleum', city: 'Bukhara', price: '' },
    { id: 12, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
    { id: 13, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
    { id: 14, name: 'Kalon Mosque', city: 'Bukhara', price: '' },
    { id: 15, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
    // Khiva
    { id: 16, name: 'Itchan Kala', city: 'Khiva', price: '250 000' },
    { id: 17, name: 'Pahlavon Mahmud', city: 'Khiva', price: '30 000' },
  ];

  const defaultCoSightseeing = [
    // Qoqon
    { id: 1, name: 'Khudayar Khan Palace', city: 'Kokand', price: '30 000' },
    { id: 2, name: 'Jami Mosque', city: 'Kokand', price: '30 000' },
    // Tashkent
    { id: 3, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
    { id: 4, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '20 000' },
    // Samarkand
    { id: 5, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
    { id: 6, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
    { id: 7, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
    { id: 8, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
    { id: 9, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
    { id: 10, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
    { id: 11, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
    // Buxoro
    { id: 12, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
    { id: 13, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
    { id: 14, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
    { id: 15, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
    { id: 16, name: 'Naqshband mausoleum', city: 'Bukhara', price: '30000' },
    { id: 17, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
    // Khiva
    { id: 18, name: 'Itchan Kala', city: 'Khiva', price: '250 000' },
    { id: 19, name: 'Pahlavon Mahmud', city: 'Khiva', price: '30 000' },
    { id: 20, name: 'Koshay Bobo', city: 'Khiva', price: '150 000' },
  ];

  const defaultKasSightseeing = [
    // Qoqon
    { id: 1, name: 'Khudayar Khan Palace', city: 'Kokand', price: '30 000' },
    { id: 2, name: 'Jami Mosque', city: 'Kokand', price: '30 000' },
    // Tashkent
    { id: 3, name: 'Hast Imam Complex', city: 'Tashkent', price: '60 000' },
    { id: 4, name: 'Kukeldash Madrasah', city: 'Tashkent', price: '20 000' },
    // Samarkand
    { id: 5, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
    { id: 6, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
    { id: 7, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
    { id: 8, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
    { id: 9, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
    { id: 10, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
    { id: 11, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
    // Buxoro
    { id: 12, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
    { id: 13, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
    { id: 14, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
    { id: 15, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
    { id: 16, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
  ];

  const defaultZaSightseeing = [
    // Buxoro
    { id: 1, name: 'Samanid Mausoleum', city: 'Bukhara', price: '20000' },
    { id: 2, name: 'Chashma Ayub', city: 'Bukhara', price: '20 000' },
    { id: 3, name: 'Ark Fortress', city: 'Bukhara', price: '60 000' },
    { id: 4, name: 'Kalon Mosque', city: 'Bukhara', price: '20000' },
    { id: 5, name: 'Mohi Khosa', city: 'Bukhara', price: '60 000' },
    // Samarkand
    { id: 6, name: 'Amir Temur Mausoleum', city: 'Samarkand', price: '50 000' },
    { id: 7, name: 'Registan Square', city: 'Samarkand', price: '100 000' },
    { id: 8, name: 'Bibi-Khanym Mosque', city: 'Samarkand', price: '50 000' },
    { id: 9, name: 'Shah-i-Zinda Necropolis', city: 'Samarkand', price: '50 000' },
    { id: 10, name: 'Daniel Mausoleum', city: 'Samarkand', price: '30 000' },
    { id: 11, name: 'Ulugbek Observatory', city: 'Samarkand', price: '50 000' },
    { id: 12, name: 'Konigil Paper Workshop', city: 'Samarkand', price: '15 000' },
  ];

  const defaultErMeal = [
    { id: 1, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
    { id: 2, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
    { id: 3, name: 'Lyabi Hauz Restaurant', city: 'Bukhara', price: '130 000' },
    { id: 4, name: 'Terrassa Restaurant', city: 'Khiva', price: '110 000' },
  ];

  const defaultCoMeal = [
    { id: 1, name: 'Silk Road Restaurant', city: 'Kokand', price: '100 000' },
    { id: 2, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
    { id: 3, name: 'Registan Plaza', city: 'Samarkand', price: '140 000' },
    { id: 4, name: 'Old Bukhara', city: 'Bukhara', price: '135 000' },
    { id: 5, name: 'Orient Star', city: 'Khiva', price: '115 000' },
  ];

  const defaultKasMeal = [
    { id: 1, name: 'Akhunbabaev Restaurant', city: 'Kokand', price: '95 000' },
    { id: 2, name: 'Caravan Restaurant', city: 'Tashkent', price: '150 000' },
    { id: 3, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
    { id: 4, name: 'Lyabi Hauz Restaurant', city: 'Bukhara', price: '130 000' },
  ];

  const defaultZaMeal = [
    { id: 1, name: 'Old Bukhara', city: 'Bukhara', price: '135 000' },
    { id: 2, name: 'Registan Plaza', city: 'Samarkand', price: '140 000' },
    { id: 3, name: 'Samarkand Restaurant', city: 'Samarkand', price: '120 000' },
  ];

  const defaultErShows = [
    { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
    { id: 2, name: 'Silk Road Spices Show', city: 'Bukhara', price: '70 000' },
    { id: 3, name: 'El Merosi Show', city: 'Khiva', price: '75 000' },
  ];

  const defaultCoShows = [
    { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
    { id: 2, name: 'El Merosi Show', city: 'Khiva', price: '75 000' },
    { id: 3, name: 'National Dance Show', city: 'Samarkand', price: '85 000' },
  ];

  const defaultKasShows = [
    { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
    { id: 2, name: 'Silk Road Spices Show', city: 'Bukhara', price: '70 000' },
  ];

  const defaultZaShows = [
    { id: 1, name: 'Folklore Show at Nadir Divan-Begi', city: 'Bukhara', price: '80 000' },
    { id: 2, name: 'National Dance Show', city: 'Samarkand', price: '85 000' },
  ];

  // Save helper - saves to BOTH localStorage AND database
  const saveOpexConfig = async (tourType, category, items, localStorageKey) => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(items));
      await opexApi.save({
        tourType: tourType.toUpperCase(),
        category,
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

  // Load helper - loads from DATABASE first (source of truth)
  const loadOpexConfig = async (tourType, category, localStorageKey, defaultValue, setter) => {
    try {
      // 1. Try DATABASE first (source of truth) - always load fresh data on mount
      console.log(`🔄 Loading from database (${tourType}/${category})...`);
      const response = await opexApi.get(tourType.toUpperCase(), category);

      // Check if DB returned a record (items !== null means record exists in DB)
      // null = no record in DB; [] = record exists but user deleted all items; [...] = has items
      const dbHasRecord = response.data && response.data.items !== null && response.data.items !== undefined;

      if (dbHasRecord) {
        // Trust DB completely - even empty array means user deleted all items intentionally
        console.log(`✅ Loaded from database (${localStorageKey}), items: ${Array.isArray(response.data.items) ? response.data.items.length : 'object'}`);
        setter(response.data.items);
        localStorage.setItem(localStorageKey, JSON.stringify(response.data.items));
        return;
      }

      // 2. No DB record yet - try localStorage as fallback
      console.log(`⚠️ No DB record, trying localStorage (${localStorageKey})...`);
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`✅ Loaded from localStorage (${localStorageKey}), saving to DB...`);
        setter(parsed);
        // Sync localStorage data back to DB so it persists
        try {
          await opexApi.save({ tourType: tourType.toUpperCase(), category, items: parsed });
        } catch (syncError) {
          console.warn(`⚠️ Could not sync localStorage to DB (${localStorageKey}):`, syncError);
        }
        return;
      }

      // 3. No data anywhere - use defaults (don't save to DB here, let user changes trigger save)
      console.log(`⚠️ No data in database or localStorage, using defaults (${localStorageKey})`);
      setter(defaultValue);
    } catch (error) {
      console.error(`❌ Database load error (${localStorageKey}):`, error);
      // Fallback to localStorage if database fails
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`⚠️ Database failed, using localStorage (${localStorageKey})`);
        setter(parsed);
      } else {
        setter(defaultValue);
      }
    }
  };

  // Format price with space separator (2 000, 20 000, 200 000, etc.)
  const formatPrice = (price) => {
    if (!price || price === '-') return '-';
    // Remove existing spaces and parse number
    const numStr = String(price).replace(/\s/g, '');
    if (!numStr || isNaN(numStr)) return price;
    // Format with space separator every 3 digits from right
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  // Load transport data from API
  const loadTransportData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await transportApi.getAll();
      const { grouped } = response.data;

      // Set data from API or use defaults if empty
      setSevilErVehicles(grouped['sevil-er']?.length > 0 ? grouped['sevil-er'] : defaultSevilVehicles);
      setSevilCoVehicles(grouped['sevil-co']?.length > 0 ? grouped['sevil-co'] : defaultSevilVehicles);
      setSevilKasVehicles(grouped['sevil-kas']?.length > 0 ? grouped['sevil-kas'] : defaultSevilVehicles);
      setSevilZaVehicles(grouped['sevil-za']?.length > 0 ? grouped['sevil-za'] : defaultSevilVehicles);
      setSevilVehicles(grouped.sevil?.length > 0 ? grouped.sevil : []); // Legacy fallback
      setXayrullaVehicles(grouped.xayrulla?.length > 0 ? grouped.xayrulla : defaultXayrullaVehicles);
      setNosirVehicles(grouped.nosir?.length > 0 ? grouped.nosir : defaultNosirVehicles);
      setMetroVehicles(grouped.metro?.length > 0 ? grouped.metro : defaultMetroVehicles);
      setTrainVehicles(grouped.train?.length > 0 ? grouped.train : defaultTrainVehicles);
      setPlaneVehicles(grouped.plane?.length > 0 ? grouped.plane : defaultPlaneVehicles);

      // Dispatch event for BookingDetail to refresh
      window.dispatchEvent(new Event('vehiclesUpdated'));
    } catch (error) {
      console.error('Error loading transport data:', error);
      // Fallback to defaults on error
      setSevilErVehicles(defaultSevilVehicles);
      setSevilCoVehicles(defaultSevilVehicles);
      setSevilKasVehicles(defaultSevilVehicles);
      setSevilZaVehicles(defaultSevilVehicles);
      setXayrullaVehicles(defaultXayrullaVehicles);
      setNosirVehicles(defaultNosirVehicles);
      setMetroVehicles(defaultMetroVehicles);
      setTrainVehicles(defaultTrainVehicles);
      setPlaneVehicles(defaultPlaneVehicles);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    loadTransportData();
  }, [loadTransportData]);

  // Load OPEX data from database on mount
  useEffect(() => {
    const loadAllOpexData = async () => {
      await Promise.all([
        // Sightseeing
        loadOpexConfig('ER', 'sightseeing', 'erSightseeing', defaultErSightseeing, setErSightseeing),
        loadOpexConfig('CO', 'sightseeing', 'coSightseeing', defaultCoSightseeing, setCoSightseeing),
        loadOpexConfig('KAS', 'sightseeing', 'kasSightseeing', defaultKasSightseeing, setKasSightseeing),
        loadOpexConfig('ZA', 'sightseeing', 'zaSightseeing', defaultZaSightseeing, setZaSightseeing),
        // Meal
        loadOpexConfig('ER', 'meal', 'erMeal', defaultErMeal, setErMeal),
        loadOpexConfig('CO', 'meal', 'coMeal', defaultCoMeal, setCoMeal),
        loadOpexConfig('KAS', 'meal', 'kasMeal', defaultKasMeal, setKasMeal),
        loadOpexConfig('ZA', 'meal', 'zaMeal', defaultZaMeal, setZaMeal),
        // Shows
        loadOpexConfig('ER', 'shows', 'erShows', defaultErShows, setErShows),
        loadOpexConfig('CO', 'shows', 'coShows', defaultCoShows, setCoShows),
        loadOpexConfig('KAS', 'shows', 'kasShows', defaultKasShows, setKasShows),
        loadOpexConfig('ZA', 'shows', 'zaShows', defaultZaShows, setZaShows),
      ]);

      // Mark data as loaded - now saves are allowed
      dataLoadedRef.current = true;
    };

    loadAllOpexData();
  }, []); // Run once on mount

  // Save ER sightseeing to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ER', 'sightseeing', erSightseeing, 'erSightseeing');
    }
  }, [erSightseeing]);

  // Save CO sightseeing to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('CO', 'sightseeing', coSightseeing, 'coSightseeing');
    }
  }, [coSightseeing]);

  // Save KAS sightseeing to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('KAS', 'sightseeing', kasSightseeing, 'kasSightseeing');
    }
  }, [kasSightseeing]);

  // Save ZA sightseeing to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ZA', 'sightseeing', zaSightseeing, 'zaSightseeing');
    }
  }, [zaSightseeing]);

  // Save ER meal to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ER', 'meal', erMeal, 'erMeal');
    }
  }, [erMeal]);

  // Save CO meal to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('CO', 'meal', coMeal, 'coMeal');
    }
  }, [coMeal]);

  // Save KAS meal to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('KAS', 'meal', kasMeal, 'kasMeal');
    }
  }, [kasMeal]);

  // Save ZA meal to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ZA', 'meal', zaMeal, 'zaMeal');
    }
  }, [zaMeal]);

  // Save ER shows to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ER', 'shows', erShows, 'erShows');
    }
  }, [erShows]);

  // Save CO shows to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('CO', 'shows', coShows, 'coShows');
    }
  }, [coShows]);

  // Save KAS shows to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('KAS', 'shows', kasShows, 'kasShows');
    }
  }, [kasShows]);

  // Save ZA shows to localStorage and database whenever it changes
  useEffect(() => {
    if (dataLoadedRef.current) {
      saveOpexConfig('ZA', 'shows', zaShows, 'zaShows');
    }
  }, [zaShows]);

  // Modal states
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [vehicleForm, setVehicleForm] = useState({
    name: '',
    seats: '',
    person: '',
    pickupDropoff: '',
    tagRate: '',
    urgenchRate: '',
    shovotRate2: '',
    olotRate: '',
    jartepaRate: '',
    // Xayrulla fields
    vstrecha: '',
    chimgan: '',
    tag: '',
    oybek: '',
    chernyayevka: '',
    cityTour: '',
    // Nosir fields
    margilan: '',
    qoqon: '',
    dostlik: '',
    toshkent: '',
    // Train fields
    route: '',
    economPrice: '',
    businessPrice: '',
    vipPrice: '',
    departure: '',
    arrival: '',
    // Route fields
    transportType: '',
    choiceTab: '',
    choiceRate: '',
    price: '',
    // Person field for routes - reusing person field
    // Flight type field
    flightType: 'DOMESTIC' // DOMESTIC or INTERNATIONAL
  });

  // Sightseeing modal state
  const [showSightseeingModal, setShowSightseeingModal] = useState(false);
  const [editingSightseeing, setEditingSightseeing] = useState(null);
  const [sightseeingForm, setSightseeingForm] = useState({
    name: '',
    city: '',
    price: ''
  });

  // Sightseeing handlers
  const handleAddSightseeing = () => {
    setEditingSightseeing(null);
    setSightseeingForm({ name: '', city: '', price: '' });
    setShowSightseeingModal(true);
  };

  const handleEditSightseeing = (item) => {
    setEditingSightseeing(item);
    setSightseeingForm({
      name: item.name,
      city: item.city,
      price: item.price
    });
    setShowSightseeingModal(true);
  };

  const handleSaveSightseeing = () => {
    if (!sightseeingForm.name || !sightseeingForm.city) {
      toast.error('Please fill in attraction name and city');
      return;
    }

    if (editingSightseeing) {
      // Update existing
      if (activeSightseeingTab === 'er') {
        setErSightseeing(erSightseeing.map(item =>
          item.id === editingSightseeing.id
            ? { ...item, ...sightseeingForm }
            : item
        ));
      } else if (activeSightseeingTab === 'co') {
        setCoSightseeing(coSightseeing.map(item =>
          item.id === editingSightseeing.id
            ? { ...item, ...sightseeingForm }
            : item
        ));
      } else if (activeSightseeingTab === 'kas') {
        setKasSightseeing(kasSightseeing.map(item =>
          item.id === editingSightseeing.id
            ? { ...item, ...sightseeingForm }
            : item
        ));
      } else if (activeSightseeingTab === 'za') {
        setZaSightseeing(zaSightseeing.map(item =>
          item.id === editingSightseeing.id
            ? { ...item, ...sightseeingForm }
            : item
        ));
      }
      toast.success('Attraction updated');
      setShowSightseeingModal(false);
    } else {
      // Add new
      let currentList;
      if (activeSightseeingTab === 'er') currentList = erSightseeing;
      else if (activeSightseeingTab === 'co') currentList = coSightseeing;
      else if (activeSightseeingTab === 'kas') currentList = kasSightseeing;
      else if (activeSightseeingTab === 'za') currentList = zaSightseeing;

      const newId = currentList.length > 0
        ? Math.max(...currentList.map(i => i.id), 0) + 1
        : 1;

      const newItem = {
        id: newId,
        ...sightseeingForm
      };

      if (activeSightseeingTab === 'er') {
        setErSightseeing([...erSightseeing, newItem]);
      } else if (activeSightseeingTab === 'co') {
        setCoSightseeing([...coSightseeing, newItem]);
      } else if (activeSightseeingTab === 'kas') {
        setKasSightseeing([...kasSightseeing, newItem]);
      } else if (activeSightseeingTab === 'za') {
        setZaSightseeing([...zaSightseeing, newItem]);
      }
      toast.success('Attraction added');
      setShowSightseeingModal(false);
    }
  };

  const handleDeleteSightseeing = (item) => {
    if (window.confirm(`Delete "${item.name}"?`)) {
      if (activeSightseeingTab === 'er') {
        setErSightseeing(erSightseeing.filter(i => i.id !== item.id));
      } else if (activeSightseeingTab === 'co') {
        setCoSightseeing(coSightseeing.filter(i => i.id !== item.id));
      } else if (activeSightseeingTab === 'kas') {
        setKasSightseeing(kasSightseeing.filter(i => i.id !== item.id));
      } else if (activeSightseeingTab === 'za') {
        setZaSightseeing(zaSightseeing.filter(i => i.id !== item.id));
      }
      toast.success('Attraction deleted');
    }
  };

  // Meal modal state
  const [showMealModal, setShowMealModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [mealForm, setMealForm] = useState({
    name: '',
    city: '',
    price: ''
  });

  // Meal handlers
  const handleAddMeal = () => {
    setEditingMeal(null);
    setMealForm({ name: '', city: '', price: '' });
    setShowMealModal(true);
  };

  const handleEditMeal = (item) => {
    setEditingMeal(item);
    setMealForm({
      name: item.name,
      city: item.city,
      price: item.price
    });
    setShowMealModal(true);
  };

  const handleSaveMeal = () => {
    if (!mealForm.name || !mealForm.city) {
      toast.error('Please fill in restaurant name and city');
      return;
    }

    if (editingMeal) {
      // Update existing
      if (activeMealTab === 'er') {
        setErMeal(erMeal.map(item =>
          item.id === editingMeal.id
            ? { ...item, ...mealForm }
            : item
        ));
      } else if (activeMealTab === 'co') {
        setCoMeal(coMeal.map(item =>
          item.id === editingMeal.id
            ? { ...item, ...mealForm }
            : item
        ));
      } else if (activeMealTab === 'kas') {
        setKasMeal(kasMeal.map(item =>
          item.id === editingMeal.id
            ? { ...item, ...mealForm }
            : item
        ));
      } else if (activeMealTab === 'za') {
        setZaMeal(zaMeal.map(item =>
          item.id === editingMeal.id
            ? { ...item, ...mealForm }
            : item
        ));
      }
      toast.success('Restaurant updated');
      setShowMealModal(false);
    } else {
      // Add new
      let currentList;
      if (activeMealTab === 'er') currentList = erMeal;
      else if (activeMealTab === 'co') currentList = coMeal;
      else if (activeMealTab === 'kas') currentList = kasMeal;
      else if (activeMealTab === 'za') currentList = zaMeal;

      const newId = currentList.length > 0
        ? Math.max(...currentList.map(i => i.id), 0) + 1
        : 1;

      const newItem = {
        id: newId,
        ...mealForm
      };

      if (activeMealTab === 'er') {
        setErMeal([...erMeal, newItem]);
      } else if (activeMealTab === 'co') {
        setCoMeal([...coMeal, newItem]);
      } else if (activeMealTab === 'kas') {
        setKasMeal([...kasMeal, newItem]);
      } else if (activeMealTab === 'za') {
        setZaMeal([...zaMeal, newItem]);
      }
      toast.success('Restaurant added');
      setShowMealModal(false);
    }
  };

  const handleDeleteMeal = (item) => {
    if (window.confirm(`Delete "${item.name}"?`)) {
      if (activeMealTab === 'er') {
        setErMeal(erMeal.filter(i => i.id !== item.id));
      } else if (activeMealTab === 'co') {
        setCoMeal(coMeal.filter(i => i.id !== item.id));
      } else if (activeMealTab === 'kas') {
        setKasMeal(kasMeal.filter(i => i.id !== item.id));
      } else if (activeMealTab === 'za') {
        setZaMeal(zaMeal.filter(i => i.id !== item.id));
      }
      toast.success('Restaurant deleted');
    }
  };

  // Shows modal state
  const [showShowsModal, setShowShowsModal] = useState(false);
  const [editingShow, setEditingShow] = useState(null);
  const [showForm, setShowForm] = useState({
    name: '',
    city: '',
    price: ''
  });

  // Shows handlers
  const handleAddShow = () => {
    setEditingShow(null);
    setShowForm({ name: '', city: '', price: '' });
    setShowShowsModal(true);
  };

  const handleEditShow = (item) => {
    setEditingShow(item);
    setShowForm({
      name: item.name,
      city: item.city,
      price: item.price
    });
    setShowShowsModal(true);
  };

  const handleSaveShow = () => {
    if (!showForm.name || !showForm.city) {
      toast.error('Please fill in show name and city');
      return;
    }

    if (editingShow) {
      // Update existing
      if (activeShowsTab === 'er') {
        setErShows(erShows.map(item =>
          item.id === editingShow.id
            ? { ...item, ...showForm }
            : item
        ));
      } else if (activeShowsTab === 'co') {
        setCoShows(coShows.map(item =>
          item.id === editingShow.id
            ? { ...item, ...showForm }
            : item
        ));
      } else if (activeShowsTab === 'kas') {
        setKasShows(kasShows.map(item =>
          item.id === editingShow.id
            ? { ...item, ...showForm }
            : item
        ));
      } else if (activeShowsTab === 'za') {
        setZaShows(zaShows.map(item =>
          item.id === editingShow.id
            ? { ...item, ...showForm }
            : item
        ));
      }
      toast.success('Show updated');
      setShowShowsModal(false);
    } else {
      // Add new
      let currentList;
      if (activeShowsTab === 'er') currentList = erShows;
      else if (activeShowsTab === 'co') currentList = coShows;
      else if (activeShowsTab === 'kas') currentList = kasShows;
      else if (activeShowsTab === 'za') currentList = zaShows;

      const newId = currentList.length > 0
        ? Math.max(...currentList.map(i => i.id), 0) + 1
        : 1;

      const newItem = {
        id: newId,
        ...showForm
      };

      if (activeShowsTab === 'er') {
        setErShows([...erShows, newItem]);
      } else if (activeShowsTab === 'co') {
        setCoShows([...coShows, newItem]);
      } else if (activeShowsTab === 'kas') {
        setKasShows([...kasShows, newItem]);
      } else if (activeShowsTab === 'za') {
        setZaShows([...zaShows, newItem]);
      }
      toast.success('Show added');
      setShowShowsModal(false);
    }
  };

  const handleDeleteShow = (item) => {
    if (window.confirm(`Delete "${item.name}"?`)) {
      if (activeShowsTab === 'er') {
        setErShows(erShows.filter(i => i.id !== item.id));
      } else if (activeShowsTab === 'co') {
        setCoShows(coShows.filter(i => i.id !== item.id));
      } else if (activeShowsTab === 'kas') {
        setKasShows(kasShows.filter(i => i.id !== item.id));
      } else if (activeShowsTab === 'za') {
        setZaShows(zaShows.filter(i => i.id !== item.id));
      }
      toast.success('Show deleted');
    }
  };

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      name: '',
      trainNumber: '',
      seats: '',
      person: '',
      pickupDropoff: '',
      tagRate: '',
      urgenchRate: '',
      shovotRate2: '',
      olotRate: '',
      jartepaRate: '',
      vstrecha: '',
      chimgan: '',
      tag: '',
      oybek: '',
      chernyayevka: '',
      cityTour: '',
      margilan: '',
      qoqon: '',
      dostlik: '',
      toshkent: '',
      route: '',
      economPrice: '',
      businessPrice: '',
      departure: '',
      arrival: '',
      transportType: '',
      choiceTab: '',
      choiceRate: '',
      price: '',
      flightType: 'DOMESTIC' // Default to Ichki reys
    });
    setShowVehicleModal(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      name: vehicle.name || vehicle.route || '',
      trainNumber: vehicle.trainNumber || '',
      seats: vehicle.seats || '',
      person: vehicle.person || '',
      pickupDropoff: vehicle.pickupDropoff || '',
      tagRate: vehicle.tagRate || '',
      urgenchRate: vehicle.urgenchRate || '',
      shovotRate2: vehicle.shovotRate2 || '',
      olotRate: vehicle.olotRate || '',
      jartepaRate: vehicle.jartepaRate || '',
      vstrecha: vehicle.vstrecha || '',
      chimgan: vehicle.chimgan || '',
      tag: vehicle.tag || '',
      oybek: vehicle.oybek || '',
      chernyayevka: vehicle.chernyayevka || '',
      cityTour: vehicle.cityTour || '',
      margilan: vehicle.margilan || '',
      qoqon: vehicle.qoqon || '',
      dostlik: vehicle.dostlik || '',
      toshkent: vehicle.toshkent || '',
      route: vehicle.route || '',
      economPrice: vehicle.economPrice || '',
      businessPrice: vehicle.businessPrice || '',
      vipPrice: vehicle.vipPrice || '',
      departure: vehicle.departure || '',
      arrival: vehicle.arrival || '',
      transportType: vehicle.transportType || '',
      choiceTab: vehicle.choiceTab || '',
      choiceRate: vehicle.choiceRate || '',
      price: vehicle.price || '',
      flightType: vehicle.flightType || 'DOMESTIC'
    });
    setShowVehicleModal(true);
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот транспорт?')) {
      if (activeCategory === 'transport') {
        let updatedVehicles;
        let provider;

        if (activeTransportTab === 'metro') {
          updatedVehicles = metroVehicles.filter(v => v.id !== vehicleId);
          setMetroVehicles(updatedVehicles);
          provider = 'metro';
        } else if (activeTransportTab === 'train') {
          updatedVehicles = trainVehicles.filter(v => v.id !== vehicleId);
          setTrainVehicles(updatedVehicles);
          provider = 'train';
        } else if (activeTransportTab === 'plane') {
          updatedVehicles = planeVehicles.filter(v => v.id !== vehicleId);
          setPlaneVehicles(updatedVehicles);
          provider = 'plane';
        } else if (activeTransportTab === 'xayrulla') {
          updatedVehicles = xayrullaVehicles.filter(v => v.id !== vehicleId);
          setXayrullaVehicles(updatedVehicles);
          provider = 'xayrulla';
        } else if (activeTransportTab === 'nosir') {
          updatedVehicles = nosirVehicles.filter(v => v.id !== vehicleId);
          setNosirVehicles(updatedVehicles);
          provider = 'nosir';
        } else if (activeTransportTab === 'sevil-er') {
          updatedVehicles = sevilErVehicles.filter(v => v.id !== vehicleId);
          setSevilErVehicles(updatedVehicles);
          provider = 'sevil-er';
        } else if (activeTransportTab === 'sevil-co') {
          updatedVehicles = sevilCoVehicles.filter(v => v.id !== vehicleId);
          setSevilCoVehicles(updatedVehicles);
          provider = 'sevil-co';
        } else if (activeTransportTab === 'sevil-kas') {
          updatedVehicles = sevilKasVehicles.filter(v => v.id !== vehicleId);
          setSevilKasVehicles(updatedVehicles);
          provider = 'sevil-kas';
        } else if (activeTransportTab === 'sevil-za') {
          updatedVehicles = sevilZaVehicles.filter(v => v.id !== vehicleId);
          setSevilZaVehicles(updatedVehicles);
          provider = 'sevil-za';
        } else {
          // Fallback for legacy tabs
          updatedVehicles = sevilErVehicles.filter(v => v.id !== vehicleId);
          setSevilErVehicles(updatedVehicles);
          provider = 'sevil-er';
        }

        // Auto-save to database
        try {
          await transportApi.bulkUpdate(provider, updatedVehicles);
          toast.success('Транспорт удален и сохранен');
          window.dispatchEvent(new Event('vehiclesUpdated'));
        } catch (error) {
          console.error('Error auto-saving:', error);
          toast.error('Удалено, но ошибка сохранения');
        }
      }
    }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleForm.name) {
      toast.error('Введите название транспорта');
      return;
    }

    let vehicles, setVehicles, provider;
    if (activeCategory === 'transport') {
      if (activeTransportTab === 'metro') {
        vehicles = metroVehicles;
        setVehicles = setMetroVehicles;
        provider = 'metro';
      } else if (activeTransportTab === 'train') {
        vehicles = trainVehicles;
        setVehicles = setTrainVehicles;
        provider = 'train';
      } else if (activeTransportTab === 'plane') {
        vehicles = planeVehicles;
        setVehicles = setPlaneVehicles;
        provider = 'plane';
      } else if (activeTransportTab === 'xayrulla') {
        vehicles = xayrullaVehicles;
        setVehicles = setXayrullaVehicles;
        provider = 'xayrulla';
      } else if (activeTransportTab === 'nosir') {
        vehicles = nosirVehicles;
        setVehicles = setNosirVehicles;
        provider = 'nosir';
      } else if (activeTransportTab === 'sevil-er') {
        vehicles = sevilErVehicles;
        setVehicles = setSevilErVehicles;
        provider = 'sevil-er';
      } else if (activeTransportTab === 'sevil-co') {
        vehicles = sevilCoVehicles;
        setVehicles = setSevilCoVehicles;
        provider = 'sevil-co';
      } else if (activeTransportTab === 'sevil-kas') {
        vehicles = sevilKasVehicles;
        setVehicles = setSevilKasVehicles;
        provider = 'sevil-kas';
      } else if (activeTransportTab === 'sevil-za') {
        vehicles = sevilZaVehicles;
        setVehicles = setSevilZaVehicles;
        provider = 'sevil-za';
      } else {
        // Fallback for legacy 'sevil' tab (should not happen)
        vehicles = sevilErVehicles;
        setVehicles = setSevilErVehicles;
        provider = 'sevil-er';
      }
    }

    let updatedVehicles;
    if (editingVehicle) {
      // Update existing vehicle
      updatedVehicles = vehicles.map(v =>
        v.id === editingVehicle.id
          ? { ...v, ...vehicleForm }
          : v
      );
      setVehicles(updatedVehicles);
    } else {
      // Add new vehicle
      const newVehicle = {
        id: Math.max(...vehicles.map(v => v.id), 0) + 1,
        ...vehicleForm
      };
      updatedVehicles = [...vehicles, newVehicle];
      setVehicles(updatedVehicles);
    }

    // Auto-save to database
    try {
      await transportApi.bulkUpdate(provider, updatedVehicles);
      toast.success(editingVehicle ? 'Транспорт обновлен и сохранен' : 'Транспорт добавлен и сохранен');
      window.dispatchEvent(new Event('vehiclesUpdated'));
    } catch (error) {
      console.error('Error auto-saving:', error);
      toast.error('Изменено, но ошибка сохранения в БД');
    }

    setShowVehicleModal(false);
  };

  // Save transport data to API
  const handleSaveTransportData = async (providerName) => {
    const provider = providerName.toLowerCase();
    try {
      let vehicles;
      let apiProvider = provider; // Provider name for API

      switch (provider) {
        case 'sevil-er':
          vehicles = sevilErVehicles;
          apiProvider = 'sevil-er';
          break;
        case 'sevil-co':
          vehicles = sevilCoVehicles;
          apiProvider = 'sevil-co';
          break;
        case 'sevil-kas':
          vehicles = sevilKasVehicles;
          apiProvider = 'sevil-kas';
          break;
        case 'sevil-za':
          vehicles = sevilZaVehicles;
          apiProvider = 'sevil-za';
          break;
        case 'xayrulla':
          vehicles = xayrullaVehicles;
          break;
        case 'nosir':
          vehicles = nosirVehicles;
          break;
        case 'train':
          vehicles = trainVehicles;
          break;
        case 'plane':
          vehicles = planeVehicles;
          break;
        case 'metro':
          vehicles = metroVehicles;
          break;
        default:
          return;
      }

      await transportApi.bulkUpdate(apiProvider, vehicles);
      toast.success(`${providerName} ma'lumotlari saqlandi!`);
      window.dispatchEvent(new Event('vehiclesUpdated'));
    } catch (error) {
      console.error('Error saving transport data:', error);
      toast.error('Saqlashda xatolik yuz berdi');
    }
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTab = categories.find(c => c.id === activeCategory);

  // Get current Sevil vehicles based on active tab
  const getCurrentSevilVehicles = () => {
    switch (activeTransportTab) {
      case 'sevil-er':
        return sevilErVehicles;
      case 'sevil-co':
        return sevilCoVehicles;
      case 'sevil-kas':
        return sevilKasVehicles;
      case 'sevil-za':
        return sevilZaVehicles;
      default:
        return sevilErVehicles; // Fallback
    }
  };

  const currentSevilVehicles = getCurrentSevilVehicles();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-emerald-100 p-4 md:p-8">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10"></div>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-br from-cyan-400/20 to-teal-400/20 rounded-full blur-3xl"></div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl md:rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 transform hover:scale-110 transition-transform duration-300">
                <Wallet className="w-7 h-7 md:w-10 md:h-10 text-white" />
              </div>
              <div className="absolute -bottom-1 md:-bottom-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <span className="text-[10px] md:text-xs font-bold text-white">$</span>
              </div>
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                OPEX Management
              </h1>
              <p className="text-slate-600 text-xs md:text-sm mt-0.5 md:mt-1 font-medium">Operational Expenses & Cost Control</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (activeCategory === 'transport' && ['sevil-er', 'sevil-co', 'sevil-kas', 'sevil-za', 'xayrulla', 'nosir', 'metro', 'train', 'plane'].includes(activeTransportTab)) {
                handleAddVehicle();
              } else if (activeCategory === 'sightseeing') {
                handleAddSightseeing();
              } else if (activeCategory === 'meal') {
                handleAddMeal();
              } else if (activeCategory === 'shows') {
                handleAddShow();
              } else {
                toast.success('Функционал в разработке');
              }
            }}
            className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white rounded-xl md:rounded-2xl hover:shadow-2xl hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all duration-300 font-bold text-sm md:text-base min-h-[44px] w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">
              {activeCategory === 'transport' && ['sevil-er', 'sevil-co', 'sevil-kas', 'sevil-za', 'xayrulla', 'nosir', 'metro', 'train', 'plane'].includes(activeTransportTab) ? 'Добавить транспорт' : 'Добавить расход'}
            </span>
            <span className="sm:hidden">
              {activeCategory === 'transport' && ['sevil-er', 'sevil-co', 'sevil-kas', 'sevil-za', 'xayrulla', 'nosir', 'metro', 'train', 'plane'].includes(activeTransportTab) ? 'Транспорт' : 'Добавить'}
            </span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl border-2 border-slate-100 p-2 md:p-4">
        <div className="flex gap-2 md:gap-4 overflow-x-auto justify-start md:justify-center pb-1">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            const colorMap = {
              blue: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-blue-600', iconBg: 'bg-blue-100', hoverBg: 'hover:from-blue-50 hover:to-blue-100' },
              sky: { bg: 'bg-gradient-to-r from-sky-500 to-sky-600', text: 'text-sky-600', iconBg: 'bg-sky-100', hoverBg: 'hover:from-sky-50 hover:to-sky-100' },
              indigo: { bg: 'bg-gradient-to-r from-indigo-500 to-indigo-600', text: 'text-indigo-600', iconBg: 'bg-indigo-100', hoverBg: 'hover:from-indigo-50 hover:to-indigo-100' },
              purple: { bg: 'bg-gradient-to-r from-purple-500 to-purple-600', text: 'text-purple-600', iconBg: 'bg-purple-100', hoverBg: 'hover:from-purple-50 hover:to-purple-100' },
              orange: { bg: 'bg-gradient-to-r from-orange-500 to-orange-600', text: 'text-orange-600', iconBg: 'bg-orange-100', hoverBg: 'hover:from-orange-50 hover:to-orange-100' },
              pink: { bg: 'bg-gradient-to-r from-pink-500 to-pink-600', text: 'text-pink-600', iconBg: 'bg-pink-100', hoverBg: 'hover:from-pink-50 hover:to-pink-100' },
              emerald: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-emerald-600', iconBg: 'bg-emerald-100', hoverBg: 'hover:from-emerald-50 hover:to-emerald-100' },
            };

            const colors = colorMap[category.color];

            return (
              <button
                key={category.id}
                onClick={() => updateParams({ category: category.id })}
                className={`group relative flex items-center gap-2 md:gap-3 px-4 md:px-8 py-2.5 md:py-4 rounded-xl md:rounded-2xl font-black transition-all duration-300 whitespace-nowrap transform min-h-[44px] flex-shrink-0 ${
                  isActive
                    ? `${colors.bg} text-white shadow-2xl hover:shadow-3xl scale-105 md:scale-110 hover:scale-110 md:hover:scale-115`
                    : `text-gray-700 bg-gradient-to-br ${colors.hoverBg} hover:shadow-xl hover:scale-105 border-2 border-slate-200`
                }`}
              >
                <div className={`${isActive ? 'bg-white/30 backdrop-blur-sm' : colors.iconBg} p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all duration-300 shadow-md`}>
                  <Icon className="w-4 h-4 md:w-6 md:h-6" />
                </div>
                <span className="text-sm md:text-base">{category.name}</span>
                {isActive && (
                  <div className="absolute -bottom-1 md:-bottom-2 left-1/2 -translate-x-1/2 w-12 md:w-16 h-1 md:h-1.5 bg-white rounded-full shadow-lg"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transport Sub-Tabs */}
      {activeCategory === 'transport' && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl md:rounded-3xl shadow-2xl border-2 border-gray-100 p-2 md:p-4">
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-1">
            {transportSubTabs.map((subTab) => {
              const Icon = subTab.icon;
              const isActive = activeTransportTab === subTab.id;

              const colorMap = {
                blue: {
                  gradient: 'from-blue-500 to-blue-600',
                  shadow: 'shadow-blue-500/30',
                  ring: 'ring-blue-200',
                  hover: 'hover:from-blue-600 hover:to-blue-700'
                },
                cyan: {
                  gradient: 'from-cyan-500 to-cyan-600',
                  shadow: 'shadow-cyan-500/30',
                  ring: 'ring-cyan-200',
                  hover: 'hover:from-cyan-600 hover:to-cyan-700'
                },
                teal: {
                  gradient: 'from-teal-500 to-teal-600',
                  shadow: 'shadow-teal-500/30',
                  ring: 'ring-teal-200',
                  hover: 'hover:from-teal-600 hover:to-teal-700'
                },
                violet: {
                  gradient: 'from-violet-500 to-violet-600',
                  shadow: 'shadow-violet-500/30',
                  ring: 'ring-violet-200',
                  hover: 'hover:from-violet-600 hover:to-violet-700'
                },
                purple: {
                  gradient: 'from-purple-500 to-purple-600',
                  shadow: 'shadow-purple-500/30',
                  ring: 'ring-purple-200',
                  hover: 'hover:from-purple-600 hover:to-purple-700'
                },
                orange: {
                  gradient: 'from-orange-500 to-orange-600',
                  shadow: 'shadow-orange-500/30',
                  ring: 'ring-orange-200',
                  hover: 'hover:from-orange-600 hover:to-orange-700'
                },
                sky: {
                  gradient: 'from-sky-500 to-sky-600',
                  shadow: 'shadow-sky-500/30',
                  ring: 'ring-sky-200',
                  hover: 'hover:from-sky-600 hover:to-sky-700'
                },
                emerald: {
                  gradient: 'from-emerald-500 to-emerald-600',
                  shadow: 'shadow-emerald-500/30',
                  ring: 'ring-emerald-200',
                  hover: 'hover:from-emerald-600 hover:to-emerald-700'
                },
                pink: {
                  gradient: 'from-pink-500 to-pink-600',
                  shadow: 'shadow-pink-500/30',
                  ring: 'ring-pink-200',
                  hover: 'hover:from-pink-600 hover:to-pink-700'
                },
              };

              const colors = colorMap[subTab.color];

              return (
                <button
                  key={subTab.id}
                  onClick={() => updateParams({ transport: subTab.id })}
                  className={`flex items-center gap-2 md:gap-2.5 px-4 md:px-6 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl font-bold transition-all duration-300 whitespace-nowrap text-xs md:text-sm min-h-[44px] flex-shrink-0 ${
                    isActive
                      ? `bg-gradient-to-r ${colors.gradient} ${colors.hover} text-white shadow-xl ${colors.shadow} ring-2 ${colors.ring} scale-105 md:scale-110 -translate-y-0.5`
                      : 'text-gray-600 bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  {subTab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sightseeing Sub-Tabs */}
      {activeCategory === 'sightseeing' && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-4">
          <div className="flex gap-3 overflow-x-auto">
            {sightseeingSubTabs.map((subTab) => {
              const Icon = subTab.icon;
              const isActive = activeSightseeingTab === subTab.id;

              const colorMap = {
                blue: {
                  gradient: 'from-blue-500 to-blue-600',
                  shadow: 'shadow-blue-500/30',
                  ring: 'ring-blue-200',
                  hover: 'hover:from-blue-600 hover:to-blue-700'
                },
                emerald: {
                  gradient: 'from-emerald-500 to-emerald-600',
                  shadow: 'shadow-emerald-500/30',
                  ring: 'ring-emerald-200',
                  hover: 'hover:from-emerald-600 hover:to-emerald-700'
                },
                orange: {
                  gradient: 'from-orange-500 to-orange-600',
                  shadow: 'shadow-orange-500/30',
                  ring: 'ring-orange-200',
                  hover: 'hover:from-orange-600 hover:to-orange-700'
                },
                purple: {
                  gradient: 'from-purple-500 to-purple-600',
                  shadow: 'shadow-purple-500/30',
                  ring: 'ring-purple-200',
                  hover: 'hover:from-purple-600 hover:to-purple-700'
                },
              };

              const colors = colorMap[subTab.color];

              return (
                <button
                  key={subTab.id}
                  onClick={() => updateParams({ sightseeing: subTab.id })}
                  className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap text-sm ${
                    isActive
                      ? `bg-gradient-to-r ${colors.gradient} ${colors.hover} text-white shadow-xl ${colors.shadow} ring-2 ${colors.ring} scale-110 -translate-y-0.5`
                      : 'text-gray-600 bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {subTab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-6">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-all duration-300"></div>
          <div className="absolute left-5 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-70 group-focus-within:opacity-100 transition-all duration-300 shadow-lg">
            <Search className="w-5 h-5 text-white" />
          </div>
          <input
            type="text"
            placeholder={`Поиск в ${activeTab.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="relative w-full pl-20 pr-6 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder:text-gray-400 font-medium shadow-md hover:shadow-lg"
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-gray-100 overflow-hidden">
        {activeCategory === 'transport' && activeTransportTab === 'xayrulla' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 border-b-3 border-cyan-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    PAX
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Pickup / Drop-off
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    chimgan Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Tag Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Oybek Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Chernyayevka Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    City Tour Rate
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {xayrullaVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-cyan-50 hover:to-teal-50 transition-all duration-300 border-b border-gray-100 group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.person || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.vstrecha || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.chimgan || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.tag || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.oybek || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.chernyayevka || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.cityTour || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditVehicle(vehicle)}
                        className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="7" className="px-6 py-4">
                    <button
                      onClick={handleAddVehicle}
                      className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                    >
                      <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="font-semibold">Добавить транспорт</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Save Button for Xayrulla */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData('Xayrulla')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'nosir' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 border-b-3 border-teal-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    PAX
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Margilan Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Qoqon Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Dostlik Rate
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Toshkent Rate
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nosirVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50 transition-all duration-300 border-b border-gray-100 group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.person || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.margilan || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.qoqon || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.dostlik || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.toshkent || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditVehicle(vehicle)}
                        className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="7" className="px-6 py-4">
                    <button
                      onClick={handleAddVehicle}
                      className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                    >
                      <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="font-semibold">Добавить транспорт</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Save Button for Nosir */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData('Nosir')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'metro' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600 border-b-3 border-violet-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metroVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-200 rounded-full flex items-center justify-center shadow-lg">
                          <Navigation className="w-10 h-10 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-gray-700 font-bold mb-1">Нет данных</p>
                          <p className="text-gray-500 text-sm">Начните добавлять транспорт</p>
                        </div>
                        <button
                          onClick={handleAddVehicle}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-2xl hover:from-violet-700 hover:to-purple-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-bold"
                        >
                          <Plus className="w-5 h-5" />
                          <span>Добавить</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  metroVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 transition-all duration-300 border-b border-gray-100 group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.economPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditVehicle(vehicle)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {metroVehicles.length > 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-4">
                      <button
                        onClick={handleAddVehicle}
                        className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                      >
                        <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-semibold">Добавить транспорт</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Save Button for Metro */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData('Metro')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'plane' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-sky-500 via-blue-500 to-sky-600 border-b-3 border-sky-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Flight Number
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Airline
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Econom
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    VIP
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {planeVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-sky-100 to-blue-200 rounded-full flex items-center justify-center shadow-lg">
                          <Plane className="w-10 h-10 text-sky-500" />
                        </div>
                        <div>
                          <p className="text-gray-700 font-bold mb-1">Нет данных</p>
                          <p className="text-gray-500 text-sm">Начните добавлять транспорт</p>
                        </div>
                        <button
                          onClick={handleAddVehicle}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="font-medium">Добавить</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  planeVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.trainNumber || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          vehicle.flightType === 'DOMESTIC'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}>
                          {vehicle.flightType === 'DOMESTIC' ? 'Ички' : 'Халқаро'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {vehicle.route || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.economPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.businessPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.vipPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {vehicle.departure || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {vehicle.arrival || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditVehicle(vehicle)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {planeVehicles.length > 0 && (
                  <tr>
                    <td colSpan="10" className="px-6 py-4">
                      <button
                        onClick={handleAddVehicle}
                        className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                      >
                        <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-semibold">Добавить транспорт</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Save Button for Plane */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData('Plane')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'train' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 border-b-3 border-emerald-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Train Number
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Train Name
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Econom
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    VIP
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trainVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center shadow-lg">
                          <Train className="w-10 h-10 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-gray-700 font-bold mb-1">Нет данных</p>
                          <p className="text-gray-500 text-sm">Начните добавлять транспорт</p>
                        </div>
                        <button
                          onClick={handleAddVehicle}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                        >
                          <Plus className="w-5 h-5" />
                          <span className="font-medium">Добавить</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  trainVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.trainNumber || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-600">
                          {vehicle.route || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.economPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.businessPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.vipPrice || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {vehicle.departure || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {vehicle.arrival || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditVehicle(vehicle)}
                          className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {trainVehicles.length > 0 && (
                  <tr>
                    <td colSpan="9" className="px-6 py-4">
                      <button
                        onClick={handleAddVehicle}
                        className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                      >
                        <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <span className="font-semibold">Добавить транспорт</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Save Button for Train */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData('Train')}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab.startsWith('sevil-') ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 border-b-3 border-blue-300">
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    PAX
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    Pickup / Drop-off
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    TAG Rate
                  </th>
                  {activeTransportTab !== 'sevil-za' && (
                    <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                      Urgench Rate
                    </th>
                  )}
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    {activeTransportTab === 'sevil-za' ? 'Jartepa Rate' : 'Shovot Rate'}
                  </th>
                  <th className="px-6 py-5 text-right text-xs font-bold text-white uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentSevilVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 border-b border-gray-100 group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.person || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.pickupDropoff || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.tagRate || '-'}
                      </div>
                    </td>
                    {activeTransportTab !== 'sevil-za' && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">
                          {vehicle.urgenchRate || '-'}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {activeTransportTab === 'sevil-za' ? (vehicle.jartepaRate || '-') : (vehicle.shovotRate2 || '-')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditVehicle(vehicle)}
                        className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-200 hover:scale-110"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(vehicle.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 hover:scale-110 ml-2"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={activeTransportTab === 'sevil-za' ? "6" : "7"} className="px-6 py-4">
                    <button
                      onClick={handleAddVehicle}
                      className="group w-full flex items-center justify-center gap-3 py-4 text-primary-600 hover:text-primary-700 hover:bg-gradient-to-r hover:from-primary-50 hover:to-blue-50 rounded-xl transition-all duration-300 border-2 border-dashed border-gray-300 hover:border-primary-400 hover:scale-[1.02]"
                    >
                      <div className="p-1.5 bg-primary-100 rounded-lg group-hover:bg-primary-200 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="font-semibold">Добавить транспорт</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Save Button for Sevil */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => handleSaveTransportData(activeTransportTab)}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
              >
                <Save className="w-5 h-5" />
                Сохранить
              </button>
            </div>
          </div>
        ) : activeCategory === 'sightseeing' && activeSightseeingTab === 'er' ? (
          <div className="overflow-x-auto rounded-2xl shadow-2xl border border-blue-100">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700">
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                    <div className="flex items-center justify-center gap-2">
                      <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      City
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Attraction
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Price (UZS)
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-blue-100">
                {erSightseeing
                  .slice()
                  .sort((a, b) => {
                    // ER tour city order: Tashkent → Samarkand → Nurota → Bukhara → Khiva
                    const cityOrder = { 'tashkent': 1, 'samarkand': 2, 'nurota': 3, 'bukhara': 4, 'khiva': 5 };
                    const cityA = (a.city || '').toLowerCase().trim();
                    const cityB = (b.city || '').toLowerCase().trim();
                    const orderA = cityOrder[cityA] || 999;
                    const orderB = cityOrder[cityB] || 999;
                    return orderA - orderB;
                  })
                  .map((item, index) => (
                  <tr key={item.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100/50 transition-all duration-300 group">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                        <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                        <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditSightseeing(item)}
                          className="p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSightseeing(item)}
                          className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 border-t-4 border-orange-300">
                  <td colSpan="3" className="px-6 py-5 text-right">
                    <span className="text-base font-bold text-white uppercase tracking-wider">Total:</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-lg">
                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                        {erSightseeing.reduce((sum, item) => {
                          const price = parseInt(item.price.replace(/\s/g, '')) || 0;
                          return sum + price;
                        }, 0).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
              <button
                onClick={handleAddSightseeing}
                className="w-full flex items-center justify-center gap-3 py-4 text-blue-700 bg-white hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span>Add Attraction</span>
              </button>
            </div>
          </div>
        ) : activeCategory === 'sightseeing' && activeSightseeingTab === 'co' ? (
          <div className="overflow-x-auto rounded-2xl shadow-2xl border border-emerald-100">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700">
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                    <div className="flex items-center justify-center gap-2">
                      <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      City
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Attraction
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Price (UZS)
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-emerald-100">
                {coSightseeing
                  .slice()
                  .sort((a, b) => {
                    // CO tour city order: same as ER
                    const cityOrder = { 'tashkent': 1, 'samarkand': 2, 'nurota': 3, 'bukhara': 4, 'khiva': 5 };
                    const cityA = (a.city || '').toLowerCase().trim();
                    const cityB = (b.city || '').toLowerCase().trim();
                    const orderA = cityOrder[cityA] || 999;
                    const orderB = cityOrder[cityB] || 999;
                    return orderA - orderB;
                  })
                  .map((item, index) => (
                  <tr key={item.id} className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100/50 transition-all duration-300 group">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                        <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditSightseeing(item)}
                          className="p-2.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSightseeing(item)}
                          className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 border-t-4 border-orange-300">
                  <td colSpan="3" className="px-6 py-5 text-right">
                    <span className="text-base font-bold text-white uppercase tracking-wider">Total:</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-lg">
                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                        {coSightseeing.reduce((sum, item) => {
                          const price = parseInt(item.price.replace(/\s/g, '')) || 0;
                          return sum + price;
                        }, 0).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="p-6 bg-gradient-to-r from-emerald-50 to-emerald-100 border-t border-emerald-200">
              <button
                onClick={handleAddSightseeing}
                className="w-full flex items-center justify-center gap-3 py-4 text-emerald-700 bg-white hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 hover:text-white rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span>Add Attraction</span>
              </button>
            </div>
          </div>
        ) : activeCategory === 'sightseeing' && activeSightseeingTab === 'kas' ? (
          <div className="overflow-x-auto rounded-2xl shadow-2xl border border-orange-100">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700">
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                    <div className="flex items-center justify-center gap-2">
                      <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      City
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Attraction
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Price (UZS)
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-orange-100">
                {kasSightseeing
                  .slice()
                  .sort((a, b) => {
                    // KAS tour city order: same as ER
                    const cityOrder = { 'tashkent': 1, 'samarkand': 2, 'nurota': 3, 'bukhara': 4, 'khiva': 5 };
                    const cityA = (a.city || '').toLowerCase().trim();
                    const cityB = (b.city || '').toLowerCase().trim();
                    const orderA = cityOrder[cityA] || 999;
                    const orderB = cityOrder[cityB] || 999;
                    return orderA - orderB;
                  })
                  .map((item, index) => (
                  <tr key={item.id} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/50 transition-all duration-300 group">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                        <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                        <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditSightseeing(item)}
                          className="p-2.5 text-orange-600 hover:text-white bg-orange-50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSightseeing(item)}
                          className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 border-t-4 border-orange-300">
                  <td colSpan="3" className="px-6 py-5 text-right">
                    <span className="text-base font-bold text-white uppercase tracking-wider">Total:</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-lg">
                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                        {kasSightseeing.reduce((sum, item) => {
                          const price = parseInt(item.price.replace(/\s/g, '')) || 0;
                          return sum + price;
                        }, 0).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-t border-orange-200">
              <button
                onClick={handleAddSightseeing}
                className="w-full flex items-center justify-center gap-3 py-4 text-orange-700 bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span>Add Attraction</span>
              </button>
            </div>
          </div>
        ) : activeCategory === 'sightseeing' && activeSightseeingTab === 'za' ? (
          <div className="overflow-x-auto rounded-2xl shadow-2xl border border-purple-100">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700">
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                    <div className="flex items-center justify-center gap-2">
                      <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      City
                    </div>
                  </th>
                  <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Attraction
                    </div>
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Price (UZS)
                  </th>
                  <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-purple-100">
                {zaSightseeing
                  .slice()
                  .sort((a, b) => {
                    // ZA tour city order: same as ER
                    const cityOrder = { 'tashkent': 1, 'samarkand': 2, 'nurota': 3, 'bukhara': 4, 'khiva': 5 };
                    const cityA = (a.city || '').toLowerCase().trim();
                    const cityB = (b.city || '').toLowerCase().trim();
                    const orderA = cityOrder[cityA] || 999;
                    const orderB = cityOrder[cityB] || 999;
                    return orderA - orderB;
                  })
                  .map((item, index) => (
                  <tr key={item.id} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100/50 transition-all duration-300 group">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                        <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                        <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditSightseeing(item)}
                          className="p-2.5 text-purple-600 hover:text-white bg-purple-50 hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSightseeing(item)}
                          className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 border-t-4 border-orange-300">
                  <td colSpan="3" className="px-6 py-5 text-right">
                    <span className="text-base font-bold text-white uppercase tracking-wider">Total:</span>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white shadow-lg">
                      <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                        {zaSightseeing.reduce((sum, item) => {
                          const price = parseInt(item.price.replace(/\s/g, '')) || 0;
                          return sum + price;
                        }, 0).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-t border-purple-200">
              <button
                onClick={handleAddSightseeing}
                className="w-full flex items-center justify-center gap-3 py-4 text-purple-700 bg-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
              >
                <Plus className="w-5 h-5" />
                <span>Add Attraction</span>
              </button>
            </div>
          </div>
        ) : activeCategory === 'meal' ? (
          <div>
            {/* Meal Sub-tabs */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-4 mb-6">
              <div className="flex gap-3 overflow-x-auto">
                {mealSubTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeMealTab === tab.id;
                  const colorClasses = {
                    blue: {
                      gradient: 'from-blue-500 to-blue-600',
                      shadow: 'shadow-blue-500/30',
                      ring: 'ring-blue-200',
                      hover: 'hover:from-blue-600 hover:to-blue-700'
                    },
                    emerald: {
                      gradient: 'from-emerald-500 to-emerald-600',
                      shadow: 'shadow-emerald-500/30',
                      ring: 'ring-emerald-200',
                      hover: 'hover:from-emerald-600 hover:to-emerald-700'
                    },
                    orange: {
                      gradient: 'from-orange-500 to-orange-600',
                      shadow: 'shadow-orange-500/30',
                      ring: 'ring-orange-200',
                      hover: 'hover:from-orange-600 hover:to-orange-700'
                    },
                    purple: {
                      gradient: 'from-purple-500 to-purple-600',
                      shadow: 'shadow-purple-500/30',
                      ring: 'ring-purple-200',
                      hover: 'hover:from-purple-600 hover:to-purple-700'
                    },
                  };

                  const colors = colorClasses[tab.color];

                  return (
                    <button
                      key={tab.id}
                      onClick={() => updateParams({ meal: tab.id })}
                      className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap text-sm ${
                        isActive
                          ? `bg-gradient-to-r ${colors.gradient} ${colors.hover} text-white shadow-xl ${colors.shadow} ring-2 ${colors.ring} scale-110 -translate-y-0.5`
                          : 'text-gray-600 bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meal tables content will go here */}
            {activeMealTab === 'er' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-blue-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4" />
                          Restaurant
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-100">
                    {erMeal.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditMeal(item)}
                              className="p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeal(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
                  <button
                    onClick={handleAddMeal}
                    className="w-full flex items-center justify-center gap-3 py-4 text-blue-700 bg-white hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Restaurant</span>
                  </button>
                </div>
              </div>
            )}

            {activeMealTab === 'co' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-emerald-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4" />
                          Restaurant
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-emerald-100">
                    {coMeal.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditMeal(item)}
                              className="p-2.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeal(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-emerald-50 to-emerald-100 border-t border-emerald-200">
                  <button
                    onClick={handleAddMeal}
                    className="w-full flex items-center justify-center gap-3 py-4 text-emerald-700 bg-white hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 hover:text-white rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Restaurant</span>
                  </button>
                </div>
              </div>
            )}

            {activeMealTab === 'kas' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-orange-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4" />
                          Restaurant
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-orange-100">
                    {kasMeal.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditMeal(item)}
                              className="p-2.5 text-orange-600 hover:text-white bg-orange-50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeal(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-t border-orange-200">
                  <button
                    onClick={handleAddMeal}
                    className="w-full flex items-center justify-center gap-3 py-4 text-orange-700 bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Restaurant</span>
                  </button>
                </div>
              </div>
            )}

            {activeMealTab === 'za' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-purple-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-4 h-4" />
                          Restaurant
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-purple-100">
                    {zaMeal.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditMeal(item)}
                              className="p-2.5 text-purple-600 hover:text-white bg-purple-50 hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeal(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-t border-purple-200">
                  <button
                    onClick={handleAddMeal}
                    className="w-full flex items-center justify-center gap-3 py-4 text-purple-700 bg-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Restaurant</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeCategory === 'shows' ? (
          <div>
            {/* Shows Sub-tabs */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl border-2 border-gray-100 p-4 mb-6">
              <div className="flex gap-3 overflow-x-auto">
                {showsSubTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeShowsTab === tab.id;
                  const colorClasses = {
                    blue: {
                      gradient: 'from-blue-500 to-blue-600',
                      shadow: 'shadow-blue-500/30',
                      ring: 'ring-blue-200',
                      hover: 'hover:from-blue-600 hover:to-blue-700'
                    },
                    emerald: {
                      gradient: 'from-emerald-500 to-emerald-600',
                      shadow: 'shadow-emerald-500/30',
                      ring: 'ring-emerald-200',
                      hover: 'hover:from-emerald-600 hover:to-emerald-700'
                    },
                    orange: {
                      gradient: 'from-orange-500 to-orange-600',
                      shadow: 'shadow-orange-500/30',
                      ring: 'ring-orange-200',
                      hover: 'hover:from-orange-600 hover:to-orange-700'
                    },
                    purple: {
                      gradient: 'from-purple-500 to-purple-600',
                      shadow: 'shadow-purple-500/30',
                      ring: 'ring-purple-200',
                      hover: 'hover:from-purple-600 hover:to-purple-700'
                    },
                  };

                  const colors = colorClasses[tab.color];

                  return (
                    <button
                      key={tab.id}
                      onClick={() => updateParams({ shows: tab.id })}
                      className={`flex items-center gap-2.5 px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 whitespace-nowrap text-sm ${
                        isActive
                          ? `bg-gradient-to-r ${colors.gradient} ${colors.hover} text-white shadow-xl ${colors.shadow} ring-2 ${colors.ring} scale-110 -translate-y-0.5`
                          : 'text-gray-600 bg-white hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:scale-105 shadow-md hover:shadow-lg border border-gray-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeShowsTab === 'er' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-blue-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Drama className="w-4 h-4" />
                          Show
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-blue-100">
                    {erShows.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditShow(item)}
                              className="p-2.5 text-blue-600 hover:text-white bg-blue-50 hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShow(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-blue-50 to-blue-100 border-t border-blue-200">
                  <button
                    onClick={handleAddShow}
                    className="w-full flex items-center justify-center gap-3 py-4 text-blue-700 bg-white hover:bg-gradient-to-r hover:from-blue-500 hover:to-blue-600 hover:text-white rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Show</span>
                  </button>
                </div>
              </div>
            )}

            {activeShowsTab === 'co' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-emerald-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Drama className="w-4 h-4" />
                          Show
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-emerald-100">
                    {coShows.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditShow(item)}
                              className="p-2.5 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShow(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-emerald-50 to-emerald-100 border-t border-emerald-200">
                  <button
                    onClick={handleAddShow}
                    className="w-full flex items-center justify-center gap-3 py-4 text-emerald-700 bg-white hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 hover:text-white rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Show</span>
                  </button>
                </div>
              </div>
            )}

            {activeShowsTab === 'kas' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-orange-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Drama className="w-4 h-4" />
                          Show
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-orange-100">
                    {kasShows.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditShow(item)}
                              className="p-2.5 text-orange-600 hover:text-white bg-orange-50 hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShow(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-orange-50 to-orange-100 border-t border-orange-200">
                  <button
                    onClick={handleAddShow}
                    className="w-full flex items-center justify-center gap-3 py-4 text-orange-700 bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-orange-600 hover:text-white rounded-xl border-2 border-dashed border-orange-300 hover:border-orange-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Show</span>
                  </button>
                </div>
              </div>
            )}

            {activeShowsTab === 'za' && (
              <div className="overflow-x-auto rounded-2xl shadow-2xl border border-purple-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700">
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider w-20">
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-sm">#</span>
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          City
                        </div>
                      </th>
                      <th className="px-6 py-5 text-left text-xs font-bold text-white uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Drama className="w-4 h-4" />
                          Show
                        </div>
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Price (UZS)
                      </th>
                      <th className="px-6 py-5 text-center text-xs font-bold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-purple-100">
                    {zaShows.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-purple-100/50 transition-all duration-300 group">
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform">
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                            <span className="text-sm font-semibold text-gray-800">{item.city}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="inline-flex items-center px-3 py-1 rounded-full bg-gradient-to-r from-green-50 to-green-100 border border-green-200">
                            <span className="text-sm font-bold text-green-700">{formatPrice(item.price)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditShow(item)}
                              className="p-2.5 text-purple-600 hover:text-white bg-purple-50 hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteShow(item)}
                              className="p-2.5 text-red-600 hover:text-white bg-red-50 hover:bg-gradient-to-r hover:from-red-500 hover:to-red-600 rounded-xl transition-all duration-300 shadow-md hover:shadow-xl transform hover:scale-110"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-6 bg-gradient-to-r from-purple-50 to-purple-100 border-t border-purple-200">
                  <button
                    onClick={handleAddShow}
                    className="w-full flex items-center justify-center gap-3 py-4 text-purple-700 bg-white hover:bg-gradient-to-r hover:from-purple-500 hover:to-purple-600 hover:text-white rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-semibold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Show</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-20">
            {(() => {
              const Icon = activeTab.icon;
              const colorMap = {
                blue: { iconBg: 'bg-gradient-to-br from-blue-100 to-blue-200', iconText: 'text-blue-600', ring: 'ring-blue-200' },
                sky: { iconBg: 'bg-gradient-to-br from-sky-100 to-sky-200', iconText: 'text-sky-600', ring: 'ring-sky-200' },
                indigo: { iconBg: 'bg-gradient-to-br from-indigo-100 to-indigo-200', iconText: 'text-indigo-600', ring: 'ring-indigo-200' },
                purple: { iconBg: 'bg-gradient-to-br from-purple-100 to-purple-200', iconText: 'text-purple-600', ring: 'ring-purple-200' },
                orange: { iconBg: 'bg-gradient-to-br from-orange-100 to-orange-200', iconText: 'text-orange-600', ring: 'ring-orange-200' },
                pink: { iconBg: 'bg-gradient-to-br from-pink-100 to-pink-200', iconText: 'text-pink-600', ring: 'ring-pink-200' },
                emerald: { iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-200', iconText: 'text-emerald-600', ring: 'ring-emerald-200' },
              };
              const colors = colorMap[activeTab.color];

              return (
                <div className={`w-24 h-24 ${colors.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-6 ring-4 ${colors.ring}`}>
                  <Icon className={`w-12 h-12 ${colors.iconText}`} />
                </div>
              );
            })()}
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Нет данных в {activeTab.name}
            </h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Начните добавлять расходы для этой категории
            </p>
            <button
              onClick={() => toast.success('Функционал в разработке')}
              className="inline-flex items-center gap-3 px-8 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span className="font-semibold">Добавить</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Описание
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {expense.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {expense.amount.toLocaleString()} UZS
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-900 mr-4">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-red-600 hover:text-red-900">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {activeCategory === 'route'
                    ? (editingVehicle ? 'Редактировать маршрут' : 'Добавить маршрут')
                    : (editingVehicle ? 'Редактировать транспорт' : 'Добавить транспорт')
                  }
                </h2>
              </div>
              <button
                onClick={() => setShowVehicleModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Flight Type Tabs for Plane */}
            {activeCategory === 'transport' && activeTransportTab === 'plane' && (
              <div className="flex border-b border-gray-200 bg-gray-50 rounded-t-lg -mx-8 -mt-4 mb-4">
                <button
                  onClick={() => setVehicleForm({ ...vehicleForm, flightType: 'DOMESTIC' })}
                  className={`flex-1 px-6 py-3 font-semibold transition-all ${
                    vehicleForm.flightType === 'DOMESTIC'
                      ? 'bg-white text-sky-600 border-b-2 border-sky-600'
                      : 'text-gray-600 hover:text-sky-600 hover:bg-gray-100'
                  }`}
                >
                  Ички рейс
                </button>
                <button
                  onClick={() => setVehicleForm({ ...vehicleForm, flightType: 'INTERNATIONAL' })}
                  className={`flex-1 px-6 py-3 font-semibold transition-all ${
                    vehicleForm.flightType === 'INTERNATIONAL'
                      ? 'bg-white text-sky-600 border-b-2 border-sky-600'
                      : 'text-gray-600 hover:text-sky-600 hover:bg-gray-100'
                  }`}
                >
                  Халқаро рейс
                </button>
              </div>
            )}

            <div className="space-y-6">
              {/* Train Number / Flight Number field (for train and plane) */}
              {activeCategory === 'transport' && (activeTransportTab === 'train' || activeTransportTab === 'plane') && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {activeTransportTab === 'train' ? 'Train Number' : 'Flight Number'}
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.trainNumber || ''}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, trainNumber: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    placeholder={activeTransportTab === 'train' ? '764Ф или Afrosiyob764Ф' : 'HY-101'}
                  />
                </div>
              )}

              {/* Name / Train Name / Airline field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {activeCategory === 'route' ? 'Route *' :
                   (activeTransportTab === 'train' ? 'Train Name *' :
                    activeTransportTab === 'plane' ? 'Airline *' :
                    activeTransportTab === 'metro' ? 'Name *' : 'Название *')}
                </label>
                <input
                  type="text"
                  value={activeCategory === 'route' ? vehicleForm.route : vehicleForm.name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, [activeCategory === 'route' ? 'route' : 'name']: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                  placeholder={
                    activeCategory === 'route' ? 'Tashkent' :
                    activeTransportTab === 'train' ? 'Tashkent Central → Karshi' :
                    activeTransportTab === 'plane' ? 'Uzbekistan Airways' :
                    activeTransportTab === 'metro' ? 'Tashkent Metro Line 1' :
                    'Joylong'
                  }
                />
              </div>

              {!['train', 'plane', 'metro'].includes(activeTransportTab) && activeCategory !== 'route' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    PAX
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.person}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, person: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                  />
                </div>
              )}

              {activeCategory === 'transport' && activeTransportTab.startsWith('sevil-') && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pickup / Drop-off
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.pickupDropoff}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, pickupDropoff: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        TAG Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.tagRate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, tagRate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {activeTransportTab === 'sevil-za' ? 'Jartepa Rate' : 'Urgench Rate'}
                      </label>
                      <input
                        type="number"
                        value={activeTransportTab === 'sevil-za' ? vehicleForm.jartepaRate : vehicleForm.urgenchRate}
                        onChange={(e) => setVehicleForm({
                          ...vehicleForm,
                          [activeTransportTab === 'sevil-za' ? 'jartepaRate' : 'urgenchRate']: e.target.value
                        })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>
                  </div>

                  {activeTransportTab !== 'sevil-za' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Shovot Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.shovotRate2}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, shovotRate2: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>
                  )}
                </>
              )}

              {activeCategory === 'transport' && activeTransportTab === 'xayrulla' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pickup / Drop-off
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.vstrecha}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, vstrecha: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        chimgan Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.chimgan}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, chimgan: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Tag Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.tag}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, tag: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Oybek Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.oybek}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, oybek: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Chernyayevka Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.chernyayevka}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, chernyayevka: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        City Tour Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.cityTour}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, cityTour: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeCategory === 'transport' && activeTransportTab === 'nosir' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Margilan
                    </label>
                    <input
                      type="number"
                      value={vehicleForm.margilan}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, margilan: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Qoqon
                    </label>
                    <input
                      type="number"
                      value={vehicleForm.qoqon}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, qoqon: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      dostlik
                    </label>
                    <input
                      type="number"
                      value={vehicleForm.dostlik}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, dostlik: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Toshkent
                    </label>
                    <input
                      type="number"
                      value={vehicleForm.toshkent}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, toshkent: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>
                </div>
              )}

              {activeCategory === 'transport' && activeTransportTab === 'metro' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Price
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.economPrice}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, economPrice: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    placeholder="1 400"
                  />
                </div>
              )}

              {activeCategory === 'transport' && ['train', 'plane'].includes(activeTransportTab) && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Route
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.route}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, route: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      placeholder={activeTransportTab === 'plane' ? 'Tashkent - Samarkand' : 'Tashkent- Samarkand'}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Econom Price
                      </label>
                      <input
                        type="text"
                        value={vehicleForm.economPrice}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, economPrice: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                        placeholder={activeTransportTab === 'plane' ? '450 000' : '270 000'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Business Price
                      </label>
                      <input
                        type="text"
                        value={vehicleForm.businessPrice}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, businessPrice: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                        placeholder={activeTransportTab === 'plane' ? '850 000' : '396 000'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        VIP Price
                      </label>
                      <input
                        type="text"
                        value={vehicleForm.vipPrice}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, vipPrice: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                        placeholder={activeTransportTab === 'plane' ? '1 200 000' : '600 000'}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Departure
                      </label>
                      <input
                        type="text"
                        value={vehicleForm.departure}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, departure: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                        placeholder={activeTransportTab === 'plane' ? '7:00' : '6:33'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Arrival
                      </label>
                      <input
                        type="text"
                        value={vehicleForm.arrival}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, arrival: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                        placeholder={activeTransportTab === 'plane' ? '8:15' : '8:46'}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeCategory === 'route' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      PAX
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.person}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, person: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="e.g., 9-20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Provider
                      </label>
                      <select
                        value={vehicleForm.choiceTab}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, choiceTab: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300 bg-white"
                      >
                        <option value="">Выберите транспорт</option>
                        <option value="sevil-er">Sevil ER</option>
                        <option value="sevil-co">Sevil CO</option>
                        <option value="sevil-kas">Sevil KAS</option>
                        <option value="sevil-za">Sevil ZA</option>
                        <option value="xayrulla">Xayrulla</option>
                        <option value="nosir">Nosir</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Option Rate
                      </label>
                      <select
                        value={vehicleForm.choiceRate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, choiceRate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300 bg-white"
                        disabled={!vehicleForm.choiceTab}
                      >
                        <option value="">Выберите rate</option>
                        {vehicleForm.choiceTab === 'sevil-za' && [
                          <option key="tagRate" value="tagRate">TAG Rate</option>,
                          <option key="jartepaRate" value="jartepaRate">Jartepa Rate</option>
                        ]}
                        {vehicleForm.choiceTab?.startsWith('sevil-') && vehicleForm.choiceTab !== 'sevil-za' && [
                          <option key="tagRate" value="tagRate">TAG Rate</option>,
                          <option key="urgenchRate" value="urgenchRate">Urgench Rate</option>,
                          <option key="shovotRate2" value="shovotRate2">Shovot Rate</option>
                        ]}
                        {vehicleForm.choiceTab === 'xayrulla' && [
                          <option key="chimgan" value="chimgan">chimgan Rate</option>,
                          <option key="tag" value="tag">Tag Rate</option>
                        ]}
                        {vehicleForm.choiceTab === 'nosir' && [
                          <option key="margilan" value="margilan">Margilan</option>,
                          <option key="qoqon" value="qoqon">Qoqon</option>,
                          <option key="dostlik" value="dostlik">dostlik</option>,
                          <option key="toshkent" value="toshkent">Toshkent</option>
                        ]}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Transport Type
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.transportType}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, transportType: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="Transport Type"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Price
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.price}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, price: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="150 000"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowVehicleModal(false)}
                className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveVehicle}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-medium"
              >
                {editingVehicle ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sightseeing Modal */}
      {showSightseeingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingSightseeing ? 'Edit Attraction' : 'Add Attraction'}
              </h2>
              <button
                onClick={() => setShowSightseeingModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attraction Name *
                </label>
                <input
                  type="text"
                  value={sightseeingForm.name}
                  onChange={(e) => setSightseeingForm({ ...sightseeingForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Registan Square"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={sightseeingForm.city}
                  onChange={(e) => setSightseeingForm({ ...sightseeingForm, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Samarkand"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (UZS)
                </label>
                <input
                  type="text"
                  value={sightseeingForm.price}
                  onChange={(e) => setSightseeingForm({ ...sightseeingForm, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. 100 000"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSightseeingModal(false)}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSightseeing}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                {editingSightseeing ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meal Modal */}
      {showMealModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingMeal ? 'Edit Restaurant' : 'Add Restaurant'}
              </h2>
              <button
                onClick={() => setShowMealModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant Name *
                </label>
                <input
                  type="text"
                  value={mealForm.name}
                  onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g. Caravan Restaurant"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={mealForm.city}
                  onChange={(e) => setMealForm({ ...mealForm, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g. Tashkent"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (UZS)
                </label>
                <input
                  type="text"
                  value={mealForm.price}
                  onChange={(e) => setMealForm({ ...mealForm, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="e.g. 150 000"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMealModal(false)}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMeal}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                {editingMeal ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shows Modal */}
      {showShowsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingShow ? 'Edit Show' : 'Add Show'}
              </h2>
              <button
                onClick={() => setShowShowsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Show Name *
                </label>
                <input
                  type="text"
                  value={showForm.name}
                  onChange={(e) => setShowForm({ ...showForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Folklore Show at Nadir Divan-Begi"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={showForm.city}
                  onChange={(e) => setShowForm({ ...showForm, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. Bukhara"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (UZS)
                </label>
                <input
                  type="text"
                  value={showForm.price}
                  onChange={(e) => setShowForm({ ...showForm, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g. 80 000"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowShowsModal(false)}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShow}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                {editingShow ? 'Save' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
