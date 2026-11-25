const searchInput = document.querySelector("#search");
const container = document.querySelector(".container");
const body = document.querySelector(".main");
const loader = document.querySelector(".loader");
const title = document.querySelector(".title");
const form = document.querySelector("form");

const API_URL = "https://api.restcountries.com/countries/v5";
const API_KEY = "rc_live_d0d540360de7417aba9b019be18282db";
const FALLBACK_API_V3 = "https://restcountries.com/v3.1";

const WEATHER_API_KEY = "TU_API_KEY_OPENWEATHER";
const WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/weather";

let debounceTimer = null;
let currentController = null;

form.addEventListener("submit", (e) => {
  e.preventDefault();
});

const extractCountriesArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data?.data?.objects)) return data.data.objects;
  if (Array.isArray(data?.objects)) return data.objects;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const getCountryName = (country) => {
  if (!country || typeof country !== "object") return "Sin nombre";
  return (
    country.names?.common ||
    country.names?.official ||
    country.name?.common ||
    country.name?.official ||
    (typeof country.name === "string" ? country.name : "") ||
    "Sin nombre"
  );
};

const getFallbackFlag = (country) => {
  const alpha2 = (
    country?.codes?.alpha_2 ||
    country?.codes?.alpha2 ||
    country?.cca2 ||
    ""
  ).toLowerCase();
  return alpha2 ? `https://flagcdn.com/w640/${alpha2}.png` : "";
};

const getCountryFlag = (country) => {
  if (!country || typeof country !== "object") return "";

  const candidates = [
    country.flag?.url_svg,
    country.flag?.url_png,
    country.flag?.uri_svg,
    country.flag?.uri_png,
    country.flag?.svg,
    country.flag?.png,
    country.flags?.svg,
    country.flags?.png,
    typeof country.flag === "string" ? country.flag : "",
    typeof country.flags === "string" ? country.flags : "",
    getFallbackFlag(country),
  ];

  return (
    candidates.find((val) => typeof val === "string" && val.startsWith("http")) || ""
  );
};

const getCountryPopulation = (country) => {
  const pop = country?.population;
  if (typeof pop === "number") return pop.toLocaleString("de-DE");
  if (typeof pop === "string" && pop.trim() !== "" && !Number.isNaN(Number(pop))) {
    return Number(pop).toLocaleString("de-DE");
  }
  return "0";
};

const getCountryCapital = (country) => {
  const caps = country?.capitals || country?.capital;
  if (Array.isArray(caps) && caps.length > 0) {
    const first = caps[0];
    if (typeof first === "string") return first;
    return first?.name || first?.common || "No disponible";
  }
  if (typeof caps === "string" && caps.trim() !== "") return caps;
  return "No disponible";
};

const getCountryLatLng = (country) => {
  if (
    country?.coordinates &&
    typeof country.coordinates.lat === "number" &&
    typeof country.coordinates.lng === "number"
  ) {
    return [country.coordinates.lat, country.coordinates.lng];
  }
  if (Array.isArray(country?.latlng) && country.latlng.length === 2) {
    return country.latlng;
  }
  return null;
};

const getWeather = async (capital, latlng) => {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === "TU_API_KEY_OPENWEATHER") return null;
  try {
    let url = "";
    if (capital && capital !== "No disponible") {
      url = `${WEATHER_API_URL}?q=${encodeURIComponent(capital)}&appid=${WEATHER_API_KEY}&units=metric&lang=es`;
    } else if (Array.isArray(latlng) && latlng.length === 2) {
      url = `${WEATHER_API_URL}?lat=${latlng[0]}&lon=${latlng[1]}&appid=${WEATHER_API_KEY}&units=metric&lang=es`;
    } else {
      return null;
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error al obtener clima:", error);
    return null;
  }
};

const renderSingleCountry = async (country) => {
  const name = getCountryName(country);
  const flag = getCountryFlag(country);
  const fallback = getFallbackFlag(country);
  const capital = getCountryCapital(country);
  const population = getCountryPopulation(country);
  const region = country.region || "No disponible";
  const subregion = country.subregion || "No disponible";
  const timezone = Array.isArray(country.timezones)
    ? country.timezones[0] || "No disponible"
    : country.timezones || "No disponible";

  container.innerHTML = "";
  loader.classList.add("active");

  const weatherData = await getWeather(capital, getCountryLatLng(country));

  loader.classList.remove("active");

  if (searchInput.value.trim() === "") return;

  const description = weatherData?.weather?.[0]?.description || "";
  const icon = weatherData?.weather?.[0]?.icon || "";
  const temp =
    weatherData?.main?.temp !== undefined ? `${weatherData.main.temp} °C` : "";

  const iconHtml = icon
    ? `<img src="https://openweathermap.org/img/wn/${icon}.png" alt="${description}" />`
    : "";

  const weatherBarContent = temp
    ? `
    <div class="weather-bar">
      <div class="weather-item">
        ${iconHtml}
        <span>${description}</span>
      </div>
      <span class="weather-divider">|</span>
      <div class="weather-item">
        <span>${temp}</span>
      </div>
    </div>
  `
    : "";

  container.innerHTML = `
    <article class="single-country-card">
      <div class="single-flag-section">
        <img
          src="${flag}"
          alt="Bandera de ${name}"
          data-fallback="${fallback}"
          onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){ this.src = this.dataset.fallback; } else { this.style.display='none'; }"
        />
        ${weatherBarContent}
      </div>
      <div class="single-info-section">
        <h2 class="single-info-title">${name}</h2>
        <p class="single-info-item">Capital: ${capital}</p>
        <p class="single-info-item">Población: ${population} habitantes</p>
        <p class="single-info-item">Región: ${region}</p>
        <p class="single-info-item">Subregión: ${subregion}</p>
        <p class="single-info-item">Zona horaria: ${timezone}</p>
      </div>
    </article>
  `;
};

