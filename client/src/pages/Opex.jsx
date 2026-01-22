import { useState, useEffect } from 'react';
import { Wallet, Plus, Edit, Trash2, Search, Bus, Eye, Coffee, Drama, Navigation, Users, Car, Train, Plane, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = [
  { id: 'transport', name: 'Transport', icon: Bus, color: 'blue', hasSubTabs: true },
  { id: 'sightseeing', name: 'Sightseeing', icon: Eye, color: 'purple' },
  { id: 'meal', name: 'Meal', icon: Coffee, color: 'orange' },
  { id: 'shows', name: 'Shows', icon: Drama, color: 'indigo' },
  { id: 'guide', name: 'Guide', icon: Users, color: 'emerald' },
];

const transportSubTabs = [
  { id: 'sevil', name: 'Sevil', icon: Car, color: 'blue' },
  { id: 'xayrulla', name: 'Xayrulla', icon: Car, color: 'cyan' },
  { id: 'nosir', name: 'Nosir', icon: Car, color: 'teal' },
  { id: 'train', name: 'Train', icon: Train, color: 'violet' },
  { id: 'plane', name: 'Plane', icon: Plane, color: 'sky' },
  { id: 'metro', name: 'Metro', icon: Navigation, color: 'emerald' },
];

export default function Opex() {
  const [activeCategory, setActiveCategory] = useState('transport');
  const [activeTransportTab, setActiveTransportTab] = useState('sevil');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Sevil vehicles data
  const [sevilVehicles, setSevilVehicles] = useState(() => {
    const saved = localStorage.getItem('sevilVehicles');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: 1, name: 'Joylong', seats: '', person: '', pickupDropoff: '', tagRate: 50, urgenchRate: 110, shovotRate2: 60 },
      { id: 2, name: 'Coster', seats: '', person: '', pickupDropoff: '', tagRate: 40, urgenchRate: 120, shovotRate2: '' },
      { id: 3, name: 'Yutong 33', seats: '', person: '', pickupDropoff: '', tagRate: 50, urgenchRate: 160, shovotRate2: 120 },
    ];
  });

  // Xayrulla vehicles data
  const [xayrullaVehicles, setXayrullaVehicles] = useState(() => {
    const saved = localStorage.getItem('xayrullaVehicles');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: 1, name: 'Joylong', seats: '30', person: '', vstrecha: '', chimgan: 120, tag: 90 },
      { id: 2, name: 'Sprinter', seats: '', person: '', vstrecha: '', chimgan: 150, tag: '' },
      { id: 3, name: 'Yutong 33', seats: '45', person: '', vstrecha: '', chimgan: 220, tag: 130 },
    ];
  });

  // Nosir vehicles data
  const [nosirVehicles, setNosirVehicles] = useState(() => {
    const saved = localStorage.getItem('nosirVehicles');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      { id: 1, name: 'PKW', seats: '', person: '', margilan: '', qoqon: 20, dostlik: 60, toshkent: 170, extra: 60 },
      { id: 2, name: 'Starex', seats: '', person: '', margilan: 30, qoqon: 100, dostlik: 100, toshkent: 120, extra: '' },
      { id: 3, name: 'Staria', seats: '', person: '', margilan: 40, qoqon: 120, dostlik: 120, toshkent: 140, extra: '' },
      { id: 4, name: 'Kinglong', seats: '', person: '', margilan: 50, qoqon: 130, dostlik: 130, toshkent: '', extra: '' },
      { id: 5, name: 'Sprinter', seats: '', person: '', margilan: 170, qoqon: 160, dostlik: 160, toshkent: '', extra: '' },
      { id: 6, name: 'Yutong 33', seats: '', person: '', margilan: 100, qoqon: 220, dostlik: 220, toshkent: '', extra: '' },
    ];
  });

  // Metro vehicles data
  const [metroVehicles, setMetroVehicles] = useState([
    { id: 1, name: 'Tashkent Metro Line 1', economPrice: '1 400' },
    { id: 2, name: 'Tashkent Metro Line 2', economPrice: '1 400' },
    { id: 3, name: 'Tashkent Metro Line 3', economPrice: '1 400' },
  ]);

  // Train vehicles data
  const [trainVehicles, setTrainVehicles] = useState([
    { id: 1, name: 'Afrosiyob764Ф (CKPCT) Tashkent Central → Karshi', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '6:33', arrival: '8:46' },
    { id: 2, name: 'Afrosiyob766Ф (CKPCT) Tashkent Central → Bukhara', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '7:30', arrival: '9:49' },
    { id: 3, name: 'Afrosiyob768Ф (CKPCT) Tashkent Central → Samarkand', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '8:00', arrival: '10:25' },
    { id: 4, name: 'Afrosiyob770Ф (CKPCT) Tashkent Central → Bukhara', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '8:30', arrival: '10:49' },
    { id: 5, name: 'Sharq710Ф (CKPCT) Tashkent Central → Bukhara', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '8:30', arrival: '10:49' },
    { id: 6, name: 'Nasaf716Ф (CKPCT) Tashkent Central → Karshi', route: 'Tashkent- Samarkand', economPrice: '270 000', businessPrice: '396 000', departure: '8:30', arrival: '10:49' },
  ]);

  // Plane vehicles data
  const [planeVehicles, setPlaneVehicles] = useState([
    { id: 1, name: 'Uzbekistan Airways HY-101', route: 'Tashkent - Samarkand', economPrice: '450 000', businessPrice: '850 000', departure: '7:00', arrival: '8:15' },
    { id: 2, name: 'Uzbekistan Airways HY-102', route: 'Tashkent - Bukhara', economPrice: '480 000', businessPrice: '900 000', departure: '9:30', arrival: '10:50' },
    { id: 3, name: 'Uzbekistan Airways HY-103', route: 'Tashkent - Urgench', economPrice: '520 000', businessPrice: '950 000', departure: '11:00', arrival: '12:30' },
  ]);

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
    // Xayrulla fields
    vstrecha: '',
    chimgan: '',
    tag: '',
    // Nosir fields
    margilan: '',
    qoqon: '',
    dostlik: '',
    toshkent: '',
    // Train fields
    route: '',
    economPrice: '',
    businessPrice: '',
    departure: '',
    arrival: '',
    // Route fields
    transportType: '',
    choiceTab: '',
    choiceRate: '',
    price: '',
    // Person field for routes - reusing person field
  });

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      name: '',
      seats: '',
      person: '',
      pickupDropoff: '',
      tagRate: '',
      urgenchRate: '',
      shovotRate2: '',
      vstrecha: '',
      chimgan: '',
      tag: '',
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
      price: ''
    });
    setShowVehicleModal(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setVehicleForm({
      name: vehicle.name || vehicle.route || '',
      seats: vehicle.seats || '',
      person: vehicle.person || '',
      pickupDropoff: vehicle.pickupDropoff || '',
      tagRate: vehicle.tagRate || '',
      urgenchRate: vehicle.urgenchRate || '',
      shovotRate2: vehicle.shovotRate2 || '',
      vstrecha: vehicle.vstrecha || '',
      chimgan: vehicle.chimgan || '',
      tag: vehicle.tag || '',
      margilan: vehicle.margilan || '',
      qoqon: vehicle.qoqon || '',
      dostlik: vehicle.dostlik || '',
      toshkent: vehicle.toshkent || '',
      route: vehicle.route || '',
      economPrice: vehicle.economPrice || '',
      businessPrice: vehicle.businessPrice || '',
      departure: vehicle.departure || '',
      arrival: vehicle.arrival || '',
      transportType: vehicle.transportType || '',
      choiceTab: vehicle.choiceTab || '',
      choiceRate: vehicle.choiceRate || '',
      price: vehicle.price || ''
    });
    setShowVehicleModal(true);
  };

  const handleDeleteVehicle = (vehicleId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот транспорт?')) {
      if (activeCategory === 'transport') {
        if (activeTransportTab === 'metro') {
          setMetroVehicles(metroVehicles.filter(v => v.id !== vehicleId));
        } else if (activeTransportTab === 'train') {
          setTrainVehicles(trainVehicles.filter(v => v.id !== vehicleId));
        } else if (activeTransportTab === 'plane') {
          setPlaneVehicles(planeVehicles.filter(v => v.id !== vehicleId));
        } else if (activeTransportTab === 'xayrulla') {
          setXayrullaVehicles(xayrullaVehicles.filter(v => v.id !== vehicleId));
        } else if (activeTransportTab === 'nosir') {
          setNosirVehicles(nosirVehicles.filter(v => v.id !== vehicleId));
        } else {
          setSevilVehicles(sevilVehicles.filter(v => v.id !== vehicleId));
        }
      }
      toast.success('Транспорт удален');
    }
  };

  const handleSaveVehicle = () => {
    if (!vehicleForm.name) {
      toast.error('Введите название транспорта');
      return;
    }

    let vehicles, setVehicles;
    if (activeCategory === 'transport') {
      if (activeTransportTab === 'metro') {
        vehicles = metroVehicles;
        setVehicles = setMetroVehicles;
      } else if (activeTransportTab === 'train') {
        vehicles = trainVehicles;
        setVehicles = setTrainVehicles;
      } else if (activeTransportTab === 'plane') {
        vehicles = planeVehicles;
        setVehicles = setPlaneVehicles;
      } else if (activeTransportTab === 'xayrulla') {
        vehicles = xayrullaVehicles;
        setVehicles = setXayrullaVehicles;
      } else if (activeTransportTab === 'nosir') {
        vehicles = nosirVehicles;
        setVehicles = setNosirVehicles;
      } else {
        vehicles = sevilVehicles;
        setVehicles = setSevilVehicles;
      }
    }

    if (editingVehicle) {
      // Update existing vehicle
      setVehicles(vehicles.map(v =>
        v.id === editingVehicle.id
          ? { ...v, ...vehicleForm }
          : v
      ));
      toast.success('Транспорт обновлен');
    } else {
      // Add new vehicle
      const newVehicle = {
        id: Math.max(...vehicles.map(v => v.id), 0) + 1,
        ...vehicleForm
      };
      setVehicles([...vehicles, newVehicle]);
      toast.success('Транспорт добавлен');
    }

    setShowVehicleModal(false);
  };

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('sevilVehicles', JSON.stringify(sevilVehicles));
  }, [sevilVehicles]);

  useEffect(() => {
    localStorage.setItem('xayrullaVehicles', JSON.stringify(xayrullaVehicles));
  }, [xayrullaVehicles]);

  useEffect(() => {
    localStorage.setItem('nosirVehicles', JSON.stringify(nosirVehicles));
  }, [nosirVehicles]);

  useEffect(() => {
    localStorage.setItem('trainVehicles', JSON.stringify(trainVehicles));
  }, [trainVehicles]);

  useEffect(() => {
    localStorage.setItem('planeVehicles', JSON.stringify(planeVehicles));
  }, [planeVehicles]);

  useEffect(() => {
    localStorage.setItem('metroVehicles', JSON.stringify(metroVehicles));
  }, [metroVehicles]);

  useEffect(() => {
    loadExpenses();
  }, [activeCategory, activeTransportTab, activeRouteTab]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const category = activeCategory === 'transport' ? activeTransportTab : activeCategory;
      // const response = await opexApi.getByCategory(category);
      // setExpenses(response.data.expenses);
      setExpenses([]);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const filteredExpenses = expenses.filter(expense =>
    expense.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeTab = categories.find(c => c.id === activeCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl blur-lg opacity-50"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">OPEX</h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Операционные расходы</p>
          </div>
        </div>

        <button
          onClick={() => {
            if ((activeCategory === 'transport' && ['sevil', 'xayrulla', 'nosir', 'metro', 'train', 'plane'].includes(activeTransportTab)) ||
                (activeCategory === 'route' && ['er', 'co', 'kas', 'za'].includes(activeRouteTab))) {
              handleAddVehicle();
            } else {
              toast.info('Функционал в разработке');
            }
          }}
          className="relative group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 rounded-xl blur opacity-0 group-hover:opacity-30 transition-opacity"></div>
          <Plus className="w-5 h-5 relative" />
          <span className="relative font-medium">
            {(activeCategory === 'transport' && ['sevil', 'xayrulla', 'nosir', 'metro', 'train', 'plane'].includes(activeTransportTab)) ||
             (activeCategory === 'route' && ['er', 'co', 'kas', 'za'].includes(activeRouteTab)) ? 'Добавить транспорт' : 'Добавить расход'}
          </span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl border border-gray-200 p-3">
        <div className="flex gap-3 overflow-x-auto ">
          {categories.map((category) => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;

            const colorMap = {
              blue: { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-blue-600', iconBg: 'bg-blue-100', hoverBg: 'hover:bg-blue-50' },
              sky: { bg: 'bg-gradient-to-r from-sky-500 to-sky-600', text: 'text-sky-600', iconBg: 'bg-sky-100', hoverBg: 'hover:bg-sky-50' },
              indigo: { bg: 'bg-gradient-to-r from-indigo-500 to-indigo-600', text: 'text-indigo-600', iconBg: 'bg-indigo-100', hoverBg: 'hover:bg-indigo-50' },
              purple: { bg: 'bg-gradient-to-r from-purple-500 to-purple-600', text: 'text-purple-600', iconBg: 'bg-purple-100', hoverBg: 'hover:bg-purple-50' },
              orange: { bg: 'bg-gradient-to-r from-orange-500 to-orange-600', text: 'text-orange-600', iconBg: 'bg-orange-100', hoverBg: 'hover:bg-orange-50' },
              pink: { bg: 'bg-gradient-to-r from-pink-500 to-pink-600', text: 'text-pink-600', iconBg: 'bg-pink-100', hoverBg: 'hover:bg-pink-50' },
              emerald: { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-emerald-600', iconBg: 'bg-emerald-100', hoverBg: 'hover:bg-emerald-50' },
            };

            const colors = colorMap[category.color];

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`group relative flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold transition-all duration-300 whitespace-nowrap ${
                  isActive
                    ? `${colors.bg} text-white shadow-lg hover:shadow-xl scale-105`
                    : `text-gray-600 ${colors.hoverBg} hover:scale-105`
                }`}
              >
                <div className={`${isActive ? 'bg-white/20' : colors.iconBg} p-1.5 rounded-lg transition-all duration-300`}>
                  <Icon className="w-5 h-5" />
                </div>
                {category.name}
                {isActive && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 bg-white rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transport Sub-Tabs */}
      {activeCategory === 'transport' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-2.5">
          <div className="flex gap-2 overflow-x-auto ">
            {transportSubTabs.map((subTab) => {
              const Icon = subTab.icon;
              const isActive = activeTransportTab === subTab.id;

              const colorMap = {
                blue: { bg: 'bg-blue-500', ring: 'ring-blue-200' },
                cyan: { bg: 'bg-cyan-500', ring: 'ring-cyan-200' },
                teal: { bg: 'bg-teal-500', ring: 'ring-teal-200' },
                violet: { bg: 'bg-violet-500', ring: 'ring-violet-200' },
                sky: { bg: 'bg-sky-500', ring: 'ring-sky-200' },
                emerald: { bg: 'bg-emerald-500', ring: 'ring-emerald-200' },
                pink: { bg: 'bg-pink-500', ring: 'ring-pink-200' },
              };

              const colors = colorMap[subTab.color];

              return (
                <button
                  key={subTab.id}
                  onClick={() => setActiveTransportTab(subTab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 whitespace-nowrap text-sm ${
                    isActive
                      ? `${colors.bg} text-white shadow-md ring-2 ${colors.ring} scale-105`
                      : 'text-gray-600 hover:bg-gray-100 hover:scale-105'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {subTab.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-5">
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"></div>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-primary-500 transition-colors z-10" />
          <input
            type="text"
            placeholder={`Поиск в ${activeTab.name}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="relative w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {activeCategory === 'transport' && activeTransportTab === 'xayrulla' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Seats
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Pickup / Drop-off
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    chimgan Rate
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Tag Rate
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {xayrullaVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.seats || '-'}
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
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'nosir' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Seats
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Margilan
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Qoqon
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    dostlik
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Toshkent
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {nosirVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.seats || '-'}
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
                  <td colSpan="8" className="px-6 py-4">
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
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'metro' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metroVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <Navigation className="w-10 h-10 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-600 font-semibold mb-1">Нет данных</p>
                          <p className="text-gray-400 text-sm">Начните добавлять транспорт</p>
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
                  metroVehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
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
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'plane' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider" colSpan="2">
                    Preis
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Econom
                  </th>
                  <th className="px-6 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {planeVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <Plane className="w-10 h-10 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-600 font-semibold mb-1">Нет данных</p>
                          <p className="text-gray-400 text-sm">Начните добавлять транспорт</p>
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
                  ))
                )}
                {planeVehicles.length > 0 && (
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
                )}
              </tbody>
            </table>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'train' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider" colSpan="2">
                    Preis
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Departure
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Arrival
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Econom
                  </th>
                  <th className="px-6 py-2 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                  <th className="px-6 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trainVehicles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                          <Train className="w-10 h-10 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-gray-600 font-semibold mb-1">Нет данных</p>
                          <p className="text-gray-400 text-sm">Начните добавлять транспорт</p>
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
                  ))
                )}
                {trainVehicles.length > 0 && (
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
                )}
              </tbody>
            </table>
          </div>
        ) : activeCategory === 'transport' && activeTransportTab === 'sevil' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Seats
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Pickup / Drop-off
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    TAG Rate
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Urgench Rate
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Shovot Rate
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sevilVehicles.map((vehicle) => (
                  <tr key={vehicle.id} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border-b border-gray-100">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {vehicle.seats || '-'}
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
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.urgenchRate || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {vehicle.shovotRate2 || '-'}
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
                  <td colSpan="8" className="px-6 py-4">
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
              onClick={() => toast.info('Функционал в разработке')}
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

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {activeCategory === 'route' ? 'Route *' : (['train', 'plane', 'metro'].includes(activeTransportTab) ? 'Name *' : 'Название *')}
                </label>
                <input
                  type="text"
                  value={activeCategory === 'route' ? vehicleForm.route : vehicleForm.name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, [activeCategory === 'route' ? 'route' : 'name']: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                  placeholder={
                    activeCategory === 'route' ? 'Tashkent' :
                    activeTransportTab === 'train' ? 'Afrosiyob764Ф (CKPCT) Tashkent Central → Karshi' :
                    activeTransportTab === 'plane' ? 'Uzbekistan Airways HY-101' :
                    activeTransportTab === 'metro' ? 'Tashkent Metro Line 1' :
                    'Joylong'
                  }
                />
              </div>

              {!['train', 'plane', 'metro'].includes(activeTransportTab) && activeCategory !== 'route' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Seats
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.seats}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, seats: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Person
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.person}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, person: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                    />
                  </div>
                </div>
              )}

              {activeCategory === 'transport' && activeTransportTab === 'sevil' && (
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
                        Urgench Rate
                      </label>
                      <input
                        type="number"
                        value={vehicleForm.urgenchRate}
                        onChange={(e) => setVehicleForm({ ...vehicleForm, urgenchRate: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      />
                    </div>
                  </div>

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

                  <div className="grid grid-cols-2 gap-4">
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
                      Person
                    </label>
                    <input
                      type="text"
                      value={vehicleForm.person}
                      onChange={(e) => setVehicleForm({ ...vehicleForm, person: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:border-gray-300"
                      placeholder="Person"
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
                        <option value="sevil">Sevil</option>
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
                        {vehicleForm.choiceTab === 'sevil' && [
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
    </div>
  );
}
