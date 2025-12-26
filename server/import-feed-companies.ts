import { storage } from "./storage";
import type { InsertCompany } from "@shared/schema";

const feedCompaniesData = `Haid Group	Asia	China	26520	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
New Hope Group	Asia	China	25960	Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Muyuan Foodstuff	Asia	China	25319	Compound, Pig Feed
Cargill	North America	United States	17500	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
CP Group	Asia	Thailand	17500	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Shuangbaotai Group (Twins Group)	Asia	China	15500	Compound, Pig Feed
Guilin Liyuan	Asia	China	14500	Aqua Feed, Compound, Pig Feed, Poultry Feed
Land O'Lakes	North America	United States	14500	Aqua Feed, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Chia Tai Investment	Asia	China	13000	Pig Feed, Poultry Feed
De Heus	Europe	Netherlands	12000	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
ForFarmers N.V.	Europe	Netherlands	9000	Additive, Aqua Feed, Compound, Horse Feed, Pig Feed, Poultry Feed, Ruminant Feed
Nutreco	Europe	Netherlands	9000	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Arab Company for Livestock Development (ACOLID)	Middle East	Saudi Arabia	7568	Compound, Poultry Feed, Ruminant Feed
Tongwei Group	Asia	China	6884	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
JA Zen-Noh	Asia	Japan	6880	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Alltech	North America	United States	6500	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Tangrenshen Group (TRS)	Asia	China	6280	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix
Harim Group	Asia	South Korea	6212	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
WH Group	Asia	China	5800	Compound, Pig Feed, Premix
Smithfield Foods	North America	United States	5471	Compound, Pig Feed
Dabeinong Group	Asia	China	5406	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Industrias Bachoco	North America	Mexico	4397	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Japfa Ltd.	Asia	Singapore	4200	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
East Hope Group	Asia	China	4100	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Easy Holdings Co. Ltd.	Asia	South Korea	4100	Additive, Compound, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Betagro Group	Asia	Thailand	4000	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
CJ Cheil Jedang	Asia	South Korea	4000	Additive, Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Gold Coin	Asia	Singapore	4000	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Jiangsu Lihua Animal Husbandry	Asia	China	3800	Compound, Pig Feed, Poultry Feed
Shandong Asia Pacific Zhonghui Group	Asia	China	3800	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Feed One	Asia	Japan	3790	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Grupo Vall Companys	Europe	Spain	3650	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Agrosuper Group	South America	Chile	3630	Aqua Feed, Compound, Pig Feed, Poultry Feed
ADM Animal Nutrition	North America	United States	3500	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Anyou Biotechnology Group Co.	Asia	China	3200	Additive, Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Huaxi Hope Group	Asia	China	3200	Aqua Feed, Pig Feed, Poultry Feed
San Miguel Foods	Asia	Philippines	3200	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
Veronesi	Europe	Italy	3200	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Amul	Asia	India	3170	Compound, Ruminant Feed
Cherkizovo Group	Europe	Russia	3022	Compound, Pig Feed, Poultry Feed
Chubu Shiryo	Asia	Japan	3020	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
AGRAVIS Raiffeisen	Europe	Germany	3000	Aqua Feed, Compound, Horse Feed, Pig Feed, Poultry Feed, Ruminant Feed
Matli	Middle East	Türkiye	3000	Compound, Poultry Feed, Ruminant Feed
Miratorg	Europe	Russia	2978	Compound, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Koch Foods Inc.	North America	United States	2976	Poultry Feed
Proteína Animal (PROAN)	North America	Mexico	2900	Compound, Poultry Feed
Royal Agrifirm Group	Europe	Netherlands	2860	Additive, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Xinjiang Tiankang	Asia	China	2828	Additive, Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
DLG Group	Europe	Denmark	2800	Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Guangxi Yangxiang Co.	Asia	China	2800	Pig Feed, Poultry Feed
Shandong Backbone Group	Asia	China	2800	Additive, Compound, Pig Feed, Poultry Feed, Premix
Avril Group	Europe	France	2736	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Leong Hup International Bhd	Asia	Malaysia	2652	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
NongHyup Feed Inc.	Asia	South Korea	2650	Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Marubeni Nisshin Feed Co.	Asia	Japan	2620	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
Shandong Hemei Group	Asia	China	2600	Pig Feed, Poultry Feed
Sichuan Tequ Group	Asia	China	2600	Aqua Feed, Pig Feed, Poultry Feed, Ruminant Feed
Danish Agro Group	Europe	Denmark	2500	Additive, Compound, Horse Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Suguna Foods	Asia	India	2500	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Italcol	South America	Colombia	2380	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
AB Agri	Europe	United Kingdom	2320	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
DTC Deutsche Tiernahrung Cremer	Europe	Germany	2250	Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Nosan Corp.	Asia	Japan	2240	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Arvesta	Europe	Belgium	2225	Additive, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Guangdong Nanbao Group	Asia	China	2200	Pig Feed, Poultry Feed
JDH	North America	United States	2200	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Abalıoğlu Group	Middle East	Türkiye	2170	Aqua Feed, Compound, Poultry Feed, Ruminant Feed
San Fernando	South America	Peru	2160	Poultry Feed
Ridley AgriProducts	Oceania	Australia	2040	Additive, Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Arasco Feed	Middle East	Saudi Arabia	2000	Additive, Aqua Feed, Compound, Horse Feed, Poultry Feed, Premix, Ruminant Feed
Bröring Unternehmensgruppe	Europe	Germany	2000	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Fujian Sunner Development Co. Ltd.	Asia	China	2000	Compound, Poultry Feed
GreenFeed	Asia	Vietnam	2000	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
GTFoods Group	South America	Brazil	2000	Compound, Poultry Feed
Kent Nutrition Group	North America	United States	2000	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Seaboard Foods	North America	United States	1988	Pig Feed
Peco Foods	North America	United States	1830	Poultry Feed
OSI Group	North America	United States	1730	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Fujian Aonong Group	Asia	China	1722	Aqua Feed, Pig Feed, Poultry Feed
Aurora Alimentos	South America	Brazil	1682	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Resource Agribusiness Group	Europe	Russia	1647	Poultry Feed
Eureden	Europe	France	1600	Aqua Feed, Compound, Horse Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Tieqilisi Group	Asia	China	1600	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Amadori	Europe	Italy	1500	Compound, Poultry Feed
Godrej Agrovet	Asia	India	1500	Aqua Feed, Compound, Poultry Feed, Ruminant Feed
Jiada Group	Asia	China	1500	Pig Feed, Premix
Koka	Europe	Croatia	1445	Compound, Poultry Feed, Ruminant Feed
BioMar Group	Europe	Denmark	1372	Aqua Feed, Compound
Masan MEATLife	Asia	Vietnam	1350	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
Agropecuaria de Guissona	Europe	Spain	1330	Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Cooperl Arc Atlantique	Europe	France	1327	Compound, Pig Feed, Poultry Feed, Ruminant Feed
C Vale - Cooperativa Agroindustrial	South America	Brazil	1300	Aqua Feed, Compound, Poultry Feed, Ruminant Feed
Lantmännen Lantbruk	Europe	Sweden	1300	Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Malindo Feedmill	Asia	Indonesia	1300	Aqua Feed, Compound, Pig Feed, Poultry Feed
Prioskolye	Europe	Russia	1290	Compound, Poultry Feed, Premix
AVSA	South America	Colombia	1275	Compound, Poultry Feed
Sollio Cooperative Group	North America	Canada	1260	Compound, Pig Feed, Poultry Feed, Premix
Hunan Jiuding Group	Asia	China	1200	Compound, Pig Feed, Poultry Feed, Premix
MEGA Tierernährung	Europe	Germany	1200	Compound, Poultry Feed, Premix
Lar Cooperativa Agroindustrial	South America	Brazil	1176	Pig Feed, Poultry Feed, Ruminant Feed
Copacol	South America	Brazil	1167	Compound, Poultry Feed, Ruminant Feed
CP Standart Gida Sanayi Ve Ticaret (CP Turkey)	Middle East	Türkiye	1150	Compound, Poultry Feed, Premix, Ruminant Feed
Bupiliç	Middle East	Türkiye	1122	Compound, Poultry Feed
CMI - Corporación Multi Inversiones	Central America	Guatemala	1100	Pet Feed, Poultry Feed, Ruminant Feed
Guangdong Evergreen Feed Industry Co. Ltd.	Asia	China	1100	Aqua Feed, Compound, Pig Feed, Poultry Feed
Daybreak Foods Inc.	North America	United States	1089	Compound, Poultry Feed
Marfrig Global Foods	South America	Brazil	1087	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Premix, Ruminant Feed
Fieldale Farms	North America	United States	1050	Compound, Poultry Feed
Michael Foods	North America	United States	1035	Poultry Feed
2Agriculture Ltd.	Europe	United Kingdom	1000	Compound, Poultry Feed
Ambar	Middle East	Israel	1000	Aqua Feed, Compound, Poultry Feed, Premix, Ruminant Feed
Case Foods Inc.	North America	United States	1000	Poultry Feed
Fufeng Group	Asia	China	1000	Pig Feed, Poultry Feed
Hebei Jiuxing Food Co. Ltd.	Asia	China	1000	Compound, Poultry Feed
Nichiwa Sangyo	Asia	Japan	1000	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Rothkötter-Mischfutterwerk	Europe	Germany	1000	Pig Feed, Poultry Feed
Simmons Foods Inc.	North America	United States	1000	Poultry Feed
Woosung Feed Co.	Asia	South Korea	1000	Aqua Feed, Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Zhengbang Science and Technology	Asia	China	1000	Aqua Feed, Compound, Pig Feed, Poultry Feed, Premix
Rembrandt Enterprises	North America	United States	926	Poultry Feed
Empresas Guadalupe	North America	Mexico	924	Poultry Feed
Banvit	Middle East	Türkiye	920	Compound, Poultry Feed, Ruminant Feed
Itochu Feed Mills Co.	Asia	Japan	920	Additive, Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
Showa Sangyo	Asia	Japan	900	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
SKM Animal Feeds & Foods	Asia	India	900	Compound, Poultry Feed, Ruminant Feed
Cooper Farms	North America	United States	896	Pig Feed, Poultry Feed
Cedrob	Europe	Poland	894	Compound, Pig Feed, Poultry Feed
Coren	Europe	Spain	894	Compound, Pig Feed, Poultry Feed, Ruminant Feed
TS Corp.	Asia	South Korea	885	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Bezrk-Belgrankorm	Europe	Russia	860	Compound, Pig Feed, Poultry Feed, Ruminant Feed
MPS Egg Farms	North America	United States	848	Poultry Feed
Center Fresh Group	North America	United States	840	Poultry Feed
Prairie Star Farms	North America	United States	840	Poultry Feed
Le Gouessant	Europe	France	819	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
El Calvario	North America	Mexico	809	Poultry Feed
Erpiliç	Middle East	Türkiye	807	Compound, Poultry Feed
DaChan Food (Asia) Ltd.	Asia	China	800	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Noble Foods	Europe	United Kingdom	800	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Guangdong Yuehai Feeds Group	Asia	China	797	Aqua Feed
Mar-Jac Poultry	North America	United States	780	Poultry Feed
Nutréa Nutrition Animale (NNA)	Europe	France	775	Compound, Horse Feed, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Redondos SA	South America	Peru	720	Aqua Feed, Compound, Pet Feed, Pig Feed, Poultry Feed
AFGRI Animal Feeds	Africa	South Africa	700	Compound, Pet Feed, Pig Feed, Poultry Feed, Ruminant Feed
Gena Agropecuaria	North America	Mexico	700	
Sanwang Group	Asia	China	700	Additive, Aqua Feed, Compound, Pig Feed, Poultry Feed
Quantum Foods	Africa	South Africa	671	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Country Bird Holdings Ltd.	Africa	South Africa	600	Compound, Pig Feed, Poultry Feed, Ruminant Feed
Olam Agri Nigeria	Africa	Nigeria	600	Aqua Feed, Poultry Feed
Prestage Farms	North America	United States	600	Compound, Pig Feed, Poultry Feed
Keskinoğlu	Middle East	Türkiye	550	Compound, Poultry Feed
Toyohashi Feed Mills	Asia	Japan	550	Pig Feed, Poultry Feed, Ruminant Feed
GFPT	Asia	Thailand	532	Aqua Feed, Compound, Pig Feed, Poultry Feed, Ruminant Feed
Malayan Flour Mills	Asia	Malaysia	500	Aqua Feed, Compound, Poultry Feed
Shenzhen Alpha Feed Co.	Asia	China	350	Additive, Aqua Feed, Compound, Pig Feed, Poultry Feed
Shandong Yisheng Livestock & Poultry Breeding Co.	Asia	China	280	Compound, Poultry Feed`;

