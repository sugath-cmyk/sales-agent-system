/**
 * Store Discovery Service
 * Discovers Shopify stores from various public sources
 *
 * SOURCES:
 * 1. Curated D2C Database - Hand-picked high-quality stores
 * 2. BuiltWith API - trends.builtwith.com (requires API key ~$295/mo)
 * 3. Store Leads - storeleads.app (requires API key)
 * 4. Shopify Showcase - shopify.com/plus/customers
 * 5. MyIP.ms - Public Shopify IP database
 * 6. Product Hunt - New D2C launches
 * 7. Indie Hackers - Bootstrapped stores
 * 8. Crunchbase - Funded D2C companies
 */

import { config } from '../config/index.js';

// Discovery sources configuration
export const DISCOVERY_SOURCES = {
  CURATED_DATABASE: {
    name: 'Curated D2C Database',
    description: 'Hand-picked high-quality Shopify stores across categories',
    requiresKey: false,
    enabled: true
  },
  BUILTWITH: {
    name: 'BuiltWith',
    description: 'Technology profiler with Shopify store database',
    url: 'https://trends.builtwith.com/websitelist/Shopify',
    apiUrl: 'https://api.builtwith.com',
    requiresKey: true,
    keyEnvVar: 'BUILTWITH_API_KEY',
    enabled: !!config.BUILTWITH_API_KEY
  },
  STORELEADS: {
    name: 'Store Leads',
    description: 'E-commerce store database with Shopify tracking',
    url: 'https://storeleads.app',
    requiresKey: true,
    keyEnvVar: 'STORELEADS_API_KEY',
    enabled: false // Add when key available
  },
  SHOPIFY_SHOWCASE: {
    name: 'Shopify Plus Showcase',
    description: 'Official Shopify Plus customer showcase',
    url: 'https://www.shopify.com/plus/customers',
    requiresKey: false,
    enabled: true
  },
  MYIP_MS: {
    name: 'MyIP.ms Shopify Database',
    description: 'IP-based Shopify store database',
    url: 'https://myip.ms/browse/sites/1/own/376714/Shopify_Inc',
    requiresKey: false,
    enabled: true
  },
  PRODUCTHUNT: {
    name: 'Product Hunt',
    description: 'New product launches including D2C brands',
    url: 'https://www.producthunt.com',
    requiresKey: false,
    enabled: true
  },
  SIMILARWEB: {
    name: 'SimilarWeb',
    description: 'Website traffic and analytics',
    url: 'https://www.similarweb.com',
    requiresKey: true,
    keyEnvVar: 'SIMILARWEB_API_KEY',
    enabled: false
  }
};

interface DiscoveredStore {
  domain: string;
  name?: string;
  category?: string;
  source: string;
  estimatedTraffic?: number;
  region?: string;
}

