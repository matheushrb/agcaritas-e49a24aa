import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudLightning, CloudFog, MapPin, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const STORAGE_KEY = "caritas.weather.place";

type Place = { name: string; region: string; latitude: number; longitude: number };

const DEFAULT_PLACE: Place = { name: "São Paulo", region: "São Paulo · BR", latitude: -23.5475, longitude: -46.63611 };

function iconFor(code: number) {
  if (code === 0) return Sun;
  if (code <= 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return CloudRain;
}

function labelFor(code: number) {
  if (code === 0) return "Céu limpo";
  if (code <= 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Neblina";
  if (code >= 51 && code <= 67) return "Chuvisco";
  if (code >= 71 && code <= 77) return "Neve";
  if (code >= 80 && code <= 82) return "Pancadas de chuva";
  if (code >= 95) return "Tempestade";
  return "Chuva";
}

export function TopbarWeather() {
  const [place, setPlace] = useState<Place>(DEFAULT_PLACE);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Place;
        if (typeof parsed?.latitude === "number" && typeof parsed?.longitude === "number") setPlace(parsed);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["weather-search", debounced],
    enabled: debounced.length >= 2,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Place[]> => {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(debounced)}&count=6&language=pt&format=json`,
      );
      const json = await res.json();
      return (json?.results ?? []).map((p: Record<string, unknown>) => ({
        name: String(p.name),
        region: [p.admin1, p.country_code].filter(Boolean).join(" · "),
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
      }));
    },
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["weather", place.latitude, place.longitude],
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`,
      );
      if (!wRes.ok) throw new Error("Falha ao buscar o clima");
      const w = await wRes.json();
      return {
        temp: Math.round(w.current.temperature_2m),
        feels: Math.round(w.current.apparent_temperature),
        humidity: Math.round(w.current.relative_humidity_2m),
        code: Number(w.current.weather_code),
        max: Math.round(w.daily.temperature_2m_max[0]),
        min: Math.round(w.daily.temperature_2m_min[0]),
      };
    },
  });

  const Icon = iconFor(data?.code ?? 3);

  const choose = (p: Place) => {
    setPlace(p);
    setQuery("");
    setDebounced("");
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cv-theme" title={`Clima em ${place.name}`}>
          <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 12 }}>
            {isLoading ? "..." : isError ? "--" : `${data?.temp}°`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-3">
        {isError && <p style={{ fontSize: 12, color: "var(--danger)" }}>Não foi possível carregar o clima.</p>}
        {data && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon className="h-8 w-8" style={{ color: "var(--primary)" }} />
              <div>
                <strong style={{ fontSize: 22, lineHeight: 1 }}>{data.temp}°C</strong>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{labelFor(data.code)}</div>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin className="h-3 w-3" style={{ color: "var(--muted)" }} />
              <span><b>{place.name}</b> <span style={{ color: "var(--muted)" }}>{place.region}</span></span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              {`Máx ${data.max}° · Mín ${data.min}° · Sensação ${data.feels}° · Umidade ${data.humidity}%`}
            </div>
          </>
        )}

        <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <div style={{ position: "relative" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cidade..."
              style={{
                width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 8,
                border: "1px solid var(--border)", background: "transparent", color: "inherit",
              }}
            />
            {searching && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ position: "absolute", right: 8, top: 8, color: "var(--muted)" }} />
            )}
          </div>

          {debounced.length >= 2 && (
            <div style={{ marginTop: 6, maxHeight: 168, overflowY: "auto", display: "grid", gap: 2 }}>
              {results.length === 0 && !searching && (
                <p style={{ fontSize: 12, color: "var(--muted)", padding: "4px 2px" }}>Nenhuma cidade encontrada.</p>
              )}
              {results.map((p) => (
                <button
                  key={`${p.latitude},${p.longitude}`}
                  type="button"
                  onClick={() => choose(p)}
                  style={{
                    textAlign: "left", fontSize: 12, padding: "6px 8px", borderRadius: 8,
                    background: "transparent", color: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <b>{p.name}</b> <span style={{ color: "var(--muted)" }}>{p.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
