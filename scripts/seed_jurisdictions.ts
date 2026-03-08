import { supabaseAdmin } from '../src/lib/supabaseAdmin';

/**
 * Seed de Jurisdicciones (135 Partidos PBA) para NotiAR.
 * Codigos de Partido: fuente oficial ARBA/Geodesia (partidas inmobiliarias).
 * Codigos de Delegacion: Ley 9020/78 (Colegio de Escribanos, 17 delegaciones).
 * Ref: https://www.arba.gov.ar/archivos/Publicaciones/codigospartidos.html
 */
const jurisdicciones = [
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Adolfo Alsina","party_code":"001","delegation_code":"017","aliases":["adolfo alsina","carhue","carhué"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Alberti","party_code":"002","delegation_code":"008","aliases":["alberti"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Almirante Brown","party_code":"003","delegation_code":"005","aliases":["almirante brown","alte brown","adrogue","adrogué","burzaco"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Avellaneda","party_code":"004","delegation_code":"005","aliases":["avellaneda","sarandi","wilde"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Ayacucho","party_code":"005","delegation_code":"012","aliases":["ayacucho"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Azul","party_code":"006","delegation_code":"013","aliases":["azul"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Bahía Blanca","party_code":"007","delegation_code":"007","aliases":["bahia blanca","bahía blanca"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Balcarce","party_code":"008","delegation_code":"009","aliases":["balcarce"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Baradero","party_code":"009","delegation_code":"010","aliases":["baradero"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Arrecifes","party_code":"010","delegation_code":"011","aliases":["arrecifes","bartolome mitre"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Bolívar","party_code":"011","delegation_code":"013","aliases":["bolivar","bolívar","san carlos de bolivar"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Bragado","party_code":"012","delegation_code":"016","aliases":["bragado"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Brandsen","party_code":"013","delegation_code":"001","aliases":["brandsen","coronel brandsen","cnel brandsen"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Campana","party_code":"014","delegation_code":"003","aliases":["campana"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Cañuelas","party_code":"015","delegation_code":"005","aliases":["cañuelas","canuelas"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Carlos Casares","party_code":"016","delegation_code":"016","aliases":["carlos casares","casares"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Carlos Tejedor","party_code":"017","delegation_code":"017","aliases":["carlos tejedor","tejedor"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Carmen de Areco","party_code":"018","delegation_code":"008","aliases":["carmen de areco"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Daireaux","party_code":"019","delegation_code":"017","aliases":["daireaux"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Castelli","party_code":"020","delegation_code":"009","aliases":["castelli"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Colón","party_code":"021","delegation_code":"011","aliases":["colon","colón"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Coronel Dorrego","party_code":"022","delegation_code":"007","aliases":["coronel dorrego","cnel dorrego"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Coronel Pringles","party_code":"023","delegation_code":"007","aliases":["coronel pringles","cnel pringles"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Coronel Suárez","party_code":"024","delegation_code":"007","aliases":["coronel suarez","coronel suárez","cnel suarez"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lanús","party_code":"025","delegation_code":"005","aliases":["lanus","lanús","remedios de escalada"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Chacabuco","party_code":"026","delegation_code":"014","aliases":["chacabuco"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Chascomús","party_code":"027","delegation_code":"009","aliases":["chascomus","chascomús"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Chivilcoy","party_code":"028","delegation_code":"008","aliases":["chivilcoy"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Dolores","party_code":"029","delegation_code":"009","aliases":["dolores"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Esteban Echeverría","party_code":"030","delegation_code":"005","aliases":["esteban echeverria","esteban echeverría","monte grande","canning"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Exaltación de la Cruz","party_code":"031","delegation_code":"003","aliases":["exaltacion de la cruz","exaltación de la cruz","capilla del señor"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Florencio Varela","party_code":"032","delegation_code":"005","aliases":["florencio varela","varela"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Alvarado","party_code":"033","delegation_code":"009","aliases":["general alvarado","gral alvarado","miramar"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Alvear","party_code":"034","delegation_code":"013","aliases":["general alvear","gral alvear"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Arenales","party_code":"035","delegation_code":"014","aliases":["general arenales","gral arenales"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Belgrano","party_code":"036","delegation_code":"009","aliases":["general belgrano","gral belgrano"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Guido","party_code":"037","delegation_code":"009","aliases":["general guido","gral guido"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Zárate","party_code":"038","delegation_code":"003","aliases":["zarate","zárate","lima"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Madariaga","party_code":"039","delegation_code":"009","aliases":["general madariaga","gral madariaga","general juan madariaga"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General La Madrid","party_code":"040","delegation_code":"013","aliases":["general la madrid","gral la madrid","general lamadrid"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Las Heras","party_code":"041","delegation_code":"002","aliases":["general las heras","gral las heras","las heras"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Lavalle","party_code":"042","delegation_code":"009","aliases":["general lavalle","gral lavalle"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Paz","party_code":"043","delegation_code":"009","aliases":["general paz","gral paz","ranchos"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Pinto","party_code":"044","delegation_code":"014","aliases":["general pinto","gral pinto"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Pueyrredón","party_code":"045","delegation_code":"009","aliases":["general pueyrredon","gral pueyrredon","mar del plata","mdq"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Rodríguez","party_code":"046","delegation_code":"008","aliases":["general rodriguez","gral rodriguez","general rodríguez"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General San Martín","party_code":"047","delegation_code":"003","aliases":["general san martin","gral san martin","san martin","san martín","villa ballester"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Viamonte","party_code":"049","delegation_code":"014","aliases":["general viamonte","gral viamonte","los toldos"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"General Villegas","party_code":"050","delegation_code":"017","aliases":["general villegas","gral villegas"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Adolfo Gonzales Chaves","party_code":"051","delegation_code":"015","aliases":["adolfo gonzales chaves","gonzales chaves","gonzález chaves"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Guaminí","party_code":"052","delegation_code":"017","aliases":["guamini","guaminí"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Benito Juárez","party_code":"053","delegation_code":"012","aliases":["benito juarez","benito juárez","juarez"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Junín","party_code":"054","delegation_code":"014","aliases":["junin","junín"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"La Plata","party_code":"055","delegation_code":"001","aliases":["la plata","laplata","city bell","los hornos","villa elisa","tolosa"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Laprida","party_code":"056","delegation_code":"013","aliases":["laprida"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tigre","party_code":"057","delegation_code":"004","aliases":["tigre","don torcuato","general pacheco","gral pacheco","benavidez","nordelta"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Las Flores","party_code":"058","delegation_code":"013","aliases":["las flores"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Leandro N. Alem","party_code":"059","delegation_code":"014","aliases":["leandro n alem","leandro alem","alem","vedia"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lincoln","party_code":"060","delegation_code":"014","aliases":["lincoln"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lobería","party_code":"061","delegation_code":"015","aliases":["loberia","lobería"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lobos","party_code":"062","delegation_code":"005","aliases":["lobos"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lomas de Zamora","party_code":"063","delegation_code":"005","aliases":["lomas de zamora","lomas","banfield","temperley"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Luján","party_code":"064","delegation_code":"008","aliases":["lujan","luján"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Magdalena","party_code":"065","delegation_code":"001","aliases":["magdalena"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Maipú","party_code":"066","delegation_code":"009","aliases":["maipu","maipú"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Salto","party_code":"067","delegation_code":"011","aliases":["salto"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Marcos Paz","party_code":"068","delegation_code":"002","aliases":["marcos paz"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Mar Chiquita","party_code":"069","delegation_code":"009","aliases":["mar chiquita","coronel vidal","santa clara del mar"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"La Matanza","party_code":"070","delegation_code":"002","aliases":["la matanza","san justo","ramos mejia","gonzalez catan","isidro casanova"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Mercedes","party_code":"071","delegation_code":"008","aliases":["mercedes"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Merlo","party_code":"072","delegation_code":"002","aliases":["merlo","san antonio de padua","libertad","mariano acosta"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Monte","party_code":"073","delegation_code":"001","aliases":["monte","san miguel del monte"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Moreno","party_code":"074","delegation_code":"002","aliases":["moreno","paso del rey","trujui"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Navarro","party_code":"075","delegation_code":"002","aliases":["navarro"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Necochea","party_code":"076","delegation_code":"015","aliases":["necochea","quequen","quequén"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Nueve de Julio","party_code":"077","delegation_code":"016","aliases":["nueve de julio","9 de julio"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Olavarría","party_code":"078","delegation_code":"013","aliases":["olavarria","olavarría"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Patagones","party_code":"079","delegation_code":"007","aliases":["patagones","carmen de patagones"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pehuajó","party_code":"080","delegation_code":"016","aliases":["pehuajo","pehuajó"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pellegrini","party_code":"081","delegation_code":"017","aliases":["pellegrini"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pergamino","party_code":"082","delegation_code":"011","aliases":["pergamino"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pila","party_code":"083","delegation_code":"009","aliases":["pila"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pilar","party_code":"084","delegation_code":"003","aliases":["pilar","del viso","derqui","villa rosa"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Puan","party_code":"085","delegation_code":"007","aliases":["puan","puán"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Quilmes","party_code":"086","delegation_code":"005","aliases":["quilmes","bernal","solano","ezpeleta","don bosco"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Ramallo","party_code":"087","delegation_code":"010","aliases":["ramallo"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Rauch","party_code":"088","delegation_code":"012","aliases":["rauch"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Rivadavia","party_code":"089","delegation_code":"017","aliases":["rivadavia","america","américa"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Rojas","party_code":"090","delegation_code":"014","aliases":["rojas"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Roque Pérez","party_code":"091","delegation_code":"001","aliases":["roque perez","roque pérez"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Saavedra","party_code":"092","delegation_code":"007","aliases":["saavedra","pigue","pigüé","pigüe"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Saladillo","party_code":"093","delegation_code":"016","aliases":["saladillo"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Andrés de Giles","party_code":"094","delegation_code":"008","aliases":["san andres de giles","san andrés de giles","giles"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Antonio de Areco","party_code":"095","delegation_code":"008","aliases":["san antonio de areco","areco"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Fernando","party_code":"096","delegation_code":"004","aliases":["san fernando","victoria","virreyes"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Isidro","party_code":"097","delegation_code":"004","aliases":["san isidro","s. isidro","martinez","martínez","boulogne","beccar","béccar","acassuso"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Nicolás","party_code":"098","delegation_code":"010","aliases":["san nicolas","san nicolás","san nicolas de los arroyos"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Pedro","party_code":"099","delegation_code":"010","aliases":["san pedro"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Vicente","party_code":"100","delegation_code":"005","aliases":["san vicente","alejandro korn","domselaar"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Morón","party_code":"101","delegation_code":"002","aliases":["moron","morón","castelar","haedo","el palomar"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Suipacha","party_code":"102","delegation_code":"008","aliases":["suipacha"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tandil","party_code":"103","delegation_code":"012","aliases":["tandil"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tapalqué","party_code":"104","delegation_code":"013","aliases":["tapalque","tapalqué"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tordillo","party_code":"105","delegation_code":"009","aliases":["tordillo","general conesa"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tornquist","party_code":"106","delegation_code":"007","aliases":["tornquist","sierra de la ventana","villa ventana"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Trenque Lauquen","party_code":"107","delegation_code":"017","aliases":["trenque lauquen","trenque lauquén","30 de agosto"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tres Arroyos","party_code":"108","delegation_code":"007","aliases":["tres arroyos","claromeco","claromecó","orence"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Veinticinco de Mayo","party_code":"109","delegation_code":"016","aliases":["veinticinco de mayo","25 de mayo"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Vicente López","party_code":"110","delegation_code":"004","aliases":["vicente lopez","vicente lópez","vte lopez","olivos","florida","munro","villa martelli"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Villarino","party_code":"111","delegation_code":"007","aliases":["villarino","medanos","pedro luro"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Coronel Rosales","party_code":"113","delegation_code":"007","aliases":["coronel rosales","cnel rosales","punta alta"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Berisso","party_code":"114","delegation_code":"001","aliases":["berisso"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Ensenada","party_code":"115","delegation_code":"001","aliases":["ensenada"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Cayetano","party_code":"116","delegation_code":"015","aliases":["san cayetano"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tres de Febrero","party_code":"117","delegation_code":"003","aliases":["tres de febrero","3 de febrero","caseros","ciudadela","santos lugares","martin coronado"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Escobar","party_code":"118","delegation_code":"003","aliases":["escobar","belen de escobar","garin"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Hipólito Yrigoyen","party_code":"119","delegation_code":"016","aliases":["hipolito yrigoyen","hipólito yrigoyen","henderson"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Berazategui","party_code":"120","delegation_code":"005","aliases":["berazategui","bera"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Capitán Sarmiento","party_code":"121","delegation_code":"011","aliases":["capitan sarmiento","capitán sarmiento"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Salliqueló","party_code":"122","delegation_code":"017","aliases":["salliquelo","salliqueló"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"La Costa","party_code":"123","delegation_code":"009","aliases":["la costa","partido de la costa","mar del tuyu","mar del tuyú","san clemente","santa teresita","mar de ajo","san bernardo"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Pinamar","party_code":"124","delegation_code":"009","aliases":["pinamar","ostende","valeria del mar","carilo","cariló"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Villa Gesell","party_code":"125","delegation_code":"009","aliases":["villa gesell","gesell","mar de las pampas","mar azul"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Monte Hermoso","party_code":"126","delegation_code":"007","aliases":["monte hermoso","m. hermoso"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Tres Lomas","party_code":"127","delegation_code":"017","aliases":["tres lomas"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Florentino Ameghino","party_code":"128","delegation_code":"014","aliases":["florentino ameghino","ameghino"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Presidente Perón","party_code":"129","delegation_code":"005","aliases":["presidente peron","presidente perón","guernica"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Ezeiza","party_code":"130","delegation_code":"005","aliases":["ezeiza","tristan suarez"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"San Miguel","party_code":"131","delegation_code":"002","aliases":["san miguel","bella vista","muñiz"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"José C. Paz","party_code":"132","delegation_code":"002","aliases":["jose c paz","josé c paz","jose c. paz"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Malvinas Argentinas","party_code":"133","delegation_code":"002","aliases":["malvinas argentinas","los polvorines","grand bourg","tortuguitas"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Punta Indio","party_code":"134","delegation_code":"001","aliases":["punta indio","veronica","verónica"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Hurlingham","party_code":"135","delegation_code":"002","aliases":["hurlingham","villa tesei","william morris"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Ituzaingó","party_code":"136","delegation_code":"002","aliases":["ituzaingo","ituzaingó","parque leloir"],"active":true},
    {"jurisdiction_id":"PBA","version":"2026_01","party_name":"Lezama","party_code":"137","delegation_code":"009","aliases":["lezama"],"active":true}
];

async function seedJurisdictions() {
    console.log('Iniciando seed de jurisdicciones (135 Partidos PBA)...');

    try {
        const { data, error } = await supabaseAdmin
            .from('jurisdicciones')
            .upsert(jurisdicciones, {
                onConflict: 'jurisdiction_id, version, party_code',
                ignoreDuplicates: false
            });

        if (error) {
            console.error('Error insertando jurisdicciones:', error.message);
            return;
        }

        console.log('Seed ejecutado con exito.', jurisdicciones.length, 'partidos procesados.');
    } catch (err) {
        console.error('Excepcion inesperada:', err);
    }
}

seedJurisdictions();
