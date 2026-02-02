'use client';

import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useState } from 'react';
import { supabase } from '@/app/lib/supabase';
import { MapPinned } from 'lucide-react';

type Deal = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  area: string | null;
  city: string | null;
};

export default function MapPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [selected, setSelected] = useState<Deal | null>(null);

  useEffect(() => {
    const fetchDeals = async () => {
      const { data } = await supabase
        .from('deals')
        .select('id, title, description, latitude, longitude, area, city')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      setDeals(data || []);
    };

    fetchDeals();
  }, []);

  const openDirections = (lat: number, lng: number) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank'
    );
  };

  return (
    <main className="h-[calc(100vh-64px)]">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: 12.9716,
          longitude: 77.5946,
          zoom: 11,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v11"
      >
        {deals.map((deal) => (
          <Marker
            key={deal.id}
            latitude={deal.latitude}
            longitude={deal.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(deal);
            }}
          >
            <MapPinned className="text-red-600 cursor-pointer" />
          </Marker>
        ))}

        {selected && (
          <Popup
            latitude={selected.latitude}
            longitude={selected.longitude}
            onClose={() => setSelected(null)}
            closeOnClick={false}
          >
            <div className="text-sm">
              <h3 className="font-semibold">{selected.title}</h3>
              <p className="text-gray-600">{selected.description}</p>
              <p className="text-xs mt-1">
                📍 {selected.area}, {selected.city}
              </p>

              <button
                onClick={() =>
                  openDirections(selected.latitude, selected.longitude)
                }
                className="mt-2 text-blue-600 text-xs underline"
              >
                Get Directions
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </main>
  );
}
