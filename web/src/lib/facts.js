// Single source of numbers for the app, the spreadsheet and the documents.
// `npm run facts` writes this object to ../data/facts.json for the Python builders.

export const FACTS = {
  // Measured on the reference application (brief, pages 2 and 12).
  reference: {
    targetRate: 6, // buckets per minute, client requirement
    testedRate: { 5: 8.6, 13: 7.4 }, // buckets per minute at FAT
    perPallet: { 5: 100, 13: 44 },
    positionsPerCell: 2,
    cellsInstalled: 2,
    deliveryMonths: 4,
    operatorsPerShiftBefore: 2,
  },
  // UR20 datasheet.
  robot: {
    payloadKg: 20,
    payloadExtendedKg: 25, // only under the manual's boundary conditions
    reachMm: 1750,
    nativeNetworks: ['PROFINET', 'EtherNet/IP', 'Modbus TCP'],
  },
  // Team assumptions, all editable.
  assumptions: {
    gripperKg: 4,
    shiftHours: 8,
    minSwapMinutes: 3, // below this an operator cannot keep up with pallet swaps
    nearFormatKg: [3, 15],
  },
  // Financial scenario given by the organisers (EUR, without VAT).
  finance: {
    year: 2027,
    promoBudget: 30000,
    price: 130000,
    directCost: 110000,
    targetNetProfit: 300000,
    taxRate: 0.16, // assumption: Romanian profit tax in 2026, to confirm for 2027
    plannedCells: 22,
  },
  // Promotion budget for the plan year; must total finance.promoBudget, each cost once.
  budget: [
    { id: 'content', name: 'Conținut UR20: studiu de caz, video, foto', eur: 5000 },
    { id: 'web', name: 'Pagină + instrument de verificare + SEO/AI + măsurare', eur: 4500 },
    { id: 'google', name: 'Google Search', eur: 5000 },
    { id: 'linkedin', name: 'LinkedIn (promovare plătită)', eur: 5000 },
    { id: 'direct', name: 'Marketing direct și CRM (listă, mesaje, follow-up)', eur: 3500 },
    { id: 'events', name: 'Demonstrații, webinare, parteneriate', eur: 3500 },
    { id: 'video', name: 'YouTube și teste sociale', eur: 1000 },
    { id: 'ai', name: 'Abonamente AI declarate', eur: 500 },
    { id: 'reserve', name: 'Rezervă pentru realocare', eur: 2000 },
  ],
  // Team estimates for the funnel, all editable in the spreadsheet.
  funnel: {
    cellsPerClient: 1.8,
    requestToMeeting: 0.6,
    meetingToOffer: 0.6,
    offerToOrder: 0.35,
    lastOrderMonth: 8, // orders signed after August are not delivered in the year
  },
  site: { url: 'https://matty27100.github.io/paletcheck-ur20/' },
  hubs: [
    { id: 'DD', name: 'Dragomirești-Deal', lat: 44.47, lon: 25.97 },
    { id: 'IS', name: 'Iași', lat: 47.16, lon: 27.59 },
    { id: 'TM', name: 'Timișoara', lat: 45.75, lon: 21.23 },
  ],
};

// County seats, approximate coordinates, used only to pick the nearest Tech-Con hub.
export const COUNTIES = [
  ['AB', 'Alba', 46.07, 23.58],
  ['AR', 'Arad', 46.18, 21.31],
  ['AG', 'Argeș', 44.86, 24.87],
  ['BC', 'Bacău', 46.57, 26.91],
  ['BH', 'Bihor', 47.06, 21.93],
  ['BN', 'Bistrița-Năsăud', 47.13, 24.49],
  ['BT', 'Botoșani', 47.75, 26.67],
  ['BV', 'Brașov', 45.66, 25.61],
  ['BR', 'Brăila', 45.27, 27.96],
  ['B', 'București', 44.43, 26.1],
  ['BZ', 'Buzău', 45.15, 26.82],
  ['CS', 'Caraș-Severin', 45.3, 21.89],
  ['CL', 'Călărași', 44.2, 27.33],
  ['CJ', 'Cluj', 46.77, 23.59],
  ['CT', 'Constanța', 44.18, 28.63],
  ['CV', 'Covasna', 45.86, 25.79],
  ['DB', 'Dâmbovița', 44.93, 25.46],
  ['DJ', 'Dolj', 44.32, 23.8],
  ['GL', 'Galați', 45.44, 28.05],
  ['GR', 'Giurgiu', 43.9, 25.97],
  ['GJ', 'Gorj', 45.04, 23.27],
  ['HR', 'Harghita', 46.36, 25.8],
  ['HD', 'Hunedoara', 45.88, 22.91],
  ['IL', 'Ialomița', 44.56, 27.36],
  ['IS', 'Iași', 47.16, 27.59],
  ['IF', 'Ilfov', 44.56, 25.95],
  ['MM', 'Maramureș', 47.66, 23.58],
  ['MH', 'Mehedinți', 44.63, 22.66],
  ['MS', 'Mureș', 46.54, 24.56],
  ['NT', 'Neamț', 46.93, 26.37],
  ['OT', 'Olt', 44.43, 24.36],
  ['PH', 'Prahova', 44.94, 26.03],
  ['SM', 'Satu Mare', 47.79, 22.89],
  ['SJ', 'Sălaj', 47.19, 23.06],
  ['SB', 'Sibiu', 45.79, 24.15],
  ['SV', 'Suceava', 47.65, 26.26],
  ['TR', 'Teleorman', 43.97, 25.33],
  ['TM', 'Timiș', 45.75, 21.23],
  ['TL', 'Tulcea', 45.18, 28.8],
  ['VS', 'Vaslui', 46.64, 27.73],
  ['VL', 'Vâlcea', 45.1, 24.37],
  ['VN', 'Vrancea', 45.7, 27.18],
];
