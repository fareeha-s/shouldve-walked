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
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        version: 'weekly',
        libraries: ['places', 'geometry'],
      });

      await loader.load();

      if (mapRef.current && window.google) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: {
            lat: (data.route.bounds.north + data.route.bounds.south) / 2,
            lng: (data.route.bounds.east + data.route.bounds.west) / 2,
          },
          zoom: 14,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0a' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
            {
              featureType: 'administrative.locality',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d59563' }],
            },
            {
              featureType: 'poi',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#d59563' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'geometry',
              stylers: [{ color: '#1f2a1f' }],
            },
            {
              featureType: 'poi.park',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#6b9a76' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry',
              stylers: [{ color: '#2a2a2a' }],
            },
            {
              featureType: 'road',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#1f1f1f' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry',
              stylers: [{ color: '#3a3a3a' }],
            },
            {
              featureType: 'road.highway',
              elementType: 'geometry.stroke',
              stylers: [{ color: '#2f2f2f' }],
            },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#0f1419' }],
            },
            {
              featureType: 'water',
              elementType: 'labels.text.fill',
              stylers: [{ color: '#515c6d' }],
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
          strokeColor: '#ededed',
          strokeOpacity: 1.0,
          strokeWeight: 3,
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

  return <div ref={mapRef} className="w-full h-[400px] md:h-[500px] bg-[#1a1a1a]" />;
}
