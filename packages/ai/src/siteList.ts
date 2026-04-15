export interface KnownSite {
  domain: string;
  testUrl: string;
  region: string;   // e.g. 'US', 'UK', 'France', 'Germany', 'Italy', 'Spain', 'Nordic', 'Benelux', 'Eastern Europe', 'Greek', 'Portugal', 'Baltic', 'Asia', 'India', 'Middle East', 'Australia/NZ', 'Canada', 'Latin America', 'International'
  language: string; // ISO-ish: 'en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'hu', 'ro', 'hr', 'el', 'et'
  cuisine?: string; // 'Asian', 'Indian', 'Middle Eastern', 'Mediterranean', 'Baking', 'French', 'Italian', 'Japanese', 'Korean', 'Thai', 'Chinese'
}

export const KNOWN_RECIPE_SITES: KnownSite[] = [
  // === MAJOR US RECIPE SITES ===
  { domain: 'allrecipes.com', testUrl: 'https://www.allrecipes.com/recipe/213742/meatball-nirvana/', region: 'US', language: 'en' },
  { domain: 'foodnetwork.com', testUrl: 'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592', region: 'US', language: 'en' },
  { domain: 'epicurious.com', testUrl: 'https://www.epicurious.com/recipes/food/views/classic-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'bonappetit.com', testUrl: 'https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'food52.com', testUrl: 'https://food52.com/recipes/82275-the-best-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'seriouseats.com', testUrl: 'https://www.seriouseats.com/the-best-chocolate-chip-cookies-recipe', region: 'US', language: 'en' },
  { domain: 'cooking.nytimes.com', testUrl: 'https://cooking.nytimes.com/recipes/1018684-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'tasty.co', testUrl: 'https://tasty.co/recipe/the-best-chewy-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'delish.com', testUrl: 'https://www.delish.com/cooking/recipe-ideas/a20088581/best-chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'simplyrecipes.com', testUrl: 'https://www.simplyrecipes.com/recipes/chocolate_chip_cookies/', region: 'US', language: 'en' },
  { domain: 'thekitchn.com', testUrl: 'https://www.thekitchn.com/how-to-make-the-best-chocolate-chip-cookies-cooking-lessons-from-the-kitchn-58056', region: 'US', language: 'en' },
  { domain: 'smittenkitchen.com', testUrl: 'https://smittenkitchen.com/2008/07/consummate-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'halfbakedharvest.com', testUrl: 'https://www.halfbakedharvest.com/brown-butter-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'minimalistbaker.com', testUrl: 'https://minimalistbaker.com/vegan-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'cookingclassy.com', testUrl: 'https://www.cookingclassy.com/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'sallysbakingaddiction.com', testUrl: 'https://sallysbakingaddiction.com/chocolate-chip-cookies/', region: 'US', language: 'en', cuisine: 'Baking' },
  { domain: 'budgetbytes.com', testUrl: 'https://www.budgetbytes.com/homemade-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'ohsheglows.com', testUrl: 'https://ohsheglows.com/2016/10/17/my-favourite-vegan-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'pinchofyum.com', testUrl: 'https://pinchofyum.com/the-best-soft-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'skinnytaste.com', testUrl: 'https://www.skinnytaste.com/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'marthastewart.com', testUrl: 'https://www.marthastewart.com/338185/soft-and-chewy-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'eatingwell.com', testUrl: 'https://www.eatingwell.com/recipe/251015/healthier-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'cookinglight.com', testUrl: 'https://www.cookinglight.com/recipes/chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'wholefoodsmarket.com', testUrl: 'https://www.wholefoodsmarket.com/recipes/classic-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'bettycrocker.com', testUrl: 'https://www.bettycrocker.com/recipes/ultimate-chocolate-chip-cookies/77c14e03-d8b0-4844-846d-f19304f61c57', region: 'US', language: 'en' },
  { domain: 'kingarthurbaking.com', testUrl: 'https://www.kingarthurbaking.com/recipes/chocolate-chip-cookies-recipe', region: 'US', language: 'en', cuisine: 'Baking' },
  { domain: 'tasteofhome.com', testUrl: 'https://www.tasteofhome.com/recipes/chewy-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'cooksillustrated.com', testUrl: 'https://www.cooksillustrated.com/recipes/1313-perfect-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'ambitiouskitchen.com', testUrl: 'https://www.ambitiouskitchen.com/the-best-chewy-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'loveandlemons.com', testUrl: 'https://www.loveandlemons.com/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'cookieandkate.com', testUrl: 'https://cookieandkate.com/classic-chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'damndelicious.net', testUrl: 'https://damndelicious.net/2018/12/17/brown-butter-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'spendwithpennies.com', testUrl: 'https://www.spendwithpennies.com/best-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'thepioneerwoman.com', testUrl: 'https://www.thepioneerwoman.com/food-cooking/recipes/a32202986/chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'yummly.com', testUrl: 'https://www.yummly.com/recipe/Chocolate-chip-cookies-9080583', region: 'US', language: 'en' },
  { domain: 'myrecipes.com', testUrl: 'https://www.myrecipes.com/recipe/classic-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'bakerbynature.com', testUrl: 'https://bakerbynature.com/best-ever-chocolate-chip-cookies/', region: 'US', language: 'en', cuisine: 'Baking' },
  { domain: 'onceuponachef.com', testUrl: 'https://www.onceuponachef.com/recipes/chocolate-chip-cookies.html', region: 'US', language: 'en' },
  { domain: 'barefootcontessa.com', testUrl: 'https://barefootcontessa.com/recipes/overnight-mac-and-cheese', region: 'US', language: 'en' },
  { domain: 'thespruceeats.com', testUrl: 'https://www.thespruceeats.com/classic-chocolate-chip-cookies-recipe-520375', region: 'US', language: 'en' },
  { domain: 'gimmesomeoven.com', testUrl: 'https://www.gimmesomeoven.com/best-chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'twopeasandtheirpod.com', testUrl: 'https://www.twopeasandtheirpod.com/the-best-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'browneyedbaker.com', testUrl: 'https://www.browneyedbaker.com/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'bakingmischief.com', testUrl: 'https://bakingmischief.com/best-chocolate-chip-cookies-recipe/', region: 'US', language: 'en', cuisine: 'Baking' },
  { domain: 'averiecooks.com', testUrl: 'https://www.averiecooks.com/best-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'dinneratthezoo.com', testUrl: 'https://www.dinneratthezoo.com/chocolate-chip-cookie-recipe/', region: 'US', language: 'en' },
  { domain: 'iambaker.net', testUrl: 'https://iambaker.net/best-chocolate-chip-cookies/', region: 'US', language: 'en', cuisine: 'Baking' },
  { domain: 'crazyforcrust.com', testUrl: 'https://www.crazyforcrust.com/best-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'jocooks.com', testUrl: 'https://www.jocooks.com/recipes/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'natashaskitchen.com', testUrl: 'https://natashaskitchen.com/chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'wellplated.com', testUrl: 'https://www.wellplated.com/easy-chicken-soup/', region: 'US', language: 'en' },
  { domain: 'cafedelites.com', testUrl: 'https://cafedelites.com/perfect-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'therecipecritic.com', testUrl: 'https://therecipecritic.com/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'recipetineats.com', testUrl: 'https://www.recipetineats.com/chicken-noodle-soup/', region: 'Australia/NZ', language: 'en' },
  { domain: 'foodandwine.com', testUrl: 'https://www.foodandwine.com/recipes/perfect-roast-chicken', region: 'US', language: 'en' },
  { domain: 'saveur.com', testUrl: 'https://www.saveur.com/classic-chocolate-chip-cookies-recipe/', region: 'US', language: 'en' },
  { domain: 'americastestkitchen.com', testUrl: 'https://www.americastestkitchen.com/recipes/8335-perfect-chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'healthyrecipes101.com', testUrl: 'https://healthyrecipes101.com/recipes/chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'ifoodreal.com', testUrl: 'https://ifoodreal.com/healthy-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'downshiftology.com', testUrl: 'https://downshiftology.com/recipes/almond-flour-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'wholesomeyum.com', testUrl: 'https://www.wholesomeyum.com/almond-flour-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'thepioneerwoman.com', testUrl: 'https://www.thepioneerwoman.com/food-cooking/recipes/a11822/classic-chocolate-chip-cookies/', region: 'US', language: 'en' },
  { domain: 'theurbanpoacher.com', testUrl: 'https://theurbanpoacher.com/recipes/chocolate-chip-cookies', region: 'US', language: 'en' },

  // === UK & IRELAND ===
  { domain: 'bbcgoodfood.com', testUrl: 'https://www.bbcgoodfood.com/recipes/ultimate-chocolate-chip-cookies', region: 'UK', language: 'en' },
  { domain: 'jamieoliver.com', testUrl: 'https://www.jamieoliver.com/recipes/chocolate-recipes/jamies-easy-chocolate-cookies/', region: 'UK', language: 'en' },
  { domain: 'nigella.com', testUrl: 'https://www.nigella.com/recipes/totally-chocolate-chocolate-chip-cookies', region: 'UK', language: 'en' },
  { domain: 'deliciousmagazine.co.uk', testUrl: 'https://www.deliciousmagazine.co.uk/recipes/chocolate-chip-cookies/', region: 'UK', language: 'en' },
  { domain: 'olivemagazine.com', testUrl: 'https://www.olivemagazine.com/recipes/baking-and-desserts/chocolate-chip-cookies/', region: 'UK', language: 'en' },
  { domain: 'greatbritishchefs.com', testUrl: 'https://www.greatbritishchefs.com/recipes/chocolate-chip-cookies-recipe', region: 'UK', language: 'en' },
  { domain: 'lovefood.com', testUrl: 'https://www.lovefood.com/recipes/63041/chocolatechip-cookies-recipe', region: 'UK', language: 'en' },
  { domain: 'waitrose.com', testUrl: 'https://www.waitrose.com/home/recipes/recipe_directory/c/chocolate_chipcookies.html', region: 'UK', language: 'en' },
  { domain: 'goodhousekeeping.com', testUrl: 'https://www.goodhousekeeping.com/food-recipes/a5045/cookies-r168961/', region: 'UK', language: 'en' },
  { domain: 'goodfood.com.au', testUrl: 'https://www.goodfood.com.au/recipes/choc-chip-cookies-20131031-2wj8u', region: 'Australia/NZ', language: 'en' },

  // === AUSTRALIA & NZ ===
  { domain: 'taste.com.au', testUrl: 'https://www.taste.com.au/recipes/classic-choc-chip-cookies/f83e7b4f-5a94-4a69-9b76-0eea9a39ba25', region: 'Australia/NZ', language: 'en' },
  { domain: 'womensweeklyfood.com.au', testUrl: 'https://www.womensweeklyfood.com.au/recipe/baking/chocolate-chip-cookies-27973/', region: 'Australia/NZ', language: 'en' },
  { domain: 'australiangoodtaste.com.au', testUrl: 'https://www.australiangoodtaste.com.au/recipes/choc-chip-cookies', region: 'Australia/NZ', language: 'en' },

  // === CANADA ===
  { domain: 'foodnetwork.ca', testUrl: 'https://www.foodnetwork.ca/recipe/chocolate-chip-cookies/', region: 'Canada', language: 'en' },
  { domain: 'canadianliving.com', testUrl: 'https://www.canadianliving.com/food/baking-and-desserts/recipe/chocolate-chip-cookies', region: 'Canada', language: 'en' },
  { domain: 'chatelaine.com', testUrl: 'https://www.chatelaine.com/recipe/baking-desserts/chocolate-chip-cookies/', region: 'Canada', language: 'en' },
  { domain: 'ricardocuisine.com', testUrl: 'https://www.ricardocuisine.com/en/recipes/1028-chocolate-chip-cookies', region: 'Canada', language: 'en' },

  // === FRANCE (French) ===
  { domain: 'marmiton.org', testUrl: 'https://www.marmiton.org/recettes/recette_cookies-aux-pepites-de-chocolat_13892.aspx', region: 'France', language: 'fr' },
  { domain: 'cuisineaz.com', testUrl: 'https://www.cuisineaz.com/recettes/cookies-aux-pepites-de-chocolat-18875.aspx', region: 'France', language: 'fr' },
  { domain: '750g.com', testUrl: 'https://www.750g.com/cookies-aux-pepites-de-chocolat-r13892.htm', region: 'France', language: 'fr' },
  { domain: 'ptitchef.com', testUrl: 'https://www.ptitchef.com/recettes/dessert/cookies-aux-pepites-de-chocolat-fid-5757', region: 'France', language: 'fr' },
  { domain: 'cuisineactuelle.fr', testUrl: 'https://www.cuisineactuelle.fr/recettes/cookies-aux-pepites-de-chocolat-329706', region: 'France', language: 'fr' },
  { domain: 'femmeactuelle.fr', testUrl: 'https://www.femmeactuelle.fr/cuisine/recettes/cookies-chocolat-23596', region: 'France', language: 'fr' },
  { domain: 'linternaute.com', testUrl: 'https://www.linternaute.com/recette/25038-cookies-aux-pepites-de-chocolat/', region: 'France', language: 'fr' },
  { domain: 'journaldesfemmes.fr', testUrl: 'https://cuisine.journaldesfemmes.fr/recette/305987-cookies-aux-pepites-de-chocolat', region: 'France', language: 'fr' },
  { domain: 'papillesetpupilles.fr', testUrl: 'https://www.papillesetpupilles.fr/2019/09/cookies-aux-pepites-de-chocolat.html/', region: 'France', language: 'fr' },
  { domain: 'chefsimon.com', testUrl: 'https://chefsimon.com/recettes/cookies-aux-pepites-de-chocolat', region: 'France', language: 'fr' },
  { domain: 'hervecuisine.com', testUrl: 'https://www.hervecuisine.com/recette/cookies-pepites-chocolat-recette-rapide/', region: 'France', language: 'fr' },
  { domain: 'recettes.de', testUrl: 'https://www.recettes.de/cookies-au-chocolat', region: 'France', language: 'fr' },
  { domain: 'elle.fr', testUrl: 'https://www.elle.fr/Elle-a-Table/Recettes-de-cuisine/Cookies-aux-pepites-de-chocolat-1912553', region: 'France', language: 'fr' },

  // === SPAIN (Spanish) ===
  { domain: 'recetasgratis.net', testUrl: 'https://www.recetasgratis.net/receta-de-galletas-con-chispas-de-chocolate-56788.html', region: 'Spain', language: 'es' },
  { domain: 'hogarmania.com', testUrl: 'https://www.hogarmania.com/cocina/recetas/postres/galletas-chocolate-21312.html', region: 'Spain', language: 'es' },
  { domain: 'pequerecetas.com', testUrl: 'https://www.pequerecetas.com/receta/galletas-con-pepitas-de-chocolate/', region: 'Spain', language: 'es' },
  { domain: 'recetasderechupete.com', testUrl: 'https://www.recetasderechupete.com/galletas-de-chocolate-tipicas-americanas/1772/', region: 'Spain', language: 'es' },
  { domain: 'directoalpaladar.com', testUrl: 'https://www.directoalpaladar.com/postres/como-hacer-las-mejores-galletas-de-chocolate-receta-americana', region: 'Spain', language: 'es' },
  { domain: 'webosfritos.es', testUrl: 'https://webosfritos.es/2015/12/cookies-de-chocolate/', region: 'Spain', language: 'es' },
  { domain: 'cocinafacil.com', testUrl: 'https://www.cocinafacil.com.mx/recetas/receta-de-galletas-con-chispas-de-chocolate/', region: 'Spain', language: 'es' },
  { domain: 'elcomidista.elpais.com', testUrl: 'https://elcomidista.elpais.com/elcomidista/2018/12/13/receta/1544700989_783451.html', region: 'Spain', language: 'es' },
  { domain: 'javirecetas.com', testUrl: 'https://www.javirecetas.com/cookies-de-chocolate-receta-americana/', region: 'Spain', language: 'es' },
  { domain: 'mis-recetas.org', testUrl: 'https://mis-recetas.org/recetas/show/33810-galletas-de-chocolate', region: 'Spain', language: 'es' },

  // === LATIN AMERICA (Spanish) ===
  { domain: 'mexicoinmykitchen.com', testUrl: 'https://www.mexicoinmykitchen.com/chocolate-chip-cookies/', region: 'Latin America', language: 'es' },
  { domain: 'kiwilimon.com', testUrl: 'https://www.kiwilimon.com/receta/postres/galletas/galletas-con-chispas-de-chocolate', region: 'Latin America', language: 'es' },
  { domain: 'recetas.com.mx', testUrl: 'https://www.recetas.com.mx/recetas/galletas-con-chispas-de-chocolate', region: 'Latin America', language: 'es' },
  { domain: 'isabeleats.com', testUrl: 'https://www.isabeleats.com/mexican-chocolate-chip-cookies/', region: 'Latin America', language: 'es' },
  { domain: 'laylita.com', testUrl: 'https://www.laylita.com/recetas/galletas-de-chocolate-y-coco/', region: 'Latin America', language: 'es' },

  // === ITALY (Italian) ===
  { domain: 'giallozafferano.it', testUrl: 'https://ricette.giallozafferano.it/Biscotti-cookies-al-cioccolato.html', region: 'Italy', language: 'it' },
  { domain: 'cucchiaio.it', testUrl: 'https://www.cucchiaio.it/ricetta/ricetta-cookies-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'lacucinaitaliana.it', testUrl: 'https://www.lacucinaitaliana.it/ricetta/dolci/cookies-al-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'agrodolce.it', testUrl: 'https://www.agrodolce.it/ricette/cookies-al-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'fattoincasadabenedetta.it', testUrl: 'https://www.fattoincasadabenedetta.it/ricetta/cookies-americani/', region: 'Italy', language: 'it' },
  { domain: 'tavolartegusto.it', testUrl: 'https://www.tavolartegusto.it/ricetta/cookies-gocce-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'ricette.it', testUrl: 'https://www.ricette.it/ricetta/cookies-al-cioccolato', region: 'Italy', language: 'it' },
  { domain: 'sale-pepe.it', testUrl: 'https://www.salepepe.it/ricette/dolci/biscotti-crostate/cookies-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'finedininglovers.com', testUrl: 'https://www.finedininglovers.com/recipe/chocolate-chip-cookies', region: 'Italy', language: 'en' },
  { domain: 'gnamgnam.it', testUrl: 'https://gnamgnam.it/ricetta/cookies-gocce-cioccolato/', region: 'Italy', language: 'it' },
  { domain: 'mysia.it', testUrl: 'https://www.misya.info/ricetta/cookies-americani.htm', region: 'Italy', language: 'it' },
  { domain: 'blog.giallozafferano.it', testUrl: 'https://blog.giallozafferano.it/ricettedinonnacri/cookies-americani/', region: 'Italy', language: 'it' },
  { domain: 'buttalapasta.it', testUrl: 'https://ricette.buttalapasta.it/ricetta/cookies-americani/', region: 'Italy', language: 'it' },

  // === GERMANY / AUSTRIA / SWITZERLAND (German) ===
  { domain: 'chefkoch.de', testUrl: 'https://www.chefkoch.de/rezepte/1061031209951433/Chocolate-Chip-Cookies.html', region: 'Germany', language: 'de' },
  { domain: 'lecker.de', testUrl: 'https://www.lecker.de/rezept/2744406/american-chocolate-chip-cookies.html', region: 'Germany', language: 'de' },
  { domain: 'essen-und-trinken.de', testUrl: 'https://www.essen-und-trinken.de/rezepte/57994-rzpt-chocolate-chip-cookies', region: 'Germany', language: 'de' },
  { domain: 'kochbar.de', testUrl: 'https://www.kochbar.de/rezept/346568/Chocolate-Chip-Cookies.html', region: 'Germany', language: 'de' },
  { domain: 'einfachkochen.at', testUrl: 'https://www.einfachkochen.at/rezept/chocolate-chip-cookies', region: 'Austria', language: 'de' },
  { domain: 'gutekueche.at', testUrl: 'https://www.gutekueche.at/chocolate-chip-cookies-rezept-10132', region: 'Austria', language: 'de' },
  { domain: 'gutekueche.ch', testUrl: 'https://www.gutekueche.ch/chocolate-chip-cookies-rezept-1856', region: 'Switzerland', language: 'de' },
  { domain: 'springlane.de', testUrl: 'https://www.springlane.de/magazin/rezeptideen/chocolate-chip-cookies/', region: 'Germany', language: 'de' },
  { domain: 'kuechengoetter.de', testUrl: 'https://www.kuechengoetter.de/rezepte/chocolate-chip-cookies-amerikanische-schokokekse-29080', region: 'Germany', language: 'de' },
  { domain: 'eatsmarter.de', testUrl: 'https://eatsmarter.de/rezepte/chocolate-chip-cookies', region: 'Germany', language: 'de' },
  { domain: 'kuechentraum.de', testUrl: 'https://www.kuechentraum24.de/magazin/amerikanische-chocolate-chip-cookies/', region: 'Germany', language: 'de' },
  { domain: 'daskochrezept.de', testUrl: 'https://www.daskochrezept.de/rezepte/chocolate-chip-cookies', region: 'Germany', language: 'de' },
  { domain: 'backenmachtgluecklich.de', testUrl: 'https://www.backenmachtgluecklich.de/rezepte/chocolate-chip-cookies.html', region: 'Germany', language: 'de' },

  // === NORDIC ===
  { domain: 'matprat.no', testUrl: 'https://www.matprat.no/oppskrifter/tradisjon/sjokoladecookies/', region: 'Nordic', language: 'no' },
  { domain: 'godt.no', testUrl: 'https://www.godt.no/oppskrifter/cookies-med-sjokoladebiter', region: 'Nordic', language: 'no' },
  { domain: 'valdemarsro.dk', testUrl: 'https://www.valdemarsro.dk/amerikanske-cookies/', region: 'Nordic', language: 'da' },
  { domain: 'foodculture.dk', testUrl: 'https://foodculture.dk/opskrifter/chocolate-chip-cookies/', region: 'Nordic', language: 'da' },
  { domain: 'arla.se', testUrl: 'https://www.arla.se/recept/chocolate-chip-cookies/', region: 'Nordic', language: 'sv' },
  { domain: 'tasteline.com', testUrl: 'https://www.tasteline.com/recept/chocolate-chip-cookies/', region: 'Nordic', language: 'sv' },
  { domain: 'recepten.se', testUrl: 'https://www.recepten.se/recept/chocolate_chip_cookies.html', region: 'Nordic', language: 'sv' },
  { domain: 'ica.se', testUrl: 'https://www.ica.se/recept/chocolate-chip-cookies-724003/', region: 'Nordic', language: 'sv' },
  { domain: 'koket.se', testUrl: 'https://www.koket.se/chocolate-chip-cookies', region: 'Nordic', language: 'sv' },
  { domain: 'maku.fi', testUrl: 'https://www.maku.fi/reseptit/amerikan-suklaakeksit', region: 'Nordic', language: 'fi' },
  { domain: 'valio.fi', testUrl: 'https://www.valio.fi/reseptit/suklaakeksit/', region: 'Nordic', language: 'fi' },
  { domain: 'k-ruoka.fi', testUrl: 'https://www.k-ruoka.fi/reseptit/amerikkalaiset-suklaakeksit', region: 'Nordic', language: 'fi' },
  { domain: 'kotikokki.net', testUrl: 'https://www.kotikokki.net/reseptit/nayta/112420/Suklaakeksit/', region: 'Nordic', language: 'fi' },
  { domain: 'mat.se', testUrl: 'https://mat.se/recept/chocolate-chip-cookies', region: 'Nordic', language: 'sv' },

  // === BENELUX ===
  { domain: 'allerhande.nl', testUrl: 'https://www.ah.nl/allerhande/recept/R-R1190727/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: 'ah.nl', testUrl: 'https://www.ah.nl/allerhande/recept/R-R1190727/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: 'leukerecepten.nl', testUrl: 'https://www.leukerecepten.nl/recepten/chocolate-chip-cookies/', region: 'Benelux', language: 'nl' },
  { domain: 'smulweb.nl', testUrl: 'https://www.smulweb.nl/recepten/1729878/Chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: 'culy.nl', testUrl: 'https://www.culy.nl/recepten/chocolate-chip-cookies/', region: 'Benelux', language: 'nl' },
  { domain: 'libelle-lekker.be', testUrl: 'https://www.libelle-lekker.be/bekijk-recept/5001/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: 'njam.tv', testUrl: 'https://njam.tv/recepten/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: '15gram.be', testUrl: 'https://15gram.be/recepten/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },
  { domain: 'dagelijksekost.een.be', testUrl: 'https://dagelijksekost.vrt.be/recepten/chocoladekoekjes', region: 'Benelux', language: 'nl' },
  { domain: 'lekkervanbijons.be', testUrl: 'https://www.lekkervanbijons.be/recepten/chocolate-chip-cookies', region: 'Benelux', language: 'nl' },

  // === EASTERN EUROPE ===
  { domain: 'kwestiasmaku.com', testUrl: 'https://www.kwestiasmaku.com/przepis/ciasteczka-z-kawalkami-czekolady', region: 'Eastern Europe', language: 'pl' },
  { domain: 'aniagotuje.pl', testUrl: 'https://www.aniagotuje.pl/przepis/amerykanskie-ciasteczka-chocolate-chip-cookies', region: 'Eastern Europe', language: 'pl' },
  { domain: 'przepisy.pl', testUrl: 'https://www.przepisy.pl/przepis/amerykanskie-ciasteczka-z-kawalkami-czekolady', region: 'Eastern Europe', language: 'pl' },
  { domain: 'doradcasmaku.pl', testUrl: 'https://www.doradcasmaku.pl/przepis-ciasteczka-z-czekolada-chocolate-chip-cookies-540017', region: 'Eastern Europe', language: 'pl' },
  { domain: 'mojewypieki.com', testUrl: 'https://www.mojewypieki.com/przepis/chocolate-chip-cookies', region: 'Eastern Europe', language: 'pl' },
  { domain: 'toprecepty.cz', testUrl: 'https://www.toprecepty.cz/recept/13488-americke-susenky-chocolate-chip-cookies/', region: 'Eastern Europe', language: 'cs' },
  { domain: 'vareni.cz', testUrl: 'https://www.vareni.cz/recepty/americke-cookies-s-cokoladou/', region: 'Eastern Europe', language: 'cs' },
  { domain: 'recepty.cz', testUrl: 'https://www.recepty.cz/recept/cokoladove-cookies-180847', region: 'Eastern Europe', language: 'cs' },
  { domain: 'nosalty.hu', testUrl: 'https://www.nosalty.hu/recept/amerikai-csokolades-keksz', region: 'Eastern Europe', language: 'hu' },
  { domain: 'mindmegette.hu', testUrl: 'https://www.mindmegette.hu/amerikai-csokolades-keksz.recept/', region: 'Eastern Europe', language: 'hu' },
  { domain: 'femina.hu', testUrl: 'https://femina.hu/recept/amerikai-csokolades-keksz/', region: 'Eastern Europe', language: 'hu' },
  { domain: 'jamilacuisine.ro', testUrl: 'https://jamilacuisine.ro/fursecuri-cu-bucatele-de-ciocolata/', region: 'Eastern Europe', language: 'ro' },
  { domain: 'lauralaurentiu.ro', testUrl: 'https://www.lauralaurentiu.ro/retete-culinare/retete-dulciuri/biscuiti-cookies-cu-ciocolata.html', region: 'Eastern Europe', language: 'ro' },
  { domain: 'bucataras.ro', testUrl: 'https://www.bucataras.ro/retete/biscuiti-cu-ciocolata-cookies.html', region: 'Eastern Europe', language: 'ro' },
  { domain: 'retete-gustoase.ro', testUrl: 'https://www.retete-gustoase.ro/Reteta-biscuiti-americani-cookies', region: 'Eastern Europe', language: 'ro' },
  { domain: 'coolinarika.com', testUrl: 'https://www.coolinarika.com/recept/chocolate-chip-cookies/', region: 'Eastern Europe', language: 'hr' },

  // === GREECE ===
  { domain: 'argiro.gr', testUrl: 'https://www.argiro.gr/recipe/cookies-me-kommataki-sokolatas/', region: 'Greek', language: 'el' },
  { domain: 'sintagespareas.gr', testUrl: 'https://www.sintagespareas.gr/Sintages/sokolatenia-cookies.html', region: 'Greek', language: 'el' },
  { domain: 'gastronomos.gr', testUrl: 'https://www.gastronomos.gr/mageirepste/syntages/cookies-sokolatas/', region: 'Greek', language: 'el' },
  { domain: 'akispetretzikis.com', testUrl: 'https://akispetretzikis.com/recipe/3169/cookies-me-sokolata', region: 'Greek', language: 'el' },
  { domain: 'cookpad.com', testUrl: 'https://cookpad.com/gr/recipes/18146893-malaka-cookies-sokolatas', region: 'Greek', language: 'el' },

  // === PORTUGAL ===
  { domain: 'teleculinaria.pt', testUrl: 'https://www.teleculinaria.pt/receitas/biscoitos-com-pepitas-de-chocolate/', region: 'Portugal', language: 'pt' },
  { domain: 'receitascomhistoria.pt', testUrl: 'https://www.receitascomhistoria.pt/bolachas-com-pepitas-de-chocolate/', region: 'Portugal', language: 'pt' },
  { domain: 'pingodoce.pt', testUrl: 'https://www.pingodoce.pt/receitas/cookies-com-pepitas-de-chocolate/', region: 'Portugal', language: 'pt' },
  { domain: 'mulher.pt', testUrl: 'https://www.mulher.pt/receitas/bolachas-cookies-com-pepitas-de-chocolate/', region: 'Portugal', language: 'pt' },
  { domain: 'sabor-intenso.com', testUrl: 'https://www.sabor-intenso.com/r-cookies_pepitas_chocolate', region: 'Portugal', language: 'pt' },
  { domain: 'panelinha.com.br', testUrl: 'https://www.panelinha.com.br/receita/Cookies-com-gotas-de-chocolate', region: 'Latin America', language: 'pt' },
  { domain: 'tudogostoso.com.br', testUrl: 'https://www.tudogostoso.com.br/receita/114447-cookies-com-gotas-de-chocolate.html', region: 'Latin America', language: 'pt' },

  // === BALTIC ===
  { domain: 'nami-nami.ee', testUrl: 'https://nami-nami.ee/retsept/ameerika-cookies', region: 'Baltic', language: 'et' },
  { domain: 'kulinar.lv', testUrl: 'https://kulinar.lv/receptes/cepumi/sokolades-cepumi', region: 'Baltic', language: 'en' },
  { domain: 'receptai.lt', testUrl: 'https://www.receptai.lt/receptas/cookies-su-sokolado-gabaliukais', region: 'Baltic', language: 'en' },

  // === ASIA CUISINE (English) ===
  { domain: 'woksoflife.com', testUrl: 'https://thewoksoflife.com/chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Chinese' },
  { domain: 'justonecookbook.com', testUrl: 'https://www.justonecookbook.com/miso-soup/', region: 'International', language: 'en', cuisine: 'Japanese' },
  { domain: 'maangchi.com', testUrl: 'https://www.maangchi.com/recipe/dakgalbi', region: 'International', language: 'en', cuisine: 'Korean' },
  { domain: 'koreanbapsang.com', testUrl: 'https://www.koreanbapsang.com/bibimbap/', region: 'International', language: 'en', cuisine: 'Korean' },
  { domain: 'chinasichuanfood.com', testUrl: 'https://www.chinasichuanfood.com/kung-pao-chicken/', region: 'International', language: 'en', cuisine: 'Chinese' },
  { domain: 'hotthaikitchen.com', testUrl: 'https://hot-thai-kitchen.com/pad-thai-2/', region: 'International', language: 'en', cuisine: 'Thai' },
  { domain: 'omnivorescookbook.com', testUrl: 'https://omnivorescookbook.com/kung-pao-chicken/', region: 'International', language: 'en', cuisine: 'Chinese' },
  { domain: 'rotinrice.com', testUrl: 'https://rotinrice.com/hainanese-chicken-rice/', region: 'International', language: 'en', cuisine: 'Asian' },
  { domain: 'chopstickchronicles.com', testUrl: 'https://www.chopstickchronicles.com/japanese-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Japanese' },
  { domain: 'rasamalaysia.com', testUrl: 'https://rasamalaysia.com/chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Asian' },
  { domain: 'mykoreankitchen.com', testUrl: 'https://mykoreankitchen.com/korean-fried-chicken/', region: 'International', language: 'en', cuisine: 'Korean' },

  // === INDIAN CUISINE ===
  { domain: 'indianhealthyrecipes.com', testUrl: 'https://www.indianhealthyrecipes.com/chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'vegrecipesofindia.com', testUrl: 'https://www.vegrecipesofindia.com/eggless-chocolate-chip-cookies-recipe/', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'hebbarskitchen.com', testUrl: 'https://hebbarskitchen.com/eggless-chocolate-chip-cookies-recipe/', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'archanaskitchen.com', testUrl: 'https://www.archanaskitchen.com/eggless-chocolate-chip-cookies-recipe', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'spiceupthecurry.com', testUrl: 'https://www.spiceupthecurry.com/eggless-chocolate-chip-cookies-recipe/', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'cookwithmanali.com', testUrl: 'https://www.cookwithmanali.com/nankhatai-eggless-cardamom-cookies/', region: 'International', language: 'en', cuisine: 'Indian' },
  { domain: 'sanjeevkapoor.com', testUrl: 'https://www.sanjeevkapoor.com/Recipe/Chocolate-Chip-Cookies.html', region: 'International', language: 'en', cuisine: 'Indian' },

  // === MEDITERRANEAN & MIDDLE EASTERN ===
  { domain: 'feelgoodfoodie.net', testUrl: 'https://feelgoodfoodie.net/recipe/chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Middle Eastern' },
  { domain: 'themediterraneandish.com', testUrl: 'https://www.themediterraneandish.com/mediterranean-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Mediterranean' },
  { domain: 'thematbakh.com', testUrl: 'https://www.thematbakh.com/lebanese-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Middle Eastern' },
  { domain: 'zaatarandzaytoun.com', testUrl: 'https://www.zaatarandzaytoun.com/chocolate-tahini-cookies/', region: 'International', language: 'en', cuisine: 'Middle Eastern' },
  { domain: 'anediblemosaic.com', testUrl: 'https://www.anediblemosaic.com/tahini-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Middle Eastern' },
  { domain: 'olivetomato.com', testUrl: 'https://www.olivetomato.com/greek-olive-oil-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'Mediterranean' },

  // === FRENCH CUISINE (English-speaking) ===
  { domain: 'davidlebovitz.com', testUrl: 'https://www.davidlebovitz.com/salted-butter-chocolate-chip-cookies/', region: 'International', language: 'en', cuisine: 'French' },

  // === AGGREGATORS ===
  { domain: 'food.com', testUrl: 'https://www.food.com/recipe/chewy-chocolate-chip-cookies-25037', region: 'US', language: 'en' },
  { domain: 'bigoven.com', testUrl: 'https://www.bigoven.com/recipe/chocolate-chip-cookies/176820', region: 'US', language: 'en' },
  { domain: 'supercook.com', testUrl: 'https://www.supercook.com/#/recipes/chocolate-chip-cookies', region: 'US', language: 'en' },
  { domain: 'recipeland.com', testUrl: 'https://recipeland.com/recipe/v/chewy-chocolate-chip-cookies-4693', region: 'US', language: 'en' },
];

export function getSitesByRegion(): Record<string, KnownSite[]> {
  const out: Record<string, KnownSite[]> = {};
  for (const s of KNOWN_RECIPE_SITES) {
    (out[s.region] ??= []).push(s);
  }
  return out;
}
