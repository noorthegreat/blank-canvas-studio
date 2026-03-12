// For the admin panel, add venues to the database by searching.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')!;

        const authHeader = req.headers.get("Authorization");
        const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
            global: { headers: { Authorization: authHeader ?? "" } },
        });

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { data: hasAdminRole } = await supabaseClient.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
        });

        if (!hasAdminRole) {
            return new Response(
                JSON.stringify({ error: "Forbidden: Admin access required" }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { query } = await req.json();

        if (!query) {
            return new Response(
                JSON.stringify({ error: "Query is required" }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log(`Searching for venue: ${query}`);

        // 1. Search for the place
        const searchUrl = `https://places.googleapis.com/v1/places:searchText`;
        const searchResponse = await fetch(searchUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": googleApiKey,
                "X-Goog-FieldMask": "places.name,places.id,places.displayName,places.formattedAddress,places.types,places.websiteUri,places.regularOpeningHours,places.utcOffsetMinutes,places.location,places.photos"
            },
            body: JSON.stringify({
                textQuery: query,
                maxResultCount: 1
            })
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`Google API Error (Search): ${searchResponse.status} ${errorText}`);
        }

        const searchData = await searchResponse.json();
        const place = searchData.places?.[0];

        if (!place) {
            return new Response(
                JSON.stringify({ error: "No venue found" }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        console.log("Found place:", place.displayName?.text);

        // 2. Transform Data
        const name = place.displayName?.text || query;
        const address = place.formattedAddress || "";
        const website = place.websiteUri || "";
        const location = place.location; // { latitude: number, longitude: number }

        // Infer type
        const types = place.types || [];
        let type = "coffee";
        if (types.some((t: string) =>
            ['bar', 'night_club', 'casino', 'pub', 'wine_bar'].includes(t)
        )) {
            type = "bar";
        }

        // Process Hours
        const hours: Record<string, { start: number; end: number } | null> = {
            "0": null, "1": null, "2": null, "3": null, "4": null, "5": null, "6": null
        };

        if (place.regularOpeningHours?.periods) {
            place.regularOpeningHours.periods.forEach((period: any) => {
                if (period.open && period.close) {
                    const day = period.open.day.toString(); // 0 = Sunday
                    const startSlot = (period.open.hour * 2) + (period.open.minute >= 30 ? 1 : 0);
                    const endSlot = (period.close.hour * 2) + (period.close.minute >= 30 ? 1 : 0);

                    if (period.open.day === period.close.day) {
                        hours[day] = { start: startSlot, end: endSlot };
                    } else {
                        // Spans midnight.
                        hours[day] = { start: startSlot, end: 48 };
                    }
                }
            });
        }

        // Timezone
        let timezone = "UTC";
        console.log("Location:", location);
        if (location) {
            const timestamp = Math.floor(Date.now() / 1000);
            const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${location.latitude},${location.longitude}&timestamp=${timestamp}&key=${googleApiKey}`;
            const timezoneResponse = await fetch(timezoneUrl);

            if (timezoneResponse.ok) {
                const timezoneData = await timezoneResponse.json();
                if (timezoneData.timeZoneId) {
                    timezone = timezoneData.timeZoneId;
                } else {
                    console.warn("Timezone API returned no timeZoneId:", timezoneData);
                }
            } else {
                console.error("Timezone API failed:", await timezoneResponse.text());
            }
        }

        // Prepare hours_full (original hours) and truncated hours
        const hours_full = JSON.parse(JSON.stringify(hours));

        // Truncate hours based on type
        if (type === "coffee") {
            Object.keys(hours).forEach(day => {
                if (hours[day]) {
                    // Close by 4:30 PM (Slot 33)
                    const limit = 33;
                    if (hours[day]!.end > limit) {
                        const newEnd = limit;
                        if (hours[day]!.start >= newEnd) {
                            hours[day] = null;
                        } else {
                            hours[day]!.end = newEnd;
                        }
                    }
                }
            });
        } else if (type === "bar") {
            Object.keys(hours).forEach(day => {
                if (hours[day]) {
                    // Open at 5:00 PM (Slot 34)
                    const limit = 34;
                    if (hours[day]!.start < limit) {
                        const newStart = limit;
                        if (newStart >= hours[day]!.end) {
                            hours[day] = null;
                        } else {
                            hours[day]!.start = newStart;
                        }
                    }
                }
            });
        }

        // Photo Handling
        let imageUrl = "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=2000&auto=format&fit=crop";

        console.log("Photos:", place.photos);
        if (place.photos && place.photos.length > 0) {
            try {
                const photo = place.photos[0];
                const photoUrl = `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=800&maxWidthPx=1200&key=${googleApiKey}`;
                console.log("Fetching photo from:", photoUrl);

                const photoResponse = await fetch(photoUrl);
                if (photoResponse.ok) {
                    const photoBlob = await photoResponse.blob();
                    const fileName = `${place.id}_${Date.now()}.jpg`;

                    // Upload to Supabase Storage
                    const { data: uploadData, error: uploadError } = await supabaseClient
                        .storage
                        .from('venue-photos')
                        .upload(fileName, photoBlob, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (uploadError) {
                        console.error("Supabase Storage Upload Error:", uploadError);
                        // Verify bucket exists? For now assume it does or user created it as requested.
                    } else {
                        const { data: { publicUrl } } = supabaseClient
                            .storage
                            .from('venue-photos')
                            .getPublicUrl(fileName);

                        imageUrl = publicUrl;
                        console.log("Photo uploaded successfully:", imageUrl);
                    }
                } else {
                    console.error("Failed to fetch photo from Google:", await photoResponse.text());
                }
            } catch (err) {
                console.error("Error processing photo:", err);
            }
        }

        // 3. Insert
        const { data: insertedVenue, error: insertError } = await supabaseClient
            .from('venues')
            .insert({
                name,
                address,
                website,
                type,
                hours,
                hours_full,
                timezone,
                latitude: location?.latitude || null,
                longitude: location?.longitude || null,
                image: imageUrl,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error("Insert Error:", insertError);
            throw insertError;
        }

        return new Response(
            JSON.stringify({ success: true, venue: insertedVenue }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
