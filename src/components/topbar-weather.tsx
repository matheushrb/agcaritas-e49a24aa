import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cloud, CloudRain, CloudSnow, Sun, CloudSun, CloudLightning, CloudFog, MapPin } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const STORAGE_KEY = "caritas.weather.city";
const DEFAULT_CITY = "São Paulo";

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
  const [city, setCity] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CITY;
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_CITY;
  });
  const [draft, setDraft] = useState(city);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["weather", city],
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`,
      );
      const geo = await geoRes.json();
      const place = geo?.results?.[0];
      if (!place) throw new Error("Cidade não encontrada");
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code` +
          `&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`,
      );
      const w = await wRes.json();
      return {
        name: place.name as string,
        region: [place.admin1, place.country_code].filter(Boolean).join(" · "),
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

  const apply = () => {
    const next = draft.trim();
    if (!next) return;
    setCity(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cv-theme" title={`Clima em ${city}`}>
          <Icon className="h-4 w-4" style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: 12 }}>
            {isLoading ? "..." : isError ? "--" : `${data?.temp}°`}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[268px] p-3">
        {isError && <p style={{ fontSize: 12, color: "var(--danger)" }}>Não encontramos essa cidade.</p>}
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
              <span><b>{data.name}</b> <span style={{ color: "var(--muted)" }}>{data.region}</span></span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--muted)" }}>
              {`Máx ${data.max}° · Mín ${data.min}° · Sensação ${data.feels}° · Umidade ${data.humidity}%`}
            </div>
          </>
        )}
        <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            placeholder="Trocar cidade"
            style={{
              flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent", color: "inherit",
            }}
          />
          <button
            type="button"
            onClick={apply}
            style={{
              fontSize: 12, padding: "6px 10px", borderRadius: 8,
              background: "var(--primary)", color: "#fff", fontWeight: 500,
            }}
          >
            Ok
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
