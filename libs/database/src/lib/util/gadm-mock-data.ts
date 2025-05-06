import { faker } from "@faker-js/faker";
import { merge } from "lodash";

export const COUNTRIES = {
  ESP: "Spain",
  USA: "United States",
  MEX: "México",
  CHL: "Chile"
} as const;

type Country = keyof typeof COUNTRIES;

export const fakerCountries = (num = 1) => faker.helpers.uniqueArray(Object.keys(COUNTRIES), num) as Country[];

export const gadmLevel0Mock = async () => Object.entries(COUNTRIES).map(([iso, name]) => ({ iso, name }));

export const STATES = {
  ESP: {
    "ESP.4_1": "Castilla-La Mancha",
    "ESP.5_1": "Castilla y León",
    "ESP.6_1": "Cataluña",
    "ESP.12_1": "Galicia",
    "ESP.1_1": "Andalucía",
    "ESP.2_1": "Aragón",
    "ESP.3_1": "Cantabria",
    "ESP.7_1": "Ceuta y Melilla",
    "ESP.8_1": "Comunidad de Madrid",
    "ESP.9_1": "Comunidad Foral de Navarra",
    "ESP.10_1": "Comunidad Valenciana",
    "ESP.11_1": "Extremadura",
    "ESP.13_1": "Islas Baleares",
    "ESP.14_1": "Islas Canarias",
    "ESP.15_1": "La Rioja",
    "ESP.16_1": "País Vasco",
    "ESP.17_1": "Principado de Asturias",
    "ESP.18_1": "Región de Murcia"
  },
  USA: {
    "USA.1_1": "Alabama",
    "USA.2_1": "Alaska",
    "USA.41_1": "South Carolina",
    "USA.42_1": "South Dakota",
    "USA.43_1": "Tennessee",
    "USA.44_1": "Texas",
    "USA.45_1": "Utah",
    "USA.46_1": "Vermont",
    "USA.47_1": "Virginia",
    "USA.48_1": "Washington",
    "USA.49_1": "West Virginia",
    "USA.50_1": "Wisconsin",
    "USA.36_1": "Ohio",
    "USA.3_1": "Arizona",
    "USA.4_1": "Arkansas",
    "USA.5_1": "California",
    "USA.9_1": "District of Columbia",
    "USA.10_1": "Florida",
    "USA.11_1": "Georgia",
    "USA.12_1": "Hawaii",
    "USA.13_1": "Idaho",
    "USA.14_1": "Illinois",
    "USA.15_1": "Indiana",
    "USA.16_1": "Iowa",
    "USA.17_1": "Kansas",
    "USA.18_1": "Kentucky",
    "USA.19_1": "Louisiana",
    "USA.20_1": "Maine",
    "USA.21_1": "Maryland",
    "USA.22_1": "Massachusetts",
    "USA.23_1": "Michigan",
    "USA.24_1": "Minnesota",
    "USA.25_1": "Mississippi",
    "USA.26_1": "Missouri",
    "USA.27_1": "Montana",
    "USA.28_1": "Nebraska",
    "USA.29_1": "Nevada",
    "USA.30_1": "New Hampshire",
    "USA.31_1": "New Jersey",
    "USA.32_1": "New Mexico",
    "USA.33_1": "New York",
    "USA.34_1": "North Carolina",
    "USA.35_1": "North Dakota",
    "USA.37_1": "Oklahoma",
    "USA.38_1": "Oregon",
    "USA.39_1": "Pennsylvania",
    "USA.40_1": "Rhode Island",
    "USA.6_1": "Colorado",
    "USA.7_1": "Connecticut",
    "USA.8_1": "Delaware",
    "USA.51_1": "Wyoming"
  },
  MEX: {
    "MEX.5_1": "Chiapas",
    "MEX.26_1": "Sonora",
    "MEX.27_1": "Tabasco",
    "MEX.28_1": "Tamaulipas",
    "MEX.29_1": "Tlaxcala",
    "MEX.30_1": "Veracruz",
    "MEX.31_1": "Yucatán",
    "MEX.32_1": "Zacatecas",
    "MEX.18_1": "Nayarit",
    "MEX.19_1": "Nuevo León",
    "MEX.20_1": "Oaxaca",
    "MEX.21_1": "Puebla",
    "MEX.22_1": "Querétaro",
    "MEX.11_1": "Guanajuato",
    "MEX.12_1": "Guerrero",
    "MEX.13_1": "Hidalgo",
    "MEX.14_1": "Jalisco",
    "MEX.15_1": "México",
    "MEX.16_1": "Michoacán",
    "MEX.17_1": "Morelos",
    "MEX.23_1": "Quintana Roo",
    "MEX.24_1": "San Luis Potosí",
    "MEX.25_1": "Sinaloa",
    "MEX.4_1": "Campeche",
    "MEX.6_1": "Chihuahua",
    "MEX.7_1": "Coahuila",
    "MEX.8_1": "Colima",
    "MEX.9_1": "Distrito Federal",
    "MEX.10_1": "Durango",
    "MEX.1_1": "Aguascalientes",
    "MEX.3_1": "Baja California",
    "MEX.2_1": "Baja California Sur"
  },
  CHL: {
    "CHL.6_1": "Bío-Bío",
    "CHL.7_1": "Coquimbo",
    "CHL.8_1": "Libertador General Bernardo O'Hi",
    "CHL.2_1": "Antofagasta",
    "CHL.3_1": "Araucanía",
    "CHL.4_1": "Arica y Parinacota",
    "CHL.5_1": "Atacama",
    "CHL.1_1": "Aysén del General Ibañez del Cam",
    "CHL.9_1": "Los Lagos",
    "CHL.10_1": "Los Ríos",
    "CHL.11_1": "Magallanes y Antártica Chilena",
    "CHL.12_1": "Maule",
    "CHL.13_1": "Ñuble",
    "CHL.14_1": "Santiago Metropolitan",
    "CHL.15_1": "Tarapacá",
    "CHL.16_1": "Valparaíso"
  }
} as const;

export const fakerStates = (countries: Country[], num = 1) => {
  const options = Object.keys(merge({}, ...countries.map(country => STATES[country])));
  return faker.helpers.uniqueArray(options, num);
};

export const gadmLevel1Mock = async (level0: Country) =>
  Object.entries(STATES[level0]).map(([id, name]) => ({ id, name }));
