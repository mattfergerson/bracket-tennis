import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// 128 fake tennis players per gender
const MENS_PLAYERS = [
  { name: "Carlos Fuentes", nationality: "ESP", seed: 1 },
  { name: "Luka Novak", nationality: "SRB", seed: 2 },
  { name: "Marcel Hoffmann", nationality: "GER", seed: 3 },
  { name: "Ryder Collins", nationality: "USA", seed: 4 },
  { name: "Alexei Sorokin", nationality: "RUS", seed: 5 },
  { name: "Dimitri Papadopoulos", nationality: "GRE", seed: 6 },
  { name: "Hugo Leblanc", nationality: "FRA", seed: 7 },
  { name: "Lorenzo Ferretti", nationality: "ITA", seed: 8 },
  { name: "Takeshi Yamamoto", nationality: "JPN", seed: 9 },
  { name: "Rafael Moreira", nationality: "BRA", seed: 10 },
  { name: "Sean Mitchell", nationality: "AUS", seed: 11 },
  { name: "Andrei Volkov", nationality: "RUS", seed: 12 },
  { name: "Filip Dvorak", nationality: "CZE", seed: 13 },
  { name: "James Blackwood", nationality: "GBR", seed: 14 },
  { name: "Matteo Conti", nationality: "ITA", seed: 15 },
  { name: "Pedro Alves", nationality: "POR", seed: 16 },
  { name: "Jonas Becker", nationality: "GER", seed: null },
  { name: "Kofi Mensah", nationality: "GHA", seed: null },
  { name: "Ethan Park", nationality: "KOR", seed: null },
  { name: "Viktor Lindgren", nationality: "SWE", seed: null },
  { name: "Nico Dupont", nationality: "BEL", seed: null },
  { name: "Ciro Esposito", nationality: "ITA", seed: null },
  { name: "Ivan Petrov", nationality: "BUL", seed: null },
  { name: "Marcus Webb", nationality: "USA", seed: null },
  { name: "Yannick Renard", nationality: "FRA", seed: null },
  { name: "Thiago Costa", nationality: "BRA", seed: null },
  { name: "Anton Krejci", nationality: "CZE", seed: null },
  { name: "Daisuke Ono", nationality: "JPN", seed: null },
  { name: "Ben Crawford", nationality: "AUS", seed: null },
  { name: "Sergi Puig", nationality: "ESP", seed: null },
  { name: "Milos Jovic", nationality: "SRB", seed: null },
  { name: "Nate Sullivan", nationality: "USA", seed: null },
  { name: "Artur Blaszczyk", nationality: "POL", seed: null },
  { name: "Sven Haugen", nationality: "NOR", seed: null },
  { name: "Leo Fontaine", nationality: "FRA", seed: null },
  { name: "Frederico Nunes", nationality: "POR", seed: null },
  { name: "Tobias Klein", nationality: "AUT", seed: null },
  { name: "Xavier Moreau", nationality: "FRA", seed: null },
  { name: "Yusuf Arslan", nationality: "TUR", seed: null },
  { name: "Bohdan Kovalenko", nationality: "UKR", seed: null },
  { name: "Santiago Rios", nationality: "ARG", seed: null },
  { name: "Dylan Hennessey", nationality: "IRL", seed: null },
  { name: "Liam Forsythe", nationality: "CAN", seed: null },
  { name: "Patrik Sedin", nationality: "SWE", seed: null },
  { name: "Lorenzo Ricci", nationality: "ITA", seed: null },
  { name: "Alexis Navarro", nationality: "COL", seed: null },
  { name: "Kenichi Mori", nationality: "JPN", seed: null },
  { name: "Oliver Grant", nationality: "GBR", seed: null },
  { name: "Tomas Havel", nationality: "CZE", seed: null },
  { name: "Gael Picard", nationality: "FRA", seed: null },
  { name: "Rodrigo Vega", nationality: "CHI", seed: null },
  { name: "Niklas Sturm", nationality: "GER", seed: null },
  { name: "Pavel Zeman", nationality: "SVK", seed: null },
  { name: "Andre Rocha", nationality: "BRA", seed: null },
  { name: "Bjorn Eriksson", nationality: "SWE", seed: null },
  { name: "Kyle Harrington", nationality: "USA", seed: null },
  { name: "Giacomo Russo", nationality: "ITA", seed: null },
  { name: "Raul Herrera", nationality: "MEX", seed: null },
  { name: "Connor Walsh", nationality: "IRL", seed: null },
  { name: "Maxime Girard", nationality: "FRA", seed: null },
  { name: "Thomas Bergmann", nationality: "GER", seed: null },
  { name: "Aleksander Wiśniewski", nationality: "POL", seed: null },
  { name: "Bruno Ferreira", nationality: "POR", seed: null },
  { name: "Marco De Luca", nationality: "ITA", seed: null },
  { name: "Luis Paredes", nationality: "PER", seed: null },
  { name: "Noah Whitfield", nationality: "AUS", seed: null },
  { name: "Stefan Gorski", nationality: "POL", seed: null },
  { name: "Christoph Weidner", nationality: "GER", seed: null },
  { name: "Cesar Ramos", nationality: "MEX", seed: null },
  { name: "Fabio Marchetti", nationality: "ITA", seed: null },
  { name: "Daniel Thornton", nationality: "GBR", seed: null },
  { name: "Oscar Lindqvist", nationality: "SWE", seed: null },
  { name: "Sebastien Caron", nationality: "CAN", seed: null },
  { name: "Erwin Baxter", nationality: "USA", seed: null },
  { name: "Rafael Santos", nationality: "BRA", seed: null },
  { name: "Mikhail Zaitsev", nationality: "RUS", seed: null },
  { name: "Adrien Boulanger", nationality: "FRA", seed: null },
  { name: "Lenny Hodge", nationality: "AUS", seed: null },
  { name: "David Navarro", nationality: "ESP", seed: null },
  { name: "Borja Gallego", nationality: "ESP", seed: null },
  { name: "Hendrik Visser", nationality: "NED", seed: null },
  { name: "Pieter Van den Berg", nationality: "NED", seed: null },
  { name: "James Callahan", nationality: "USA", seed: null },
  { name: "Andres Molina", nationality: "ARG", seed: null },
  { name: "Kenji Hayashi", nationality: "JPN", seed: null },
  { name: "Enrico Bianchi", nationality: "ITA", seed: null },
  { name: "Roman Horak", nationality: "CZE", seed: null },
  { name: "Patrice Guilloteau", nationality: "FRA", seed: null },
  { name: "Emilio Vidal", nationality: "ESP", seed: null },
  { name: "Lucas Pinto", nationality: "BRA", seed: null },
  { name: "Tom Bassett", nationality: "GBR", seed: null },
  { name: "Ján Kováč", nationality: "SVK", seed: null },
  { name: "Daniil Rykov", nationality: "RUS", seed: null },
  { name: "Marcus Osei", nationality: "GHA", seed: null },
  { name: "Finn Gallagher", nationality: "IRL", seed: null },
  { name: "Ivan Stankovic", nationality: "SRB", seed: null },
  { name: "Jean-Pierre Aubert", nationality: "FRA", seed: null },
  { name: "Paulo Carvalho", nationality: "BRA", seed: null },
  { name: "Markus Frei", nationality: "SUI", seed: null },
  { name: "Wout Claes", nationality: "BEL", seed: null },
  { name: "Dmitry Kozlov", nationality: "RUS", seed: null },
  { name: "Antoine Rousseau", nationality: "FRA", seed: null },
  { name: "Lars Mikkelsen", nationality: "DEN", seed: null },
  { name: "Patrick Drum", nationality: "USA", seed: null },
  { name: "Hideo Tanaka", nationality: "JPN", seed: null },
  { name: "Carlos Mendez", nationality: "ARG", seed: null },
  { name: "Jonah Whitmore", nationality: "GBR", seed: null },
  { name: "Benedikt Huber", nationality: "AUT", seed: null },
  { name: "Remi Lacoste", nationality: "FRA", seed: null },
  { name: "Nico Ferrara", nationality: "ITA", seed: null },
  { name: "Georg Steiner", nationality: "GER", seed: null },
  { name: "Alexis Perez", nationality: "CHL", seed: null },
  { name: "Luca Savoia", nationality: "ITA", seed: null },
  { name: "Chris Delacroix", nationality: "BEL", seed: null },
  { name: "Mikael Larsson", nationality: "SWE", seed: null },
  { name: "Tommy Brookes", nationality: "AUS", seed: null },
  { name: "Hans Richter", nationality: "GER", seed: null },
  { name: "Alberto Casas", nationality: "ESP", seed: null },
  { name: "Ben Hartley", nationality: "GBR", seed: null },
  { name: "Julien Marceau", nationality: "FRA", seed: null },
  { name: "Vincenzo Palma", nationality: "ITA", seed: null },
  { name: "Omar Al-Rashid", nationality: "QAT", seed: null },
  { name: "Tyler Brooks", nationality: "USA", seed: null },
  { name: "Marco Volpe", nationality: "ITA", seed: null },
  { name: "Pierre Gaudin", nationality: "FRA", seed: null },
  { name: "Kwame Asare", nationality: "GHA", seed: null },
  { name: "Ronaldo Silva", nationality: "BRA", seed: null },
  { name: "Nick Papadakis", nationality: "GRE", seed: null },
];

