type UnitSystem = "metric" | "imperial";
interface AppConfig {
  darkMode: boolean;
  unitSystem: UnitSystem;
}
interface FormattedValue {
  value: number;
  units: string;
  unitSystem?: UnitSystem;
}
function formatValue(value: FormattedValue) {
  return value.value;
}

interface Hike {
  miles: number;
  hours: number;
}
function formatHike({ miles, hours }: Hike, config: AppConfig) {
  const { unitSystem } = config;
  const distanceDisplay = formatValue({
    value: miles,
    units: "miles",
    unitSystem,
  });
  const paceDisplay = formatValue({ value: miles / hours, units: "mph" });
  return `${distanceDisplay} at ${paceDisplay}`;
}

console.log(
  formatHike({ miles: 1, hours: 1 }, { darkMode: true, unitSystem: "metric" })
);
