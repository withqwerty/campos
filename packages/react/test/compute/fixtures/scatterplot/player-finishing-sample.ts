export type PlayerFinishingPoint = {
  playerId: string;
  name: string;
  team: string;
  xg: number;
  goals: number;
  shots: number;
  minutes: number;
};

export const playerFinishingSample: PlayerFinishingPoint[] = [
  {
    playerId: "haaland",
    name: "Erling Haaland",
    team: "Man City",
    xg: 18.1,
    goals: 27,
    shots: 95,
    minutes: 2200,
  },
  {
    playerId: "salah",
    name: "Mohamed Salah",
    team: "Liverpool",
    xg: 12.5,
    goals: 18,
    shots: 85,
    minutes: 2600,
  },
  {
    playerId: "palmer",
    name: "Cole Palmer",
    team: "Chelsea",
    xg: 11.8,
    goals: 16,
    shots: 78,
    minutes: 2900,
  },
  {
    playerId: "watkins",
    name: "Ollie Watkins",
    team: "Villa",
    xg: 10.3,
    goals: 13,
    shots: 72,
    minutes: 2700,
  },
  {
    playerId: "saka",
    name: "Bukayo Saka",
    team: "Arsenal",
    xg: 8.2,
    goals: 14,
    shots: 60,
    minutes: 2800,
  },
];