const WOMENS_PLAYERS = [
  { name: "Serena Kovacs", nationality: "HUN", seed: 1 },
  { name: "Yuki Tanaka", nationality: "JPN", seed: 2 },
  { name: "Elena Morozova", nationality: "RUS", seed: 3 },
  { name: "Bianca Ferretti", nationality: "ITA", seed: 4 },
  { name: "Madison Clarke", nationality: "USA", seed: 5 },
  { name: "Ingrid Holen", nationality: "NOR", seed: 6 },
  { name: "Camille Bertrand", nationality: "FRA", seed: 7 },
  { name: "Ana Vidal", nationality: "ESP", seed: 8 },
  { name: "Petra Novakova", nationality: "CZE", seed: 9 },
  { name: "Sofia Reyes", nationality: "MEX", seed: 10 },
  { name: "Olivia Hargreaves", nationality: "GBR", seed: 11 },
  { name: "Valentina Greco", nationality: "ITA", seed: 12 },
  { name: "Nadia Popescu", nationality: "ROU", seed: 13 },
  { name: "Zara Okonkwo", nationality: "NGR", seed: 14 },
  { name: "Louise Fontaine", nationality: "FRA", seed: 15 },
  { name: "Hana Suzuki", nationality: "JPN", seed: 16 },
  { name: "Mia Vandenberg", nationality: "NED", seed: null },
  { name: "Clara Hoffmann", nationality: "GER", seed: null },
  { name: "Isabella Santos", nationality: "BRA", seed: null },
  { name: "Kristina Johansson", nationality: "SWE", seed: null },
  { name: "Natasha Petrova", nationality: "RUS", seed: null },
  { name: "Alicia Moreno", nationality: "ESP", seed: null },
  { name: "Fiona Walsh", nationality: "IRL", seed: null },
  { name: "Layla Hassan", nationality: "EGY", seed: null },
  { name: "Emilee Zhang", nationality: "CAN", seed: null },
  { name: "Renata Lima", nationality: "BRA", seed: null },
  { name: "Kirsten Muller", nationality: "GER", seed: null },
  { name: "Soo-Jin Park", nationality: "KOR", seed: null },
  { name: "Chiara Lombardi", nationality: "ITA", seed: null },
  { name: "Anastasia Kuznetsova", nationality: "RUS", seed: null },
  { name: "Marta Villarreal", nationality: "ESP", seed: null },
  { name: "Tessa Dubois", nationality: "BEL", seed: null },
  { name: "Grace Whitfield", nationality: "AUS", seed: null },
  { name: "Yulia Savchenko", nationality: "UKR", seed: null },
  { name: "Léa Mercier", nationality: "FRA", seed: null },
  { name: "Amara Diallo", nationality: "SEN", seed: null },
  { name: "Rina Kawamoto", nationality: "JPN", seed: null },
  { name: "Elsa Lindgren", nationality: "SWE", seed: null },
  { name: "Priya Sharma", nationality: "IND", seed: null },
  { name: "Dana Kowalski", nationality: "POL", seed: null },
  { name: "Fernanda Castillo", nationality: "MEX", seed: null },
  { name: "Beatriz Fonseca", nationality: "POR", seed: null },
  { name: "Lily Forsythe", nationality: "CAN", seed: null },
  { name: "Alina Semenova", nationality: "BLR", seed: null },
  { name: "Miriam Schulz", nationality: "GER", seed: null },
  { name: "Pilar Ruiz", nationality: "ARG", seed: null },
  { name: "Aiko Mitsui", nationality: "JPN", seed: null },
  { name: "Nina Mäkinen", nationality: "FIN", seed: null },
  { name: "Roxy Hennessey", nationality: "USA", seed: null },
  { name: "Carmen Blanco", nationality: "ESP", seed: null },
  { name: "Tatiana Bogdan", nationality: "ROU", seed: null },
  { name: "Jade Pelletier", nationality: "FRA", seed: null },
  { name: "Kiri Ngata", nationality: "NZL", seed: null },
  { name: "Silvia Caruso", nationality: "ITA", seed: null },
  { name: "Hannah Brandt", nationality: "GER", seed: null },
  { name: "Chloe Morrison", nationality: "GBR", seed: null },
  { name: "Xiu Chen", nationality: "CHN", seed: null },
  { name: "Luisa Rocha", nationality: "BRA", seed: null },
  { name: "Fatima Benali", nationality: "MAR", seed: null },
  { name: "Sigrid Thorsen", nationality: "DEN", seed: null },
  { name: "Veronica Lozano", nationality: "COL", seed: null },
  { name: "Eszter Gal", nationality: "HUN", seed: null },
  { name: "Madeleine Dupont", nationality: "FRA", seed: null },
  { name: "Abby Callahan", nationality: "USA", seed: null },
  { name: "Vera Stankovic", nationality: "SRB", seed: null },
  { name: "Elena Bautista", nationality: "ESP", seed: null },
  { name: "Iris Verhagen", nationality: "NED", seed: null },
  { name: "Sofiya Marchenko", nationality: "UKR", seed: null },
  { name: "Saoirse Flynn", nationality: "IRL", seed: null },
  { name: "Mai Ishida", nationality: "JPN", seed: null },
  { name: "Robyn Fletcher", nationality: "AUS", seed: null },
  { name: "Katarina Boric", nationality: "CRO", seed: null },
  { name: "Lucia Palomino", nationality: "PER", seed: null },
  { name: "Alice Garnier", nationality: "FRA", seed: null },
  { name: "Dani Weiss", nationality: "ISR", seed: null },
  { name: "Sofia Vasquez", nationality: "VEN", seed: null },
  { name: "Nora Christensen", nationality: "DEN", seed: null },
  { name: "Ingeborg Hauge", nationality: "NOR", seed: null },
  { name: "Wanjiru Kariuki", nationality: "KEN", seed: null },
  { name: "Rosa Ferrando", nationality: "ITA", seed: null },
  { name: "Emilia Wróbel", nationality: "POL", seed: null },
  { name: "Hana Fujimoto", nationality: "JPN", seed: null },
  { name: "Tara Malone", nationality: "IRL", seed: null },
  { name: "Nathalie Bouchard", nationality: "CAN", seed: null },
  { name: "Claudia Ríos", nationality: "CHI", seed: null },
  { name: "Sophie Laurent", nationality: "FRA", seed: null },
  { name: "Ayşe Kaya", nationality: "TUR", seed: null },
  { name: "Mariam Dadiani", nationality: "GEO", seed: null },
  { name: "Alena Horak", nationality: "CZE", seed: null },
  { name: "Leona Shepherd", nationality: "GBR", seed: null },
  { name: "Paula Gimenez", nationality: "ARG", seed: null },
  { name: "Megan Tremblay", nationality: "CAN", seed: null },
  { name: "Hiromi Nishida", nationality: "JPN", seed: null },
  { name: "Alexia Moreau", nationality: "FRA", seed: null },
  { name: "Anya Baranova", nationality: "RUS", seed: null },
  { name: "Giulia Conti", nationality: "ITA", seed: null },
  { name: "Nadia Hassan", nationality: "EGY", seed: null },
  { name: "Kira Engel", nationality: "GER", seed: null },
  { name: "Florencia Soto", nationality: "URU", seed: null },
  { name: "Abena Asante", nationality: "GHA", seed: null },
  { name: "Yuna Kim", nationality: "KOR", seed: null },
  { name: "Pauline Jacobs", nationality: "NED", seed: null },
  { name: "Sara Holm", nationality: "SWE", seed: null },
  { name: "Isadora Sousa", nationality: "BRA", seed: null },
  { name: "Thandi Dlamini", nationality: "RSA", seed: null },
  { name: "Rosa Carbonell", nationality: "ESP", seed: null },
  { name: "Petra Blazic", nationality: "SLO", seed: null },
  { name: "Lauren Beckett", nationality: "USA", seed: null },
  { name: "Aisha Diop", nationality: "SEN", seed: null },
  { name: "Maja Pettersson", nationality: "SWE", seed: null },
  { name: "Eva Balog", nationality: "HUN", seed: null },
  { name: "Carla Ramos", nationality: "MEX", seed: null },
  { name: "Natsumi Ito", nationality: "JPN", seed: null },
  { name: "Svetlana Orlova", nationality: "RUS", seed: null },
  { name: "Claudine Petit", nationality: "FRA", seed: null },
  { name: "Tamara Ilic", nationality: "SRB", seed: null },
  { name: "Mei-Ling Wu", nationality: "TPE", seed: null },
  { name: "Sabrina Köhler", nationality: "GER", seed: null },
  { name: "Cecilia Cruz", nationality: "ARG", seed: null },
  { name: "Amy Thornton", nationality: "GBR", seed: null },
  { name: "Vivienne Chevalier", nationality: "FRA", seed: null },
  { name: "Daria Kovalchuk", nationality: "UKR", seed: null },
  { name: "Ji-Eun Lee", nationality: "KOR", seed: null },
  { name: "Orla Kennedy", nationality: "IRL", seed: null },
  { name: "Mia Hartmann", nationality: "GER", seed: null },
  { name: "Selin Yildiz", nationality: "TUR", seed: null },
  { name: "Bongiwe Zulu", nationality: "RSA", seed: null },
  { name: "Camila Velez", nationality: "COL", seed: null },
];

