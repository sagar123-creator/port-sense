/** Illustrative policy dashboard aggregates for demo / ministry pitch. */
export const GOVT_INSIGHTS = {
  totalEstimatedLossINR: 284000000,
  highRiskPorts: 2,
  portsTracked: 5,
  peakSeason: "Oct–Dec (festival export surge)",
  portLossRanking: [
    { port: "JNPT (Nhava Sheva)", lossINR: 98000000, share: 34.5 },
    { port: "Chennai", lossINR: 62000000, share: 21.8 },
    { port: "Kolkata", lossINR: 41000000, share: 14.4 },
    { port: "Visakhapatnam", lossINR: 32000000, share: 11.3 },
  ],
  seasonalIndex: [
    { season: "Pre-monsoon (Apr–Jun)", index: 72 },
    { season: "Monsoon (Jul–Sep)", index: 85 },
    { season: "Festival peak (Oct–Dec)", index: 94 },
    { season: "Post-harvest (Jan–Mar)", index: 68 },
  ],
  monthlyTrend: [
    { month: "Mar", congestion: 58 },
    { month: "Apr", congestion: 62 },
    { month: "May", congestion: 65 },
    { month: "Jun", congestion: 61 },
    { month: "Jul", congestion: 70 },
    { month: "Aug", congestion: 74 },
  ],
};
