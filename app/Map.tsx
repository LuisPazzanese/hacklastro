"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BRASIL: [number, number] = [-14.2, -51.9];

export default function Map({
  imoveis,
  onSelect,
  onEstadoClick,
}: {
  imoveis: any[];
  onSelect: (im: any) => void;
  onEstadoClick?: (estado: string) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (mapRef.current) return;
    const bounds = L.latLngBounds(
      L.latLng(-38, -80),
      L.latLng(10, -28),
    );
    const map = L.map("map", {
      zoomControl: false,
      attributionControl: false,
      minZoom: 4,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
    }).setView(BRASIL, 5);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Pane de overlay (abaixo dos pins mas acima dos tiles)
    const overlayPane = map.createPane("worldOverlay");
    overlayPane.style.zIndex = "350";
    overlayPane.style.pointerEvents = "none";

    // Pane dos estados do Brasil (acima do overlay)
    const brazilPane = map.createPane("brazilStates");
    brazilPane.style.zIndex = "360";

    // Retângulo escuro cobrindo o mundo inteiro
    L.rectangle([[-90, -180], [90, 180]], {
      pane: "worldOverlay",
      fillColor: "#1a1614",
      fillOpacity: 0.32,
      stroke: false,
      interactive: false,
    } as L.PathOptions).addTo(map);

    // Estados brasileiros "pintados" por cima com a cor de fundo
    // → Brasil aparece claro, resto do mundo fica escuro
    fetch("https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson")
      .then((r) => r.json())
      .then((geojson) => {
        let estadosLayer: L.GeoJSON;
        estadosLayer = L.geoJSON(geojson, {
          pane: "brazilStates",
          style: {
            fillColor: "#f5f2ed",
            fillOpacity: 0.92,
            color: "#b8aee8",
            weight: 1.2,
            opacity: 0.8,
          },
          onEachFeature: (feature, layer) => {
            const nome: string = feature.properties?.name ?? feature.properties?.nome ?? "";
            layer.on({
              mouseover(e) {
                e.target.setStyle({ fillColor: "#6d44c0", fillOpacity: 0.18, color: "#6d44c0", weight: 2 });
              },
              mouseout() {
                estadosLayer.resetStyle(layer);
              },
              click(e) {
                const b = (e.target as L.Path & { getBounds?: () => L.LatLngBounds }).getBounds?.();
                if (b) map.flyToBounds(b, { duration: 0.8, padding: [40, 40] });
                if (nome && onEstadoClick) onEstadoClick(nome);
              },
            });
            layer.bindTooltip(nome, { sticky: true, className: "estado-tooltip" });
          },
        }).addTo(map);
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

    if (!imoveis.length) {
      map.flyTo(BRASIL, 4, { duration: 1 });
      return;
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