const DEFAULT_POINT_CONFIGS = [
  { round: 1, label: "R128", points: 1 },
  { round: 2, label: "R64", points: 2 },
  { round: 3, label: "R32", points: 3 },
  { round: 4, label: "R16", points: 5 },
  { round: 5, label: "Quarterfinal", points: 8 },
  { round: 6, label: "Semifinal", points: 13 },
  { round: 7, label: "Final", points: 21 },
];

async function seedDraw(
  drawId: string,
  players: typeof MENS_PLAYERS
) {
  // Create all 128 players
  const created = await Promise.all(
    players.map((p) =>
      prisma.player.create({
        data: {
          name: p.name,
          nationality: p.nationality,
          seed: p.seed ?? null,
        },
      })
    )
  );

  // Standard seeding pairs: 1v128, 2v127, 3v126, ... 64v65
  // First 16 players are seeded; the seeded draw places them in specific sections
  // For simplicity use the standard formula: position i pairs with position (129-i)
  const r1Matches = [];
  for (let i = 0; i < 64; i++) {
    r1Matches.push({
      drawId,
      round: 1,
      position: i + 1,
      player1Id: created[i].id,
      player2Id: created[127 - i].id,
    });
  }

  // Placeholder matches for rounds 2–7
  const laterMatches = [];
  for (let round = 2; round <= 7; round++) {
    const count = 64 / Math.pow(2, round - 1);
    for (let pos = 1; pos <= count; pos++) {
      laterMatches.push({ drawId, round, position: pos, player1Id: null, player2Id: null });
    }
  }

  await prisma.match.createMany({ data: [...r1Matches, ...laterMatches] });

  console.log(`  → Created ${created.length} players and ${r1Matches.length + laterMatches.length} matches`);
}

