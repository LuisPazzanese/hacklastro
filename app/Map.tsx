"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BRASIL: [number, number] = [-14.2, -51.9];

export default function Map({
  imoveis,
  onSelect,
}: {
  imoveis: any[];
  onSelect: (im: any) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Inicializa o mapa uma vez, centrado no Brasil.
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(
      BRASIL,
      4,
    );
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
  }, []);

  // A cada nova busca, repõe os pins e dá zoom na região (efeito Zillow).
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (!imoveis.length) {
      map.flyTo(BRASIL, 4, { duration: 1 });
      return;
    }

    const pontos: [number, number][] = [];
    imoveis.forEach((im) => {
      if (typeof im.lat !== "number" || typeof im.lng !== "number") return;
      pontos.push([im.lat, im.lng]);
      const icon = L.divIcon({
        className: "pin",
        html: `<div class="pin-inner">R$ ${Math.round(im.preco / 1000)}k</div>`,
        iconSize: [60, 26],
        iconAnchor: [30, 26],
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
