import { openMeteo } from "../src/open-meteo/index.js";

async function main() {
  const inland = await openMeteo.getForecastForLocation("Paris");
  const coast = await openMeteo.getForecastForLocation("Biarritz");

  console.log(
    JSON.stringify(
      {
        inland: {
          name: inland.location.name,
          marine: inland.marineAvailable,
          days: inland.days.length,
          wave0: inland.days[0]?.waveHeightMaxM ?? null,
          temp0: inland.days[0]?.temperatureMaxC,
        },
        coast: {
          name: coast.location.name,
          marine: coast.marineAvailable,
          days: coast.days.length,
          wave0: coast.days[0]?.waveHeightMaxM ?? null,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
