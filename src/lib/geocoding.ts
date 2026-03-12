export const getCityFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const address = data.address;
    
    // Try to get city, town, village, or municipality
    const city = address.city || 
                 address.town || 
                 address.village || 
                 address.municipality ||
                 address.county;
    
    return city || null;
  } catch (error) {
    console.error("Error fetching city:", error);
    return null;
  }
};