const renderCountryList = (filteredCountries) => {
  const grid = document.createElement("div");
  grid.classList.add("countries-grid");

  filteredCountries.forEach((country) => {
    const name = getCountryName(country);
    const flag = getCountryFlag(country);
    const fallback = getFallbackFlag(country);

    const card = document.createElement("div");
    card.classList.add("country-card");
    card.innerHTML = `
      <img
        src="${flag}"
        alt="Bandera de ${name}"
        data-fallback="${fallback}"
        onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback){ this.src = this.dataset.fallback; } else { this.style.display='none'; }"
      />
      <p class="country-card-name">${name}</p>
    `;

    card.addEventListener("click", () => {
      searchInput.value = name;
      renderSingleCountry(country);
    });

    grid.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(grid);
};

const fetchCountriesWithFallback = async (query, signal) => {
  const normalized = query.toLowerCase();
  const aliasMap = {
    "estados unidos": "united states",
    "eeuu": "united states",
    "ee.uu.": "united states",
    "usa": "united states",
  };
  const mappedQuery = aliasMap[normalized] || query;

  // 1. Intento principal con v5
  try {
    const resV5 = await fetch(`${API_URL}?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal,
    });
    if (resV5.ok) {
      const dataV5 = await resV5.json();
      const listV5 = extractCountriesArray(dataV5);
      if (listV5.length > 0) return listV5;
    } else {
      console.warn("Respuesta HTTP no exitosa en v5:", resV5.status);
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    console.warn("Fallo en v5, usando respaldo v3.1:", err);
  }

  // 2. Respaldo por nombre en restcountries v3.1
  const resName = await fetch(
    `${FALLBACK_API_V3}/name/${encodeURIComponent(mappedQuery)}`,
    { signal }
  );
  if (resName.ok) {
    const dataName = await resName.json();
    const listName = extractCountriesArray(dataName);
    if (listName.length > 0) return listName;
  }

  // 3. Respaldo por traducción (útil para nombres en español)
  const resTrans = await fetch(
    `${FALLBACK_API_V3}/translation/${encodeURIComponent(query)}`,
    { signal }
  );
  if (resTrans.ok) {
    const dataTrans = await resTrans.json();
    return extractCountriesArray(dataTrans);
  }

  return [];
};

const performSearch = async (query) => {
  if (currentController) {
    currentController.abort();
  }
  currentController = new AbortController();

  body.classList.add("searching");
  title.classList.add("hidden");
  loader.classList.add("active");
  container.innerHTML = "";

  try {
    const filteredCountries = await fetchCountriesWithFallback(
      query,
      currentController.signal
    );

    loader.classList.remove("active");

    if (filteredCountries.length === 0) {
      container.innerHTML = `<p class="message-text">No se encontraron paises con ese nombre</p>`;
      return;
    }

    const normalizedQuery = query.toLowerCase();
    if (["estados unidos", "eeuu", "ee.uu.", "usa"].includes(normalizedQuery)) {
      const exactUS = filteredCountries.find(
        (c) =>
          getCountryName(c).toLowerCase() === "united states" ||
          c.codes?.alpha_3 === "USA" ||
          c.codes?.alpha_2 === "US" ||
          c.codes?.alpha3 === "USA" ||
          c.codes?.alpha2 === "US" ||
          c.cca3 === "USA" ||
          c.cca2 === "US"
      );
      if (exactUS) {
        await renderSingleCountry(exactUS);
        return;
      }
    }

    if (filteredCountries.length > 10) {
      container.innerHTML = `<p class="message-text">Demasiados paises, especifica mejor tu busqueda</p>`;
      return;
    }

    if (filteredCountries.length > 1 && filteredCountries.length <= 10) {
      renderCountryList(filteredCountries);
      return;
    }

    if (filteredCountries.length === 1) {
      await renderSingleCountry(filteredCountries[0]);
    }
  } catch (error) {
    if (error.name === "AbortError") return;
    loader.classList.remove("active");
    console.error("Error en la petición:", error);
    container.innerHTML = `<p class="message-text">No se encontraron paises con ese nombre</p>`;
  }
};

searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();
  clearTimeout(debounceTimer);

  if (currentController) {
    currentController.abort();
  }

  if (query === "") {
    body.classList.remove("searching");
    title.classList.remove("hidden");
    container.innerHTML = "";
    loader.classList.remove("active");
    return;
  }

  debounceTimer = setTimeout(() => {
    performSearch(query);
  }, 250);
});