function parseFeedCompanies(): InsertCompany[] {
  const lines = feedCompaniesData.trim().split('\n');
  const companies: InsertCompany[] = [];
  
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    
    const name = parts[0].trim();
    const region = parts[1].trim();
    const country = parts[2].trim();
    const feedTypes = parts[4]?.trim() || "";
    
    const tags = ["feed"];
    if (feedTypes) {
      feedTypes.split(',').forEach(t => {
        const tag = t.trim().toLowerCase().replace(/\s+/g, '-');
        if (tag) tags.push(tag);
      });
    }
    
    companies.push({
      name,
      industry: "Feed",
      region,
      country,
      tags,
      isActive: country === "United States",
    });
  }
  
  return companies;
}

export async function importFeedCompanies(): Promise<{ imported: number; skipped: number }> {
  const feedCompanies = parseFeedCompanies();
  let imported = 0;
  let skipped = 0;
  
  const existingCompanies = await storage.getAllCompanies();
  const existingNames = new Set(existingCompanies.map(c => c.name.toLowerCase()));
  
  for (const company of feedCompanies) {
    if (existingNames.has(company.name.toLowerCase())) {
      skipped++;
      continue;
    }
    
    await storage.createCompany(company);
    imported++;
  }
  
  console.log(`Feed companies import complete: ${imported} imported, ${skipped} skipped (already exist)`);
  return { imported, skipped };
}