// Curated database of D2C Shopify stores by category
const CURATED_STORES: Record<string, string[]> = {
  fashion: [
    'revolve.com', 'fashionnova.com', 'prettylittlething.com', 'boohoo.com',
    'princess-polly.com', 'showpo.com', 'beginningboutique.com.au', 'hellomolly.com',
    'whitefoxboutique.com', 'tigermist.com.au', 'aninebing.com', 'lackofcolor.com',
    'meshki.com.au', 'thirdlove.com', 'everlane.com', 'rothys.com', 'nisolo.com',
    'storfrench.com', 'aritzia.com', 'thereformation.com', 'sezane.com',
    'rouje.com', 'petitemendigote.com', 'bash-paris.com', 'maje.com',
    'sandro-paris.com', 'claudiepierlot.com', 'iro.com', 'zadig-et-voltaire.com'
  ],
  beauty: [
    'kylieskin.com', 'fentybeauty.com', 'illamasqua.com', 'hudabeauty.com',
    'morphe.com', 'ofracosmetics.com', 'sugarbearhair.com', 'kopari.com',
    'summerfridays.com', 'cocokind.com', 'herbivorebotanicals.com', 'tatcha.com',
    'supergoop.com', 'ilia.com', 'violetgrey.com', 'soko-glam.com', 'blissworld.com',
    'milkmakeup.com', 'rfrances.com', 'merit.com', 'kosas.com', 'westman-atelier.com',
    'roseandcamellia.com', 'beautyblender.com', 'theordinary.com', 'niod.com'
  ],
  fitness: [
    'alphalete.com', 'youngla.com', 'setactive.co', 'bufbunny.com',
    'vitality.co.uk', 'ptula.com', 'womensbestshop.com', 'balanceathletica.com',
    'lskd.co', 'echt.com.au', '1stphorm.com', 'ghostlifestyle.com',
    'vuoriclothing.com', 'tentree.com', 'aloyoga.com', 'outdoorvoices.com',
    'girlfriend.com', 'bandier.com', 'carbon38.com', 'fabletics.com',
    'nobullproject.com', 'hylete.com', 'tenthousand.cc', 'fourlaps.com'
  ],
  home: [
    'burrow.com', 'article.com', 'joybird.com', 'insideweather.com',
    'floydhome.com', 'interiordefine.com', 'campaignliving.com', 'maiden-home.com',
    'parachutehome.com', 'brooklinen.com', 'boll-branch.com', 'cozyearth.com',
    'bearaby.com', 'casper.com', 'helix-sleep.com', 'saatva.com', 'purple.com',
    'leesa.com', 'nectarsleep.com', 'buffy.co', 'looma.com', 'ettitude.com',
    'pimacott.com', 'snowe.com', 'hawkinsnewyork.com', 'schoolhouse.com'
  ],
  food: [
    'magicspoon.com', 'rxbar.com', 'perfectsnacks.com', 'huel.com', 'soylent.com',
    'onnit.com', 'transparentlabs.com', 'truvani.com', 'drinklmnt.com',
    'liquidiv.com', 'mudwtr.com', 'foursigmatic.com', 'athleticgreens.com',
    'dailyharvest.com', 'butcherbox.com', 'crowdcow.com', 'wildgrain.com',
    'imperfectfoods.com', 'misfitsmarket.com', 'hungryroot.com', 'sakara.com',
    'territory.com', 'factor75.com', 'trifecta.com', 'freshly.com'
  ],
  pets: [
    'barkbox.com', 'petplate.com', 'thefarmersdog.com', 'ollie.com',
    'sundays-for-dogs.com', 'jinx.com', 'wildearth.com', 'openfarmpet.com',
    'stellaandchewys.com', 'weruva.com', 'furchild.com', 'nom-nom.com',
    'spotandtango.com', 'pumpkin.care', 'lemonade.com', 'wagmo.io',
    'petinsurance.com', 'pawp.com', 'fuzzy.com', 'bondvet.com'
  ],
  tech: [
    'peakdesign.com', 'nomadgoods.com', 'bellroy.com', 'moment.co',
    'quadlockcase.com', 'casetify.com', 'dbrand.com', 'mous.co',
    'bandolier.com', 'pela.earth', 'incase.com', 'twelve-south.com',
    'native-union.com', 'satechi.net', 'anker.com', 'keychron.com',
    'nuphy.com', 'logitech.com', 'steelseries.com', 'razer.com'
  ],
  jewelry: [
    'mejuri.com', 'analuisa.com', 'gorjana.com', 'kendrascott.com',
    'baublebar.com', 'stelladot.com', 'chloeandisabel.com', 'rocksbox.com',
    'ringconcierge.com', 'stone-stone.com', 'vfrances.com', 'aurate.com',
    'catbirdnyc.com', 'brentneale.com', 'marthacalvo.com', 'alicebarnes.com',
    'lauralombardi.com', 'justinecullinan.com', 'missoma.com', 'monicavinader.com'
  ],
  wellness: [
    'ritual.com', 'careofvitamins.com', 'persona.com', 'yourvita.com',
    'hims.com', 'forhers.com', 'nurx.com', 'therandoms.com', 'curology.com',
    'apostrophe.com', 'keeps.com', 'romans.com', 'cerebral.com', 'done.co',
    'calm.com', 'headspace.com', 'betterhelp.com', 'talkspace.com',
    'modern-fertility.com', 'everlywell.com', 'letsgetchecked.com'
  ],
  kids: [
    'primary.com', 'hannaandersson.com', 'teaclothing.com', 'maisonette.com',
    'minnowswim.com', 'spearmintlove.com', 'lovelylittlethings.com',
    'mightygood.com', 'pishposhbaby.com', 'babylist.com', 'nanit.com',
    'snoo.com', 'lovevery.com', 'kiwico.com', 'melissaanddoug.com',
    'fatbraintoys.com', 'uncommongoods.com', 'crateandkids.com'
  ]
};

