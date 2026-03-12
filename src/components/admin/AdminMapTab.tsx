import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
// Fix for default marker icon - imports needed if we were using default icons, 
// but we are using custom divIcons. 
// However, Leaflet might complain if images are missing. 
// Let's just focus on the custom icons used in the render loop.

import { useAdminProfiles } from "@/hooks/admin/useAdminProfiles";
import { useAdminVenues } from "@/hooks/admin/useAdminVenues";

export const AdminMapTab = () => {
    const { profiles, loading: profilesLoading } = useAdminProfiles();
    const { venues, loading: venuesLoading } = useAdminVenues();

    if (profilesLoading || venuesLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading map data...</div>;
    }
    return (
        <div className="space-y-6">
            <Card className="h-[600px] overflow-hidden">
                <MapContainer center={[39.8283, -98.5795]} zoom={4} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />

                    {profiles.map(profile => {
                        const imageUrl = profile.photo_url ||
                            (profile.additional_photos && profile.additional_photos.length > 0 ? profile.additional_photos[0] : null) ||
                            "https://github.com/shadcn.png";

                        const userIcon = L.divIcon({
                            className: 'bg-transparent',
                            html: `<div class="w-12 h-12 rounded-full border-4 border-blue-500 overflow-hidden shadow-lg bg-white">
                               <img src="${imageUrl}" class="w-full h-full object-cover" />
                             </div>`,
                            iconSize: [48, 48],
                            iconAnchor: [24, 24],
                            popupAnchor: [0, -24]
                        });

                        // Deterministic jitter
                        const getJitteredPosition = (lat: number, lng: number, id: string): [number, number] => {
                            const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            const jitterlat = ((hash % 100) / 100 - 0.5) * 0.005; // +/- 0.0025 degrees
                            const jitterlng = (((hash * 13) % 100) / 100 - 0.5) * 0.005;
                            return [lat + jitterlat + Math.random() * 0.001, lng + jitterlng + Math.random() * 0.001];
                        };

                        const position = getJitteredPosition(profile.latitude, profile.longitude, profile.id);


                        return (
                            profile.latitude && profile.longitude && (
                                <Marker
                                    key={`profile-${profile.id}`}
                                    position={position}
                                    icon={userIcon}
                                >
                                    <Popup>
                                        <strong>{profile.first_name} {profile.last_name}</strong>
                                        <br />
                                        User
                                    </Popup>
                                </Marker>
                            )
                        );
                    })}

                    {venues.map(venue => {
                        const venueIcon = L.divIcon({
                            className: 'bg-transparent',
                            html: `<div class="w-12 h-12 rounded-full border-4 border-violet-500 overflow-hidden shadow-lg bg-white">
                               <img src="${venue.image || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2000&auto=format&fit=crop"}" class="w-full h-full object-cover" />
                             </div>`,
                            iconSize: [48, 48],
                            iconAnchor: [24, 24],
                            popupAnchor: [0, -24]
                        });

                        // Deterministic jitter
                        const getJitteredPosition = (lat: number, lng: number, id: string): [number, number] => {
                            const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            const jitterlat = ((hash % 100) / 100 - 0.5) * 0.005;
                            const jitterlng = (((hash * 13) % 100) / 100 - 0.5) * 0.005;
                            return [lat + jitterlat, lng + jitterlng];
                        };

                        const position = getJitteredPosition(venue.latitude, venue.longitude, venue.id);

                        return (
                            venue.latitude && venue.longitude && (
                                <Marker
                                    key={`venue-${venue.id}`}
                                    position={position}
                                    icon={venueIcon}
                                >
                                    <Popup>
                                        <strong>{venue.name}</strong>
                                        <br />
                                        {venue.type} Venue
                                    </Popup>
                                </Marker>
                            )
                        );
                    })}
                </MapContainer>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Missing Location Data</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase">Users without location</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {profiles.filter(p => !p.latitude || !p.longitude).map(p => (
                                    <div key={p.id} className="p-2 bg-muted rounded text-sm flex justify-between">
                                        <span>{p.first_name} {p.last_name}</span>
                                        <span className="text-xs text-primary font-mono">No Lat/Lng</span>
                                    </div>
                                ))}
                                {profiles.filter(p => !p.latitude || !p.longitude).length === 0 && (
                                    <p className="text-sm text-muted-foreground">All users have location data.</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold mb-2 text-sm text-muted-foreground uppercase">Venues without location</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {venues.filter(v => !v.latitude || !v.longitude).map(v => (
                                    <div key={v.id} className="p-2 bg-muted rounded text-sm flex justify-between">
                                        <span>{v.name}</span>
                                        <span className="text-xs text-primary font-mono">No Lat/Lng</span>
                                    </div>
                                ))}
                                {venues.filter(v => !v.latitude || !v.longitude).length === 0 && (
                                    <p className="text-sm text-muted-foreground">All venues have location data.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
