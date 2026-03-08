import { supabaseAdmin } from '../src/lib/supabaseAdmin';

/**
 * Seed de Jurisdicciones (Partidos y Delegaciones PBA) para NotiAR.
 * Cruce oficial 2026: Códigos de Partido (ARBA/Geodesia) y Códigos de Delegación (CESBA).
 * Fuente: Marco de Estandarización Geo-Administrativa y Notarial de la Provincia de Buenos Aires (2026).
 */
const jurisdicciones = [
    { "provincia_id": "PBA", "version": "2026_01", "name": "Adolfo Alsina", "partido_code": "001", "delegacion_code": "017", "aliases": ["adolfo alsina", "carhue", "carhué"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Adolfo Gonzales Chaves", "partido_code": "130", "delegacion_code": "015", "aliases": ["adolfo gonzales chaves", "gonzales chaves", "gonzález chaves"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Alberti", "partido_code": "002", "delegacion_code": "008", "aliases": ["alberti"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Almirante Brown", "partido_code": "003", "delegacion_code": "005", "aliases": ["almirante brown", "alte brown", "adrogue", "adrogué", "burzaco"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Arrecifes", "partido_code": "077", "delegacion_code": "011", "aliases": ["arrecifes", "bartolome mitre"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Avellaneda", "partido_code": "004", "delegacion_code": "005", "aliases": ["avellaneda", "sarandi", "wilde", "gerli"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Ayacucho", "partido_code": "005", "delegacion_code": "012", "aliases": ["ayacucho"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Azul", "partido_code": "006", "delegacion_code": "013", "aliases": ["azul"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Bahía Blanca", "partido_code": "007", "delegacion_code": "007", "aliases": ["bahia blanca", "bahía blanca"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Balcarce", "partido_code": "008", "delegacion_code": "009", "aliases": ["balcarce"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Baradero", "partido_code": "009", "delegacion_code": "010", "aliases": ["baradero"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Benito Juárez", "partido_code": "010", "delegacion_code": "012", "aliases": ["benito juarez", "benito juárez", "juarez"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Berazategui", "partido_code": "011", "delegacion_code": "005", "aliases": ["berazategui", "bera"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Berisso", "partido_code": "012", "delegacion_code": "001", "aliases": ["berisso"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Bolívar", "partido_code": "013", "delegacion_code": "013", "aliases": ["bolivar", "bolívar", "san carlos de bolivar"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Bragado", "partido_code": "014", "delegacion_code": "016", "aliases": ["bragado"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Brandsen", "partido_code": "015", "delegacion_code": "001", "aliases": ["brandsen", "coronel brandsen", "cnel brandsen"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Campana", "partido_code": "016", "delegacion_code": "003", "aliases": ["campana"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Cañuelas", "partido_code": "017", "delegacion_code": "005", "aliases": ["cañuelas", "canuelas"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Capitán Sarmiento", "partido_code": "018", "delegacion_code": "011", "aliases": ["capitan sarmiento", "capitán sarmiento"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Carlos Casares", "partido_code": "019", "delegacion_code": "016", "aliases": ["carlos casares", "casares"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Carlos Tejedor", "partido_code": "020", "delegacion_code": "017", "aliases": ["carlos tejedor", "tejedor"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Carmen de Areco", "partido_code": "021", "delegacion_code": "008", "aliases": ["carmen de areco"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Castelli", "partido_code": "022", "delegacion_code": "009", "aliases": ["castelli"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Chacabuco", "partido_code": "023", "delegacion_code": "014", "aliases": ["chacabuco"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Chascomús", "partido_code": "024", "delegacion_code": "009", "aliases": ["chascomus", "chascomús"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Chivilcoy", "partido_code": "025", "delegacion_code": "008", "aliases": ["chivilcoy"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Colón", "partido_code": "026", "delegacion_code": "011", "aliases": ["colon", "colón"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Coronel Dorrego", "partido_code": "027", "delegacion_code": "007", "aliases": ["coronel dorrego", "cnel dorrego"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Coronel Pringles", "partido_code": "028", "delegacion_code": "007", "aliases": ["coronel pringles", "cnel pringles"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Coronel Rosales", "partido_code": "029", "delegacion_code": "007", "aliases": ["coronel rosales", "cnel rosales", "punta alta"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Coronel Suárez", "partido_code": "030", "delegacion_code": "007", "aliases": ["coronel suarez", "coronel suárez", "cnel suarez"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Daireaux", "partido_code": "031", "delegacion_code": "017", "aliases": ["daireaux"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Dolores", "partido_code": "032", "delegacion_code": "009", "aliases": ["dolores"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Ensenada", "partido_code": "033", "delegacion_code": "001", "aliases": ["ensenada"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Escobar", "partido_code": "034", "delegacion_code": "003", "aliases": ["escobar", "belen de escobar", "garin"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Esteban Echeverría", "partido_code": "035", "delegacion_code": "005", "aliases": ["esteban echeverria", "esteban echeverría", "monte grande", "canning"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Exaltación de la Cruz", "partido_code": "036", "delegacion_code": "003", "aliases": ["exaltacion de la cruz", "exaltación de la cruz", "capilla del señor"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Ezeiza", "partido_code": "037", "delegacion_code": "005", "aliases": ["ezeiza", "tristan suarez"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Florencio Varela", "partido_code": "038", "delegacion_code": "005", "aliases": ["florencio varela", "varela"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Florentino Ameghino", "partido_code": "128", "delegacion_code": "014", "aliases": ["florentino ameghino", "ameghino"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Alvarado", "partido_code": "040", "delegacion_code": "009", "aliases": ["general alvarado", "gral alvarado", "miramar"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Alvear", "partido_code": "041", "delegacion_code": "013", "aliases": ["general alvear", "gral alvear"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Arenales", "partido_code": "042", "delegacion_code": "014", "aliases": ["general arenales", "gral arenales"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Belgrano", "partido_code": "043", "delegacion_code": "009", "aliases": ["general belgrano", "gral belgrano"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Guido", "partido_code": "044", "delegacion_code": "009", "aliases": ["general guido", "gral guido"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General La Madrid", "partido_code": "046", "delegacion_code": "013", "aliases": ["general la madrid", "gral la madrid", "general lamadrid"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Las Heras", "partido_code": "047", "delegacion_code": "002", "aliases": ["general las heras", "gral las heras", "las heras"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Lavalle", "partido_code": "048", "delegacion_code": "009", "aliases": ["general lavalle", "gral lavalle"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Madariaga", "partido_code": "049", "delegacion_code": "009", "aliases": ["general madariaga", "gral madariaga", "general juan madariaga"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Paz", "partido_code": "050", "delegacion_code": "009", "aliases": ["general paz", "gral paz", "ranchos"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Pinto", "partido_code": "051", "delegacion_code": "014", "aliases": ["general pinto", "gral pinto"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Pueyrredón", "partido_code": "045", "delegacion_code": "009", "aliases": ["general pueyrredon", "gral pueyrredon", "mar del plata", "mdq"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Rodríguez", "partido_code": "052", "delegacion_code": "008", "aliases": ["general rodriguez", "gral rodriguez", "general rodríguez"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General San Martín", "partido_code": "053", "delegacion_code": "003", "aliases": ["general san martin", "gral san martin", "san martin", "san martín", "villa ballester"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Viamonte", "partido_code": "054", "delegacion_code": "014", "aliases": ["general viamonte", "gral viamonte", "los toldos"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "General Villegas", "partido_code": "056", "delegacion_code": "017", "aliases": ["general villegas", "gral villegas"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Guaminí", "partido_code": "057", "delegacion_code": "017", "aliases": ["guamini", "guaminí"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Hipólito Yrigoyen", "partido_code": "058", "delegacion_code": "016", "aliases": ["hipolito yrigoyen", "hipólito yrigoyen", "henderson"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Hurlingham", "partido_code": "133", "delegacion_code": "002", "aliases": ["hurlingham", "villa tesei", "william morris"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Ituzaingó", "partido_code": "134", "delegacion_code": "002", "aliases": ["ituzaingo", "ituzaingó", "parque leloir"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "José C. Paz", "partido_code": "131", "delegacion_code": "002", "aliases": ["jose c paz", "josé c paz", "jose c. paz"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Junín", "partido_code": "059", "delegacion_code": "014", "aliases": ["junin", "junín"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "La Costa", "partido_code": "123", "delegacion_code": "009", "aliases": ["la costa", "partido de la costa", "mar del tuyu", "mar del tuyú", "san clemente", "santa teresita", "mar de ajo", "san bernardo"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "La Matanza", "partido_code": "060", "delegacion_code": "002", "aliases": ["la matanza", "san justo", "ramos mejia", "gonzalez catan", "isidro casanova"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "La Plata", "partido_code": "055", "delegacion_code": "001", "aliases": ["la plata", "laplata", "city bell", "los hornos", "villa elisa", "tolosa"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lanús", "partido_code": "061", "delegacion_code": "005", "aliases": ["lanus", "lanús", "remedios de escalada", "gerli"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Laprida", "partido_code": "062", "delegacion_code": "013", "aliases": ["laprida"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Las Flores", "partido_code": "063", "delegacion_code": "013", "aliases": ["las flores"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Leandro N. Alem", "partido_code": "064", "delegacion_code": "014", "aliases": ["leandro n alem", "leandro alem", "alem", "vedia"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lezama", "partido_code": "135", "delegacion_code": "009", "aliases": ["lezama"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lincoln", "partido_code": "065", "delegacion_code": "014", "aliases": ["lincoln"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lobería", "partido_code": "066", "delegacion_code": "015", "aliases": ["loberia", "lobería"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lobos", "partido_code": "067", "delegacion_code": "005", "aliases": ["lobos"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Lomas de Zamora", "partido_code": "068", "delegacion_code": "005", "aliases": ["lomas de zamora", "lomas", "banfield", "temperley"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Luján", "partido_code": "069", "delegacion_code": "008", "aliases": ["lujan", "luján"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Magdalena", "partido_code": "070", "delegacion_code": "001", "aliases": ["magdalena"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Maipú", "partido_code": "071", "delegacion_code": "009", "aliases": ["maipu", "maipú"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Malvinas Argentinas", "partido_code": "132", "delegacion_code": "002", "aliases": ["malvinas argentinas", "los polvorines", "grand bourg", "tortuguitas"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Mar Chiquita", "partido_code": "072", "delegacion_code": "009", "aliases": ["mar chiquita", "coronel vidal", "santa clara del mar"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Marcos Paz", "partido_code": "073", "delegacion_code": "002", "aliases": ["marcos paz"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Mercedes", "partido_code": "074", "delegacion_code": "008", "aliases": ["mercedes"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Merlo", "partido_code": "075", "delegacion_code": "002", "aliases": ["merlo", "san antonio de padua", "libertad", "mariano acosta"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Monte", "partido_code": "076", "delegacion_code": "001", "aliases": ["monte", "san miguel del monte"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Monte Hermoso", "partido_code": "126", "delegacion_code": "007", "aliases": ["monte hermoso", "m. hermoso"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Moreno", "partido_code": "078", "delegacion_code": "002", "aliases": ["moreno", "paso del rey", "trujui"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Morón", "partido_code": "101", "delegacion_code": "002", "aliases": ["moron", "morón", "castelar", "haedo", "el palomar"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Navarro", "partido_code": "079", "delegacion_code": "002", "aliases": ["navarro"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Necochea", "partido_code": "080", "delegacion_code": "015", "aliases": ["necochea", "quequen", "quequén"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Nueve de Julio", "partido_code": "081", "delegacion_code": "016", "aliases": ["nueve de julio", "9 de julio"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Olavarría", "partido_code": "082", "delegacion_code": "013", "aliases": ["olavarria", "olavarría"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Patagones", "partido_code": "083", "delegacion_code": "007", "aliases": ["patagones", "carmen de patagones"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pehuajó", "partido_code": "084", "delegacion_code": "016", "aliases": ["pehuajo", "pehuajó"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pellegrini", "partido_code": "085", "delegacion_code": "017", "aliases": ["pellegrini"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pergamino", "partido_code": "086", "delegacion_code": "011", "aliases": ["pergamino"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pila", "partido_code": "087", "delegacion_code": "009", "aliases": ["pila"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pilar", "partido_code": "088", "delegacion_code": "003", "aliases": ["pilar", "del viso", "derqui", "villa rosa"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Pinamar", "partido_code": "124", "delegacion_code": "009", "aliases": ["pinamar", "ostende", "valeria del mar", "carilo", "cariló"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Presidente Perón", "partido_code": "129", "delegacion_code": "005", "aliases": ["presidente peron", "presidente perón", "guernica"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Puan", "partido_code": "089", "delegacion_code": "007", "aliases": ["puan", "puán"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Punta Indio", "partido_code": "127", "delegacion_code": "001", "aliases": ["punta indio", "veronica", "verónica"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Quilmes", "partido_code": "090", "delegacion_code": "005", "aliases": ["quilmes", "bernal", "solano", "ezpeleta", "don bosco"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Ramallo", "partido_code": "091", "delegacion_code": "010", "aliases": ["ramallo"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Rauch", "partido_code": "092", "delegacion_code": "012", "aliases": ["rauch"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Rivadavia", "partido_code": "093", "delegacion_code": "017", "aliases": ["rivadavia", "america", "américa"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Rojas", "partido_code": "094", "delegacion_code": "014", "aliases": ["rojas"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Roque Pérez", "partido_code": "095", "delegacion_code": "001", "aliases": ["roque perez", "roque pérez"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Saavedra", "partido_code": "096", "delegacion_code": "007", "aliases": ["saavedra", "pigue", "pigüé", "pigüe"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Saladillo", "partido_code": "097", "delegacion_code": "016", "aliases": ["saladillo"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Salliqueló", "partido_code": "122", "delegacion_code": "017", "aliases": ["salliquelo", "salliqueló"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Salto", "partido_code": "098", "delegacion_code": "011", "aliases": ["salto"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Andrés de Giles", "partido_code": "099", "delegacion_code": "008", "aliases": ["san andres de giles", "san andrés de giles", "giles"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Antonio de Areco", "partido_code": "100", "delegacion_code": "008", "aliases": ["san antonio de areco", "areco"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Cayetano", "partido_code": "115", "delegacion_code": "015", "aliases": ["san cayetano"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Fernando", "partido_code": "102", "delegacion_code": "004", "aliases": ["san fernando", "victoria", "virreyes"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Isidro", "partido_code": "103", "delegacion_code": "004", "aliases": ["san isidro", "s. isidro", "martinez", "martínez", "boulogne", "beccar", "béccar", "acassuso"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Miguel", "partido_code": "131", "delegacion_code": "002", "aliases": ["san miguel", "bella vista", "muñiz"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Nicolás", "partido_code": "104", "delegacion_code": "010", "aliases": ["san nicolas", "san nicolás", "san nicolas de los arroyos"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Pedro", "partido_code": "105", "delegacion_code": "010", "aliases": ["san pedro"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "San Vicente", "partido_code": "106", "delegacion_code": "005", "aliases": ["san vicente", "alejandro korn", "domselaar"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Suipacha", "partido_code": "107", "delegacion_code": "008", "aliases": ["suipacha"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tandil", "partido_code": "108", "delegacion_code": "012", "aliases": ["tandil"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tapalqué", "partido_code": "109", "delegacion_code": "013", "aliases": ["tapalque", "tapalqué"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tigre", "partido_code": "110", "delegacion_code": "004", "aliases": ["tigre", "don torcuato", "general pacheco", "gral pacheco", "benavidez", "nordelta"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tordillo", "partido_code": "111", "delegacion_code": "009", "aliases": ["tordillo", "general conesa"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tornquist", "partido_code": "112", "delegacion_code": "007", "aliases": ["tornquist", "sierra de la ventana", "villa ventana"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Trenque Lauquen", "partido_code": "113", "delegacion_code": "017", "aliases": ["trenque lauquen", "trenque lauquén", "30 de agosto"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tres Arroyos", "partido_code": "114", "delegacion_code": "007", "aliases": ["tres arroyos", "claromeco", "claromecó", "orence"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tres de Febrero", "partido_code": "117", "delegacion_code": "003", "aliases": ["tres de febrero", "3 de febrero", "caseros", "ciudadela", "santos lugares", "martin coronado"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Tres Lomas", "partido_code": "125", "delegacion_code": "017", "aliases": ["tres lomas"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Veinticinco de Mayo", "partido_code": "118", "delegacion_code": "016", "aliases": ["veinticinco de mayo", "25 de mayo"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Vicente López", "partido_code": "119", "delegacion_code": "004", "aliases": ["vicente lopez", "vicente lópez", "vte lopez", "olivos", "florida", "munro", "villa martelli"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Villa Gesell", "partido_code": "121", "delegacion_code": "009", "aliases": ["villa gesell", "gesell", "mar de las pampas", "mar azul"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Villarino", "partido_code": "116", "delegacion_code": "007", "aliases": ["villarino", "medanos", "pedro luro"], "active": true },
    { "provincia_id": "PBA", "version": "2026_01", "name": "Zárate", "partido_code": "120", "delegacion_code": "003", "aliases": ["zarate", "zárate", "lima"], "active": true }
];

async function seedJurisdictions() {
    console.log('Iniciando seed de jurisdicciones (Partidos y Delegaciones PBA)...');

    try {
        const { data, error } = await supabaseAdmin
            .from('jurisdicciones')
            .upsert(jurisdicciones, {
                onConflict: 'partido_code, delegacion_code',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Error insertando jurisdicciones:', error.message);
            return;
        }

        console.log('Seed de jurisdicciones ejecutado con éxito. Se procesaron', jurisdicciones.length, 'registros.');
    } catch (err) {
        console.error('Excepción inesperada ejecutando el seed:', err);
    }
}

seedJurisdictions();