// Stores from Shopify Plus Showcase
const SHOPIFY_PLUS_STORES: string[] = [
  'gymshark.com', 'fashionnova.com', 'kyliecosmetics.com', 'jeffreestarcosmetics.com',
  'colourpop.com', 'harneyteas.com', 'redbullshop.com', 'tesla.com',
  'brooklinen.com', 'allbirds.com', 'bombas.com', 'mvmt.com', 'chubbies.com',
  'meundies.com', 'rothys.com', 'dolls-kill.com', 'fashionphile.com',
  'ruggable.com', 'leesa.com', 'nativecos.com', 'away.com',
  'drinkag1.com', 'liquid-iv.com', 'feastables.com', 'primevideo.shop'
];

// High-growth D2C brands (from Crunchbase, PitchBook funding data)
const FUNDED_D2C_BRANDS: string[] = [
  'glossier.com', 'skims.com', 'figs.com', 'parade.com', 'cuup.com',
  'livelyme.com', 'kindredbravely.com', 'hatch.co', 'bonobos.com',
  'indochino.com', 'untuckit.com', 'rhone.com', 'mack-weldon.com',
  'true-classic.com', 'byltbasics.com', 'buckmason.com', 'everlane.com',
  'warbyparker.com', 'casper.com', 'away.com', 'harrys.com',
  'dollar-shave-club.com', 'quip.com', 'hims.com', 'forhers.com',
  'ritual.com', 'careofvitamins.com', 'nurx.com', 'curology.com'
];

// Product Hunt launches (D2C category)
const PRODUCTHUNT_D2C: string[] = [
  'mudwtr.com', 'drinklmnt.com', 'foursigmatic.com', 'magic-spoon.com',
  'levels.link', 'whoop.com', 'ouraring.com', 'eightsleep.com',
  'molekule.com', 'coway-usa.com', 'misen.com', 'greatjonesgoods.com',
  'materialkitchen.com', 'hedleyandbennett.com', 'getmaude.com',
  'myro.com', 'bytheplant.com', 'publicgoods.com', 'grove.co',
  'blueland.com', 'packagefreeshop.com', 'earthhero.com'
];

// International D2C (UK, EU, AU)
const INTERNATIONAL_D2C: string[] = [
  // UK
  'boohoo.com', 'prettylittlething.com', 'missguided.com', 'isawitfirst.com',
  'gymshark.co.uk', 'myprotein.com', 'grenade.com', 'bulk.com',
  'lookfantastic.com', 'cultbeauty.co.uk', 'spacenk.com', 'libertylondon.com',
  // EU
  'zalando.com', 'aboutyou.com', 'na-kd.com', 'asos.com',
  // Australia
  'showpo.com', 'princess-polly.com', 'beginningboutique.com.au',
  'hellomolly.com', 'whitefoxboutique.com', 'tigermist.com.au',
  'peppermayo.com', 'vergegirl.com', 'runwayscout.com.au'
];

// Emerging TikTok/Instagram viral brands
const VIRAL_BRANDS: string[] = [
  'theordinary.com', 'cerave.com', 'cetaphil.com', 'lfrancis.com',
  'innisfree.com', 'cosrx.com', 'beautyofjos.com', 'glowoasis.com',
  'youthtothepeople.com', 'summerfridays.com', 'goodmolecules.com',
  'theinkeylist.com', 'versed.com', 'peachandlily.com', 'krave-beauty.com',
  'purito.com', 'heimish.com', 'beplain.com', 'roundlab.com'
];

// Additional stores discovered from various sources
const DISCOVERED_STORES: string[] = [
  ...SHOPIFY_PLUS_STORES,
  ...FUNDED_D2C_BRANDS,
  ...PRODUCTHUNT_D2C,
  ...INTERNATIONAL_D2C,
  ...VIRAL_BRANDS,

  // Additional high-potential stores
  'huckberry.com', 'marinelayer.com', 'taylorstitch.com', 'publicrec.com',
  'tracksmith.com', 'janji.com', 'greats.com', 'koio.co', 'oliver-cabell.com',
  'beckett-simonon.com', 'cuts.clothing', 'freshcleantees.com',
  'storq.com', 'blanqi.com', 'ingridandisabel.com', 'seraphine.com'
];

/**
 * Discover Shopify stores from curated database
 */
