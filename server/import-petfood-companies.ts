import { storage } from "./storage";
import type { InsertCompany } from "@shared/schema";

const petfoodCompaniesData = `Nestlé Purina PetCare	United States	22457
Mars Petcare Inc.	United States	22000
Hill's Pet Nutrition	United States	4483
General Mills	United States	2375.8
J.M. Smucker	United States	1719.6
Diamond Pet Foods	United States	1500
United Petfood	Belgium	1500
Simmons Pet Food	United States	1300
Spectrum Brands / United Pet Group	United States	1151.5
Unicharm Corp.	Japan	1034
Alphia	United States	1000
Freshpet	United States	975.2
Inaba Petfood	Japan	925
Partner in Pet Food	Hungary	857
Agrolimen SA	Spain	850
Premier Pet	Brazil	800
Heristo AG	Germany	780
Perfect Companion Group Co.	Thailand	751
BRF Pet SA	Brazil	750
Deuerer	Germany	750
Wellness Pet Company	United States	700
Vafo Group	Czech Republic	690
Central Garden & Pet	United States	547
i-Tail Corporation	Thailand	526.93
Jeil Feed	South Korea	525
Sunshine Mills	United States	525
Affinity Petcare SA	Spain	520
Monge & C. S.p.A.	Italy	500
C & D Foods	Ireland	495
Farmina Pet Foods	Italy	440
Tuffy's Pet Foods	United States	415
Real Pet Food Company	Australia	410
Special Dog	Brazil	370
Adimax Indústria e Comércio de Alimentos Ltda	Brazil	350
Whitebridge Pet Brands	United States	325
Versele-Laga NV	Belgium	302
Compana Pet Brands	United States	300
Nulo Pet Food	United States	261.8
Champion Petfoods	Canada	250
Group Depre	Belgium	250
Morando	Italy	239
Inspired Pet Nutrition	United Kingdom	223.03
Petline Ltd.	Japan	220
Rondo Food	Germany	218
GA Pet Food Partners	United Kingdom	214
Instinct	United States	200
Normandise Pet Food	France	193.4
Total Alimentos SA	Brazil	190
Bewital Petfood GmbH & Co. KG	Germany	185
Butcher's Pet Care	United Kingdom	178.19
Lider Petfood	Turkey	172.25
DoggyMan H.A. Co., Ltd.	Japan	171.6
Redbarn Pet Products	United States	168
Kormotech LLC	Ukraine	162.66
MG Group	Japan	161
Vitakraft Pet Care GmbH & Co.	Germany	161
Empresas Carozzi	Chile	160
Irish Dog Foods Ltd.	Ireland	150
Virbac	France	146.5
Pets Choice	United Kingdom	140.62
Maruha Nichiro Corporation	Japan	140
Bynsa Pets	Spain	136
Almo Nature	Italy	130.4
MPM Products	United Kingdom	124.36
Mid America Pet Food	United States	115.07
Nippon Pet Food Co.	Japan	105
Solid Gold Pet	United States	105
Kent Corp.	United States	100
Nordic Pet Care Group	Denmark	100
Montego Pet Nutrition	South Africa	99.5
Primal Pet Group	United States	95.3
Ethos Pet Brands	United States	94.9
Landini Giuntini SPA	Italy	94
Champion Pet Care	Chile	90
Rush Direct Inc	United States	87
Sopral	France	85
Drools Pet Food	India	84.1
Natures Menu	United Kingdom	84
Natura Plus Ultra Pet Food	France	81.3
Midwestern Pet Foods	United States	80
Gimborn	Germany	77.52
Natural Balance Pet Foods	United States	74.3
Dorado S.r.l.	Italy	73
Doggy AB	Sweden	71.04
Interquell	Germany	70
Laroy Group	Belgium	70
TFP Nutrition	United States	70
Vobra Special Petfoods	Netherlands	65.36
National Flour Mills	Trinidad and Tobago	65
Betagro	Thailand	63.06
The Crump Group Inc.	Canada	63
Austria Pet Food GmbH	Austria	60
Grupo Pilar (Gepsa Pet Foods)	Argentina	60
Aller Petfood Group A/S	Denmark	57
Red Collar Pet Foods	United States	57
Canagan Group	United Kingdom	56.1
Stella & Chewy's	United States	52.4
Campi Alimentos S.A de C.V.	Mexico	51.57
BrightPet Nutrition Group	United States	50
FirstMate Pet Foods	Canada	50
PLB International	Canada	50
Dibaq Mascotas	Spain	47
Forthglade	United Kingdom	47
The Honest Kitchen	United States	45
Vital Petfood Group	Denmark	42
Better Choice Company Inc.	United States	41.11
Grove Pet Foods	United Kingdom	41
JustFoodForDogs	United States	40
Life's Abundance	United States	38
Burns Pet Nutrition	United Kingdom	37.55
Tropikal Pet	Turkey	36
ZIWI Limited	New Zealand	32
Elmira Pet Products	Canada	30.8
Weruva Pet Foods	United States	30.4
Agroindustrias Baires	Argentina	30
Nutec Group	Mexico	30
SANYpet SpA	Italy	28.86
Propecsa	Mexico	26
Best Friend Group Oy	Finland	25
Italcol	Colombia	25
Rinti SA	Peru	25
Hagen Pet Foods	Canada	24`;

function parsePetfoodCompanies(): InsertCompany[] {
  const lines = petfoodCompaniesData.trim().split('\n');
  const companies: InsertCompany[] = [];
  
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    
    const name = parts[0].trim();
    const country = parts[1].trim();
    
    companies.push({
      name,
      industry: "Pet Food",
      country,
      tags: ["pet-food"],
      isActive: country === "United States",
    });
  }
  
  return companies;
}

export async function importPetfoodCompanies(): Promise<{ imported: number; skipped: number }> {
  const petfoodCompanies = parsePetfoodCompanies();
  let imported = 0;
  let skipped = 0;
  
  const existingCompanies = await storage.getAllCompanies();
  const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase()));
  
  for (const company of petfoodCompanies) {
    if (existingNames.has(company.name.toLowerCase())) {
      skipped++;
      continue;
    }
    
    await storage.createCompany(company);
    imported++;
  }
  
  console.log(`Pet food companies import complete: ${imported} imported, ${skipped} skipped (already exist)`);
  return { imported, skipped };
}