async function main() {
  console.log("🎾 Seeding Test Slam tournament...");

  // Clean up existing test data
  const existing = await prisma.tournament.findUnique({ where: { slug: "test-slam-2026" } });
  if (existing) {
    console.log("  Removing existing Test Slam...");
    await prisma.tournament.delete({ where: { id: existing.id } });
  }

  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      name: "Test Slam 2026",
      slug: "test-slam-2026",
      major: "WIMBLEDON",
      year: 2026,
      status: "ACCEPTING_PICKS",
      startDate: new Date("2026-06-29"),
      endDate: new Date("2026-07-13"),
      pointConfigs: { create: DEFAULT_POINT_CONFIGS },
      draws: { create: [{ gender: "MENS" }, { gender: "WOMENS" }] },
    },
    include: { draws: true },
  });

  console.log(`  ✓ Tournament created: ${tournament.name}`);

  const mensDraw = tournament.draws.find((d) => d.gender === "MENS")!;
  const womensDraw = tournament.draws.find((d) => d.gender === "WOMENS")!;

  console.log("  Seeding Men's draw...");
  await seedDraw(mensDraw.id, MENS_PLAYERS);

  console.log("  Seeding Women's draw...");
  await seedDraw(womensDraw.id, WOMENS_PLAYERS);

  console.log("\n✅ Done! Visit http://localhost:3000 to see the tournament.");
  console.log("   Sign up as admin → go to Admin → Test Slam to manage it.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
