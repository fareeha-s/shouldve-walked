'use client';

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { AnalysisResult } from '@/lib/types';

interface RouteMapProps {
  data: AnalysisResult;
}

export default function RouteMap({ data }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  useEffect(() => {
    const initMap = async () => {
      // Check if Google Maps is already loaded
      if (!window.google) {
        const loader = new Loader({
          apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
          version: 'weekly',
          libraries: ['places', 'geometry'],
        });

        await loader.load();
      }

      if (mapRef.current && window.google) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: {
            lat: (data.route.bounds.north + data.route.bounds.south) / 2,
            lng: (data.route.bounds.east + data.route.bounds.west) / 2,
          },
          zoom: 14,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
            {
              featureType: 'administrative.locality',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#000000' }],
            },
            {
              featureType: 'poi',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#666666' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'geometry',
              stylers: [{ color: '#d4e9d4' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#3d7a3d' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry',
              stylers: [{ color: '#ffffff' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#d0d0d0' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry',
              stylers: [{ color: '#f0f0f0' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#c0c0c0' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#c9e4f5' }],
            },
            {
              featureType: 'water',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#5a8fad' }],
            },
          ],
          disableDefaultUI: true,
          zoomControl: true,
        });

        mapInstanceRef.current = map;

        // Decode and draw the route
        const path = window.google.maps.geometry.encoding.decodePath(data.route.polyline);
        new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: '#0066ff',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          map,
        });

        // Add markers for POIs
        data.pointsOfInterest.forEach((poi) => {
          new window.google.maps.Marker({
            position: poi.location,
            map,
            title: poi.name,
          });
        });

        // Fit bounds to show entire route
        const bounds = new window.google.maps.LatLngBounds(
          { lat: data.route.bounds.south, lng: data.route.bounds.west },
          { lat: data.route.bounds.north, lng: data.route.bounds.east }
        );
        map.fitBounds(bounds);
      }
    };

    initMap();
  }, [data]);

  return <div ref={mapRef} className="w-full h-[300px] md:h-[450px] lg:h-[500px]" style={{ backgroundColor: "var(--th-surface)", border: "3px solid var(--th-border)", boxShadow: "var(--th-shadow-lg)" }} />;
}
