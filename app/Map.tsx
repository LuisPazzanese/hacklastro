"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BRASIL: [number, number] = [-14.2, -51.9];

type Imovel = {
  id: string; tipo: string; cidade: string; bairro: string;
  preco: number; quartos: number; area: number; vagas: number;
  lat: number; lng: number; destaque: string;
  compatibilidade?: number; matchedFields?: string[];
};

export default function Map({
  imoveis,
  onSelect,
  onEstadoClick,
}: {
  imoveis: Imovel[];
  onSelect: (im: Imovel) => void;
  onEstadoClick?: (estado: string) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const estadosLayerRef = useRef<L.GeoJSON | null>(null);
  // false = zoomed in (hover desabilitado), true = zoom geral (hover ativo)
  const hoverAtivo = useRef(true);

  useEffect(() => {
    if (mapRef.current) return;
    const bounds = L.latLngBounds(L.latLng(-38, -80), L.latLng(10, -28));
    const map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    }).setView(BRASIL, 5);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
      .then((r) => r.json())
      .then((geojson) => {
        const estadosLayer = L.geoJSON(geojson, {
          style: {
            fillColor: "transparent",
            fillOpacity: 0,
            color: "#6d44c0",
            weight: 1.5,
            opacity: 0.5,
          },
          onEachFeature: (feature, layer) => {
            const nome: string = feature.properties?.name ?? feature.properties?.nome ?? "";
            layer.on({
              mouseover(e) {
                if (!hoverAtivo.current) return;
                e.target.setStyle({ fillColor: "#6d44c0", fillOpacity: 0.12, color: "#6d44c0", weight: 2, opacity: 0.9 });
              },
              mouseout() {
                if (!hoverAtivo.current) return;
                estadosLayer.resetStyle(layer);
              },
              click() {
                if (!hoverAtivo.current) return; // zoomed in: ignora clique no estado
                estadosLayer.resetStyle(layer);
                const b = (layer as L.Path & { getBounds?: () => L.LatLngBounds }).getBounds?.();
                if (b) map.flyToBounds(b, { duration: 0.8, padding: [40, 40] });
                if (nome && onEstadoClick) onEstadoClick(nome);
              },
            });
            layer.bindTooltip(nome, { sticky: true, className: "estado-tooltip" });
          },
        }).addTo(map);
        estadosLayerRef.current = estadosLayer;
      })
      .catch(() => {});

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, [onEstadoClick]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    map.invalidateSize();
    layer.clearLayers();

    const mapEl = document.getElementById("map");
    if (!imoveis.length) {
      hoverAtivo.current = true;
      mapEl?.classList.remove("has-imoveis");
      map.flyTo(BRASIL, 4, { duration: 1 });
      return;
    }

    hoverAtivo.current = false;
    mapEl?.classList.add("has-imoveis");
    if (estadosLayerRef.current) {
      estadosLayerRef.current.resetStyle(); // remove fill de todos os estados
    }

    const pontos: [number, number][] = [];
    imoveis.forEach((im) => {
      if (typeof im.lat !== "number" || typeof im.lng !== "number") return;
      pontos.push([im.lat, im.lng]);
      const label =
        im.preco >= 1_000_000
          ? `R$ ${(im.preco / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`
          : `R$ ${Math.round(im.preco / 1000)}k`;
      const icon = L.divIcon({
        className: "pin",
        html: `<div class="pin-inner">${label}</div>`,
        iconSize: [70, 26],
        iconAnchor: [35, 26],
      });
      L.marker([im.lat, im.lng], { icon })
        .addTo(layer)
        .on("click", () => onSelect(im));
    });

    if (pontos.length) {
      map.flyToBounds(L.latLngBounds(pontos).pad(0.4), { duration: 1.2, maxZoom: 13 });
    }
  }, [imoveis, onSelect]);

  return <div id="map" />;
}