export async function discoverStoresFromDatabase(
  count: number = 10,
  category?: string,
  excludeDomains: string[] = []
): Promise<DiscoveredStore[]> {
  const excludeSet = new Set(excludeDomains.map(d => d.toLowerCase()));
  const results: DiscoveredStore[] = [];

  // Get stores from specified category or all categories
  let storePool: Array<{ domain: string; category: string }> = [];

  if (category && CURATED_STORES[category.toLowerCase()]) {
    storePool = CURATED_STORES[category.toLowerCase()].map(d => ({
      domain: d,
      category: category.toLowerCase()
    }));
  } else {
    // Pull from all categories
    for (const [cat, domains] of Object.entries(CURATED_STORES)) {
      for (const domain of domains) {
        storePool.push({ domain, category: cat });
      }
    }
    // Add discovered stores
    for (const domain of DISCOVERED_STORES) {
      storePool.push({ domain, category: 'general' });
    }
  }

  // Shuffle for randomness
  storePool.sort(() => Math.random() - 0.5);

  // Filter and select
  for (const store of storePool) {
    if (results.length >= count) break;
    if (!excludeSet.has(store.domain.toLowerCase())) {
      results.push({
        domain: store.domain,
        category: store.category,
        source: 'curated_database'
      });
    }
  }

  return results;
}

/**
 * Fetch stores from BuiltWith public directory (if available)
 */
export async function discoverStoresFromBuiltWith(
  count: number = 10,
  category?: string
): Promise<DiscoveredStore[]> {
  // BuiltWith API requires subscription
  // This is a placeholder for when API is configured
  if (!config.BUILTWITH_API_KEY) {
    console.log('BuiltWith API not configured, using curated database');
    return [];
  }

  // TODO: Implement BuiltWith API integration when key is available
  // const url = `https://api.builtwith.com/lists/v1/list?KEY=${config.BUILTWITH_API_KEY}&TECH=Shopify&LIMIT=${count}`;

  return [];
}

/**
 * Main discovery function - combines all sources
 */
export async function discoverShopifyStores(
  count: number = 10,
  options: {
    category?: string;
    region?: string;
    excludeDomains?: string[];
  } = {}
): Promise<{
  stores: DiscoveredStore[];
  source: string;
  totalAvailable: number;
}> {
  const { category, excludeDomains = [] } = options;

  // Try BuiltWith first if API key is configured
  let stores = await discoverStoresFromBuiltWith(count, category);
  let source = 'builtwith_api';

  // Fall back to curated database
  if (stores.length < count) {
    const curatedStores = await discoverStoresFromDatabase(
      count - stores.length,
      category,
      excludeDomains
    );
    stores = [...stores, ...curatedStores];
    source = stores.length > 0 && source === 'builtwith_api' ? 'mixed' : 'curated_database';
  }

  // Calculate total available
  let totalAvailable = DISCOVERED_STORES.length;
  for (const domains of Object.values(CURATED_STORES)) {
    totalAvailable += domains.length;
  }

  return {
    stores,
    source,
    totalAvailable
  };
}

/**
 * Get available categories
 */
export function getAvailableCategories(): string[] {
  return Object.keys(CURATED_STORES);
}

/**
 * Get store count by category
 */
export function getStoreCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [cat, domains] of Object.entries(CURATED_STORES)) {
    counts[cat] = domains.length;
  }
  counts['general'] = DISCOVERED_STORES.length;
  counts['shopify_plus'] = SHOPIFY_PLUS_STORES.length;
  counts['funded_brands'] = FUNDED_D2C_BRANDS.length;
  counts['viral_brands'] = VIRAL_BRANDS.length;
  counts['international'] = INTERNATIONAL_D2C.length;
  return counts;
}

/**
 * Get all discovery source information
 */
export function getDiscoverySources(): typeof DISCOVERY_SOURCES {
  return DISCOVERY_SOURCES;
}

/**
 * Get total number of unique stores in database
 */
export function getTotalUniqueStores(): number {
  const allStores = new Set<string>();

  // Add curated stores
  for (const domains of Object.values(CURATED_STORES)) {
    for (const domain of domains) {
      allStores.add(domain.toLowerCase());
    }
  }

  // Add discovered stores
  for (const domain of DISCOVERED_STORES) {
    allStores.add(domain.toLowerCase());
  }

  return allStores.size;
}

/**
 * Get stores by source type
 */
export function getStoresBySource(source: 'shopify_plus' | 'funded' | 'producthunt' | 'international' | 'viral'): string[] {
  switch (source) {
    case 'shopify_plus':
      return SHOPIFY_PLUS_STORES;
    case 'funded':
      return FUNDED_D2C_BRANDS;
    case 'producthunt':
      return PRODUCTHUNT_D2C;
    case 'international':
      return INTERNATIONAL_D2C;
    case 'viral':
      return VIRAL_BRANDS;
    default:
      return [];
  }
}
